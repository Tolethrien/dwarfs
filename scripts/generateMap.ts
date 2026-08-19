// generateMap.ts — generuje losowy plik .dwb z ramką typu 3 dookoła
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
interface MapGenConfig {
  tileSize: Size2D;
  chunkSize: Size2D;
  mapSize: Size2D;
  start: Position2D;
}

const CONFIG: MapGenConfig = {
  tileSize: { width: 96, height: 96 },
  chunkSize: { width: 32, height: 32 },
  mapSize: { width: 12, height: 12 },
  start: { x: 0, y: 0 },
};
/**
 * offset  type    val
0       i32    startX
4       i32    startY
8       u16    tileWidth
10      u16    tileHeight
12      u16    chunkTilesW
14      u16    chunkTilesH
16      u16    mapChunksW
18      u16    mapChunksH
sum = 20 b
 */
const BYTES_PER_BLOCK = 2; // typ + zniszczenie
const HEADER_SIZE = 20;
const BORDER_TYPE = 3;

function generateMap(config: MapGenConfig, outPath: string): void {
  const { tileSize, chunkSize, mapSize, start } = config;

  const mapTilesW = chunkSize.width * mapSize.width;
  const mapTilesH = chunkSize.height * mapSize.height;

  const chunkBlockCount = chunkSize.width * chunkSize.height;
  const totalChunks = mapSize.width * mapSize.height;
  const totalBlocks = chunkBlockCount * totalChunks;

  const buffer = Buffer.alloc(HEADER_SIZE + totalBlocks * BYTES_PER_BLOCK);

  buffer.writeInt32LE(start.x, 0);
  buffer.writeInt32LE(start.y, 4);
  buffer.writeUInt16LE(tileSize.width, 8);
  buffer.writeUInt16LE(tileSize.height, 10);
  buffer.writeUInt16LE(chunkSize.width, 12);
  buffer.writeUInt16LE(chunkSize.height, 14);
  buffer.writeUInt16LE(mapSize.width, 16);
  buffer.writeUInt16LE(mapSize.height, 18);

  for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex++) {
    const chunkX = chunkIndex % mapSize.width;
    const chunkY = Math.floor(chunkIndex / mapSize.width);

    for (let ly = 0; ly < chunkSize.height; ly++) {
      for (let lx = 0; lx < chunkSize.width; lx++) {
        const globalX = chunkX * chunkSize.width + lx;
        const globalY = chunkY * chunkSize.height + ly;

        const isBorder =
          globalX === 0 ||
          globalY === 0 ||
          globalX === mapTilesW - 1 ||
          globalY === mapTilesH - 1;

        const localBlockIndex = ly * chunkSize.width + lx;
        const offset =
          HEADER_SIZE +
          (chunkIndex * chunkBlockCount + localBlockIndex) * BYTES_PER_BLOCK;

        const type = isBorder ? BORDER_TYPE : Math.floor(Math.random() * 3); // 0-2
        const damage = 0;

        buffer.writeUInt8(type, offset);
        buffer.writeUInt8(damage, offset + 1);
      }
    }
  }

  fs.writeFileSync(outPath, buffer);

  console.log(`Zapisano ${outPath}`);
  console.log(`  bloków: ${totalBlocks.toLocaleString()}`);
  console.log(`  rozmiar: ${(buffer.length / 1024 / 1024).toFixed(2)} MB`);
}
const __dirname = path.dirname(fileURLToPath(import.meta.url));
generateMap(CONFIG, path.join(__dirname, "test.dwb"));
