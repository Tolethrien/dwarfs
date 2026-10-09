import Aurora from "@aurora/core";
import AxiomMath from "@axiom/math";
import Vec2 from "@axiom/vec2";
import PragmaSystem from "@pragma/system";
import { Draw, Light } from "@aurora/urp/draw/draw";
import { Camera } from "@engine/camera/camera";
import { getVariantCrop, hasGraphics } from "@sandbox/content/blocks";
import { SPRITES } from "@sandbox/content/sprites";
import { RENDER_ORDER } from "@sandbox/configs";
import Materials from "@sandbox/shaders/materials";
import TileMask from "@sandbox/shaders/tileMask";
import type World from "@sandbox/world/world";
import SoundBank from "@sandbox/audio/soundBank";
import { SoundsID } from "@sandbox/content/sounds";
import Terrain, {
  type TileContact,
  type TileDamagedEvent,
  type TileDeflectedEvent,
  type TileMinedEvent,
} from "./terrain";

const EFFECTS = {
  // the particles quad, in tiles around the hit: holds nearly all of a burst (particles.wgsl),
  // a chip falling out of it is cut off while it fades
  particleTiles: 6,
  // tiles this far outside the view still get their effect (camera moving towards them)
  marginTiles: 2,
  // camera trauma of a mined tile: a small knock, several in a row add up
  mineShake: 0.12,
  // the ambient loop, it fades out when the game scene closes
  ambientVolume: 0.5,
  ambientFadeSeconds: 1,
  // frame.time wraps at this (sharedBinds.ts TIME_WRAP)
  timeWrap: 3600,
};

// speeds in world units per second, away from the final hit; small shards fly faster
const SHARDS = {
  seconds: 0.8,
  // last share of the life spent fading out
  fade: 0.4,
  speed: [140, 320],
  smallBoost: 0.8,
  kick: [60, 180],
  // radians per second, either way
  spin: 5,
  gravity: 1500,
} as const;

type BurstKind = "sparks" | "chips" | "rubble" | "dust" | "sift";
const BURST_SECONDS: Record<BurstKind, number> = {
  sparks: 0.45,
  chips: 0.8,
  rubble: 0.9,
  dust: 0.7,
  sift: 1.4,
};

// a short warm light where a tile was hit, gone in a moment: the cave walls pulse while digging
type FlashKind = "hit" | "mined" | "deflected";
const FLASH: Record<FlashKind, { radius: number; intensity: number; seconds: number }> = {
  hit: { radius: 260, intensity: 1.3, seconds: 0.22 },
  mined: { radius: 360, intensity: 2.2, seconds: 0.3 },
  deflected: { radius: 160, intensity: 0.6, seconds: 0.15 },
};
const FLASH_COLOR: RGBA = [255, 200, 140, 255];

interface Flash {
  kind: FlashKind;
  x: number;
  y: number;
  bornAt: number;
}
// a hit that did nothing: the damage sound, quieter, until it has its own
const DEFLECT_VOLUME = 0.3;

interface Burst {
  kind: BurstKind;
  x: number;
  y: number;
  bornAt: number;
  seed: number;
  // radians, the surface normal the particles fly along
  angle: number;
}

interface FlyingShard {
  gx: number;
  gy: number;
  type: number;
  variant: number;
  // crack cell lattice coords (tileShard params)
  cell: Position2D;
  // where its middle sat in the world
  center: Position2D;
  velocity: Position2D;
  spin: number;
  bornAt: number;
}

// presentation: what happens to tiles on screen, no actors. A mined tile is air in the World at
// once, here it still breaks along its cracks into shards flying off the final hit; a hit knocks
// off chips and a few sparks; both make sound
export default class MapEffects extends PragmaSystem {
  declare private world: World;
  private shards: FlyingShard[] = [];
  private bursts: Burst[] = [];
  private flashes: Flash[] = [];
  // the mine's ambient loop, for as long as the game scene lives
  private ambient: ReturnType<typeof SoundBank.loopSound>;

  constructor(internal: InternalPSProps) {
    super(internal);
  }

