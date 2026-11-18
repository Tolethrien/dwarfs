import AxiomMath from "@axiom/math";
import { Camera } from "@engine/camera/camera";

const SPATIAL = {
  near: 600,
  far: 2500,
  pan: 0.8,
};

export const ZOOM_VOLUME_EFFECT = {
  scope: "shared" as const,
  build: (ctx: AudioContext) => {
    const gain = ctx.createGain();
    return { input: gain, output: gain };
  },
};

// set once at the start: fine for short sounds only
export const SPATIAL_EFFECT = {
  scope: "perInstance" as const,
  build: (ctx: AudioContext, runtimeArgs?: unknown) => {
    const gain = ctx.createGain();
    const panner = ctx.createStereoPanner();
    gain.connect(panner);
    const position = (runtimeArgs as { position?: Position2D } | undefined)?.position;
    if (position) {
      const center = Camera.getCenter;
      const view = Camera.getViewBounds;
      const away = Math.hypot(position.x - center.x, position.y - center.y);
      gain.gain.value = 1 - AxiomMath.clamp(AxiomMath.inverseLerp(SPATIAL.near, SPATIAL.far, away), 0, 1);
      const halfWidth = (view.max.x - view.min.x) / 2;
      panner.pan.value = AxiomMath.clamp((position.x - center.x) / halfWidth, -1, 1) * SPATIAL.pan;
    }
    return { input: gain, output: panner };
  },
};
