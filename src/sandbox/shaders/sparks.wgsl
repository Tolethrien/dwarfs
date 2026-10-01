// sparks of a hit: SPARK_COUNT particles fly out of the quad's centre, direction, speed and life
// from the hash of (seed, index), falling with SPARK_GRAVITY, snapped to SPARK_SIZE grains.
// in.params: x = birth (game time), y = duration in s, z = seed.
// Additive and emissive (Materials.sparks): they glow in the dark mine and feed the bloom
const SPARK_COUNT: i32 = 14;
const SPARK_SPEED_MIN: f32 = 120.0;
const SPARK_SPEED_MAX: f32 = 380.0;
const SPARK_GRAVITY: f32 = 900.0;
// shortest life as a share of the duration, the longest is the whole of it
const SPARK_LIFE_MIN: f32 = 0.45;
const SPARK_SIZE: f32 = 3.0;
const SPARK_HOT: vec3f = vec3f(1.0, 0.9, 0.55);
const SPARK_COOL: vec3f = vec3f(1.0, 0.35, 0.05);
// frame.time wraps at this (sharedBinds.ts TIME_WRAP)
const SPARK_TIME_WRAP: f32 = 3600.0;

fn sparkHash(seed: f32, index: f32) -> f32 {
  let n = bitcast<vec2u>(vec2i(vec2f(seed, index)));
  var h = (n.x * 1597334677u) ^ (n.y * 3812015801u);
  h = (h ^ (h >> 16u)) * 2246822519u;
  h = h ^ (h >> 13u);
  return f32(h) / 4294967295.0;
}

fn material(in: MaterialInput) -> vec4f {
  var age = frame.time - in.params.x;
  if (age < 0.0) {
    age += SPARK_TIME_WRAP;
  }
  let progress = age / in.params.y;
  if (progress >= 1.0) {
    return vec4f(0.0);
  }

  let grain = floor(in.local / SPARK_SIZE);
  var light = 0.0;
  for (var index = 0; index < SPARK_COUNT; index++) {
    let i = f32(index);
    let life = mix(SPARK_LIFE_MIN, 1.0, sparkHash(in.params.z, i + 200.0));
    if (progress >= life) {
      continue;
    }
    let angle = sparkHash(in.params.z, i) * 6.2831853;
    let speed = mix(SPARK_SPEED_MIN, SPARK_SPEED_MAX, sparkHash(in.params.z, i + 100.0));
    // y grows downwards in world space
    let position = vec2f(cos(angle), sin(angle)) * speed * age + vec2f(0.0, 0.5 * SPARK_GRAVITY * age * age);
    if (all(floor(position / SPARK_SIZE) == grain)) {
      light = max(light, 1.0 - progress / life);
    }
  }
  if (light <= 0.0) {
    return vec4f(0.0);
  }
  return vec4f(mix(SPARK_COOL, SPARK_HOT, light) * light, light);
}