  awake(): void {
    this.onSceneEvent<TileMinedEvent>("tileMined", (event) => this.onMined(event));
    this.onSceneEvent<TileDamagedEvent>("tileDamaged", (event) => this.onDamaged(event));
    this.onSceneEvent<TileDeflectedEvent>("tileDeflected", (event) => this.onDeflected(event));
    this.ambient = SoundBank.loopSound(SoundsID.ambientNew, { volume: EFFECTS.ambientVolume });
  }

  destroy(): void {
    this.ambient?.fadeOutAndStop(EFFECTS.ambientFadeSeconds);
  }

  start(): void {
    this.world = this.scene.getSystem(Terrain).world;
  }

  render(): void {
    const now = Aurora.getGameTime;
    this.renderShards(now);
    this.renderBursts(now);
    this.renderFlashes(now);
  }

  // fades on a square curve: bright at once, a quick tail
  private renderFlashes(now: number) {
    let kept = 0;
    for (const flash of this.flashes) {
      const look = FLASH[flash.kind];
      let age = now - flash.bornAt;
      if (age < 0) age += EFFECTS.timeWrap;
      if (age >= look.seconds) continue;
      this.flashes[kept++] = flash;
      const left = 1 - age / look.seconds;
      Light.point({
        position: { x: flash.x, y: flash.y },
        radius: look.radius,
        color: FLASH_COLOR,
        intensity: look.intensity * left * left,
      });
    }
    this.flashes.length = kept;
  }

  private pushFlash(kind: FlashKind, point: Position2D) {
    this.flashes.push({ kind, x: point.x, y: point.y, bornAt: Aurora.getGameTime });
  }

  // a shard turns around its own middle, the sprite around the tile's: the sprite is moved by
  // what the turn shifts the shard's middle
  private renderShards(now: number) {
    let kept = 0;
    for (const shard of this.shards) {
      let age = now - shard.bornAt;
      if (age < 0) age += EFFECTS.timeWrap;
      if (age >= SHARDS.seconds) continue;
      this.shards[kept++] = shard;

      const tileCenter = this.world.tileCenterToWorld({ x: shard.gx, y: shard.gy });
      const fromTile = { x: shard.center.x - tileCenter.x, y: shard.center.y - tileCenter.y };
      const angle = shard.spin * age;
      const cos = Math.cos(angle);
      const sin = Math.sin(angle);
      const moved = {
        x: shard.velocity.x * age + fromTile.x - (fromTile.x * cos - fromTile.y * sin),
        y: shard.velocity.y * age + 0.5 * SHARDS.gravity * age * age + fromTile.y - (fromTile.x * sin + fromTile.y * cos),
      };
      const alpha = AxiomMath.clamp((1 - age / SHARDS.seconds) / SHARDS.fade, 0, 1);
      const corner = this.world.tileToWorld({ x: shard.gx, y: shard.gy });
      const crop = getVariantCrop(shard.type, shard.variant);
      Draw.sprite({
        position: { x: corner.x + moved.x, y: corner.y + moved.y, z: RENDER_ORDER.main },
        crop,
        texture: SPRITES.blocks,
        size: { width: crop.width, height: crop.height },
        rotation: angle,
        tint: [255, 255, 255, Math.round(255 * alpha)],
        material: TileMask.shard,
        params: [shard.gx, shard.gy, shard.cell.x, shard.cell.y],
      });
    }
    this.shards.length = kept;
  }

  private renderBursts(now: number) {
    const tile = this.world.meta.tileInPixels;
    const size = { width: tile.width * EFFECTS.particleTiles, height: tile.height * EFFECTS.particleTiles };
    let kept = 0;
    for (const burst of this.bursts) {
      const seconds = BURST_SECONDS[burst.kind];
      let age = now - burst.bornAt;
      if (age < 0) age += EFFECTS.timeWrap;
      if (age >= seconds) continue;
      this.bursts[kept++] = burst;
      Draw.rect({
        position: {
          x: burst.x - size.width / 2,
          y: burst.y - size.height / 2,
          z: RENDER_ORDER.decoFront,
        },
        size,
        material: Materials[burst.kind],
        params: [burst.bornAt, seconds, burst.seed, burst.angle],
      });
    }
    this.bursts.length = kept;
  }

