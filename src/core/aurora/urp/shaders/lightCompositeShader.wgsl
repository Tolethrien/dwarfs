@group(2) @binding(0) var scene: texture_2d<f32>;
@group(2) @binding(1) var lightMap: texture_2d<f32>;
// share of the pixel drawn by emissive materials, see WorldPass
@group(2) @binding(2) var emissive: texture_2d<f32>;
// Light.setLimit: up to lightKnee the light stays, past it the brightest channel bends softly
// toward lightMax, the color kept; lightMax 0: no limit
override lightKnee: f32 = 0.0;
override lightMax: f32 = 0.0;

fn limitLight(light: vec3f) -> vec3f {
  let peak = max(light.r, max(light.g, light.b));
  if (lightMax <= 0.0 || peak <= lightKnee) {
    return light;
  }
  let room = lightMax - lightKnee;
  let soft = lightKnee + room * (1.0 - exp(-(peak - lightKnee) / room));
  return light * (soft / peak);
}

@fragment
fn fragmentMain(in: FullscreenOut) -> @location(0) vec4f {
  // all at render resolution, read texel to texel
  let pixel = vec2u(in.position.xy);
  let color = textureLoad(scene, pixel, 0);
  let light = limitLight(textureLoad(lightMap, pixel, 0).rgb);
  let glow = textureLoad(emissive, pixel, 0).r;
  // emissive keeps its own color, the rest takes the light; premultiplied, coverage stays
  return vec4f(color.rgb * mix(light, vec3f(1.0), glow), color.a);
}
