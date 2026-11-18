// the renderer sorts by whole hundredths (step.z in index.ts): within one, the see-through draws over the
// opaque, so what must show over another layer takes the next hundredth
export const SORT_ORDER = {
  engravings: 0.2,
  background: 0.25,
  decoBack: 0.3,
  blocks: 0.4,
  glow: 0.45,
  blueprint: 0.46,
  // over the blueprint, so build mode shows it as a plan
  shaft: 0.47,
  buildings: 0.48,
  // the camp's buildings, the wall beam over the shaft's post
  camp: 0.48,
  // the shaft's lamps, over the beams of the camp's buildings
  shaftFront: 0.49,
  dwarfs: 0.5,
  debris: 0.51,
  sparks: 0.52,
  mist: 0.55,
  decoFront: 0.6,
  effects: 1,
};
export const CULL_MARGIN = 100;
export const RENDER_SHEET = {
  dwarfs: "dwarfLayers",
  buildings: "buildings",
  rocks: "rocks",
  rocksGlow: "rocksGlow",
  backgrounds: "bg",
  caveCeiling: "caveCeiling",
  caveFloor: "caveFloor",
  items: "items",
  dwarfCard: "dwarfCard",
};
