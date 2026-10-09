// embers rising off a flame, looping forever: EMBER_COUNT sparks start at the bottom middle of the
// quad, drift up with a sway and burn out, each on its own cycle; snapped to EMBER_GRAIN.
// in.params.x = seed (one per flame, so neighbours differ). Additive and emissive, over 1 to bloom

const EMBER_COUNT: i32 = 7;
// seconds, shortest and longest climb
const EMBER_CYCLE: vec2f = vec2f(1.1, 2.0);
const EMBER_SWAY: f32 = 7.0;
const EMBER_SPREAD: f32 = 10.0;
const EMBER_GRAIN: f32 = 3.0;
const EMBER_HOT: vec3f = vec3f(1.0, 0.85, 0.4);
const EMBER_COOL: vec3f = vec3f(1.0, 0.3, 0.05);
const EMBER_BRIGHTNESS: f32 = 3.0;

fn emberHash(seed: f32, index: f32) -> f32 {
  return fract(sin(seed * 12.9898 + index * 78.233) * 43758.5453);
}

fn material(in: MaterialInput) -> vec4f {
  // from the bottom middle, up is negative
  let point = (floor((in.local - vec2f(0.0, in.size.y * 0.5)) / EMBER_GRAIN) + 0.5) * EMBER_GRAIN;
  let height = in.size.y;
  var light = 0.0;
  var heat = 0.0;
  for (var index = 0; index < EMBER_COUNT; index++) {
    let i = f32(index);
    let cycle = mix(EMBER_CYCLE.x, EMBER_CYCLE.y, emberHash(in.params.x, i));
    let life = fract(frame.time / cycle + emberHash(in.params.x, i + 10.0));
    let side = (emberHash(in.params.x, i + 20.0) - 0.5) * EMBER_SPREAD * 2.0;
    let sway = sin(life * 6.0 + i * 1.7) * EMBER_SWAY * life;
    let spark = vec2f(side * (0.3 + life) + sway, -life * height);
    if (all(abs(point - spark) < vec2f(EMBER_GRAIN * 0.5))) {
      let left = pow(1.0 - life, 1.5);
      if (left > light) {
        light = left;
        heat = 1.0 - life;
      }
    }
  }
  if (light <= 0.0) {
    return vec4f(0.0);
  }
  let flicker = 0.75 + 0.25 * sin(frame.time * 23.0 + point.y);
  return vec4f(mix(EMBER_COOL, EMBER_HOT, heat) * light * flicker * EMBER_BRIGHTNESS, light);
}
