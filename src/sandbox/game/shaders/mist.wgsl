// the tunnel mist over the whole map, after globals.wgsl; drawn like everything else, so the lamps
// light it up and the fog of war hides it. Only in the open: it fades out against the rock

// the look of the banks: thinnest, how thin a gap gets (a share of the mist); gap/bank: the noise
// below gap is a gap, above bank a full bank; swirl: how far the warp drags the banks into wisps, in
// noise units; churn: how fast the warp circles in place, radians a second, so the banks curl where
// they hang instead of sailing off; draftCycle: seconds the draft carries one layer before it fades
// into the other; shaftReach: tiles from the shaft's middle where the sideways pull turns into rising
struct MistLook {
  octaves: i32,
  thinnest: f32,
  gap: f32,
  bank: f32,
  swirl: f32,
  churn: f32,
  draftCycle: f32,
  shaftReach: f32,
}
const MIST_LOOK = MistLook(4, 0.1, 0.38, 0.76, 1.6, 0.08, 8.0, 14.0);

// the dust a break throws into the air, over the mist. color: linear rgb, times scatter it goes
// over 1 in light, so the dark leaves almost nothing of it; thickness: opacity of a full tile;
// frequency: puffs per tile; drift: noise units a second the warp under the puffs moves, so they
// slowly change shape where they hang; swirl: how far the warp drags them; blur: how far (tiles) the
// warp bends where the dust is read, hiding the tile grid; edge: how far from the
// rock (tiles) the dust thins out, ragged by the puffs, it never goes over a block.
// Motes, after the old game's motes.wgsl: round specks snapped to moteGrain world units, at most one
// per cell of moteCell units in two layers (the far one finer and dimmer), a share of the cells
// holding one where the dust is full, radius moteSize, resting around a home in their cell and
// wobbling moteWobble of the cell; moteTwinkle how much they dim, slowly; moteColor times moteGlow
// catches the light far brighter than the dust
struct DustLook {
  color: vec3f,
  scatter: f32,
  thickness: f32,
  frequency: f32,
  drift: f32,
  swirl: f32,
  blur: f32,
  edge: f32,
  moteColor: vec3f,
  moteGlow: f32,
  moteGrain: f32,
  moteCell: f32,
  moteSize: f32,
  motes: f32,
  moteWobble: f32,
  moteTwinkle: f32,
}
const DUST_LOOK = DustLook(
  vec3f(0.3, 0.23, 0.16), 1.6, 0.85, 0.9, 0.04, 1.2, 1.2, 0.35,
  vec3f(1.0, 0.88, 0.7), 3.0, 3.0, 32.0, 2.5, 0.6, 0.18, 0.5,
);
const DUST_MOTE_LAYERS: i32 = 2;
const DUST_MOTE_FAR_SCALE: f32 = 0.6;

fn material(in: MaterialInput) -> vec4f {
  let tilePosition = in.world / map.tileSize;
  let open = openAt(tilePosition);
  // in the rock, or where nothing lights it: skip the noise
  if (open <= 0.0 || discoveredAt(in.world) <= 0.0) {
    return vec4f(0.0);
  }
  let shape = map.mistShape;
  let depth = mix(shape.x, shape.y, clamp(tilePosition.y / map.sizeInTiles.y, 0.0, 1.0));
  let patches = mix(MIST_LOOK.thinnest, 1.0, smoothstep(MIST_LOOK.gap, MIST_LOOK.bank, mistBanks(tilePosition, shape)));
  // in.params.x: the whole mist's opacity, y: the dust's, gone when zoomed far out, z: the motes'
  // world size for the zoom, 1 at zoom 1, w: their specks' size on top (Mist.material)
  let shown = in.params.x * (1.0 - buildingCover(in.world));
  let alpha = clamp(mistAt(tilePosition) * depth * open * patches, 0.0, 1.0) * map.mistColor.a * shown;
  let haze = vec4f(map.mistColor.rgb * alpha, alpha);

  let dust = dustAt(tilePosition) * shown * in.params.y;
  if (dust <= 0.0) {
    return haze;
  }
  let room = roomAt(tilePosition);
  if (room <= 0.0) {
    return haze;
  }
  return dustOver(haze, dust, room, in.world, tilePosition, in.params.zw, shown * in.params.y);
}

