import type { OutlineLook } from "./build";

export const BUILD_LOOK = {
  outline: {
    free: { fill: [120, 230, 140, 50] as RGBA, border: [150, 255, 170, 220] as RGBA } as OutlineLook,
    refused: { fill: [240, 90, 70, 50] as RGBA, border: [255, 110, 90, 220] as RGBA } as OutlineLook,
    inTheWay: [255, 60, 40, 150] as RGBA,
    width: 0.12,
  },
  reserve: {
    free: { fill: [120, 230, 140, 18] as RGBA, border: [150, 255, 170, 110] as RGBA } as OutlineLook,
    refused: { fill: [240, 90, 70, 18] as RGBA, border: [255, 110, 90, 110] as RGBA } as OutlineLook,
    built: { fill: [200, 200, 220, 18] as RGBA, border: [200, 200, 220, 90] as RGBA } as OutlineLook,
    width: 0.06,
  },
  drag: {
    text: { size: 0.45, gap: 0.4 },
  },
  rotateDeadzoneSq: 16,
};
