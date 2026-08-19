// generateMap.ts — generuje losowy .dwb z czterema warstwami
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

interface MapGenConfig {
  tileSize: Size2D; // px
  chunkSize: Size2D; // tile'i
  mapSize: Size2D; // chunk'ów
  start: Position2D; // px — lewy górny róg mapy w świecie
}

const CONFIG: MapGenConfig = {
  tileSize: { width: 96, height: 96 },
  chunkSize: { width: 32, height: 32 },
  mapSize: { width: 12, height: 12 },
  start: { x: 0, y: 0 },
};

const HEADER_SIZE = 20;
const BORDER_TYPE = 3;
const BG_SHADES = 32;
const DECO_BACK_CHANCE = 0.02;
const DECO_FRONT_CHANCE = 0.01;

/** wszystkie sekcje u16, więc kolejność jest dowolna — nie ma czego wyrównywać */
const SECTIONS = [
  { name: "background", bytes: 2 },
  { name: "decoBack", bytes: 2 },
  { name: "solidType", bytes: 2 },
  { name: "solidDamage", bytes: 2 },
  { name: "decoFront", bytes: 2 },
] as const;

type SectionName = (typeof SECTIONS)[number]["name"];

function generateMap(config: MapGenConfig, outPath: string): void {
  const { tileSize, chunkSize, mapSize, start } = config;

  const blocksPerChunk = chunkSize.width * chunkSize.height;
  const totalChunks = mapSize.width * mapSize.height;
  const totalBlocks = blocksPerChunk * totalChunks;
  const mapTilesW = chunkSize.width * mapSize.width;
  const mapTilesH = chunkSize.height * mapSize.height;

  const base = {} as Record<SectionName, number>;
  let cursor = HEADER_SIZE;
  for (const section of SECTIONS) {
    base[section.name] = cursor;
    cursor += totalBlocks * section.bytes;
  }

  const buffer = Buffer.alloc(cursor);

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

    // każdy chunk dostaje inny odcień — od razu widać granice chunków na ekranie
    const bgShade = (chunkIndex % BG_SHADES) + 1;

    for (let ly = 0; ly < chunkSize.height; ly++) {
      for (let lx = 0; lx < chunkSize.width; lx++) {
        const globalX = chunkX * chunkSize.width + lx;
        const globalY = chunkY * chunkSize.height + ly;
        const blockIndex =
          chunkIndex * blocksPerChunk + ly * chunkSize.width + lx;

        const isBorder =
          globalX === 0 ||
          globalY === 0 ||
          globalX === mapTilesW - 1 ||
          globalY === mapTilesH - 1;

        buffer.writeUInt16LE(bgShade, base.background + blockIndex * 2);
        buffer.writeUInt16LE(
          isBorder ? BORDER_TYPE : Math.floor(Math.random() * 3),
          base.solidType + blockIndex * 2,
        );
        // solidDamage zostaje 0 — Buffer.alloc już wyzerował

        // 0 = brak dekoracji
        if (Math.random() < DECO_BACK_CHANCE)
          buffer.writeUInt16LE(1, base.decoBack + blockIndex * 2);
        if (Math.random() < DECO_FRONT_CHANCE)
          buffer.writeUInt16LE(2, base.decoFront + blockIndex * 2);
      }
    }
  }

  fs.writeFileSync(outPath, buffer);

  console.log(`Zapisano ${outPath}`);
  console.log(`  bloków: ${totalBlocks.toLocaleString()}`);
  console.log(`  rozmiar: ${(buffer.length / 1024 / 1024).toFixed(2)} MB`);
  console.log(`  sekcje:`);
  for (const section of SECTIONS)
    console.log(`    ${section.name.padEnd(12)} @ ${base[section.name]}`);
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
generateMap(CONFIG, path.join(__dirname, "test.dwb"));