fn roomAt(tilePosition: vec2f) -> f32 {
  return clamp(rockDistance(tilePosition), 0.0, 1.0);
}

// premultiplied: the dust over the mist, the motes on top of both
fn dustOver(haze: vec4f, dust: f32, room: f32, world: vec2f, tilePosition: vec2f, mote: vec2f, fade: f32) -> vec4f {
  let still = tilePosition * DUST_LOOK.frequency;
  // the warp field slides, the puffs don't: they bend and change shape in place, never looping back
  let flow = frame.time * DUST_LOOK.drift;
  let warp = vec2f(
    mistFbm(still * 0.7 + vec2f(flow, 0.0) + vec2f(7.1, 2.3)),
    mistFbm(still * 0.7 + vec2f(0.0, flow * 0.8) + vec2f(13.7, 29.1)),
  ) - 0.5;
  let puffs = mistFbm(still + warp * DUST_LOOK.swirl + vec2f(41.3, 17.9));
  // the dust read through the warp: its tiles' edges bend into the puffs instead of a grid
  let swirled = dustAt(tilePosition + warp * DUST_LOOK.blur) * fade;
  // the edge follows the puffs: the dust curls back from the rock, never onto it
  let walls = smoothstep(0.0, DUST_LOOK.edge * mix(0.7, 1.3, puffs), room);
  // thin dust still reads: a spread-out tile holds only a share of a break's dust
  let alpha = clamp(pow(swirled, 0.6) * walls * DUST_LOOK.thickness * mix(0.55, 1.0, puffs), 0.0, 1.0);
  var color = DUST_LOOK.color * DUST_LOOK.scatter * alpha + haze.rgb * (1.0 - alpha);
  var cover = alpha + haze.a * (1.0 - alpha);

  let speck = dustMote(world, mote, fade);
  color += DUST_LOOK.moteColor * DUST_LOOK.moteGlow * speck;
  cover = max(cover, speck);
  return vec4f(color, cover);
}

// 0-1, the brightest speck over the point. Whether a cell holds a speck is read at the speck's own
// middle, the same for all its pixels: it fades in and out whole, never cut by a tile's edge
// mote: x the cells' world size for the zoom, y the specks' size on top of it
fn dustMote(world: vec2f, mote: vec2f, fade: f32) -> f32 {
  let moteScale = mote.x;
  let time = frame.time;
  let grain = DUST_LOOK.moteGrain * moteScale * mote.y;
  let pixel = (floor(world / grain) + 0.5) * grain;
  var amount = 0.0;
  for (var layer = 0; layer < DUST_MOTE_LAYERS; layer++) {
    let near = layer == 0;
    let scale = select(DUST_MOTE_FAR_SCALE, 1.0, near) * moteScale;
    let cellSize = DUST_LOOK.moteCell * scale;
    let shift = f32(layer) * 17.3;
    let point = pixel / cellSize + shift;
    let cell = floor(point);
    let seed = mistHash(cell + f32(layer) * 31.0);
    if (seed > DUST_LOOK.motes) {
      continue;
    }
    let phase = seed * 6.2832;
    let home = vec2f(mistHash(cell + 11.0), mistHash(cell + 23.0)) * 0.5 + 0.25;
    let wobble = vec2f(sin(time * 0.7 + phase), cos(time * 0.5 + phase * 1.7)) * DUST_LOOK.moteWobble;
    let spot = home + wobble;
    // to the speck's middle snapped to the grain: its own pixel is always lit, however small
    let snapped = (floor((cell + spot - shift) * cellSize / grain) + 0.5) * grain;
    let gap = length(pixel - snapped);
    let size = DUST_LOOK.moteSize * scale * mote.y * mix(0.6, 1.2, mistHash(cell + 5.0));
    if (gap >= size && gap > 0.0) {
      continue;
    }
    let middle = (cell + spot - shift) * cellSize / map.tileSize;
    let presence = smoothstep(0.0, 0.25, dustAt(middle)) * smoothstep(0.0, DUST_LOOK.edge, roomAt(middle));
    // the thinner the dust, the fewer cells keep their speck; one on the edge fades, not pops
    let kept = clamp((presence * DUST_LOOK.motes - seed) / 0.15, 0.0, 1.0);
    let twinkle = mix(1.0, 0.5 + 0.5 * sin(time * 2.3 + phase * 3.0), DUST_LOOK.moteTwinkle);
    amount = max(amount, kept * fade * twinkle * select(0.6, 1.0, near));
  }
  return amount;
}

