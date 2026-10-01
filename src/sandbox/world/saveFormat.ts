export const SAVE_FORMAT = { magic: "KRSN", version: 1 };

// written into every save: never change or reuse an id, a new section takes the next number
export const SAVE_SECTION = {
  meta: 1,
  terrain: 2,
  damage: 3,
  discovered: 4,
  biomes: 5,
  // 6: objects, 8: dwarfs, both went into actors
  resources: 7,
  actors: 9,
  decos: 10,
};
