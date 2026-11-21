// unlit glow, hidden by the fog of war and optional mask (in.params.y: albedo layer, < 0 none)
fn material(in: MaterialInput) -> vec4f {
  let outline = in.outlineColor * in.ring;
  let base = outline + in.color * in.texel * (1.0 - outline.a);
  var mask = 1.0;
  if (in.params.y >= 0.0) {
    let corner = in.uvRect.xy + in.uvRect.zw;
    let low = min(in.uvRect.xy, corner) + 0.5;
    let high = max(in.uvRect.xy, corner) - 0.5;
    let uv = clamp(in.texelPosition, low, high) / vec2f(textureDimensions(albedo, 0));
    mask = textureSampleLevel(albedo, texSampler, uv, u32(in.params.y), in.lod).r;
  }
  let visible = fogLightShade(in.world) * mask;
  materialGlow = visible;
  return vec4f(base.rgb * mix(1.0, in.params.x, visible), base.a);
}
