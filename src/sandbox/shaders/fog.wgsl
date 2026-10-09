// fog over the screen (ScreenEffect, "world" stage: drawn before the light composite, so the scene's
// lights light it). The swirls sit in the world, so a moving camera flies through them; only the
// thickening toward the bottom stays on the screen. in.params: x = density, y = how
// much thicker it gets toward the bottom of the screen, z = how much it billows there (folds into
// itself, clumps), w = drift speed. Colour from the layer's colour, blend "mix"

// noise cells per world unit: the size of the big swirls
const FOG_SCALE: f32 = 1.0 / 560.0;
const FOG_DRIFT: vec2f = vec2f(1.0, -0.2);
// how far the billowing bends the noise into itself
const FOG_WARP: f32 = 2.2;
// at the bottom with full density boost the fog is this many times thicker than at the top
const FOG_BOTTOM_GAIN: f32 = 2.0;
// clump edges: half width of the smoothstep, calm and fully billowing
const FOG_SOFT_EDGE: f32 = 0.45;
const FOG_CLUMP_EDGE: f32 = 0.12;

fn effect(in: EffectInput) -> vec4f {
  let density = in.params.x;
  let bottom = in.params.y;
  let billow = in.params.z;
  let time = in.time * in.params.w;

  // 0 at the top of the screen, 1 at the bottom, eased so the change is mostly in the lower half
  let low = in.uv.y * in.uv.y;
  let folding = billow * low;

  let point = in.world * FOG_SCALE + FOG_DRIFT * time * 0.05;
  let warp = vec2f(
    fbm(point + vec2f(time * 0.03, 0.0)),
    fbm(point + vec2f(5.2, 1.3) - vec2f(0.0, time * 0.02)),
  ) - 0.5;
  let swirl = fbm(point + warp * FOG_WARP * folding);

  let edge = mix(FOG_SOFT_EDGE, FOG_CLUMP_EDGE, folding);
  let shape = smoothstep(0.5 - edge, 0.5 + edge, swirl);
  let height = mix(1.0, low * FOG_BOTTOM_GAIN, bottom);
  return vec4f(in.color, clamp(density * height * shape, 0.0, 1.0));
}
