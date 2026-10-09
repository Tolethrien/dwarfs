import Noise from "@axiom/noise";
import PragmaSystem from "@pragma/system";
import Aurora from "@aurora/core";
import { Draw } from "@aurora/urp/draw/draw";
import DrawBatch from "@aurora/urp/draw/drawBatch";
import { Camera } from "@engine/camera/camera";
import { BlocksID, getBlock, getVariantCrop, hasGraphics } from "@sandbox/content/blocks";
import { BACKGROUNDS, BackgroundsID } from "@sandbox/content/backgrounds";
import { getDecoCrop, type DecoLayer } from "@sandbox/content/decos";
import { SPRITES } from "@sandbox/content/sprites";
import { RENDER_ORDER } from "@sandbox/configs";
import TileMask from "@sandbox/shaders/tileMask";
import { tileType, tileVariant } from "@sandbox/world/tile";
import { MAX_DAMAGE } from "@sandbox/world/strike";
import type World from "@sandbox/world/world";
import Terrain, {
  type TileContact,
  type TileDamagedEvent,
  type TileDeflectedEvent,
} from "./terrain";
import type { ChunkDiscoveredEvent } from "./discovery";
import { DECO_ACTORS } from "./decoView";

export interface ChunkShownEvent {
  chunk: number;
}
export interface ChunkHiddenEvent {
  chunk: number;
}

const VIEW = {
  // discovered chunks around the camera kept built, so a pan does not show them being made
  margin: 1,
  // tileSolid params [damage 0-1, hit time, packed impact, heat]; a hit long ago = no flash
  noHit: -1000,
  middle: { x: 0.5, y: 0.5 },
  // heat of a pick hit, blasts will send 1; a deflected hit lights no cracks
  cold: 0,
  deflected: -1,
};
const DECO_DEPTH: Record<DecoLayer, number> = {
  back: RENDER_ORDER.decoBackTiles,
  front: RENDER_ORDER.decoFrontTiles,
};
const PICTURES = Object.values(BackgroundsID).filter(
  (value) => typeof value === "number" && value !== BackgroundsID.none,
) as BackgroundsID[];

interface ChunkDraw {
  chunk: number;
  version: number;
  background: DrawBatch;
  solid: DrawBatch;
  decos: Record<DecoLayer, DrawBatch>;
}
type ChunkRange = { minX: number; minY: number; maxX: number; maxY: number };

// presentation: batches of the discovered chunks around the camera, rebuilt when a tile type
// changes; damage and hits only patch the tile's params (the shader draws cracks and the flash).
// Undiscovered chunks are not drawn, a newly discovered one just appears. Reads the World, never writes it
export default class ChunkView extends PragmaSystem {
  declare private world: World;
  declare private backgroundNoise: Noise;
  private shown = new Map<number, ChunkDraw>();
  private pool: ChunkDraw[] = [];
  private range: ChunkRange = { minX: -1, minY: -1, maxX: -1, maxY: -1 };
  private dirty = false;
  // undiscovered chunks drawn too, for looking at the whole map
  private showAll = true;

  constructor(internal: InternalPSProps) {
    super(internal);
  }

  awake(): void {
    this.onSceneEvent<TileDamagedEvent>("tileDamaged", (event) =>
      this.patchHit(event.gx, event.gy, event.damage, VIEW.cold, event.contact),
    );
    this.onSceneEvent<TileDeflectedEvent>("tileDeflected", (event) =>
      this.patchHit(
        event.gx,
        event.gy,
        this.world.getDamage(event.gx, event.gy),
        VIEW.deflected,
        event.contact,
      ),
    );
    this.onSceneEvent<ChunkDiscoveredEvent>("chunkDiscovered", () => {
      this.dirty = true;
    });
  }

  start(): void {
    this.world = this.scene.getSystem(Terrain).world;
    this.backgroundNoise = new Noise(this.world.meta.seed);
    this.sync(this.visibleRange());
  }

  update(): void {
    const range = this.visibleRange();
    const same =
      range.minX === this.range.minX &&
      range.minY === this.range.minY &&
      range.maxX === this.range.maxX &&
      range.maxY === this.range.maxY;
    if (same && !this.dirty) return;
    this.dirty = false;
    this.sync(range);
  }

