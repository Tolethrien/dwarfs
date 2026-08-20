export const HEADER_SIZE = 20;

/**
 * Sekcje u8 MUSZĄ być na końcu — inaczej przy nieparzystej liczbie elementów
 * przesuną kolejne sekcje u16 o bajt i `new Uint16Array(buffer, offset)` rzuci błąd wyrównania.
 */
export const SECTIONS = [
  { name: "background", bytes: 2, per: "block" },
  { name: "decoBack", bytes: 2, per: "block" },
  { name: "solidType", bytes: 2, per: "block" },
  { name: "solidDamage", bytes: 2, per: "block" },
  { name: "decoFront", bytes: 2, per: "block" },
  { name: "discovered", bytes: 1, per: "chunk" },
  { name: "biome", bytes: 1, per: "chunk" },
] as const;
export const BG_SHADES = 32;

export type SectionName = (typeof SECTIONS)[number]["name"];
export type SectionOffsets = Record<SectionName, number>;

/** offsety liczone OD POCZĄTKU DANYCH, czyli już po zdjęciu nagłówka */
export function sectionOffsets(
  totalBlocks: number,
  totalChunks: number,
): SectionOffsets {
  const offsets = {} as SectionOffsets;
  let cursor = 0;
  for (const section of SECTIONS) {
    offsets[section.name] = cursor;
    cursor +=
      (section.per === "block" ? totalBlocks : totalChunks) * section.bytes;
  }
  return offsets;
}

export function dataSize(totalBlocks: number, totalChunks: number) {
  return SECTIONS.reduce(
    (sum, s) => sum + (s.per === "block" ? totalBlocks : totalChunks) * s.bytes,
    0,
  );
}
