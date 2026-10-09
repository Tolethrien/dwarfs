// the minimap (gui): a window of the map tiles texture, one texel per tile in the colour of its
// block (Minimap.ts), nearest so the tiles stay square. in.params: xy = the window's centre in
// tiles, z = tiles across the width. Outside the map stays empty, the plate behind shows

// replaced by Minimap.register: the minimapTiles binding
// MINIMAP_MAP

// the window darkens toward its edges
const MINIMAP_EDGE_SHADE: f32 = 0.35;
// the block colours toned down: this share toward grey and this much darker
const MINIMAP_MUTE: f32 = 0.25;
const MINIMAP_DIM: f32 = 0.25;

fn material(in: MaterialInput) -> vec4f {
  let perPixel = in.params.z / in.size.x;
  let tile = in.params.xy + in.local * perPixel;
  let size = vec2f(textureDimensions(minimapTiles));
  if (any(tile < vec2f(0.0)) || any(tile >= size)) {
    return vec4f(0.0);
  }
  // an srgb texture: already linear, straight alpha
  let texel = textureLoad(minimapTiles, vec2i(floor(tile)), 0);
  let grey = vec3f(dot(texel.rgb, vec3f(0.2126, 0.7152, 0.0722)));
  let muted = mix(texel.rgb, grey, MINIMAP_MUTE) * (1.0 - MINIMAP_DIM);
  let shade = 1.0 - MINIMAP_EDGE_SHADE * smoothstep(0.55, 1.0, length(in.uv * 2.0 - 1.0));
  return vec4f(muted * shade * texel.a, texel.a) * in.color.a;
}
