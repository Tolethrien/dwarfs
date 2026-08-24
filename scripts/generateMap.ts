// generateMap.ts — generuje testowy .dwb
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import {
  HEADER_SIZE,
  SECTIONS,
  sectionOffsets,
  dataSize,
  type SectionName,
} from "../src/mapFormat.ts";
import {
  BlocksID,
  DecosID,
  BackgroundsID,
} from "../src/sandbox/managers/entitiesObject.ts";

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

const BORDER = BlocksID.obsidian;
const START_CHUNK = 3; // jedyny odkryty na starcie
const DECO_BACK_CHANCE = 0.02;
const DECO_FRONT_CHANCE = 0.01;
const CHUNKS_PER_BIOME = 3; // biomy jako pasma głębokości

/** górna połowa mapy — brązy, dolna — szarości, losowo w obrębie połowy */
const ROCKS_TOP = [BlocksID.rocksLightBrown, BlocksID.rocksBrown];
const ROCKS_BOTTOM = [
  BlocksID.rocksGray,
  BlocksID.rocksDarkGray,
  BlocksID.rocksLightGray,
];

/** drobne ubytki w skale, żeby nie było zbitej ściany */
const AIR_CHANCE = 0.12;

/** szyb startowy — środkiem chunka, w dół na całą jego wysokość */
const START_TUNNEL_WIDTH = 3; // przy 2 kafelkach kulka o średnicy 110 px ledwo się mieści

/** jaskinie — puste plamy w skale */
const CAVES = { count: 90, radius: [2, 6] as const };

/**
 * Skrzynie. Muszą siedzieć w LITEJ skale — wyglądają jak zwykła ściana,
 * dopóki krasnolud w nie nie trafi. Chunki `guaranteed` dostają swoje na pewno,
 * reszta jest rozsypana losowo po całej mapie.
 */
const CHESTS = {
  random: 25,
  guaranteed: [1, 2, 3],
  perGuaranteed: [2, 4] as const,
};

/**
 * Złoża. `depth` to zakres głębokości 0–1, więc diamenty siedzą nisko,
 * a węgiel wysoko. `count` i `radius` sterują rzadkością i wielkością plamy.
 */
const VEINS = [
  {
    type: BlocksID.coal,
    count: 140,
    radius: [2, 5] as const,
    depth: [0.0, 0.6] as const,
  },
  {
    type: BlocksID.bonesOne,
    count: 50,
    radius: [2, 4] as const,
    depth: [0.1, 0.7] as const,
  },
  {
    type: BlocksID.bonesTwo,
    count: 40,
    radius: [2, 4] as const,
    depth: [0.2, 0.8] as const,
  },
  {
    type: BlocksID.silver,
    count: 60,
    radius: [2, 4] as const,
    depth: [0.3, 0.9] as const,
  },
  {
    type: BlocksID.gold,
    count: 35,
    radius: [1, 3] as const,
    depth: [0.5, 1.0] as const,
  },
  {
    type: BlocksID.sapphire,
    count: 22,
    radius: [1, 3] as const,
    depth: [0.6, 1.0] as const,
  },
  {
    type: BlocksID.diamonds,
    count: 12,
    radius: [1, 2] as const,
    depth: [0.8, 1.0] as const,
  },
];

const randInt = (min: number, max: number) =>
  min + Math.floor(Math.random() * (max - min + 1));