  private onDamaged(event: TileDamagedEvent) {
    if (!this.onScreen(event.gx, event.gy)) return;
    const hit = this.hitOf(event.gx, event.gy, event.contact);
    this.pushBurst("chips", hit.point, hit.angle);
    this.pushBurst("sparks", hit.point, hit.angle);
    this.pushFlash("hit", hit.point);
    SoundBank.playSound(SoundsID.blockDamage, { position: hit.point });
  }

  private onDeflected(event: TileDeflectedEvent) {
    if (!this.onScreen(event.gx, event.gy)) return;
    const hit = this.hitOf(event.gx, event.gy, event.contact);
    this.pushBurst("dust", hit.point, hit.angle);
    this.pushFlash("deflected", hit.point);
    SoundBank.playSound(SoundsID.blockDamage, { position: hit.point, volume: DEFLECT_VOLUME });
  }

  // not hit by a ball: from the middle, upwards
  private hitOf(gx: number, gy: number, contact?: TileContact) {
    const point = contact?.point ?? this.world.tileCenterToWorld({ x: gx, y: gy });
    const normal = contact?.normal ?? { x: 0, y: -1 };
    return { point, angle: Math.atan2(normal.y, normal.x) };
  }

  // not mined by a ball: blown apart from the middle, the kick still sends the shards up
  private onMined(event: TileMinedEvent) {
    if (!this.onScreen(event.gx, event.gy)) return;
    const tile = { x: event.gx, y: event.gy };
    const tileCenter = this.world.tileCenterToWorld(tile);
    const impact = event.impact ?? tileCenter;
    const size = this.world.meta.tileInPixels;
    const corner = this.world.tileToWorld(tile);
    const bornAt = Aurora.getGameTime;

    for (const shard of TileMask.shardsOf(event.gx, event.gy)) {
      const center = {
        x: corner.x + shard.center.x * size.width,
        y: corner.y + shard.center.y * size.height,
      };
      const away = Vec2.create(center.x - impact.x, center.y - impact.y);
      if (away.isZero()) away.set(0, -1);
      away.normalize();
      const speed =
        AxiomMath.randomFloat(SHARDS.speed[0], SHARDS.speed[1]) * (1 + (1 - shard.share) * SHARDS.smallBoost);
      this.shards.push({
        gx: event.gx,
        gy: event.gy,
        type: event.type,
        variant: event.variant,
        cell: shard.cell,
        center,
        velocity: {
          x: away.x * speed,
          y: away.y * speed - AxiomMath.randomFloat(SHARDS.kick[0], SHARDS.kick[1]),
        },
        spin: AxiomMath.randomFloat(-SHARDS.spin, SHARDS.spin),
        bornAt,
      });
    }

    // the rubble flies on, away from the hit
    const angle = event.impact ? Math.atan2(tileCenter.y - impact.y, tileCenter.x - impact.x) : -Math.PI / 2;
    this.pushBurst("rubble", impact, angle);
    this.pushFlash("mined", tileCenter);
    // the rock over the new hole sheds a little dust
    if (hasGraphics(this.world.getType(event.gx, event.gy - 1)))
      this.pushBurst("sift", { x: tileCenter.x, y: corner.y }, Math.PI / 2);
    Camera.shake(EFFECTS.mineShake);
    SoundBank.playSound(SoundsID.blockDestroy, { volume: 0.5 });
  }

  private pushBurst(kind: BurstKind, point: Position2D, angle: number) {
    this.bursts.push({
      kind,
      x: point.x,
      y: point.y,
      bornAt: Aurora.getGameTime,
      // look only, no need for the world seed
      seed: Math.floor(Math.random() * 100000),
      angle,
    });
  }

  private onScreen(gx: number, gy: number) {
    const view = Camera.getViewBounds;
    const tile = this.world.meta.tileInPixels;
    const corner = this.world.tileToWorld({ x: gx, y: gy });
    const marginX = tile.width * EFFECTS.marginTiles;
    const marginY = tile.height * EFFECTS.marginTiles;
    return !(
      corner.x + tile.width < view.min.x - marginX ||
      corner.y + tile.height < view.min.y - marginY ||
      corner.x > view.max.x + marginX ||
      corner.y > view.max.y + marginY
    );
  }
}
