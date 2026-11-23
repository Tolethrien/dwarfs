import AxiomMath from "@axiom/math";
import { Camera } from "@engine/camera/camera";

export const SPATIAL = {
  near: 900,
  far: 4200,
  pan: 0.8,
  lowpassHz: { near: 18000, far: 1600 },
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
    const lowpass = ctx.createBiquadFilter();
    const panner = ctx.createStereoPanner();
    lowpass.type = "lowpass";
    lowpass.frequency.value = SPATIAL.lowpassHz.near;
    gain.connect(lowpass);
    lowpass.connect(panner);
    const position = (runtimeArgs as { position?: Position2D } | undefined)?.position;
    if (position) {
      const center = Camera.getCenter;
      const view = Camera.getViewBounds;
      const away = Math.hypot(position.x - center.x, position.y - center.y);
      const distance = AxiomMath.clamp(AxiomMath.inverseLerp(SPATIAL.near, SPATIAL.far, away), 0, 1);
      gain.gain.value = 1 - distance;
      // octave scale so high-frequency rolloff sounds even across distance
      lowpass.frequency.value =
        SPATIAL.lowpassHz.near * Math.pow(SPATIAL.lowpassHz.far / SPATIAL.lowpassHz.near, distance);
      const halfWidth = (view.max.x - view.min.x) / 2;
      panner.pan.value = AxiomMath.clamp((position.x - center.x) / halfWidth, -1, 1) * SPATIAL.pan;
    }
    return {
      input: gain,
      output: panner,
      dispose: () => lowpass.disconnect(),
    };
  },
};
