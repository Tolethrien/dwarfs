import type Noise from "@axiom/noise";
import { STRUCTURES } from "../content/structures";
import type World from "./world";

// the shape of the shaft's hole and of the station's crater under it, the same for the first segment
// and for every one dug later, so a new one goes on from the old without a seam; the noise is the
// game's seed, its second coordinate a line far from the map keeps the shaft's
// sides apart, the third the craters' rings
const SALT = {
  shaft: { left: 9000, right: 10000 },
  crater: 12000,
};

export interface ShaftHole {
  structure: Position2D[];
  open: Position2D[];
}

export function shaftColumns(world: World) {
  const from = Math.floor(world.mapInTiles.width / 2) - Math.floor(STRUCTURES.shaft.width / 2);
  return { from: from, to: from + STRUCTURES.shaft.width - 1 };
}

export function laneX(world: World, index: number) {
  const shaft = STRUCTURES.shaft;
  const post = shaft.look.post.width;
  const halfWidth = shaft.width / shaft.look.halves;
  const perHalf = shaft.look.lanes.count / shaft.look.halves;
  const half = Math.floor(index / perHalf);
  const inHalf = index % perHalf;
  return shaftColumns(world).from + half * halfWidth + post + ((halfWidth - post * 2) * (inHalf + 0.5)) / perHalf;
}

export function shaftHole(world: World, noise: Noise, fromRow: number, toRow: number): ShaftHole {
  const shaft = STRUCTURES.shaft;
  const columns = shaftColumns(world);
  const hole: ShaftHole = { structure: [], open: [] };
  for (let gy = fromRow; gy <= toRow; gy++) {
    const left = columns.from - stray(noise, shaft, gy, SALT.shaft.left);
    const right = columns.to + stray(noise, shaft, gy, SALT.shaft.right);
    for (let gx = Math.min(left, columns.from); gx <= Math.max(right, columns.to); gx++) {
      if (gx >= columns.from && gx <= columns.to) hole.structure.push({ x: gx, y: gy });
      else if (gx >= left && gx <= right) hole.open.push({ x: gx, y: gy });
    }
  }
  return hole;
}

export function stationCrater(world: World, noise: Noise, depth: number) {
  const crater = STRUCTURES.station.crater;
  const center = craterCenter(world, depth);
  const reach = Math.ceil(crater.radius * (1 + crater.jag)) + 1;
  const tiles: Position2D[] = [];
  for (let gy = Math.floor(center.y) - reach; gy <= Math.floor(center.y) + reach; gy++)
    for (let gx = Math.floor(center.x) - reach; gx <= Math.floor(center.x) + reach; gx++) {
      const dx = gx + 0.5 - center.x;
      const dy = gy + 0.5 - center.y;
      const angle = Math.atan2(dy, dx);
      const bump = noise.simplex3D(Math.cos(angle) * crater.bumps, Math.sin(angle) * crater.bumps, SALT.crater + depth);
      if (Math.hypot(dx, dy) <= crater.radius * (1 + crater.jag * bump)) tiles.push({ x: gx, y: gy });
    }
  return tiles;
}

export function stationCraterBottom(world: World, depth: number) {
  const crater = STRUCTURES.station.crater;
  return Math.ceil(craterCenter(world, depth).y + crater.radius * (1 + crater.jag));
}

export function startTile(world: World): Position2D {
  const center = craterCenter(world, world.shaftDepth);
  return { x: Math.floor(center.x), y: Math.floor(center.y) };
}

export function craterCenter(world: World, depth: number): Position2D {
  const columns = shaftColumns(world);
  return { x: (columns.from + columns.to + 1) / 2, y: depth + 1 + STRUCTURES.station.look.body.height / 2 };
}

function stray(noise: Noise, edge: { jag: number; frequency: number }, along: number, side: number) {
  return Math.round(edge.jag * noise.simplex2D(along * edge.frequency, side));
}
