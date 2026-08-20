// generateMap.ts — generuje testowy .dwb
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import {
  HEADER_SIZE,
  SECTIONS,
  sectionOffsets,
  dataSize,
  BG_SHADES,
  type SectionName,
} from "../src/mapFormat.ts";
import { BlocksID, DecosID } from "../src/sandbox/managers/entitiesObject.ts";
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

/** bedrock jest wyłącznie ramką, nie losowym terenem */
const TERRAIN = [BlocksID.air, BlocksID.rock, BlocksID.coal];
const BORDER = BlocksID.bedrock;

const START_CHUNK = 3; // jedyny odkryty na starcie
const DECO_BACK_CHANCE = 0.02;
const DECO_FRONT_CHANCE = 0.01;
const CHUNKS_PER_BIOME = 3; // biomy jako pasma głębokości

function generateMap(config: MapGenConfig, outPaths: string[]): void {
  const { tileSize, chunkSize, mapSize, start } = config;

  const blocksPerChunk = chunkSize.width * chunkSize.height;
  const totalChunks = mapSize.width * mapSize.height;
  const totalBlocks = blocksPerChunk * totalChunks;
  const mapTilesW = chunkSize.width * mapSize.width;
  const mapTilesH = chunkSize.height * mapSize.height;

  const offsets = sectionOffsets(totalBlocks, totalChunks);
  const buffer = Buffer.alloc(HEADER_SIZE + dataSize(totalBlocks, totalChunks));

  const at = (section: SectionName, index: number, bytes: number) =>
    HEADER_SIZE + offsets[section] + index * bytes;

  // ---- nagłówek ----
  buffer.writeInt32LE(start.x, 0);
  buffer.writeInt32LE(start.y, 4);
  buffer.writeUInt16LE(tileSize.width, 8);
  buffer.writeUInt16LE(tileSize.height, 10);
  buffer.writeUInt16LE(chunkSize.width, 12);
  buffer.writeUInt16LE(chunkSize.height, 14);
  buffer.writeUInt16LE(mapSize.width, 16);
  buffer.writeUInt16LE(mapSize.height, 18);

  // ---- sekcje per chunk ----
  for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex++) {
    const cy = Math.floor(chunkIndex / mapSize.width);
    buffer.writeUInt8(
      chunkIndex === START_CHUNK ? 1 : 0,
      at("discovered", chunkIndex, 1),
    );
    buffer.writeUInt8(
      Math.floor(cy / CHUNKS_PER_BIOME),
      at("biome", chunkIndex, 1),
    );
  }

  // ---- sekcje per blok ----
  for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex++) {
    const chunkX = chunkIndex % mapSize.width;
    const chunkY = Math.floor(chunkIndex / mapSize.width);
    // inny odcień na każdy chunk — od razu widać granice chunków
    const bgShade = (chunkIndex % BG_SHADES) + 1;

    for (let ly = 0; ly < chunkSize.height; ly++) {
      for (let lx = 0; lx < chunkSize.width; lx++) {
        const gx = chunkX * chunkSize.width + lx;
        const gy = chunkY * chunkSize.height + ly;
        const index = chunkIndex * blocksPerChunk + ly * chunkSize.width + lx;

        const isBorder =
          gx === 0 || gy === 0 || gx === mapTilesW - 1 || gy === mapTilesH - 1;

        buffer.writeUInt16LE(bgShade, at("background", index, 2));
        buffer.writeUInt16LE(
          isBorder
            ? BORDER
            : TERRAIN[Math.floor(Math.random() * TERRAIN.length)],
          at("solidType", index, 2),
        );
        // solidDamage zostaje 0 — Buffer.alloc wyzerował

        // 0 = brak dekoracji
        if (Math.random() < DECO_BACK_CHANCE)
          buffer.writeUInt16LE(DecosID.flower, at("decoBack", index, 2));
        if (Math.random() < DECO_FRONT_CHANCE)
          buffer.writeUInt16LE(DecosID.flower, at("decoFront", index, 2));
      }
    }
  }

  for (const out of outPaths) {
    fs.mkdirSync(path.dirname(out), { recursive: true });
    fs.writeFileSync(out, buffer);
    console.log(`Zapisano ${out}`);
  }

  console.log(
    `  bloków: ${totalBlocks.toLocaleString()}, chunków: ${totalChunks}`,
  );
  console.log(`  rozmiar: ${(buffer.length / 1024 / 1024).toFixed(2)} MB`);
  console.log(`  odkryty na starcie: chunk ${START_CHUNK}`);
  for (const section of SECTIONS)
    console.log(
      `    ${section.name.padEnd(12)} @ ${offsets[section.name]} (u${section.bytes * 8}, per ${section.per})`,
    );
}
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");

const OUTPUTS = [
  path.join(__dirname, "test.dwb"),
  path.join(ROOT, ".vite", "build", "test.dwb"),
];

generateMap(CONFIG, OUTPUTS);
