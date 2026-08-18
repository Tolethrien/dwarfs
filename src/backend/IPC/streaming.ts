import { ipcMain } from "electron";
import fs from "fs/promises";
import path from "path";

type MapHeader = {
  tileInPixels: Size2D;
  chunkInPixels: Size2D;
  chunkInTiles: Size2D;
  mapInPixels: Size2D;
  mapInTiles: Size2D;
  mapInChunks: Size2D;
  mapSizeInMB: number;
  HEADER_SIZE: number;
  BYTES_PER_BLOCK: number;
};
export type LoadedMap = { header: MapHeader; data: Uint8Array };

const HEADER_SIZE = 12; // 6x Uint16
const BYTES_PER_BLOCK = 2;

export function registerGameStreamingEventsIPC() {
  ipcMain.handle("loadMap", async (_, fileName: string) => {
    const file = await fs.readFile(mapFilePath(fileName));
    const header = parseHeader(file);
    const data = new Uint8Array(file.subarray(HEADER_SIZE));
    return { header, data };
  });
}
function parseHeader(buffer: Buffer): MapHeader {
  const tileInPixels: Size2D = {
    width: buffer.readUInt16LE(0),
    height: buffer.readUInt16LE(2),
  };
  const chunkInTiles: Size2D = {
    width: buffer.readUInt16LE(4),
    height: buffer.readUInt16LE(6),
  };
  const mapInChunks: Size2D = {
    width: buffer.readUInt16LE(8),
    height: buffer.readUInt16LE(10),
  };

  const chunkInPixels: Size2D = {
    width: chunkInTiles.width * tileInPixels.width,
    height: chunkInTiles.height * tileInPixels.height,
  };
  const mapInTiles: Size2D = {
    width: mapInChunks.width * chunkInTiles.width,
    height: mapInChunks.height * chunkInTiles.height,
  };
  const mapInPixels: Size2D = {
    width: mapInTiles.width * tileInPixels.width,
    height: mapInTiles.height * tileInPixels.height,
  };
  const mapSizeInMB =
    (mapInTiles.width * mapInTiles.height * BYTES_PER_BLOCK) / (1024 * 1024);

  return {
    tileInPixels,
    chunkInPixels,
    chunkInTiles,
    mapInPixels,
    mapInTiles,
    mapInChunks,
    mapSizeInMB,
    BYTES_PER_BLOCK,
    HEADER_SIZE,
  };
}
function mapFilePath(fileName: string) {
  return path.join(__dirname, fileName);
}
