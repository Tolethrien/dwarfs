// a mined tile falling apart: grains of DISSOLVE_GRAIN world units vanish one by one over
// in.params.y seconds from in.params.x (game time of the death); the centre holds out longest,
// a grain brightens just before it goes. World only (Material gui: false)

const DISSOLVE_GRAIN: f32 = 3.0;
// how much the distance from the centre orders the grains (0: pure noise)
const DISSOLVE_CENTER_BIAS: f32 = 0.3;
const DISSOLVE_GLOW_SHARE: f32 = 0.12;
const DISSOLVE_GLOW: f32 = 0.7;
// frame.time wraps at this (sharedBinds.ts TIME_WRAP)
const DISSOLVE_TIME_WRAP: f32 = 3600.0;

fn dissolveHash(cell: vec2f) -> f32 {
  let n = bitcast<vec2u>(vec2i(cell));
  var h = (n.x * 1597334677u) ^ (n.y * 3812015801u);
  h = (h ^ (h >> 16u)) * 2246822519u;
  h = h ^ (h >> 13u);
  return f32(h) / 4294967295.0;
}

fn material(in: MaterialInput) -> vec4f {
  var age = frame.time - in.params.x;
  if (age < 0.0) {
    age += DISSOLVE_TIME_WRAP;
  }
  let progress = clamp(age / in.params.y, 0.0, 1.0);

  let grain = floor(in.world / DISSOLVE_GRAIN);
  let fromCenter = clamp(length(in.local / (in.size * 0.5)), 0.0, 1.0);
  let lasts = mix(dissolveHash(grain), 1.0 - fromCenter, DISSOLVE_CENTER_BIAS);
  if (lasts < progress) {
    return vec4f(0.0);
  }

  let base = in.color * in.texel;
  let glow = select(0.0, DISSOLVE_GLOW, lasts - progress < DISSOLVE_GLOW_SHARE);
  return vec4f(base.rgb + glow * base.a, base.a);
}
