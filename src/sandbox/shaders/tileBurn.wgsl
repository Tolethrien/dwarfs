// a mined tile burning away: a ragged front runs from the start point (in.params.zw, 0-1 across the
// tile) to the far corner over in.params.y seconds from in.params.x (game time of the death). Ahead of
// the front the stone chars, on it the grains glow as embers (materialGlow, over 1 for the bloom),
// behind it nothing is left. World only (Material gui: false)

const BURN_GRAIN: f32 = 3.0;
// share of the front order taken by noise instead of the distance (0: a perfect circle)
const BURN_RAGGED: f32 = 0.35;
// blobs per tile of the ragged noise
const BURN_NOISE_SCALE: f32 = 3.0;
// widths in the front's 0-1 run: embers behind it, charring ahead of it
const BURN_EMBER_WIDTH: f32 = 0.18;
const BURN_CHAR_WIDTH: f32 = 0.25;
const BURN_CHAR_SHADE: f32 = 0.75;
const BURN_CHAR_TINT: vec3f = vec3f(0.35, 0.12, 0.04);
// no tone mapping: the screen clips at 1, so the hue on screen is these times the brightness clipped
// (hot reads yellow, cool orange red), what is past 1 only feeds the bloom (threshold 1). That high
// because the bloom prefilter averages the thin ember band with the dark around it before the threshold
const BURN_EMBER_HOT: vec3f = vec3f(1.0, 0.1, 0.0);
const BURN_EMBER_COOL: vec3f = vec3f(0.6, 0.035, 0.0);
const BURN_EMBER_BRIGHTNESS: f32 = 8.0;
const BURN_FLICKER_RATE: f32 = 14.0;
const BURN_FLICKER: f32 = 0.25;
// frame.time wraps at this (sharedBinds.ts TIME_WRAP)
const BURN_TIME_WRAP: f32 = 3600.0;

fn burnHash(cell: vec2f) -> f32 {
  let n = bitcast<vec2u>(vec2i(cell));
  var h = (n.x * 1597334677u) ^ (n.y * 3812015801u);
  h = (h ^ (h >> 16u)) * 2246822519u;
  h = h ^ (h >> 13u);
  return f32(h) / 4294967295.0;
}
fn burnNoise(point: vec2f) -> f32 {
  let cell = floor(point);
  let fraction = smoothstep(vec2f(0.0), vec2f(1.0), point - cell);
  let top = mix(burnHash(cell), burnHash(cell + vec2f(1.0, 0.0)), fraction.x);
  let bottom = mix(burnHash(cell + vec2f(0.0, 1.0)), burnHash(cell + vec2f(1.0, 1.0)), fraction.x);
  return mix(top, bottom, fraction.y);
}

fn material(in: MaterialInput) -> vec4f {
  var age = frame.time - in.params.x;
  if (age < 0.0) {
    age += BURN_TIME_WRAP;
  }
  let progress = clamp(age / in.params.y, 0.0, 1.0);

  // the grain's centre, 0-1 across the tile: the whole grain burns at once, pixel art step
  let grain = floor(in.local / BURN_GRAIN);
  let point = (grain + 0.5) * BURN_GRAIN / in.size + 0.5;
  let start = in.params.zw;
  let far = max(max(length(start), length(start - vec2f(1.0, 0.0))),
                max(length(start - vec2f(0.0, 1.0)), length(start - vec2f(1.0))));
  let noise = burnNoise((point + start) * BURN_NOISE_SCALE) * 0.7 + burnHash(grain) * 0.3;
  let reach = mix(length(point - start) / far, noise, BURN_RAGGED);
  // the front starts before the closest grain and ends past the last ember
  let front = mix(-BURN_CHAR_WIDTH, 1.0 + BURN_EMBER_WIDTH, progress);

  let behind = front - reach;
  if (behind > BURN_EMBER_WIDTH) {
    return vec4f(0.0);
  }
  let base = in.color * in.texel;
  if (behind >= 0.0) {
    let heat = 1.0 - behind / BURN_EMBER_WIDTH;
    let flicker = 1.0 - BURN_FLICKER * burnHash(grain + vec2f(floor(frame.time * BURN_FLICKER_RATE), 91.0));
    // cooling embers dim too: a cool one at full brightness blooms as a deep red blob
    let brightness = mix(1.0, BURN_EMBER_BRIGHTNESS, heat);
    let ember = mix(BURN_EMBER_COOL, BURN_EMBER_HOT, heat) * brightness * flicker;
    materialGlow = 1.0;
    return vec4f(ember * base.a, base.a);
  }

  let charring = clamp(1.0 + behind / BURN_CHAR_WIDTH, 0.0, 1.0);
  let charred = mix(base.rgb * (1.0 - BURN_CHAR_SHADE), BURN_CHAR_TINT * base.a, 0.3);
  return vec4f(mix(base.rgb, charred, charring), base.a);
}
