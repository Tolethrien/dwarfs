import { LoadedMap } from "@/backend/IPC/streaming";

export default class MapObject {
  declare private static tileArray: Uint8Array;
  declare private static mapConfig: LoadedMap["header"];

  public static async loadMap(path: string) {
    const data = await window.API.STREAMING.loadMapFromFile(path);
    this.mapConfig = data.header;
    this.tileArray = data.data;
    console.log("loaded file", data);
  }
  public static get mapMeta() {
    return this.mapConfig;
  }
  public static getChunkData(chunkIndex: number) {
    const start = this.getChunkByteOffset(chunkIndex);
    const length = this.chunkBlockCount() * this.mapMeta.BYTES_PER_BLOCK;
    return this.tileArray.subarray(start, start + length);
  }
  private static chunkBlockCount() {
    return this.mapMeta.chunkInTiles.width * this.mapMeta.chunkInTiles.height;
  }
  private static getChunkByteOffset(chunkIndex: number) {
    return chunkIndex * this.chunkBlockCount() * this.mapMeta.BYTES_PER_BLOCK;
  }
}
