import PragmaSystem from "@pragma/system";
import AxiomMath from "@axiom/math";
import Time from "@engine/time";
import { Camera } from "@engine/camera/camera";
import { Draw } from "@aurora/urp/draw/draw";
import ROCK_SHEET from "@sandbox/assets/rocks/rocks-spritesheet.json";
import { BLOCK_CROPS, BLOCKS } from "../content/blocks";
import { RENDER_SHEET, SORT_ORDER } from "../content/render";
import type World from "../world/world";
import { MAP_LOOK } from "../gpu/gameGlobals";
import GameEvents from "./gameEvents";
import MapView from "./mapView";
import type { TileStruck } from "./terrain";

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

export default class Debris extends PragmaSystem {
  private readonly pieces = {
    x: new Float32Array(DEBRIS.capacity),
    y: new Float32Array(DEBRIS.capacity),
    vx: new Float32Array(DEBRIS.capacity),
    vy: new Float32Array(DEBRIS.capacity),
    angle: new Float32Array(DEBRIS.capacity),
    spin: new Float32Array(DEBRIS.capacity),
    size: new Float32Array(DEBRIS.capacity),
    cropX: new Float32Array(DEBRIS.capacity),
    cropY: new Float32Array(DEBRIS.capacity),
    cropSize: new Float32Array(DEBRIS.capacity),
    age: new Float32Array(DEBRIS.capacity),
    // -1 while flying, then seconds lying still
    rest: new Float32Array(DEBRIS.capacity),
  };
  private readonly columns = Object.values(this.pieces);
  private count = 0;
  // with the pool full a new piece takes this slot, going round
  private replace = 0;
  private readonly tile: number;
  private readonly sheetScale: number;
  // one props object for every piece: render is a hot path, Draw copies what it needs
  private readonly sprite = {
    position: { x: 0, y: 0, z: SORT_ORDER.debris },
    size: { width: 0, height: 0 },
    crop: { x: 0, y: 0, width: 0, height: 0 },
    tint: [255, 255, 255, 255] as RGBA,
    texture: RENDER_SHEET.rocks,
    rotation: 0,
  };
  private readonly tileBox: Box = { x: 0, y: 0, w: 0, h: 0 };
  declare private mapView: MapView;

  constructor(
    internal: InternalPSProps,
    private readonly world: World,
  ) {
    super(internal);
    this.tile = world.meta.tileInPixels;
    this.sheetScale = this.tile / ROCK_SHEET.tileSize;
  }

  awake(): void {
    this.mapView = this.scene.getSystem(MapView);
    const events = this.scene.getSystem(GameEvents);
    events.terrain.mined.connect((tile) => this.burst(tile));
  }

  // the dust also off screen: it still hangs there when the camera comes
  private burst(tile: TileStruck) {
    const force = tile.hit.piercing ? 1 : AxiomMath.clamp(AxiomMath.inverseLerp(1, DEBRIS.fullForce, tile.ratio), 0, 1);
    const dust = MAP_LOOK.dust.perBreak;
    this.mapView.addDust(tile.gx, tile.gy, AxiomMath.lerp(dust.weak, dust.strong, force));

    const crops = BLOCK_CROPS[tile.type];
    if (!crops) return;
    const box = this.tileBox;
    box.x = tile.gx * this.tile;
    box.y = tile.gy * this.tile;
    box.w = this.tile;
    box.h = this.tile;
    if (!Camera.isInView(box, DEBRIS.viewMargin)) return;

    const count = Math.round(AxiomMath.lerp(DEBRIS.count.weak, DEBRIS.count.strong, force));
    const faceAngle = Math.atan2(tile.hit.normal.y, tile.hit.normal.x);
    const flightAngle = Math.atan2(tile.hit.direction.y, tile.hit.direction.x);
    const minSize = AxiomMath.lerp(DEBRIS.size.weak[0], DEBRIS.size.strong[0], force);
    const maxSize = AxiomMath.lerp(DEBRIS.size.weak[1], DEBRIS.size.strong[1], force);
    const minSpeed = AxiomMath.lerp(DEBRIS.speed.weak[0], DEBRIS.speed.strong[0], force);
    const maxSpeed = AxiomMath.lerp(DEBRIS.speed.weak[1], DEBRIS.speed.strong[1], force);
    const spin = AxiomMath.lerp(DEBRIS.spin.weak, DEBRIS.spin.strong, force);

    for (let piece = 0; piece < count; piece++) {
      const alongFlight = Math.random() < force;
      const spread = alongFlight ? DEBRIS.spread.flight : DEBRIS.spread.face;
      const angle = (alongFlight ? flightAngle : faceAngle) + AxiomMath.randomFloat(-spread, spread);
      const speed = AxiomMath.randomFloat(minSpeed, maxSpeed);
      const size = AxiomMath.randomFloat(minSize, maxSize);
      const crop = crops[AxiomMath.randomInt(0, crops.length - 1)];
      const cropSize = Math.min(size / this.sheetScale, crop.width);
      const half = size / 2;
      this.add(
        box.x + AxiomMath.randomFloat(half, this.tile - half),
        box.y + AxiomMath.randomFloat(half, this.tile - half),
        Math.cos(angle) * speed,
        Math.sin(angle) * speed,
        AxiomMath.randomFloat(-spin, spin),
        size,
        crop.x + AxiomMath.randomFloat(0, crop.width - cropSize),
        crop.y + AxiomMath.randomFloat(0, crop.height - cropSize),
        cropSize,
      );
    }
  }