  render(): void {
    const view = Camera.getViewBounds;
    const chunkSize = this.world.chunkInPixels;
    for (const draw of this.shown.values()) {
      const version = this.world.chunkVersions[draw.chunk];
      if (version !== draw.version) {
        draw.version = version;
        this.buildSolid(draw);
        this.buildDecos(draw);
      }
      const origin = this.world.chunkToWorld(draw.chunk);
      const outside =
        origin.x + chunkSize.width < view.min.x ||
        origin.y + chunkSize.height < view.min.y ||
        origin.x > view.max.x ||
        origin.y > view.max.y;
      if (outside) continue;
      Draw.batch(draw.background);
      Draw.batch(draw.decos.back);
      Draw.batch(draw.solid);
      Draw.batch(draw.decos.front);
    }
  }

  public setShowAll(show: boolean) {
    this.showAll = show;
    this.dirty = true;
  }

  public isShown(chunk: number) {
    return this.shown.has(chunk);
  }

  destroy(): void {
    for (const draw of this.shown.values()) this.destroyDraw(draw);
    for (const draw of this.pool) this.destroyDraw(draw);
  }

  private visibleRange(): ChunkRange {
    const view = Camera.getViewBounds;
    const chunks = this.world.meta.mapInChunks;
    const topLeft = this.world.worldToChunk(view.min);
    const bottomRight = this.world.worldToChunk(view.max);
    return {
      minX: Math.max(0, topLeft.x - VIEW.margin),
      minY: Math.max(0, topLeft.y - VIEW.margin),
      maxX: Math.min(chunks.width - 1, bottomRight.x + VIEW.margin),
      maxY: Math.min(chunks.height - 1, bottomRight.y + VIEW.margin),
    };
  }

  private sync(range: ChunkRange) {
    this.range = range;
    const wanted = new Set<number>();
    for (let cy = range.minY; cy <= range.maxY; cy++) {
      for (let cx = range.minX; cx <= range.maxX; cx++) {
        const chunk = this.world.chunkIndex(cx, cy);
        if (this.showAll || this.world.isDiscovered(chunk)) wanted.add(chunk);
      }
    }

    for (const [chunk, draw] of this.shown) {
      if (wanted.has(chunk)) continue;
      this.shown.delete(chunk);
      this.pool.push(draw);
      this.emitSceneEvent<ChunkHiddenEvent>("chunkHidden", { chunk });
    }
    for (const chunk of wanted) {
      if (this.shown.has(chunk)) continue;
      this.show(chunk);
    }
  }

  private show(chunk: number) {
    const capacity =
      this.world.meta.chunkInTiles.width * this.world.meta.chunkInTiles.height;
    const draw = this.pool.pop() ?? {
      chunk,
      version: 0,
      background: new DrawBatch("chunk:background", { capacity }),
      solid: new DrawBatch("chunk:solid", { capacity }),
      decos: {
        back: new DrawBatch("chunk:decoBack", { capacity }),
        front: new DrawBatch("chunk:decoFront", { capacity }),
      },
    };
    draw.chunk = chunk;
    draw.version = this.world.chunkVersions[chunk];
    this.buildBackground(draw);
    this.buildSolid(draw);
    this.buildDecos(draw);
    this.shown.set(chunk, draw);
    this.emitSceneEvent<ChunkShownEvent>("chunkShown", { chunk });
  }

  // key = tile index inside the chunk (lx + ly * chunk width), patchDamage finds it by that
  private buildSolid(draw: ChunkDraw) {
    TileMask.writeChunk(draw.chunk);
    const origin = this.world.chunkOrigin(draw.chunk);
    const chunkInTiles = this.world.meta.chunkInTiles;
    const tile = this.world.meta.tileInPixels;
    const mapWidth = this.world.mapInTiles.width;
    const pixels = this.world.chunkToWorld(draw.chunk);

    draw.solid.begin();
    for (let ly = 0; ly < chunkInTiles.height; ly++) {
      for (let lx = 0; lx < chunkInTiles.width; lx++) {
        const gx = origin.x + lx;
        const gy = origin.y + ly;
        // inline index instead of world.getType: per tile of every rebuilt chunk
        const raw = this.world.solid[gx + gy * mapWidth];
        const type = tileType(raw);
        if (!hasGraphics(type)) continue;
        const crop = getVariantCrop(type, tileVariant(raw));
        draw.solid.key(lx + ly * chunkInTiles.width);
        Draw.sprite({
          position: {
            x: pixels.x + lx * tile.width,
            y: pixels.y + ly * tile.height,
            z: RENDER_ORDER.solidTiles,
          },
          crop,
          texture: SPRITES.blocks,
          size: { width: crop.width, height: crop.height },
          material: getBlock(type).glint ? TileMask.ore : TileMask.solid,
          params: [this.world.getDamage(gx, gy) / MAX_DAMAGE, VIEW.noHit, TileMask.packImpact(VIEW.middle), VIEW.cold],
        });
      }
    }
    draw.solid.end();
  }

