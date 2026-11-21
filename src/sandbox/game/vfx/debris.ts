import AxiomMath from "@axiom/math";
import { Draw } from "@aurora/urp/draw/draw";
import { Camera } from "@engine/camera/camera";
import ROCK_SHEET from "@sandbox/assets/rocks/rocks-spritesheet.json";
import { BLOCK_CROPS } from "../content/blocks";
import { RENDER_SHEET, SORT_ORDER } from "../content/render";
import type { TileStruck } from "../systems/world/terrain";
import ParticlePool from "./pool";
import { solidAt, type VfxConnect, type VfxContext, type VfxLayer } from "./vfx";

// force: 0 a block barely broken (ratio 1, or worn down by earlier hits), 1 broken with fullForce
// times its strength or more, or by a piercing ball; the share of pieces pushed along the flight
// grows with it, the rest falls out of the face
const DEBRIS = {
  capacity: 3000,
  viewMargin: 200,
  fullForce: 2,
  count: { weak: 5, strong: 28 },
  size: { weak: [22, 34], strong: [6, 14] },
  speed: { weak: [60, 160], strong: [260, 620] },
  spread: { face: 0.9, flight: 0.45 },
  spin: { weak: 3, strong: 14 },
  gravity: 1800,
  bounce: 0.35,
  friction: 0.6,
  settleSpeed: 40,
  maxFlightSeconds: 4,
  restSeconds: 3,
  fadeSeconds: 0.6,
  // a piece collides by a point this share of its half size from its middle
  hitbox: 0.7,
};

const FIELDS = [
  "x",
  "y",
  "vx",
  "vy",
  "angle",
  "spin",
  "size",
  "cropX",
  "cropY",
  "cropSize",
  "age",
  // -1 while flying, then seconds lying still
  "rest",
] as const;

export default class DebrisLayer implements VfxLayer {
  private readonly pool = new ParticlePool(DEBRIS.capacity, FIELDS);
  private sheetScale = 1;
  // one props object for every piece: render is a hot path, Draw copies what it needs
  private readonly sprite = {
    position: { x: 0, y: 0, z: SORT_ORDER.debris },
    size: { width: 0, height: 0 },
    crop: { x: 0, y: 0, width: 0, height: 0 },
    tint: [255, 255, 255, 255] as RGBA,
    texture: RENDER_SHEET.rocks,
    rotation: 0,
  };

  public attach(ctx: VfxContext, connect: VfxConnect) {
    this.sheetScale = ctx.tile / ROCK_SHEET.tileSize;
    connect(ctx.events.terrain.mined, (tile) => this.burst(tile, ctx));
  }

  public burst(tile: TileStruck, ctx: VfxContext) {
    const crops = BLOCK_CROPS[tile.type];
    if (!crops) return;
    const tileSize = ctx.tile;
    const baseX = tile.gx * tileSize;
    const baseY = tile.gy * tileSize;
    if (!ctx.inView(baseX, baseY, tileSize, tileSize, DEBRIS.viewMargin)) return;

    const force = tile.hit.piercing ? 1 : AxiomMath.clamp(AxiomMath.inverseLerp(1, DEBRIS.fullForce, tile.ratio), 0, 1);
    const count = Math.round(AxiomMath.lerp(DEBRIS.count.weak, DEBRIS.count.strong, force));
    const faceAngle = Math.atan2(tile.hit.normal.y, tile.hit.normal.x);
    const flightAngle = Math.atan2(tile.hit.direction.y, tile.hit.direction.x);
    const minSize = AxiomMath.lerp(DEBRIS.size.weak[0], DEBRIS.size.strong[0], force);
    const maxSize = AxiomMath.lerp(DEBRIS.size.weak[1], DEBRIS.size.strong[1], force);
    const minSpeed = AxiomMath.lerp(DEBRIS.speed.weak[0], DEBRIS.speed.strong[0], force);
    const maxSpeed = AxiomMath.lerp(DEBRIS.speed.weak[1], DEBRIS.speed.strong[1], force);
    const spin = AxiomMath.lerp(DEBRIS.spin.weak, DEBRIS.spin.strong, force);

    const pieces = this.pool.data;
    for (let piece = 0; piece < count; piece++) {
      const alongFlight = Math.random() < force;
      const spread = alongFlight ? DEBRIS.spread.flight : DEBRIS.spread.face;
      const angle = (alongFlight ? flightAngle : faceAngle) + AxiomMath.randomFloat(-spread, spread);
      const speed = AxiomMath.randomFloat(minSpeed, maxSpeed);
      const size = AxiomMath.randomFloat(minSize, maxSize);
      const crop = crops[AxiomMath.randomInt(0, crops.length - 1)];
      const cropSize = Math.min(size / this.sheetScale, crop.width);
      const half = size / 2;
      const index = this.pool.alloc();
      pieces.x[index] = baseX + AxiomMath.randomFloat(half, tileSize - half);
      pieces.y[index] = baseY + AxiomMath.randomFloat(half, tileSize - half);
      pieces.vx[index] = Math.cos(angle) * speed;
      pieces.vy[index] = Math.sin(angle) * speed;
      pieces.angle[index] = Math.random() * Math.PI * 2;
      pieces.spin[index] = AxiomMath.randomFloat(-spin, spin);
      pieces.size[index] = size;
      pieces.cropX[index] = crop.x + AxiomMath.randomFloat(0, crop.width - cropSize);
      pieces.cropY[index] = crop.y + AxiomMath.randomFloat(0, crop.height - cropSize);
      pieces.cropSize[index] = cropSize;
      pieces.age[index] = 0;
      pieces.rest[index] = -1;
    }
  }

