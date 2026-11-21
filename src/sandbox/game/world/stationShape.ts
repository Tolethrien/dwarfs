import Grid from "@axiom/grid";
import { BlocksID } from "../content/blocks";
import { STRUCTURES } from "../content/structures";
import type Terrain from "../systems/world/terrain";

export function stationFootprint(body: Box): Box {
  return { x: body.x - 1, y: body.y, w: body.w + 2, h: body.h };
}

export function stationConnectors(body: Box): Position2D[] {
  const row = body.y + body.h - 1;
  return [
    { x: body.x - 1, y: row },
    { x: body.x + body.w, y: row },
  ];
}

export function stationRailEnds(body: Box): Position2D[] {
  const corner = body.y + body.h;
  return [
    { x: body.x - 1, y: corner },
    { x: body.x + body.w + 1, y: corner },
  ];
}

export function stationBodyAt(tile: Position2D): Box {
  const body = STRUCTURES.station.look.body;
  return {
    x: tile.x - Math.floor(body.width / 2),
    y: tile.y - Math.floor(body.height / 2),
    w: body.width,
    h: body.height,
  };
}

export function clearStation(terrain: Terrain, body: Box) {
  for (const tile of [...Grid.tilesIn(body), ...stationConnectors(body)]) terrain.place(tile.x, tile.y, BlocksID.air);
}

export function standStation(terrain: Terrain, body: Box) {
  for (let gy = body.y; gy < body.y + body.h; gy++)
    for (let gx = body.x; gx < body.x + body.w; gx++) terrain.place(gx, gy, BlocksID.structure);
  for (const connector of stationConnectors(body)) terrain.place(connector.x, connector.y, BlocksID.rail);
}
