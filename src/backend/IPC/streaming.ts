import { ipcMain } from "electron";
import fs from "fs/promises";
import path from "path";

type MapHeader = {
  start: Position2D;
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

const HEADER_SIZE = 20;
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
  const start: Position2D = {
    x: buffer.readInt32LE(0),
    y: buffer.readInt32LE(4),
  };
  const tileInPixels: Size2D = {
    width: buffer.readUInt16LE(8),
    height: buffer.readUInt16LE(10),
  };
  const chunkInTiles: Size2D = {
    width: buffer.readUInt16LE(12),
    height: buffer.readUInt16LE(14),
  };
  const mapInChunks: Size2D = {
    width: buffer.readUInt16LE(16),
    height: buffer.readUInt16LE(18),
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
    start,
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
