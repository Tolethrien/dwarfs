import PragmaComponent from "@/core/pragma/component";
import MapObject from "../managers/mapObject";
import Draw from "@/core/aurora/draw";
import Grid from "@/core/axiom/grid";
import { BLOCK_NAMES, BLOCK_TYPES } from "@/data";
import Chunk from "../bActors/chunk";
interface TilesProps {
  data: Uint8Array;
}
export default class Tiles extends PragmaComponent {
  private readonly tileData: Uint8Array;
  private tilesAlive: Set<number> = new Set();
  declare BYTES: number;
  declare BLOCK_COUNT: number;
  declare CHUNK_TILE_WIDTH: number;
  declare TILE_SIZE: Size2D;
  constructor(internal: InternalPCProps, props: TilesProps) {
    super(internal);
    this.tileData = props.data;
  }
  awake(): void {
    this.BYTES = MapObject.mapMeta.BYTES_PER_BLOCK;
    this.BLOCK_COUNT = this.tileData.length / this.BYTES;
    this.CHUNK_TILE_WIDTH = MapObject.mapMeta.chunkInTiles.width;
    this.TILE_SIZE = MapObject.mapMeta.tileInPixels;
    for (let index = 0; index < this.BLOCK_COUNT; index++) {
      const type = this.tileData[index * this.BYTES];
      if (BLOCK_NAMES[type] === "air") continue;
      this.tilesAlive.add(index);
    }
  }
  render(): void {
    this.tilesAlive.forEach((index) => {
      let tint: RGBA = this.actor.getEnabled()
        ? [255, 255, 255, 255]
        : [100, 100, 100, 100];
      const pos = this.getRenderTilePosition(index);
      const type = this.tileData[index * this.BYTES];
      const crop = BLOCK_TYPES[BLOCK_NAMES[type]];
      Draw.sprite({
        position: { x: pos.x, y: pos.y, z: 1 },
        crop: crop,
        textureToUse: "stones",
        size: { height: crop.height, width: crop.width },
        tint: tint,
      });
    });
  }
  getRenderTilePosition(index: number): Position2D {
    const chunkPos = this.actor.transform.getRenderPosition();
    const tile = Grid.indexToTile(index, this.CHUNK_TILE_WIDTH);
    const tilePos = Grid.tileToWorld(tile, this.TILE_SIZE);
    return { x: chunkPos.x + tilePos.x, y: chunkPos.y + tilePos.y };
  }
}