// how much of the point the camp buildings' sprites cover, 0-1: the mist flows behind them
fn buildingCover(world: vec2f) -> f32 {
  var cover = 0.0;
  for (var index = 0u; index < map.buildingCount; index++) {
    let mask = map.buildings[index];
    let local = (world - mask.box.xy) / mask.box.zw;
    if (any(local < vec2f(0.0)) || any(local >= vec2f(1.0))) {
      continue;
    }
    let uv = (mask.crop.xy + local * mask.crop.zw) / vec2f(textureDimensions(albedo, 0));
    cover = max(cover, textureSampleLevel(albedo, texSampler, uv, map.buildingsLayer, 0.0).a);
  }
  return cover;
}

fn mistHash(cell: vec2f) -> f32 {
  return fract(sin(dot(cell, vec2f(127.1, 311.7))) * 43758.5453);
}

// value noise, 0-1
fn mistNoise(position: vec2f) -> f32 {
  let cell = floor(position);
  let inside = fract(position);
  let eased = inside * inside * (3.0 - 2.0 * inside);
  let a = mistHash(cell);
  let b = mistHash(cell + vec2f(1.0, 0.0));
  let c = mistHash(cell + vec2f(0.0, 1.0));
  let d = mistHash(cell + vec2f(1.0, 1.0));
  return mix(mix(a, b, eased.x), mix(c, d, eased.x), eased.y);
}

// the banks hang and curl in place, and the mine breathes through its shaft: the side tunnels' air
// is pulled toward the shaft, which carries it up. A flow that differs from place to place would
// stretch the banks without end, so two layers ride it in turns, each fading out before it jumps
// back (a flow map's two phases)
fn mistBanks(tilePosition: vec2f, shape: vec4f) -> f32 {
  let frequency = shape.z;
  let still = tilePosition * frequency;
  // domain warp circling in place: the banks stretch into wisps and turn, but go nowhere
  let turn = frame.time * MIST_LOOK.churn;
  let warp = vec2f(
    mistFbm(still * 0.5 + vec2f(cos(turn), sin(turn)) * 0.8 + vec2f(0.0, 3.1)),
    mistFbm(still * 0.5 + vec2f(sin(turn * 0.7), cos(turn * 0.7)) * 0.8 + vec2f(5.3, 11.7)),
  );
  let swirl = (warp - 0.5) * MIST_LOOK.swirl;
  // the shaft stands in the map's middle (shaftColumns)
  let fromShaft = tilePosition.x - map.sizeInTiles.x * 0.5;
  let sideways = smoothstep(0.0, MIST_LOOK.shaftReach, abs(fromShaft));
  let flow = vec2f(-sign(fromShaft) * sideways, -(1.0 - sideways)) * shape.w * frequency;
  let cycle = frame.time / MIST_LOOK.draftCycle;
  let first = mistLayer(still + swirl, flow, cycle, 0.0);
  let second = mistLayer(still + swirl, flow, cycle + 0.5, 1.0);
  // the first one jumps at the cycle's start, the second halfway: each weighs nothing as it jumps
  let weight = abs(fract(cycle) * 2.0 - 1.0);
  return mix(first, second, weight);
}

// one layer carried by the flow for a cycle; a new spot of the noise every cycle, so the turns
// don't pulse the same banks back and forth
fn mistLayer(point: vec2f, flow: vec2f, cycle: f32, layer: f32) -> f32 {
  let turnIndex = floor(cycle);
  let seed = vec2f(turnIndex * 7.31 + layer * 19.7, turnIndex * 3.17 + layer * 5.9);
  return mistFbm(point - flow * fract(cycle) * MIST_LOOK.draftCycle + seed);
}

fn mistFbm(position: vec2f) -> f32 {
  var sum = 0.0;
  var weight = 0.5;
  var total = 0.0;
  var point = position;
  for (var octave = 0; octave < MIST_LOOK.octaves; octave++) {
    sum += mistNoise(point) * weight;
    total += weight;
    weight *= 0.5;
    point *= 2.03;
  }
  return sum / total;
}
