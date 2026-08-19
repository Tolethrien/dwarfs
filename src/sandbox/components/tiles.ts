import PragmaComponent from "@/core/pragma/component";
import AuroraCamera from "@/core/aurora/camera";
import Draw from "@/core/aurora/draw";
import MapObject from "../managers/mapObject";
import { BLOCK_NAMES, BLOCK_TYPES } from "@/sandbox/data";
import CameraObject from "../managers/cameraObject";

interface TilesProps {
  chunkIndex: number;
}

const AIR = BLOCK_NAMES.indexOf("air");

export default class Tiles extends PragmaComponent {
  declare private tileData: Uint8Array;
  private chunkIndex: number;
  private tilesAlive: Set<number> = new Set();
  private lastVersion = -1;

  declare private BYTES: number;
  declare private BLOCK_COUNT: number;
  declare private CHUNK_TILE_WIDTH: number;
  declare private TILE_SIZE: Size2D;
  declare private CHUNK_SIZE: Size2D;

  constructor(internal: InternalPCProps, props: TilesProps) {
    super(internal);
    this.chunkIndex = props.chunkIndex;
    const meta = MapObject.mapMeta;
    this.BYTES = meta.BYTES_PER_BLOCK;
    this.CHUNK_TILE_WIDTH = meta.chunkInTiles.width;
    this.TILE_SIZE = meta.tileInPixels;
    this.CHUNK_SIZE = meta.chunkInPixels;
    this.tileData = MapObject.getChunkData(this.chunkIndex);
    this.BLOCK_COUNT = this.tileData.length / this.BYTES;
    this.rebuildAlive();
  }

  render(): void {
    if (MapObject.getChunkVersion(this.chunkIndex) !== this.lastVersion)
      this.rebuildAlive();
    if (this.tilesAlive.size === 0) return;

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

    // widoczny zakres kafli w lokalnych współrzędnych chunka
    const minLX = Math.max(
      0,
      Math.floor((view.x - origin.x) / this.TILE_SIZE.width),
    );
    const minLY = Math.max(
      0,
      Math.floor((view.y - origin.y) / this.TILE_SIZE.height),
    );
    const maxLX = Math.floor(
      (view.x + view.w - origin.x) / this.TILE_SIZE.width,
    );
    const maxLY = Math.floor(
      (view.y + view.h - origin.y) / this.TILE_SIZE.height,
    );

    const W = this.CHUNK_TILE_WIDTH;

    this.tilesAlive.forEach((index) => {
      // rozkład indeksu inline — Grid.indexToTile alokowałoby obiekt na każdy kafel
      const lx = index % W;
      const ly = (index / W) | 0;
      if (lx < minLX || lx > maxLX || ly < minLY || ly > maxLY) return;

      const offset = index * this.BYTES;
      const crop = BLOCK_TYPES[BLOCK_NAMES[this.tileData[offset]]];
      const shade = (255 - this.tileData[offset + 1] * 0.5) | 0;

      Draw.sprite({
        position: {
          x: origin.x + lx * this.TILE_SIZE.width,
          y: origin.y + ly * this.TILE_SIZE.height,
          z: 1,
        },
        crop,
        textureToUse: "stones",
        size: { width: crop.width, height: crop.height },
        tint: [shade, shade, shade, 255],
      });
    });
  }

  private rebuildAlive() {
    this.lastVersion = MapObject.getChunkVersion(this.chunkIndex);
    this.tilesAlive.clear();
    for (let index = 0; index < this.BLOCK_COUNT; index++) {
      if (this.tileData[index * this.BYTES] === AIR) continue;
      this.tilesAlive.add(index);
    }
  }
  public rebind(chunkIndex: number) {
    if (
      chunkIndex === this.chunkIndex &&
      MapObject.getChunkVersion(chunkIndex) === this.lastVersion
    )
      return; // same chunk
    this.chunkIndex = chunkIndex;
    this.tileData = MapObject.getChunkData(chunkIndex);
    this.rebuildAlive();
  }
}
