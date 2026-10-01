import Aurora from "@aurora/core";
import PragmaSystem from "@pragma/system";
import { Draw } from "@aurora/urp/draw/draw";
import { Camera } from "@engine/camera/camera";
import { getVariantCrop } from "@sandbox/content/blocks";
import { SPRITES } from "@sandbox/content/sprites";
import { RENDER_ORDER } from "@sandbox/configs";
import Materials from "@sandbox/shaders/materials";
import type World from "@sandbox/world/world";
import SoundBank from "@sandbox/audio/soundBank";
import { SoundsID } from "@sandbox/content/sounds";
import Terrain, { type TileDamagedEvent, type TileMinedEvent } from "./terrain";

const EFFECTS = {
  dissolveSeconds: 0.4,
  sparkSeconds: 0.3,
  // the sparks quad, in tiles around the hit: must hold the furthest spark (sparks.wgsl)
  sparkTiles: 3,
  // tiles this far outside the view still get their effect (camera moving towards them)
  marginTiles: 2,
  // frame.time wraps at this (sharedBinds.ts TIME_WRAP)
  timeWrap: 3600,
};

interface Spark {
  x: number;
  y: number;
  bornAt: number;
  seed: number;
}

interface DyingTile {
  gx: number;
  gy: number;
  type: number;
  variant: number;
  diedAt: number;
}

// presentation: what happens to tiles on screen, no actors. A mined tile is air in the World at
// once, here it is still drawn falling apart for a moment; a hit throws sparks; both make sound
export default class MapEffects extends PragmaSystem {
  declare private world: World;
  private dying: DyingTile[] = [];
  private sparks: Spark[] = [];

  constructor(internal: InternalPSProps) {
    super(internal);
  }

  awake(): void {
    this.onSceneEvent<TileMinedEvent>("tileMined", (event) => this.onMined(event));
    this.onSceneEvent<TileDamagedEvent>("tileDamaged", (event) => this.onDamaged(event));
  }

  start(): void {
    this.world = this.scene.getSystem(Terrain).world;
  }

  render(): void {
    const now = Aurora.getGameTime;
    let kept = 0;
    for (const tile of this.dying) {
      let age = now - tile.diedAt;
      if (age < 0) age += EFFECTS.timeWrap;
      if (age >= EFFECTS.dissolveSeconds) continue;
      this.dying[kept++] = tile;

      const crop = getVariantCrop(tile.type, tile.variant);
      const position = this.world.tileToWorld({ x: tile.gx, y: tile.gy });
      Draw.sprite({
        position: { x: position.x, y: position.y, z: RENDER_ORDER.solidTiles },
        crop,
        texture: SPRITES.blocks,
        size: { width: crop.width, height: crop.height },
        material: Materials.tileDissolve,
        params: [tile.diedAt, EFFECTS.dissolveSeconds, 0, 0],
      });
    }
    this.dying.length = kept;
    this.renderSparks(now);
  }

  private renderSparks(now: number) {
    const tile = this.world.meta.tileInPixels;
    const size = { width: tile.width * EFFECTS.sparkTiles, height: tile.height * EFFECTS.sparkTiles };
    let kept = 0;
    for (const spark of this.sparks) {
      let age = now - spark.bornAt;
      if (age < 0) age += EFFECTS.timeWrap;
      if (age >= EFFECTS.sparkSeconds) continue;
      this.sparks[kept++] = spark;
      Draw.rect({
        position: {
          x: spark.x - size.width / 2,
          y: spark.y - size.height / 2,
          z: RENDER_ORDER.decoFront,
        },
        size,
        material: Materials.sparks,
        params: [spark.bornAt, EFFECTS.sparkSeconds, spark.seed, 0],
      });
    }
    this.sparks.length = kept;
  }

  private onDamaged(event: TileDamagedEvent) {
    if (!this.onScreen(event.gx, event.gy)) return;
    const center = this.world.tileCenterToWorld({ x: event.gx, y: event.gy });
    this.sparks.push({
      x: center.x,
      y: center.y,
      bornAt: Aurora.getGameTime,
      // look only, no need for the world seed
      seed: Math.floor(Math.random() * 100000),
    });
    SoundBank.playSound(SoundsID.blockDamage, { position: center });
  }

  private onMined(event: TileMinedEvent) {
    if (!this.onScreen(event.gx, event.gy)) return;
    this.dying.push({
      gx: event.gx,
      gy: event.gy,
      type: event.type,
      variant: event.variant,
      diedAt: Aurora.getGameTime,
    });
    SoundBank.playSound(SoundsID.blockDestroy, { volume: 0.5 });
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