const BG_TYPES = Object.values(BackgroundsID).filter(
  (v) => typeof v === "number" && v !== BackgroundsID.none,
) as BackgroundsID[];

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

  /** globalne (gx,gy) -> indeks bloku w układzie chunk-major */
  const blockIndex = (gx: number, gy: number) => {
    const cx = Math.floor(gx / chunkSize.width);
    const cy = Math.floor(gy / chunkSize.height);
    const local =
      (gy - cy * chunkSize.height) * chunkSize.width +
      (gx - cx * chunkSize.width);
    return (cy * mapSize.width + cx) * blocksPerChunk + local;
  };

  const setSolid = (gx: number, gy: number, type: BlocksID) => {
    if (gx < 0 || gy < 0 || gx >= mapTilesW || gy >= mapTilesH) return;
    buffer.writeUInt16LE(type, at("solidType", blockIndex(gx, gy), 2));
  };

  const getSolid = (gx: number, gy: number): BlocksID => {
    if (gx < 0 || gy < 0 || gx >= mapTilesW || gy >= mapTilesH)
      return BlocksID.obsidian;
    return buffer.readUInt16LE(at("solidType", blockIndex(gx, gy), 2));
  };

  const pick = <T>(arr: readonly T[]) =>
    arr[Math.floor(Math.random() * arr.length)];

  /** plama o nierównej krawędzi — stąd „złoża", a nie kwadraty */
  const blob = (
    cx: number,
    cy: number,
    rx: number,
    ry: number,
    type: BlocksID,
  ) => {
    for (let dy = -ry; dy <= ry; dy++) {
      for (let dx = -rx; dx <= rx; dx++) {
        const d = (dx * dx) / (rx * rx) + (dy * dy) / (ry * ry);
        if (d <= 1 + (Math.random() - 0.5) * 0.7)
          setSolid(cx + dx, cy + dy, type);
      }
    }
  };

  /** stawia skrzynię w losowym LITYM kaflu z zakresu; false gdy nie znalazł miejsca */
  const placeChest = (
    minX: number,
    maxX: number,
    minY: number,
    maxY: number,
  ) => {
    for (let attempt = 0; attempt < 60; attempt++) {
      const gx = randInt(minX, maxX);
      const gy = randInt(minY, maxY);
      const current = getSolid(gx, gy);
      if (current === BlocksID.air || current === BlocksID.hiddenChest)
        continue;
      setSolid(gx, gy, BlocksID.hiddenChest);
      return true;
    }
    return false;
  };

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

  // ---- skała + tło + dekoracje ----
  const half = mapTilesH / 2;
  for (let gy = 0; gy < mapTilesH; gy++) {
    const rocks = gy < half ? ROCKS_TOP : ROCKS_BOTTOM;

    for (let gx = 0; gx < mapTilesW; gx++) {
      const index = blockIndex(gx, gy);

      buffer.writeUInt16LE(pick(BG_TYPES), at("background", index, 2));
      buffer.writeUInt16LE(
        Math.random() < AIR_CHANCE ? BlocksID.air : pick(rocks),
        at("solidType", index, 2),
      );
      // solidDamage zostaje 0 — Buffer.alloc wyzerował

      if (Math.random() < DECO_BACK_CHANCE)
        buffer.writeUInt16LE(DecosID.flower, at("decoBack", index, 2));
      if (Math.random() < DECO_FRONT_CHANCE)
        buffer.writeUInt16LE(DecosID.flower, at("decoFront", index, 2));
    }
  }

  // ---- jaskinie ----
  for (let i = 0; i < CAVES.count; i++) {
    blob(
      randInt(0, mapTilesW - 1),
      randInt(0, mapTilesH - 1),
      randInt(CAVES.radius[0], CAVES.radius[1]),
      randInt(CAVES.radius[0], CAVES.radius[1]),
      BlocksID.air,
    );
  }

  // ---- złoża ----
  for (const vein of VEINS) {
    const minY = Math.floor(vein.depth[0] * mapTilesH);
    const maxY = Math.floor(vein.depth[1] * mapTilesH) - 1;

    for (let i = 0; i < vein.count; i++) {
      blob(
        randInt(0, mapTilesW - 1),
        randInt(minY, maxY),
        randInt(vein.radius[0], vein.radius[1]),
        randInt(vein.radius[0], vein.radius[1]),
        vein.type,
      );
    }
  }

  // ---- szyb startowy, po złożach żeby nic go nie zasypało ----
  const tcx = START_CHUNK % mapSize.width;
  const tcy = Math.floor(START_CHUNK / mapSize.width);
  const tunnelX = tcx * chunkSize.width + Math.floor(chunkSize.width / 2);
  const tunnelHalf = Math.floor(START_TUNNEL_WIDTH / 2);

  for (let gy = tcy * chunkSize.height; gy < (tcy + 1) * chunkSize.height; gy++)
    for (let dx = -tunnelHalf; dx <= tunnelHalf; dx++)
      setSolid(tunnelX + dx, gy, BlocksID.air);

  // ---- skrzynie: po szybie (żeby ich nie wykuł), przed ramką (żeby ramka wygrała) ----
  let chestCount = 0;

  for (const chunkIndex of CHESTS.guaranteed) {
    const cx = chunkIndex % mapSize.width;
    const cy = Math.floor(chunkIndex / mapSize.width);
    const howMany = randInt(CHESTS.perGuaranteed[0], CHESTS.perGuaranteed[1]);

    for (let i = 0; i < howMany; i++) {
      const placed = placeChest(
        cx * chunkSize.width,
        (cx + 1) * chunkSize.width - 1,
        cy * chunkSize.height,
        (cy + 1) * chunkSize.height - 1,
      );
      if (placed) chestCount++;
    }
  }

  for (let i = 0; i < CHESTS.random; i++) {
    if (placeChest(0, mapTilesW - 1, 0, mapTilesH - 1)) chestCount++;
  }

  // ---- ramka na końcu, żeby nic jej nie nadpisało ----
  for (let gx = 0; gx < mapTilesW; gx++) {
    setSolid(gx, 0, BORDER);
    setSolid(gx, mapTilesH - 1, BORDER);
  }
  for (let gy = 0; gy < mapTilesH; gy++) {
    setSolid(0, gy, BORDER);
    setSolid(mapTilesW - 1, gy, BORDER);
  }

  // ---- zapis ----
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
  console.log(
    `  szyb startowy: kolumna ${tunnelX}, szerokość ${START_TUNNEL_WIDTH}`,
  );
  console.log(
    `  skrzynie: ${chestCount} (gwarantowane w chunkach ${CHESTS.guaranteed.join(", ")})`,
  );
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