  // the variant's crop over the whole tile, nothing for a deco without graphics yet
  private buildDecos(draw: ChunkDraw) {
    const origin = this.world.chunkOrigin(draw.chunk);
    const chunkInTiles = this.world.meta.chunkInTiles;
    const tile = this.world.meta.tileInPixels;
    const pixels = this.world.chunkToWorld(draw.chunk);

    for (const layer of ["back", "front"] as const) {
      const batch = draw.decos[layer];
      batch.begin();
      for (let ly = 0; ly < chunkInTiles.height; ly++) {
        for (let lx = 0; lx < chunkInTiles.width; lx++) {
          const gx = origin.x + lx;
          const gy = origin.y + ly;
          const type = this.world.getDecoType(layer, gx, gy);
          if (type === 0 || DECO_ACTORS[type as keyof typeof DECO_ACTORS])
            continue;
          const crop = getDecoCrop(type, this.world.getDecoVariant(layer, gx, gy));
          if (!crop) continue;
          Draw.sprite({
            position: {
              x: pixels.x + lx * tile.width,
              y: pixels.y + ly * tile.height,
              z: DECO_DEPTH[layer],
            },
            crop,
            texture: SPRITES.deco,
            size: { width: tile.width, height: tile.height },
          });
        }
      }
      batch.end();
    }
  }

  // not stored anywhere: nothing outside the mine, a picture from the tile's hash inside
  private buildBackground(draw: ChunkDraw) {
    const origin = this.world.chunkOrigin(draw.chunk);
    const chunkInTiles = this.world.meta.chunkInTiles;
    const tile = this.world.meta.tileInPixels;
    const pixels = this.world.chunkToWorld(draw.chunk);

    draw.background.begin();
    for (let ly = 0; ly < chunkInTiles.height; ly++) {
      for (let lx = 0; lx < chunkInTiles.width; lx++) {
        const gx = origin.x + lx;
        const gy = origin.y + ly;
        const type = this.world.getType(gx, gy);
        if (type === BlocksID.void) continue;
        if (type === BlocksID.obsidian && !this.touchesMine(gx, gy)) continue;
        const pick = Math.floor(
          this.backgroundNoise.white2D(gx, gy) * PICTURES.length,
        );
        const crop = BACKGROUNDS[PICTURES[pick]].crop;
        Draw.sprite({
          position: {
            x: pixels.x + lx * tile.width,
            y: pixels.y + ly * tile.height,
            z: RENDER_ORDER.bg,
          },
          crop,
          texture: SPRITES.bg,
          size: { width: crop.width, height: crop.height },
        });
      }
    }
    draw.background.end();
  }

  // obsidian among obsidian/void keeps its gaps black, only the band next to the mine shows bg
  private touchesMine(gx: number, gy: number) {
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const type = this.world.getType(gx + dx, gy + dy);
        if (type !== BlocksID.void && type !== BlocksID.obsidian) return true;
      }
    }
    return false;
  }

  private patchHit(gx: number, gy: number, damage: number, heat: number, contact?: TileContact) {
    const draw = this.shown.get(this.world.chunkOfTile(gx, gy));
    if (!draw) return;
    const origin = this.world.chunkOrigin(draw.chunk);
    const local = gx - origin.x + (gy - origin.y) * this.world.meta.chunkInTiles.width;
    const impact = contact
      ? this.world.worldToTileFraction({ x: gx, y: gy }, contact.point)
      : VIEW.middle;
    draw.solid
      .edit(local)
      ?.params(damage / MAX_DAMAGE, Aurora.getGameTime, TileMask.packImpact(impact), heat);
  }

  private destroyDraw(draw: ChunkDraw) {
    draw.background.destroy();
    draw.solid.destroy();
    draw.decos.back.destroy();
    draw.decos.front.destroy();
  }
}