  private add(
    x: number,
    y: number,
    vx: number,
    vy: number,
    spin: number,
    size: number,
    cropX: number,
    cropY: number,
    cropSize: number,
  ) {
    let index = this.count;
    if (index < DEBRIS.capacity) this.count++;
    else {
      index = this.replace;
      this.replace = (this.replace + 1) % DEBRIS.capacity;
    }
    const pieces = this.pieces;
    pieces.x[index] = x;
    pieces.y[index] = y;
    pieces.vx[index] = vx;
    pieces.vy[index] = vy;
    pieces.angle[index] = Math.random() * Math.PI * 2;
    pieces.spin[index] = spin;
    pieces.size[index] = size;
    pieces.cropX[index] = cropX;
    pieces.cropY[index] = cropY;
    pieces.cropSize[index] = cropSize;
    pieces.age[index] = 0;
    pieces.rest[index] = -1;
  }

  update(): void {
    const delta = Time.getDeltaTime();
    if (delta === 0) return;
    const pieces = this.pieces;
    let index = 0;
    while (index < this.count) {
      pieces.age[index] += delta;
      if (pieces.rest[index] >= 0 && pieces.rest[index] < DEBRIS.restSeconds && !this.lying(index)) {
        pieces.rest[index] = -1;
        pieces.age[index] = 0;
      }
      if (pieces.rest[index] >= 0) {
        pieces.rest[index] += delta;
        if (pieces.rest[index] >= DEBRIS.restSeconds + DEBRIS.fadeSeconds) {
          this.remove(index);
          continue;
        }
        index++;
        continue;
      }
      this.fly(index, delta);
      index++;
    }
  }

  private fly(index: number, delta: number) {
    const pieces = this.pieces;
    const reach = (pieces.size[index] / 2) * DEBRIS.hitbox;
    pieces.vy[index] += DEBRIS.gravity * delta;
    pieces.angle[index] += pieces.spin[index] * delta;

    const x = pieces.x[index];
    const y = pieces.y[index];
    const nextX = x + pieces.vx[index] * delta;
    if (this.solidAt(nextX + Math.sign(pieces.vx[index]) * reach, y)) {
      pieces.vx[index] *= -DEBRIS.bounce;
      pieces.spin[index] *= DEBRIS.friction;
    } else pieces.x[index] = nextX;

    const nextY = y + pieces.vy[index] * delta;
    const falling = pieces.vy[index] > 0;
    if (this.solidAt(pieces.x[index], nextY + Math.sign(pieces.vy[index]) * reach)) {
      pieces.vy[index] *= -DEBRIS.bounce;
      if (falling) {
        pieces.vx[index] *= DEBRIS.friction;
        pieces.spin[index] *= DEBRIS.friction;
        if (Math.abs(pieces.vy[index]) < DEBRIS.settleSpeed) pieces.rest[index] = 0;
      }
    } else pieces.y[index] = nextY;

    // fell into a shaft or stuck between walls: it fades out where it is
    if (pieces.age[index] > DEBRIS.maxFlightSeconds) pieces.rest[index] = DEBRIS.restSeconds;
  }

  // the block under a lying piece can be mined away: then it falls again
  private lying(index: number) {
    const reach = (this.pieces.size[index] / 2) * DEBRIS.hitbox;
    return this.solidAt(this.pieces.x[index], this.pieces.y[index] + reach + 1);
  }

  // inline instead of worldToTile: per piece per frame, no object per call
  private solidAt(x: number, y: number) {
    return BLOCKS[this.world.getType(Math.floor(x / this.tile), Math.floor(y / this.tile))].solid;
  }

  private remove(index: number) {
    const last = --this.count;
    if (index !== last) for (const column of this.columns) column[index] = column[last];
    if (this.replace >= this.count) this.replace = 0;
  }

  render(): void {
    const view = Camera.getViewBounds;
    const margin = DEBRIS.viewMargin;
    const pieces = this.pieces;
    const sprite = this.sprite;
    for (let index = 0; index < this.count; index++) {
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
}
