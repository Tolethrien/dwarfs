// dust floating in the air (ScreenEffect, "world" stage, after the fog): pale specks drifting and
// wobbling slowly; drawn before the light composite and only where the light map is well above the
// ambient, so they show in the headlight beams and around torches, not in the dark; colourful and
// over 1 there, so they bloom. They float in the world, a moving camera passes them by. in.params:
// x = how many (share of the cells holding a speck), y = speck size in world units, z = drift
// speed, w = twinkle 0-1.
// Colour from the layer's colour, blend "mix"

// one speck at most per cell, world units; two layers, the far one finer and slower
const MOTE_CELL: f32 = 80.0;
const MOTE_LAYERS: i32 = 2;
const MOTE_FAR_SCALE: f32 = 0.6;
const MOTE_DRIFT: vec2f = vec2f(0.6, -0.35);
const MOTE_WOBBLE: f32 = 0.18;
// world units per pixel art step
const MOTE_GRAIN: f32 = 6.0;
// light map strength where they start to show and where they are full: above the mine's ambient
const MOTE_LIGHT: vec2f = vec2f(0.35, 0.9);
// lit, they go over 1 and bloom; each speck takes one colour of the palette in effect(), the layer
// colour tints them all
const MOTE_GLOW: f32 = 3.0;

fn moteHash(point: vec2f) -> f32 {
  return fract(sin(dot(point, vec2f(127.1, 311.7))) * 43758.5453);
}

fn effect(in: EffectInput) -> vec4f {
  let time = in.time * in.params.z;
  let pixel = (floor(in.world / MOTE_GRAIN) + 0.5) * MOTE_GRAIN;
  // a var: indexed by a runtime value
  var palette = array<vec3f, 4>(
    vec3f(1.0, 0.75, 0.35),
    vec3f(0.45, 0.9, 1.0),
    vec3f(0.85, 0.55, 1.0),
    vec3f(1.0, 0.95, 0.85),
  );
  var amount = 0.0;
  var color = vec3f(1.0);
  for (var layer = 0; layer < MOTE_LAYERS; layer++) {
    let near = layer == 0;
    let scale = select(MOTE_FAR_SCALE, 1.0, near);
    let cellSize = MOTE_CELL * scale;
    let point = pixel / cellSize + MOTE_DRIFT * time * scale * 0.1 + f32(layer) * 17.3;
    let cell = floor(point);
    let seed = moteHash(cell + f32(layer) * 31.0);
    if (seed > in.params.x) {
      continue;
    }
    let phase = seed * 6.2831853;
    let home = vec2f(moteHash(cell + 11.0), moteHash(cell + 23.0)) * 0.5 + 0.25;
    let wobble = vec2f(sin(time * 0.7 + phase), cos(time * 0.5 + phase * 1.7)) * MOTE_WOBBLE;
    let gap = length((fract(point) - home - wobble) * cellSize);
    let size = in.params.y * scale * mix(0.6, 1.2, moteHash(cell + 5.0));
    let twinkle = mix(1.0, 0.5 + 0.5 * sin(time * 2.3 + phase * 3.0), in.params.w);
    let speck = (1.0 - step(size, gap)) * twinkle * select(0.6, 1.0, near);
    if (speck > amount) {
      amount = speck;
      color = palette[u32(moteHash(cell + 41.0) * 3.999)];
    }
  }
  // the ambient alone must not show them: only real light, a beam or a torch
  let lit = smoothstep(MOTE_LIGHT.x, MOTE_LIGHT.y, max(in.light.r, max(in.light.g, in.light.b)));
  return vec4f(in.color * color * MOTE_GLOW, amount * lit);
}