  public update(delta: number, _rawDelta: number, ctx: VfxContext) {
    if (delta === 0 || this.pool.count === 0) return;
    const pieces = this.pool.data;
    const world = ctx.world;
    const tile = ctx.tile;
    let index = 0;
    while (index < this.pool.count) {
      pieces.age[index] += delta;
      if (pieces.rest[index] >= 0 && pieces.rest[index] < DEBRIS.restSeconds) {
        const reach = (pieces.size[index] / 2) * DEBRIS.hitbox;
        // the block under a lying piece can be mined away: then it falls again
        if (!solidAt(world, tile, pieces.x[index], pieces.y[index] + reach + 1)) {
          pieces.rest[index] = -1;
          pieces.age[index] = 0;
        }
      }
      if (pieces.rest[index] >= 0) {
        pieces.rest[index] += delta;
        if (pieces.rest[index] >= DEBRIS.restSeconds + DEBRIS.fadeSeconds) {
          this.pool.remove(index);
          continue;
        }
        index++;
        continue;
      }
      this.fly(index, delta, ctx);
      index++;
    }
  }

  private fly(index: number, delta: number, ctx: VfxContext) {
    const pieces = this.pool.data;
    const world = ctx.world;
    const tile = ctx.tile;
    const reach = (pieces.size[index] / 2) * DEBRIS.hitbox;
    pieces.vy[index] += DEBRIS.gravity * delta;
    pieces.angle[index] += pieces.spin[index] * delta;

    const x = pieces.x[index];
    const y = pieces.y[index];
    const nextX = x + pieces.vx[index] * delta;
    if (solidAt(world, tile, nextX + Math.sign(pieces.vx[index]) * reach, y)) {
      pieces.vx[index] *= -DEBRIS.bounce;
      pieces.spin[index] *= DEBRIS.friction;
    } else pieces.x[index] = nextX;

    const nextY = y + pieces.vy[index] * delta;
    const falling = pieces.vy[index] > 0;
    if (solidAt(world, tile, pieces.x[index], nextY + Math.sign(pieces.vy[index]) * reach)) {
      pieces.vy[index] *= -DEBRIS.bounce;
      if (falling) {
        pieces.vx[index] *= DEBRIS.friction;
        pieces.spin[index] *= DEBRIS.friction;
        // set down on the floor: stopped a frame's fall above it, lying check would not find it
        // and throw it up again, over and over
        if (Math.abs(pieces.vy[index]) < DEBRIS.settleSpeed) {
          const floor = Math.floor((nextY + reach) / tile) * tile;
          pieces.y[index] = floor - reach - 0.5;
          pieces.rest[index] = 0;
        }
      }
    } else pieces.y[index] = nextY;

    // fell into a shaft or stuck between walls: it fades out where it is
    if (pieces.age[index] > DEBRIS.maxFlightSeconds) pieces.rest[index] = DEBRIS.restSeconds;
  }

  public render() {
    if (this.pool.count === 0) return;
    const view = Camera.getViewBounds;
    const margin = DEBRIS.viewMargin;
    const pieces = this.pool.data;
    const sprite = this.sprite;
    for (let index = 0; index < this.pool.count; index++) {
      const x = pieces.x[index];
      const y = pieces.y[index];
      if (x < view.min.x - margin || x > view.max.x + margin || y < view.min.y - margin || y > view.max.y + margin)
        continue;
      const fading = AxiomMath.clamp((pieces.rest[index] - DEBRIS.restSeconds) / DEBRIS.fadeSeconds, 0, 1);
      const size = pieces.size[index] * (1 - fading * 0.5);
      sprite.position.x = x - size / 2;
      sprite.position.y = y - size / 2;
      sprite.size.width = size;
      sprite.size.height = size;
      sprite.crop.x = pieces.cropX[index];
      sprite.crop.y = pieces.cropY[index];
      sprite.crop.width = pieces.cropSize[index];
      sprite.crop.height = pieces.cropSize[index];
      sprite.rotation = pieces.angle[index];
      sprite.tint[3] = Math.round(255 * (1 - fading));
      Draw.sprite(sprite);
    }
  }

  public clear() {
    this.pool.clear();
  }
}
