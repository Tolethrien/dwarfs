import PragmaComponent from "@/core/pragma/component";
import MapObject, { LAYER, MAX_DAMAGE } from "@/sandbox/managers/mapObject";
import Draw from "@/core/aurora/draw";
import CameraObject from "@/sandbox/managers/cameraObject";
import EntitiesObject from "@/sandbox/managers/entitiesObject";
import { BG_SHADES } from "@/mapFormat";
import { RENDER_ORDER, SPRITES } from "../managers/generalData";
type TileDefs = Record<number, { crop: Crop }>;
const TINTS: RGBA[] = Array.from({ length: BG_SHADES + 1 }, (_, i) => {
  const shade = ((i / BG_SHADES) * 200) | 0;
  return [shade, 150, shade, 255];
});
const BG_CROP: Crop = { x: 0, y: 0, width: 96, height: 96 };
const BG_DEFS: TileDefs = Array.from({ length: BG_SHADES + 1 }, () => ({
  crop: BG_CROP,
}));
const LAYERS = [
  {
    layer: LAYER.background,
    z: RENDER_ORDER.bg,
    texture: SPRITES.bg,
    defs: EntitiesObject.backgrounds as TileDefs,
    tints: null,
  },
  // {
  //   layer: LAYER.decoBack,
  //   z: EntitiesObject.renderOrder.decoBack,
  //   texture: EntitiesObject.sprites.blocks,
  //   defs: EntitiesObject.blocks as TileDefs,
  //   tints: null as RGBA[] | null,
  // },
  {
    layer: LAYER.solid,
    z: RENDER_ORDER.main,
    texture: SPRITES.blocks,
    defs: EntitiesObject.blocks as TileDefs,
    tints: null as RGBA[] | null,
  },
  // {
  //   layer: LAYER.decoFront,
  //   z: EntitiesObject.renderOrder.decoFront,
  //   texture: EntitiesObject.sprites.blocks,
  //   defs: EntitiesObject.blocks as TileDefs,
  //   tints: null as RGBA[] | null,
  // },
];
export default class TileLayer extends PragmaComponent {
  private views: Uint16Array[] = [];
  declare private damage: Uint16Array;
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
    this.rebind(props.chunkIndex);
  }

  public rebind(chunkIndex: number) {
    LAYERS.forEach((l, i) => {
      this.views[i] = MapObject.getChunkData(l.layer, chunkIndex);
    });
    this.damage = MapObject.getChunkDamage(chunkIndex);
  }

  render(): void {
    const view = CameraObject.getViewBox();
    const origin = this.actor.transform.getRenderPosition();

    if (
      origin.x + this.chunkSize.width < view.x ||
      origin.y + this.chunkSize.height < view.y ||
      origin.x > view.x + view.w ||
      origin.y > view.y + view.h
    )
      return;

    const TW = this.tileSize.width;
    const TH = this.tileSize.height;

    // zakres przycięty do chunka — inaczej index wyjdzie poza tablicę
    const minLX = Math.max(0, Math.floor((view.x - origin.x) / TW));
    const minLY = Math.max(0, Math.floor((view.y - origin.y) / TH));
    const maxLX = Math.min(
      this.tilesW - 1,
      Math.floor((view.x + view.w - origin.x) / TW),
    );
    const maxLY = Math.min(
      this.tilesH - 1,
      Math.floor((view.y + view.h - origin.y) / TH),
    );

    for (let ly = minLY; ly <= maxLY; ly++) {
      for (let lx = minLX; lx <= maxLX; lx++) {
        const index = ly * this.tilesW + lx;
        const x = origin.x + lx * TW;
        const y = origin.y + ly * TH;

        for (let i = 0; i < LAYERS.length; i++) {
          const layer = LAYERS[i];
          const type = this.views[i][index];
          if (type === 0) continue;

          const crop = layer.defs[type].crop;

          let tint: RGBA | undefined;
          if (layer.layer === LAYER.solid) {
            const shade = (255 - (this.damage[index] / MAX_DAMAGE) * 128) | 0;
            this.solidTint[0] = shade;
            this.solidTint[1] = shade;
            this.solidTint[2] = shade;
            tint = this.solidTint;
          } else if (layer.tints) {
            tint = layer.tints[type];
          }
          Draw.sprite({
            position: { x, y, z: layer.z },
            crop,
            textureToUse: layer.texture,
            size: { width: crop.width, height: crop.height },
            tint,
          });
        }
      }
    }
  }
}
