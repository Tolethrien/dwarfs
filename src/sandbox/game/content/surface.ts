// a cave hall over the mine: the ceiling's and the floor's strips repeated across the
// map, every other one mirrored, the middle filled with their color
export const SURFACE = {
  height: 1500,
  color: [22, 21, 23, 255] as RGBA,
  // the floor strip's road, in pixels over the mine's top: the surface's buildings stand on it
  ground: 64,
  ceiling: { width: 2172, height: 340 },
  floor: { width: 2172, height: 260 },
  // the hall's own light: dim and cool over all of it, warm around the shaft's mouth
  light: {
    hall: { color: [170, 190, 235, 255] as RGBA, intensity: 0.45, softness: 300 },
    mouth: { color: [255, 180, 110, 255] as RGBA, radius: 2200, intensity: 0.9 },
  },
};
