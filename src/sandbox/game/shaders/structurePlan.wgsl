// what stands and flies on the map as build mode's plan, after globals.wgsl, put in front by
// StructurePlan; in.params: x the map's wave radius in tiles (0: off), y its center as a tile
// index, z the look (PLAN_LOOK in structurePlan.ts): a sprite drawn as a plan, a dwarf as a token
// of one color, a flat shape (no texture) whose outline band is its silhouette

const PLAN_LUMINANCE: vec3f = vec3f(0.2126, 0.7152, 0.0722);
const PLAN_SPRITE: f32 = 0.0;
const PLAN_TOKEN: f32 = 1.0;
const PLAN_FLAT: f32 = 2.0;

fn material(in: MaterialInput) -> vec4f {
  let outline = in.outlineColor * in.ring;
  let base = outline + in.color * in.texel * (1.0 - outline.a);
  let radius = in.params.x;
  if (radius <= 0.0 || base.a == 0.0) {
    return base;
  }
  // whole tiles of the map's grid, the front steps like on the map
  let tile = floor(in.world / map.tileSize);
  let width = u32(map.sizeInTiles.x);
  let centerIndex = u32(in.params.y);
  let center = vec2f(f32(centerIndex % width), f32(centerIndex / width));
  let distance = length(tile - center);
  if (distance > radius) {
    return base;
  }

  // the shape's brightness picks the shade of blue, so its details stay apart
  let fill = base.rgb / base.a;
  let palette = map.blueprint;
  let token = in.params.z == PLAN_TOKEN;
  let shaded = mix(palette.structureDark.rgb, palette.structureLight.rgb, clamp(dot(fill, PLAN_LUMINANCE) * 1.5, 0.0, 1.0));
  var blue = select(shaded, palette.token.rgb, token);
  let lines = select(palette.structureLines, palette.tokenLines, token);
  // a flat shape has no texels to read: its outline band (see-through outside the plan) is the line
  let flat = in.params.z == PLAN_FLAT;
  var line = in.ring * lines.w;
  if (!flat) {
    line = planLine(in, lines);
  }
  blue = mix(blue, palette.line.rgb, line);
  // the wave's front glows with the map's
  let edge = smoothstep(radius - BLUEPRINT_EDGE, radius, distance);
  blue = mix(blue, palette.line.rgb, edge * 0.5);
  // the plan is lit by nothing, like the map's
  materialGlow = 1.0;
  return vec4f(blue * base.a, base.a);
}

// the silhouette where a neighbouring texel is see-through, inside where its brightness jumps;
// one texel of the mip the sprite comes from, so the lines don't shimmer when zoomed out
fn planLine(in: MaterialInput, lines: vec4f) -> f32 {
  let spacing = exp2(max(round(in.lod), 0.0));
  let own = planLuminance(in.texel);
  let left = planNeighbour(in, vec2f(-spacing, 0.0));
  let right = planNeighbour(in, vec2f(spacing, 0.0));
  let up = planNeighbour(in, vec2f(0.0, -spacing));
  let down = planNeighbour(in, vec2f(0.0, spacing));

  let seeThrough = 1.0 - min(min(left.a, right.a), min(up.a, down.a));
  let silhouette = clamp(seeThrough * 2.0 - 1.0, 0.0, 1.0) * lines.w;
  let jump = max(
    max(planJump(own, left), planJump(own, right)),
    max(planJump(own, up), planJump(own, down)),
  );
  let inner = smoothstep(lines.x, lines.y, jump) * lines.z;
  return max(silhouette, inner);
}

// kept inside the crop, or it reads the next sprite of the sheet; the crop flips with zw < 0
fn planNeighbour(in: MaterialInput, offset: vec2f) -> vec4f {
  let corner = in.uvRect.xy + in.uvRect.zw;
  let low = min(in.uvRect.xy, corner) + 0.5;
  let high = max(in.uvRect.xy, corner) - 0.5;
  let position = clamp(in.texelPosition + offset, low, high);
  let uv = position / vec2f(textureDimensions(albedo, 0));
  return textureSampleLevel(albedo, texSampler, uv, in.layer, in.lod);
}

// square root: close to how the eye sees it, in linear the dark and middle tones barely differ
fn planLuminance(texel: vec4f) -> f32 {
  return sqrt(dot(texel.rgb / max(texel.a, 0.0001), PLAN_LUMINANCE));
}

// only between two visible texels, the silhouette has its own line
fn planJump(own: f32, neighbour: vec4f) -> f32 {
  return abs(planLuminance(neighbour) - own) * step(0.5, neighbour.a);
}
