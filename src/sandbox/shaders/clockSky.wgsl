// sun and moon of the clock dome (GameClock): one rect over the dome, its centre in the middle of
// the bottom edge. Gui shapes snap to whole pixels, these move slowly and would step, here they glide.
// The look copies what the shapes drew: a disc, a pale core off centre, two soft glows (the blurred
// shadows), moon craters. in.params: x = sun angle (radians, y down), y = gui scale

// shares of the dome's radius; sky must match FACE.sky in gameClock.ts
const BODY_SKY: f32 = 0.88;
const BODY_ORBIT: f32 = 0.62;
const BODY_SUN: f32 = 0.16;
const BODY_MOON: f32 = 0.13;

// colours written in srgb like the rest of the gui, it works in linear
fn bodyLinear(color: vec3f) -> vec3f {
  return pow(color, vec3f(2.2));
}
// 1 inside a disc, 0 outside, a pixel wide soft edge
fn bodyDisc(gap: f32, radius: f32) -> f32 {
  return clamp(radius - gap + 0.5, 0.0, 1.0);
}
// a blurred shadow of a disc: spread grows it, blur fades it out over that many pixels
fn bodyGlow(gap: f32, radius: f32, spread: f32, blur: f32) -> f32 {
  return exp(-max(gap - radius - spread, 0.0) / max(blur * 0.5, 0.001));
}
// premultiplied src over dst
fn bodyOver(dst: vec4f, color: vec3f, alpha: f32) -> vec4f {
  return vec4f(color * alpha, alpha) + dst * (1.0 - alpha);
}

fn material(in: MaterialInput) -> vec4f {
  let radius = in.size.x * 0.5;
  let scale = in.params.y;
  // from the dome's centre (the middle of the rect's bottom edge), y up is negative
  let point = in.local - vec2f(0.0, in.size.y * 0.5);
  let sunAngle = in.params.x;
  var out = vec4f(0.0);

  let sun = vec2f(cos(sunAngle), sin(sunAngle)) * radius * BODY_ORBIT;
  let sunRadius = radius * BODY_SUN;
  let sunGap = length(point - sun);
  let sunGlow = bodyLinear(vec3f(1.0, 0.706, 0.275));
  out = bodyOver(out, sunGlow, 0.35 * bodyGlow(sunGap, sunRadius, 4.0 * scale, 22.0 * scale));
  out = bodyOver(out, sunGlow, 0.78 * bodyGlow(sunGap, sunRadius, 2.0 * scale, 8.0 * scale));
  out = bodyOver(out, bodyLinear(vec3f(1.0, 0.839, 0.431)), bodyDisc(sunGap, sunRadius));
  let core = sun - sunRadius * 0.25;
  out = bodyOver(out, bodyLinear(vec3f(1.0, 0.961, 0.824)), 0.78 * bodyDisc(length(point - core), sunRadius * 0.55));

  let moon = -sun;
  let moonRadius = radius * BODY_MOON;
  let moonGap = length(point - moon);
  let moonGlow = bodyLinear(vec3f(0.588, 0.686, 1.0));
  out = bodyOver(out, moonGlow, 0.2 * bodyGlow(moonGap, moonRadius, 0.0, 22.0 * scale));
  out = bodyOver(out, moonGlow, 0.43 * bodyGlow(moonGap, moonRadius, 1.0 * scale, 10.0 * scale));
  out = bodyOver(out, bodyLinear(vec3f(0.886, 0.894, 0.949)), bodyDisc(moonGap, moonRadius));
  // a var: indexed by a runtime value; offset in moon radii, size share
  var craters = array<vec3f, 3>(vec3f(-0.3, -0.2, 0.28), vec3f(0.32, 0.18, 0.2), vec3f(-0.05, 0.42, 0.16));
  let crater = bodyLinear(vec3f(0.714, 0.729, 0.808));
  for (var index = 0; index < 3; index++) {
    let spot = moon + craters[index].xy * moonRadius;
    out = bodyOver(out, crater, bodyDisc(length(point - spot), craters[index].z * moonRadius));
  }
  // nothing spills over the rim: cut to the sky's disc
  return out * in.color.a * bodyDisc(length(point), radius * BODY_SKY);
}
