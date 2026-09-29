import PragmaComponent from "@pragma/component";
import MapObject, { LAYER, MAX_DAMAGE } from "@sandbox/managers/mapObject";
import { Draw } from "@aurora/urp/draw/draw";
import DrawBatch from "@aurora/urp/draw/drawBatch";
import { Camera } from "@engine/camera/camera";
import EntitiesObject from "@sandbox/managers/entitiesObject";
import { BG_SHADES } from "@/mapFormat";
import { RENDER_ORDER, SPRITES } from "../managers/generalData";
import type { TileDamagedEvent } from "./mapDirector";
type TileDefs = Record<number, { crop: Crop }>;
const TINTS: RGBA[] = Array.from({ length: BG_SHADES + 1 }, (_, i) => {
  const shade = ((i / BG_SHADES) * 200) | 0;
  return [shade, 150, shade, 255];
});
const BG_CROP: Crop = { x: 0, y: 0, width: 96, height: 96 };
const BG_DEFS: TileDefs = Array.from({ length: BG_SHADES + 1 }, () => ({
  crop: BG_CROP,
}));
// dynamic: rebuilt when MapObject bumps the chunk version (tile type changed)
const LAYERS = [
  {
    layer: LAYER.background,
    z: RENDER_ORDER.bg,
    texture: SPRITES.bg,
    defs: EntitiesObject.backgrounds as TileDefs,
    tints: null,
    dynamic: false,
  },
  // {
  //   layer: LAYER.decoBack,
  //   z: RENDER_ORDER.decoBackTiles,
  //   texture: SPRITES.blocks,
  //   defs: EntitiesObject.blocks as TileDefs,
  //   tints: null as RGBA[] | null,
  //   dynamic: false,
  // },
  {
    layer: LAYER.solid,
    z: RENDER_ORDER.solidTiles,
    texture: SPRITES.blocks,
    defs: EntitiesObject.blocks as TileDefs,
    tints: null as RGBA[] | null,
    dynamic: true,
  },
  // {
  //   layer: LAYER.decoFront,
  //   z: RENDER_ORDER.decoFrontTiles,
  //   texture: SPRITES.blocks,
  //   defs: EntitiesObject.blocks as TileDefs,
  //   tints: null as RGBA[] | null,
  //   dynamic: false,
  // },
];
export default class TileLayer extends PragmaComponent {
  private batches: DrawBatch[];
  private chunkIndex = -1;
  private version = -1;
  private solidTint: RGBA = [255, 255, 255, 255];

  declare private tilesW: number;
  declare private tilesH: number;
  declare private tileSize: Size2D;
  declare private chunkSize: Size2D;

  constructor(internal: InternalPCProps, props: { chunkIndex: number }) {
    super(internal);
    const meta = MapObject.mapMeta;
    this.tilesW = meta.chunkInTiles.width;
    this.tilesH = meta.chunkInTiles.height;
    this.tileSize = meta.tileInPixels;
    this.chunkSize = meta.chunkInPixels;
    this.batches = LAYERS.map(
      (layer) =>
        new DrawBatch(`tiles:${layer.layer}`, {
          capacity: meta.blocksPerChunk,
        }),
    );
    this.rebind(props.chunkIndex);
  }

  awake(): void {
    this.onSceneEvent<TileDamagedEvent>("tileDamaged", (event) =>
      this.patchDamage(event),
    );
  }

  destroy(): void {
    for (const batch of this.batches) batch.destroy();
  }

  public rebind(chunkIndex: number) {
    this.chunkIndex = chunkIndex;
    this.version = MapObject.getChunkVersion(chunkIndex);
    LAYERS.forEach((_, i) => this.build(i));
  }

  render(): void {
    const version = MapObject.getChunkVersion(this.chunkIndex);
    if (version !== this.version) {
      this.version = version;
      LAYERS.forEach((layer, i) => {
        if (layer.dynamic) this.build(i);
      });
    }

    const view = Camera.getViewBounds;
    const origin = this.actor.transform.getRenderPosition();
    if (
      origin.x + this.chunkSize.width < view.min.x ||
      origin.y + this.chunkSize.height < view.min.y ||
      origin.x > view.max.x ||
      origin.y > view.max.y
    )
      return;

    for (const batch of this.batches) Draw.batch(batch);
  }

  // whole chunk, not only the visible part: the batch is kept until the data changes
  private build(layerIndex: number) {
    const layer = LAYERS[layerIndex];
    const batch = this.batches[layerIndex];
    const data = MapObject.getChunkData(layer.layer, this.chunkIndex);
    const damage = MapObject.getChunkDamage(this.chunkIndex);
    const origin = MapObject.chunkToWorld(this.chunkIndex);

    batch.begin();
    for (let index = 0; index < data.length; index++) {
      const type = data[index];
      if (type === 0) continue;
      if (layer.layer === LAYER.solid && EntitiesObject.getBlock(type).spawn)
        continue;
      const crop = layer.defs[type].crop;

      let tint: RGBA | undefined;
      if (layer.layer === LAYER.solid) {
        tint = this.damageTint(damage[index]);
      } else if (layer.tints) {
        tint = layer.tints[type];
      }
      batch.key(index);
      Draw.sprite({
        position: {
          x: origin.x + (index % this.tilesW) * this.tileSize.width,
          y: origin.y + Math.floor(index / this.tilesW) * this.tileSize.height,
          z: layer.z,
        },
        crop,
        texture: layer.texture,
        size: { width: crop.width, height: crop.height },
        tint,
      });
    }
    batch.end();
  }

  private patchDamage(event: TileDamagedEvent) {
    if (MapObject.chunkIndexOfTile(event.gx, event.gy) !== this.chunkIndex)
      return;
    const index =
      (event.gy % this.tilesH) * this.tilesW + (event.gx % this.tilesW);
    const solid = LAYERS.findIndex((layer) => layer.layer === LAYER.solid);
    const tint = this.damageTint(event.damage);
    this.batches[solid].edit(index)?.color(tint[0], tint[1], tint[2], tint[3]);
  }

  private damageTint(damage: number) {
    const shade = (255 - (damage / MAX_DAMAGE) * 128) | 0;
    this.solidTint[0] = shade;
    this.solidTint[1] = shade;
    this.solidTint[2] = shade;
    return this.solidTint;
  }
}
