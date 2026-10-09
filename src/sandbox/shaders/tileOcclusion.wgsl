// lightVisibility for occluded lights (Light.setOcclusion): walks the tiles on the line from the
// light to the pixel (Amanatides-Woo) and measures how much of it runs through rock. The light dies
// out over the first OCCLUSION_DEPTH world units in rock: a wall is lit in a thin band along where
// the beam meets it, whatever the tiles, and nothing behind it. Outside the map counts as rock,
// like in tileSolid.wgsl

// replaced by TileMask.register: tileMask binding, TILE_ORIGIN, TILE_SIZE
// TILE_MAP

// longer lines give up and stay lit: a beam is a few tiles long
const OCCLUSION_MAX_TILES: i32 = 32;
// world units of rock the light still gets into, fading over them (a tile is 96)
const OCCLUSION_DEPTH: f32 = 26.0;

fn occlusionBlocked(cell: vec2i) -> bool {
  let size = vec2i(textureDimensions(tileMask));
  if (any(cell < vec2i(0)) || any(cell >= size)) {
    return true;
  }
  return textureLoad(tileMask, cell, 0).r > 0.5;
}

// t runs 0-1 from the light to the pixel; each tile on the way is crossed from t to its exit, the
// rock tiles add that stretch (in world units) to how deep the light has gone into rock
fn lightVisibility(light: vec2f, pixel: vec2f) -> f32 {
  let start = (light - TILE_ORIGIN) / TILE_SIZE;
  let end = vec2i(floor((pixel - TILE_ORIGIN) / TILE_SIZE));
  let delta = (pixel - TILE_ORIGIN) / TILE_SIZE - start;
  let total = length(pixel - light);
  let direction = vec2i(sign(delta));
  // t per tile on each axis; a flat axis never steps
  let perTile = 1.0 / max(abs(delta), vec2f(0.000001));
  let inTile = start - floor(start);
  var next = select(1.0 - inTile, inTile, delta < vec2f(0.0)) * perTile;
  var cell = vec2i(floor(start));
  var t = 0.0;
  var rock = 0.0;
  for (var index = 0; index < OCCLUSION_MAX_TILES; index++) {
    let last = all(cell == end);
    let exit = select(min(min(next.x, next.y), 1.0), 1.0, last);
    if (occlusionBlocked(cell)) {
      rock += (exit - t) * total;
      if (rock >= OCCLUSION_DEPTH) {
        return 0.0;
      }
    }
    if (last || exit >= 1.0) {
      break;
    }
    t = exit;
    if (next.x < next.y) {
      cell.x += direction.x;
      next.x += perTile.x;
    } else {
      cell.y += direction.y;
      next.y += perTile.y;
    }
  }
  return 1.0 - smoothstep(0.0, OCCLUSION_DEPTH, rock);
}
