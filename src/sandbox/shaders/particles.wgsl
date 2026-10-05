// particles of a hit: PARTICLE_COUNT fly out of the quad's centre in a cone of PARTICLE_SPREAD
// around the surface normal, speed, size and life from the hash of (seed, index), falling with
// PARTICLE_GRAVITY, snapped to PARTICLE_GRAIN. Glowing ones (sparks) fade out as light and go
// over 1 for the bloom (its prefilter averages thin bright things away otherwise); solid ones
// (chips) stay opaque in one of two colours and fade at the end of their life.
// in.params: x = birth (game time), y = duration in s, z = seed, w = normal angle in radians

// replaced by Materials.register with the style's constants:
// PARTICLE_COUNT, PARTICLE_SPREAD (half of the cone, radians), PARTICLE_SPEED_MIN/MAX,
// PARTICLE_GRAVITY, PARTICLE_LIFE_MIN (share of the duration), PARTICLE_GRAIN,
// PARTICLE_SIZE_STEPS (a particle is 1..steps grains), PARTICLE_COLOR_A/B, PARTICLE_BRIGHTNESS,
// PARTICLE_SELF_LIT (materialGlow of a solid one), PARTICLE_GLOWS
// PARTICLE_STYLE

// solid particles fade over this last share of their life
const PARTICLE_FADE: f32 = 0.3;
// frame.time wraps at this (sharedBinds.ts TIME_WRAP)
const PARTICLE_TIME_WRAP: f32 = 3600.0;

fn particleHash(seed: f32, index: f32) -> f32 {
  let n = bitcast<vec2u>(vec2i(vec2f(seed, index)));
  var h = (n.x * 1597334677u) ^ (n.y * 3812015801u);
  h = (h ^ (h >> 16u)) * 2246822519u;
  h = h ^ (h >> 13u);
  return f32(h) / 4294967295.0;
}

fn material(in: MaterialInput) -> vec4f {
  var age = frame.time - in.params.x;
  if (age < 0.0) {
    age += PARTICLE_TIME_WRAP;
  }
  let progress = age / in.params.y;
  if (progress >= 1.0) {
    return vec4f(0.0);
  }

  let grain = floor(in.local / PARTICLE_GRAIN);
  var best = 0.0;
  var shade = 0.0;
  for (var index = 0; index < PARTICLE_COUNT; index++) {
    let i = f32(index);
    let life = mix(PARTICLE_LIFE_MIN, 1.0, particleHash(in.params.z, i + 200.0));
    if (progress >= life) {
      continue;
    }
    let angle = in.params.w + (particleHash(in.params.z, i) * 2.0 - 1.0) * PARTICLE_SPREAD;
    let speed = mix(PARTICLE_SPEED_MIN, PARTICLE_SPEED_MAX, particleHash(in.params.z, i + 100.0));
    // y grows downwards in world space
    let position = vec2f(cos(angle), sin(angle)) * speed * age + vec2f(0.0, 0.5 * PARTICLE_GRAVITY * age * age);
    let size = 1.0 + floor(particleHash(in.params.z, i + 300.0) * PARTICLE_SIZE_STEPS);
    let corner = floor(position / PARTICLE_GRAIN);
    if (any(grain < corner) || any(grain >= corner + size)) {
      continue;
    }
    let left = 1.0 - progress / life;
    if (left > best) {
      best = left;
      shade = particleHash(in.params.z, i + 400.0);
    }
  }
  if (best <= 0.0) {
    return vec4f(0.0);
  }

  if (PARTICLE_GLOWS) {
    return vec4f(mix(PARTICLE_COLOR_B, PARTICLE_COLOR_A, best) * best * PARTICLE_BRIGHTNESS, best);
  }
  materialGlow = PARTICLE_SELF_LIT;
  let alpha = clamp(best / PARTICLE_FADE, 0.0, 1.0);
  let color = select(PARTICLE_COLOR_B, PARTICLE_COLOR_A, shade < 0.5) * PARTICLE_BRIGHTNESS;
  return vec4f(color * alpha, alpha);
}
