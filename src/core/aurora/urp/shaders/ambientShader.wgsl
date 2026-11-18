// copied on purpose from drawWorldShader.wgsl: every shader stays standalone for now
struct Frame {
  time: f32,
  realTime: f32,
  delta: f32,
  realDelta: f32,
  renderSize: vec2f,
  canvasSize: vec2f,
  frame: u32,
};
// must match ViewTransform in worldView.ts: view center in world units, world units to render texels
struct Camera {
  center: vec2f,
  scale: f32,
  rotation: f32,
};
@group(0) @binding(0) var<uniform> frame: Frame;
@group(0) @binding(1) var<uniform> camera: Camera;

struct Ambient {
  colorA: vec4f,
  colorB: vec4f,
  // cos, sin scaled to the render size and normalized, see LightPass.writeAmbient
  direction: vec2f,
};
@group(2) @binding(0) var<uniform> ambient: Ambient;

// replaced by Light.setAmbientMap: fn ambientAt(world: vec2f, base: vec3f) -> vec3f, the pixel's
// world point and the ambient's own color there, linear
// AMBIENT_MAP

// the inverse of worldToPixel in lightShader.wgsl
fn pixelToWorld(pixel: vec2f) -> vec2f {
  let rel = pixel - floor(frame.renderSize * 0.5);
  if (camera.rotation == 0.0) {
    return rel / camera.scale + camera.center;
  }
  let c = cos(camera.rotation);
  let s = sin(camera.rotation);
  return vec2f(rel.x * c + rel.y * s, -rel.x * s + rel.y * c) / camera.scale + camera.center;
}

@fragment
fn fragmentMain(in: FullscreenOut) -> @location(0) vec4f {
  let t = clamp(dot(in.uv - 0.5, ambient.direction) + 0.5, 0.0, 1.0);
  let base = mix(ambient.colorA.rgb, ambient.colorB.rgb, t);
  return vec4f(ambientAt(pixelToWorld(in.position.xy), base), 1.0);
}
