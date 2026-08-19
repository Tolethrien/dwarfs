export const HEADER_SIZE = 20;

export const SECTIONS = [
  { name: "background", bytes: 2 },
  { name: "decoBack", bytes: 2 },
  { name: "solidType", bytes: 2 },
  { name: "solidDamage", bytes: 2 },
  { name: "decoFront", bytes: 2 },
] as const;

export type SectionName = (typeof SECTIONS)[number]["name"];
export type SectionOffsets = Record<SectionName, number>;

/** offsety liczone OD POCZĄTKU DANYCH, czyli już po zdjęciu nagłówka */
export function sectionOffsets(totalBlocks: number): SectionOffsets {
  const offsets = {} as SectionOffsets;
  let cursor = 0;
  for (const section of SECTIONS) {
    offsets[section.name] = cursor;
    cursor += totalBlocks * section.bytes;
  }
  return offsets;
}
