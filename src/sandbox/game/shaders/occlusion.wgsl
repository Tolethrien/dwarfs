// lightVisibility for occluded lights (Light.setOcclusion), after globals.wgsl: walks the tiles on
// the line from the light to the pixel (Amanatides-Woo) and measures how much of it runs through
// solid blocks. The light dies out over the first map.lightIntoRock world units in rock: a tunnel's
// walls are lit in a band along where the beam meets them, nothing behind. Over the map's top is
// open air, the rest outside the map counts as rock (isSolidAt), the map's top left is the world's 0,0

// longer lines give up and stay lit: a light reaches a few tiles
const OCCLUSION_MAX_TILES: i32 = 48;
// how the light dies in rock: (1 - depth share) to this power; the light is linear and the screen
// isn't, 2.2 makes it fade evenly on screen across the whole depth instead of at its start
const OCCLUSION_FADE: f32 = 2.2;
const OCCLUSION_CHIP_SAMPLES: i32 = 8;

// no light where nothing is discovered yet: the fog of war covers the lamps too, only the ambient
// shows faintly through it
fn lightVisibility(light: vec2f, pixel: vec2f) -> f32 {
  let shade = fogLightShade(pixel);
  if (shade <= 0.0) {
    return 0.0;
  }
  return shade * rockVisibility(light, pixel);
}

// t runs 0-1 from the light to the pixel; each tile on the way is crossed from t to its exit, the
// rock tiles add that stretch (in world units) to how deep the light has gone into rock
fn rockVisibility(light: vec2f, pixel: vec2f) -> f32 {
  let start = light / map.tileSize;
  let end = vec2i(floor(pixel / map.tileSize));
  let delta = pixel / map.tileSize - start;
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
    if (isSolidAt(cell)) {
      rock += (exit - t) * total * rockShare(cell, light, pixel, t, exit);
      if (rock >= map.lightIntoRock) {
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
  return pow(1.0 - rock / map.lightIntoRock, OCCLUSION_FADE);
}

// a crumbled hole lets the light through: the shadow follows the crumbled edge, not the tile
fn rockShare(cell: vec2i, light: vec2f, pixel: vec2f, enter: f32, leave: f32) -> f32 {
  if (tileDamageAt(cell) <= 0.0) {
    return 1.0;
  }
  var inRock = 0;
  for (var index = 0; index < OCCLUSION_CHIP_SAMPLES; index++) {
    let along = mix(enter, leave,(f32(index) + 0.5) / f32(OCCLUSION_CHIP_SAMPLES));
    let point = mix(light, pixel, along) / map.tileSize;
    if (!chippedAt(cell, clamp(point - vec2f(cell), vec2f(0.0), vec2f(1.0)))) {
      inRock++;
    }
  }
  return f32(inRock) / f32(OCCLUSION_CHIP_SAMPLES);
}
