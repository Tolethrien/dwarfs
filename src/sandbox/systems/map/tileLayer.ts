import PragmaComponent from "@/core/pragma/component";
import BackgroundLayer from "./bgLayer";
import SolidLayer from "./solidLayer";
import MapObject, { MAX_DAMAGE } from "@/sandbox/managers/mapObject";
import DecoBackLayer from "./decoBackLayer";
import DecoFrontLayer from "./decoFrontLayer";
import Draw from "@/core/aurora/draw";
import CameraObject from "@/sandbox/managers/cameraObject";

export default class TileLayer extends PragmaComponent {
  declare private background: BackgroundLayer;
  declare private decoBack: DecoBackLayer;
  declare private solid: SolidLayer;
  declare private decoFront: DecoFrontLayer;

  declare private CHUNK_TILE_WIDTH: number;
  declare private CHUNK_TILE_HEIGHT: number;
  declare private TILE_SIZE: Size2D;
  declare private CHUNK_SIZE: Size2D;

  constructor(internal: InternalPCProps) {
    super(internal);
    const meta = MapObject.mapMeta;
    this.CHUNK_TILE_WIDTH = meta.chunkInTiles.width;
    this.CHUNK_TILE_HEIGHT = meta.chunkInTiles.height;
    this.TILE_SIZE = meta.tileInPixels;
    this.CHUNK_SIZE = meta.chunkInPixels;
  }

  start(): void {
    this.background = this.getSibling(BackgroundLayer)!;
    this.decoBack = this.getSibling(DecoBackLayer)!;
    this.solid = this.getSibling(SolidLayer)!;
    this.decoFront = this.getSibling(DecoFrontLayer)!;
  }

  render(): void {
    const view = CameraObject.getViewBox();
    const origin = this.actor.transform.getRenderPosition();

    // cały chunk poza kadrem
    if (
      origin.x + this.CHUNK_SIZE.width < view.x ||
      origin.y + this.CHUNK_SIZE.height < view.y ||
      origin.x > view.x + view.w ||
      origin.y > view.y + view.h
    )
      return;

    const TW = this.TILE_SIZE.width;
    const TH = this.TILE_SIZE.height;
    const W = this.CHUNK_TILE_WIDTH;
    const H = this.CHUNK_TILE_HEIGHT;

    // zakres MUSI być przycięty do chunka — inaczej index wyjdzie poza tablicę
    const minLX = Math.max(0, Math.floor((view.x - origin.x) / TW));
    const minLY = Math.max(0, Math.floor((view.y - origin.y) / TH));
    const maxLX = Math.min(
      W - 1,
      Math.floor((view.x + view.w - origin.x) / TW),
    );
    const maxLY = Math.min(
      H - 1,
      Math.floor((view.y + view.h - origin.y) / TH),
    );

    // wszystko do lokalnych przed pętlą — w środku żadnych zejść po własnościach
    const bgData = this.background.data;
    const bgZ = this.background.z;
    const bgTex = this.background.texture;
    const bgTints = this.background.tints;

    const backData = this.decoBack.data;
    const backZ = this.decoBack.z;
    const backTex = this.decoBack.texture;
    const backCrops = this.decoBack.crops;
    const backTints = this.decoBack.tints;

    const solidData = this.solid.data;
    const damageData = this.solid.damage;
    const solidZ = this.solid.z;
    const solidTex = this.solid.texture;
    const solidCrops = this.solid.crops;

    const frontData = this.decoFront.data;
    const frontZ = this.decoFront.z;
    const frontTex = this.decoFront.texture;
    const frontCrops = this.decoFront.crops;
    const frontTints = this.decoFront.tints;

    for (let ly = minLY; ly <= maxLY; ly++) {
      for (let lx = minLX; lx <= maxLX; lx++) {
        const index = ly * W + lx;
        const x = origin.x + lx * TW;
        const y = origin.y + ly * TH;

        // tło jest ZA wszystkim, niezależnie od tego czy kafel jest wykopany
        const bg = bgData[index];
        if (bg !== 0) {
          Draw.rect({
            position: { x, y, z: bgZ },
            size: { width: TW, height: TH },
            tint: bgTints[bg],
          });
        }
        this.drawTile(
          backData[index],
          x,
          y,
          backZ,
          backTex,
          backCrops,
          backTints,
        );

        const type = solidData[index];
        if (type !== 0) {
          const crop = solidCrops[type].crop;
          const shade = (255 - (damageData[index] / MAX_DAMAGE) * 128) | 0;
          Draw.sprite({
            position: { x, y, z: solidZ },
            crop,
            textureToUse: solidTex,
            size: { width: crop.width, height: crop.height },
            tint: [shade, shade, shade, 255],
          });
        }

        this.drawTile(
          frontData[index],
          x,
          y,
          frontZ,
          frontTex,
          frontCrops,
          frontTints,
        );
      }
    }
  }

  private drawTile(
    type: number,
    x: number,
    y: number,
    z: number,
    texture: string,
    crops: Record<number, { crop: Crop }>,
    tints: RGBA[] | null,
  ) {
    if (type === 0) return;
    const crop = crops[type].crop;
    Draw.sprite({
      position: { x, y, z },
      crop,
      textureToUse: texture,
      size: { width: crop.width, height: crop.height },
      tint: tints ? tints[type] : undefined,
    });
  }
}
