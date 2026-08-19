import PragmaComponent from "@/core/pragma/component";
import Draw from "@/core/aurora/draw";
import MapObject, { LAYER, MAX_DAMAGE } from "../managers/mapObject";
import { BLOCK_NAMES, BLOCK_TYPES } from "@/sandbox/data";
import CameraObject from "../managers/cameraObject";
import Vec2 from "@/core/axiom/vec2";

interface TilesProps {
  chunkIndex: number;
}

const AIR = BLOCK_NAMES.indexOf("air");

const Z_BACKGROUND = 0;
const Z_DECO_BACK = 0.2;
const Z_SOLID = 0.4;
const Z_DECO_FRONT = 0.8;
//TODO: jedne obiekt dla layerow renderowania
const PLACEHOLDER_CROP: Crop = { x: 0, y: 0, width: 96, height: 96 };
const BG_SHADES = 32;
const DECO_BACK_TINT: RGBA = [80, 140, 255, 255];
const DECO_FRONT_TINT: RGBA = [255, 100, 80, 255];

export default class Tiles extends PragmaComponent {
  declare private bgData: Uint16Array;
  declare private decoBackData: Uint16Array;
  declare private solidData: Uint16Array;
  declare private decoFrontData: Uint16Array;
  declare private damageData: Uint16Array;

  private chunkIndex: number;

  declare private CHUNK_TILE_WIDTH: number;
  declare private CHUNK_TILE_HEIGHT: number;
  declare private TILE_SIZE: Size2D;
  declare private CHUNK_SIZE: Size2D;

  constructor(internal: InternalPCProps, props: TilesProps) {
    super(internal);
    const meta = MapObject.mapMeta;

    this.chunkIndex = props.chunkIndex;
    this.CHUNK_TILE_WIDTH = meta.chunkInTiles.width;
    this.CHUNK_TILE_HEIGHT = meta.chunkInTiles.height;
    this.TILE_SIZE = meta.tileInPixels;
    this.CHUNK_SIZE = meta.chunkInPixels;

    this.bindViews(props.chunkIndex);
  }

  render(): void {
    const view = CameraObject.getViewBox();
    const origin = this.actor.transform.getRenderPosition();

    const isOutside = this.chunkInView(origin, view);
    if (isOutside) return;

    const TW = this.TILE_SIZE.width;
    const TH = this.TILE_SIZE.height;
    const W = this.CHUNK_TILE_WIDTH;
    const H = this.CHUNK_TILE_HEIGHT;

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

    for (let ly = minLY; ly <= maxLY; ly++) {
      for (let lx = minLX; lx <= maxLX; lx++) {
        const index = ly * W + lx;
        const x = origin.x + lx * TW;
        const y = origin.y + ly * TH;

        const bg = this.bgData[index];
        if (bg !== 0) {
          const shade = ((bg / BG_SHADES) * 200) | 0;
          this.drawPlaceholder(x, y, Z_BACKGROUND, [shade, shade, shade, 255]);
        }

        if (this.decoBackData[index] !== 0)
          this.drawPlaceholder(x, y, Z_DECO_BACK, DECO_BACK_TINT);

        const solid = this.solidData[index];
        if (solid !== AIR) this.drawLayer(index, solid, x, y);

        if (this.decoFrontData[index] !== 0)
          this.drawPlaceholder(x, y, Z_DECO_FRONT, DECO_FRONT_TINT);
      }
    }
  }

  public rebind(chunkIndex: number) {
    this.chunkIndex = chunkIndex;
    this.bindViews(chunkIndex);
  }
  private chunkInView(origin: Vec2, view: Box) {
    return (
      origin.x + this.CHUNK_SIZE.width < view.x ||
      origin.y + this.CHUNK_SIZE.height < view.y ||
      origin.x > view.x + view.w ||
      origin.y > view.y + view.h
    );
  }
  private bindViews(chunkIndex: number) {
    this.bgData = MapObject.getChunkData(LAYER.background, chunkIndex);
    this.decoBackData = MapObject.getChunkData(LAYER.decoBack, chunkIndex);
    this.solidData = MapObject.getChunkData(LAYER.solid, chunkIndex);
    this.decoFrontData = MapObject.getChunkData(LAYER.decoFront, chunkIndex);
    this.damageData = MapObject.getChunkDamage(chunkIndex);
  }

  private drawPlaceholder(x: number, y: number, z: number, tint: RGBA) {
    Draw.rect({
      position: { x, y, z },
      size: { width: PLACEHOLDER_CROP.width, height: PLACEHOLDER_CROP.height },
      tint,
    });
  }
  private drawLayer(index: number, solid: number, x: number, y: number) {
    const crop = BLOCK_TYPES[BLOCK_NAMES[solid]];
    const shade = (255 - (this.damageData[index] / MAX_DAMAGE) * 128) | 0;
    Draw.sprite({
      position: { x, y, z: Z_SOLID },
      crop,
      textureToUse: "stones",
      size: { width: crop.width, height: crop.height },
      tint: [shade, shade, shade, 255],
    });
  }
}
