// generateMap.ts — użycie: ts-node generateMap.ts <input.png> <output.json>
import fs from "fs";
import zlib from "zlib";

const COLOR_MAP: { rgb: [number, number, number]; type: number }[] = [
  { rgb: [255, 0, 0], type: 0 }, // red
  { rgb: [0, 255, 0], type: 1 }, // green
  { rgb: [0, 0, 255], type: 2 }, // blue
  { rgb: [0, 0, 0], type: 3 }, // black
];
const ALPHA_THRESHOLD = 10; // poniżej = pusty tile
const PNG_SIGNATURE = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
]);

interface DecodedPng {
  width: number;
  height: number;
  pixels: Uint8Array; // RGBA, 4 bajty na piksel
}

function decodePng(buffer: Buffer): DecodedPng {
  if (!buffer.subarray(0, 8).equals(PNG_SIGNATURE)) {
    throw new Error("To nie jest poprawny plik PNG");
  }

  let width = 0;
  let height = 0;
  let bitDepth = 0;
  let colorType = 0;
  let interlace = 0;
  const idatChunks: Buffer[] = [];

  let offset = 8;
  while (offset < buffer.length) {
    const length = buffer.readUInt32BE(offset);
    const type = buffer.toString("ascii", offset + 4, offset + 8);
    const data = buffer.subarray(offset + 8, offset + 8 + length);

    if (type === "IHDR") {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      bitDepth = data.readUInt8(8);
      colorType = data.readUInt8(9);
      interlace = data.readUInt8(12);
    } else if (type === "IDAT") {
      idatChunks.push(data);
    } else if (type === "IEND") {
      break;
    }

    offset += 8 + length + 4; // + CRC
  }

  if (bitDepth !== 8)
    throw new Error(`Obsługiwany jest tylko bitDepth 8, plik ma ${bitDepth}`);
  if (colorType !== 2 && colorType !== 6)
    throw new Error(
      `Obsługiwane są tylko RGB (2) i RGBA (6), plik ma colorType ${colorType}`,
    );
  if (interlace !== 0)
    throw new Error(
      "Interlaced PNG nie jest obsługiwany, zapisz bez interlace",
    );

  const bpp = colorType === 6 ? 4 : 3;
  const rowBytes = width * bpp;
  const raw = zlib.inflateSync(Buffer.concat(idatChunks));
  const unfiltered = new Uint8Array(height * rowBytes);

  for (let y = 0; y < height; y++) {
    const filterType = raw[y * (rowBytes + 1)];
    const rowIn = y * (rowBytes + 1) + 1;
    const rowOut = y * rowBytes;

    for (let x = 0; x < rowBytes; x++) {
      const raw_ = raw[rowIn + x];
      const a = x >= bpp ? unfiltered[rowOut + x - bpp] : 0; // pixel po lewej
      const b = y > 0 ? unfiltered[rowOut - rowBytes + x] : 0; // pixel nad
      const c = x >= bpp && y > 0 ? unfiltered[rowOut - rowBytes + x - bpp] : 0; // po skosie

      let value = raw_;
      switch (filterType) {
        case 1:
          value = raw_ + a;
          break;
        case 2:
          value = raw_ + b;
          break;
        case 3:
          value = raw_ + ((a + b) >> 1);
          break;
        case 4:
          value = raw_ + paeth(a, b, c);
          break;
      }
      unfiltered[rowOut + x] = value & 0xff;
    }
  }

  const pixels = new Uint8Array(width * height * 4);
  for (let i = 0, p = 0; i < unfiltered.length; i += bpp, p += 4) {
    pixels[p] = unfiltered[i];
    pixels[p + 1] = unfiltered[i + 1];
    pixels[p + 2] = unfiltered[i + 2];
    pixels[p + 3] = bpp === 4 ? unfiltered[i + 3] : 255;
  }

  return { width, height, pixels };
}

// standardowy predyktor PNG dla filtra typu 4 (Paeth)
function paeth(a: number, b: number, c: number): number {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  if (pa <= pb && pa <= pc) return a;
  if (pb <= pc) return b;
  return c;
}

function closestType(r: number, g: number, b: number): number {
  let best = COLOR_MAP[0];
  let bestDist = Infinity;
  for (const c of COLOR_MAP) {
    const dist =
      (r - c.rgb[0]) ** 2 + (g - c.rgb[1]) ** 2 + (b - c.rgb[2]) ** 2;
    if (dist < bestDist) {
      bestDist = dist;
      best = c;
    }
  }
  return best.type;
}

function generateMap(inputPath: string, outputPath: string) {
  const png = decodePng(fs.readFileSync(inputPath));
  const tiles: { index: number; type: number }[] = [];

  for (let y = 0; y < png.height; y++) {
    for (let x = 0; x < png.width; x++) {
      const i = (y * png.width + x) * 4;
      const a = png.pixels[i + 3];
      if (a < ALPHA_THRESHOLD) continue;

      tiles.push({
        index: y * png.width + x,
        type: closestType(png.pixels[i], png.pixels[i + 1], png.pixels[i + 2]),
      });
    }
  }

  const grid = { width: png.width, height: png.height, tiles };
  fs.writeFileSync(outputPath, JSON.stringify(grid));
  console.log(
    `Zapisano ${tiles.length} tile'i (${png.width}x${png.height}) -> ${outputPath}`,
  );
}

const [, , inputPath, outputPath] = process.argv;
if (!inputPath || !outputPath) {
  console.error("Użycie: ts-node generateMap.ts <input.png> <output.json>");
  process.exit(1);
}

generateMap(inputPath, outputPath);
