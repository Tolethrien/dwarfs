import { Draw } from "@aurora/urp/draw/draw";
import { STRUCTURES } from "../content/structures";
import { SORT_ORDER } from "../content/render";

// the rails run on the tiles' corners: point (x, y) is the top-left corner of tile (x, y), a step
// goes one tile to the side and none or one up or down; the piece between two points lies in the
// tile it runs along the bottom of (flat) or through from corner to corner (at 45°), so a flat rail
// and a slanted one meet on the same corner

export interface RailSegment {
  from: Position2D;
  step: Position2D;
  length: number;
}

export const RAIL_STEPS: readonly Position2D[] = [
  { x: 1, y: 0 },
  { x: -1, y: 0 },
  { x: 1, y: -1 },
  { x: 1, y: 1 },
  { x: -1, y: -1 },
  { x: -1, y: 1 },
];

export function isRailStep(step: Position2D) {
  return RAIL_STEPS.some((rail) => rail.x === step.x && rail.y === step.y);
}

export function railTile(point: Position2D, step: Position2D): Position2D {
  return { x: Math.min(point.x, point.x + step.x), y: Math.max(point.y, point.y + step.y) - 1 };
}

export function railPoint(segment: RailSegment, steps: number): Position2D {
  return { x: segment.from.x + segment.step.x * steps, y: segment.from.y + segment.step.y * steps };
}

export function railTiles(segment: RailSegment) {
  const tiles: Position2D[] = [];
  for (let steps = 0; steps < segment.length; steps++) tiles.push(railTile(railPoint(segment, steps), segment.step));
  return tiles;
}

export function drawRail(from: Position2D, to: Position2D, tile: number, color = STRUCTURES.rails.look.color) {
  const look = STRUCTURES.rails.look;
  const lift = (look.width * tile) / 2;
  Draw.line({
    from: { x: from.x * tile, y: from.y * tile - lift },
    to: { x: to.x * tile, y: to.y * tile - lift },
    width: look.width * tile,
    color: color,
    z: SORT_ORDER.buildings,
  });
}

export function railEnd(segment: RailSegment) {
  return railPoint(segment, segment.length);
}

export function stepsTo(segment: RailSegment, point: Position2D) {
  const steps = (point.x - segment.from.x) / segment.step.x;
  if (!Number.isInteger(steps) || steps < 0 || steps > segment.length) return undefined;
  if (segment.from.y + segment.step.y * steps !== point.y) return undefined;
  return steps;
}

// the segment from the point toward the spot (tiles, fractional), its end on the nearest corner:
// flat while the spot is within 22.5° of level, otherwise at 45°; nothing straight above or below
export function railToward(from: Position2D, spot: Position2D): RailSegment | undefined {
  const dx = spot.x - from.x;
  const dy = spot.y - from.y;
  const side = Math.sign(dx);
  const flat = Math.abs(dy) < Math.abs(dx) * Math.tan(Math.PI / 8);
  const length = flat ? Math.round(Math.abs(dx)) : Math.round((Math.abs(dx) + Math.abs(dy)) / 2);
  if (side === 0 || length === 0) return undefined;
  return { from: from, step: { x: side, y: flat ? 0 : Math.sign(dy) }, length: length };
}
