import PragmaSystem from "@pragma/system";
import AxiomMath from "@axiom/math";
import Grid from "@axiom/grid";
import { assert } from "@axiom/utils";
import { BuildingsID, STRUCTURES } from "../content/structures";
import type { RoutePoint } from "../components/travel";
import { laneX, shaftColumns } from "../world/shaftShape";
import { stationFootprint, stationRailEnds } from "../world/stationShape";
import { buildingSprite } from "../world/buildingShape";
import type { BuildingPlace, ShaftSide } from "./buildings";
import Terrain from "./terrain";
import Rails, { type RailStart, type ShaftJoint } from "./rails";

const TRAVEL = { walk: 3, lane: 6, rail: 4, tunnel: 4, belly: 0.1, deck: 0.1 };

export type RouteLeg =
  | { kind: "free" }
  | { kind: "lane" }
  | { kind: "joint"; tile: Position2D }
  | { kind: "rail" }
  | { kind: "station"; body: Box }
  | { kind: "tunnel" };

const FREE_LEG: RouteLeg = { kind: "free" };
const LANE_LEG: RouteLeg = { kind: "lane" };
const RAIL_LEG: RouteLeg = { kind: "rail" };
const TUNNEL_LEG: RouteLeg = { kind: "tunnel" };

export interface Network {
  shaftStation: Box;
  bodies: Box[];
}

export interface StationPlace {
  body: Box;
  atShaft: boolean;
}

// in tiles: where a ride comes out of a building onto its deck
export interface BuildingDoor {
  tile: Position2D;
  side: ShaftSide;
}

export type RideGoal = { to: "station"; station: StationPlace } | { to: "tavern"; station: StationPlace | undefined };

interface Entry {
  start: RailStart;
  row: number;
  joint: ShaftJoint | undefined;
}

export default class Transport extends PragmaSystem {
  private tavernDoor: BuildingDoor | undefined;
  declare private terrain: Terrain;
  declare private rails: Rails;

  awake(): void {
    this.terrain = this.scene.getSystem(Terrain);
    this.rails = this.scene.getSystem(Rails);
  }

  public setTavern(place: BuildingPlace | undefined) {
    this.tavernDoor = place && this.doorOf(BuildingsID.tavern, place);
  }

  public doorOf(id: BuildingsID, place: BuildingPlace): BuildingDoor {
    const tile = this.terrain.tile;
    const door = buildingSprite(id, place, tile).door;
    assert(door !== undefined, `${BuildingsID[id]} has no door in its sprite`);
    return { tile: { x: door.x / tile, y: door.y / tile }, side: place.side };
  }

  // from the station's stop to the building's door
  public toDoor(door: BuildingDoor, station: StationPlace, network: Network): RoutePoint[] | undefined {
    const lane = this.randomLane();
    const tail = this.fromLane({ x: lane, y: door.tile.y }, station, network);
    return tail && reversed([...this.outOfDoor(door, lane), ...tail]);
  }

  public rerouteToDoor(at: Position2D, route: RoutePoint[], next: number, door: BuildingDoor, network: Network) {
    return this.railsToDoor(at, this.cornersAround(at, route, next, network), door, network);
  }

  // to whichever of the stations is nearest along the rails
  public rerouteToStations(at: Position2D, route: RoutePoint[], next: number, stations: StationPlace[], network: Network) {
    return this.railsToStations(at, this.cornersAround(at, route, next, network), stations, network);
  }

  public toStation(station: StationPlace, network: Network): RoutePoint[] | undefined {
    const lane = this.randomLane();
    const route = this.outOfDoor(this.door, lane);
    const tail = this.fromLane({ x: lane, y: this.door.tile.y }, station, network);
    return tail && [...route, ...tail];
  }

  public fromStation(station: StationPlace, network: Network) {
    const out = this.toStation(station, network);
    return out && reversed(out);
  }

  public home(from: Position2D, station: StationPlace, network: Network): RoutePoint[] | undefined {
    const back = this.fromStation(station, network);
    if (!back) return undefined;
    const tunnels = this.tunnelsTo(from, station.body);
    return tunnels && [...tunnels, ...back.slice(1)];
  }

  public isIntact(route: RoutePoint[], next: number, network: Network) {
    for (let index = Math.max(next, 1); index < route.length; index++)
      if (!this.canRideLeg(route, index, network)) return false;
    return true;
  }

  public isNode(position: Position2D, network: Network) {
    const tile = this.terrain.tile;
    if (!isOnCorner(position, tile)) return false;
    const corner = cornerOf(position, tile);
    if (this.rails.isJunction(corner) || this.rails.joints.some((joint) => isSame(joint.anchor, corner))) return true;
    return linksOf(network).some((ends) => ends.some((end) => isSame(end, corner)));
  }

  public isCutAhead(route: RoutePoint[], next: number, network: Network) {
    for (let index = Math.max(next, 1); index < route.length; index++) {
      if (!this.canRideLeg(route, index, network)) return true;
      if (this.isNode(route[index].position, network)) return false;
    }
    return false;
  }

  public reroute(
    at: Position2D,
    route: RoutePoint[],
    next: number,
    goal: RideGoal,
    network: Network,
  ): RoutePoint[] | undefined {
    if (goal.to === "tavern") {
      const inMine = route.slice(next).some((point) => point.leg.kind === "tunnel");
      if (inMine && goal.station) return this.home(at, goal.station, network);
      return this.railsToDoor(at, this.cornersAround(at, route, next, network), this.door, network);
    }
    const onRails = route.slice(0, next).some((point) => isOnCorner(point.position, this.terrain.tile));
    if (!onRails) return this.laneToStation(at, route, next, goal.station, network);
    return this.railsToStation(at, this.cornersAround(at, route, next, network), goal.station, network);
  }

  public backThroughNode(
    at: Position2D,
    route: RoutePoint[],
    next: number,
    goal: RideGoal,
    network: Network,
  ): RoutePoint[] | undefined {
    const back: RoutePoint[] = [here(at)];
    for (let index = next - 1; index >= 0; index--) {
      const leg = back.length === 1 ? FREE_LEG : route[index + 1].leg;
      back.push({ position: route[index].position, speed: route[index + 1].speed, leg: leg });
      if (!this.canRideLeg(back, back.length - 1, network)) return undefined;
      if (!this.isNode(route[index].position, network)) continue;
      const node = route[index].position;
      const start = [{ corner: cornerOf(node, this.terrain.tile), cost: 0 }];
      const on =
        goal.to === "tavern"
          ? this.railsToDoor(node, start, this.door, network)
          : this.railsToStation(node, start, goal.station, network);
      return on && [...back, ...on.slice(1)];
    }
    return undefined;
  }

  private canRideLeg(route: RoutePoint[], index: number, network: Network) {
    const tile = this.terrain.tile;
    const leg = route[index].leg;
    const before = route[index - 1].position;
    const at = route[index].position;
    if (leg.kind === "rail") return this.canStep(cornerOf(before, tile), cornerOf(at, tile), network);
    if (leg.kind === "joint") return this.rails.workingJoints.some((joint) => isSame(joint.tile, leg.tile));
    if (leg.kind === "station") return network.bodies.some((body) => isSameBox(body, leg.body));
    if (leg.kind === "tunnel")
      return Grid.hasLineOfSight(toTiles(before, tile), toTiles(at, tile), (x, y) => !this.terrain.isSolid(x, y));
    return true;
  }

  private laneToStation(
    at: Position2D,
    route: RoutePoint[],
    next: number,
    station: StationPlace,
    network: Network,
  ): RoutePoint[] | undefined {
    const tile = this.terrain.tile;
    const onLane = route.findIndex((point) => point.leg.kind === "lane") - 1;
    assert(onLane >= 0, "A ride to a station has no lane");
    const lane = route[onLane].position.x;
    const prefix = [here(at)];
    let from = route[onLane].position;
    if (next <= onLane) prefix.push(...route.slice(next, onLane + 1));
    else {
      from = { x: lane, y: at.y };
      if (at.x !== lane) prefix.push({ position: from, speed: TRAVEL.walk * tile, leg: FREE_LEG });
    }
    const tail = this.fromLane(toTiles(from, tile), station, network);
    return tail && [...prefix, ...tail];
  }

  private railsToStation(
    at: Position2D,
    starts: RailStart[],
    station: StationPlace,
    network: Network,
  ): RoutePoint[] | undefined {
    return this.railsToStations(at, starts, [station], network)?.route;
  }

  private railsToStations(at: Position2D, starts: RailStart[], stations: StationPlace[], network: Network) {
    const ends = stations.flatMap((station) => stationRailEnds(station.body).map((end) => ({ corner: end, cost: 0 })));
    const shaft = this.entries(0, 0, network.shaftStation).map((entry) => entry.start.corner);
    const corners = this.rails.route(starts, ends, linksOf(network), shaft);
    if (!corners) return undefined;
    const last = corners[corners.length - 1];
    const station = stations.find((place) => stationRailEnds(place.body).some((end) => isSame(end, last)));
    assert(station !== undefined, "The rails' route ends off every station");
    const route = [here(at)];
    corners.forEach((corner, index) => {
      const before = corners[index - 1];
      if (before && this.isShaftHop(before, corner, network)) route.push(...this.throughShaft(before, corner, network));
      else route.push(this.point(onRail(corner), TRAVEL.rail, index === 0 ? FREE_LEG : RAIL_LEG));
    });
    route.push(this.point(stopOf(station.body), TRAVEL.walk, { kind: "station", body: station.body }));
    return { route: route, station: station };
  }

  private isShaftHop(from: Position2D, to: Position2D, network: Network) {
    if (this.canStep(from, to, network)) return false;
    return this.entryAt(from, network) !== undefined && this.entryAt(to, network) !== undefined;
  }

  private throughShaft(from: Position2D, to: Position2D, network: Network): RoutePoint[] {
    const out = this.entryAt(from, network);
    const into = this.entryAt(to, network);
    assert(out !== undefined && into !== undefined, "A ride through the shaft off no way onto the rails");
    const lane = this.randomLane();
    const body = network.shaftStation;
    const shaftLeg: RouteLeg = { kind: "station", body: body };
    const points: RoutePoint[] = [];
    if (out.joint) {
      points.push(this.point({ x: this.wallOf(out.joint), y: out.row }, TRAVEL.walk, { kind: "joint", tile: out.joint.tile }));
      points.push(this.point({ x: lane, y: out.row }, TRAVEL.walk, FREE_LEG));
    } else {
      points.push(this.point(stopOf(body), TRAVEL.walk, shaftLeg));
      points.push(this.point({ x: lane, y: body.y }, TRAVEL.walk, FREE_LEG));
    }
    points.push(this.point({ x: lane, y: into.row }, TRAVEL.lane, LANE_LEG));
    if (into.joint) {
      points.push(this.point({ x: this.wallOf(into.joint), y: into.row }, TRAVEL.walk, FREE_LEG));
      points.push(this.point(onRail(to), TRAVEL.walk, { kind: "joint", tile: into.joint.tile }));
    } else {
      points.push(this.point(stopOf(body), TRAVEL.walk, shaftLeg));
      points.push(this.point(onRail(to), TRAVEL.walk, shaftLeg));
    }
    return points;
  }

  private entryAt(corner: Position2D, network: Network) {
    return this.entries(0, 0, network.shaftStation).find((entry) => isSame(entry.start.corner, corner));
  }

  private railsToDoor(at: Position2D, starts: RailStart[], door: BuildingDoor, network: Network) {
    const lane = this.randomLane();
    const entries = this.entries(lane, door.tile.y, network.shaftStation);
    const corners = this.rails.route(
      starts,
      entries.map((entry) => entry.start),
      linksOf(network),
    );
    if (!corners) return undefined;
    const exit = entries.find((entry) => isSame(entry.start.corner, corners[corners.length - 1]));
    assert(exit !== undefined, "The rails' route ends off every entry");
    const way: RoutePoint[] = [here(at), ...this.alongRails(corners, FREE_LEG)];
    if (exit.joint) {
      way.push(this.point({ x: this.wallOf(exit.joint), y: exit.row }, TRAVEL.walk, { kind: "joint", tile: exit.joint.tile }));
      way.push(this.point({ x: lane, y: exit.row }, TRAVEL.walk, FREE_LEG));
    } else {
      const body = network.shaftStation;
      way.push(this.point(stopOf(body), TRAVEL.walk, { kind: "station", body: body }));
      way.push(this.point({ x: lane, y: body.y }, TRAVEL.walk, FREE_LEG));
    }
    const into = reversed(this.outOfDoor(door, lane));
    into[0].speed = TRAVEL.lane * this.terrain.tile;
    return [...way, ...into];
  }

  private cornersAround(at: Position2D, route: RoutePoint[], next: number, network: Network): RailStart[] {
    const tile = this.terrain.tile;
    const corners = [route[next - 1].position, route[next].position]
      .filter((position) => isOnCorner(position, tile))
      .map((position) => cornerOf(position, tile));
    const spot = toTiles(at, tile);
    const starts = corners.map((corner) => ({ corner: corner, cost: AxiomMath.distance2d(onRail(corner), spot) }));
    if (starts.length === 2 && !this.canStep(starts[0].corner, starts[1].corner, network))
      return [starts[0].cost <= starts[1].cost ? starts[0] : starts[1]];
    return starts;
  }

  private canStep(from: Position2D, to: Position2D, network: Network) {
    const through = linksOf(network).some(
      (ends) => ends.some((end) => isSame(end, from)) && ends.some((end) => isSame(end, to)),
    );
    return through || this.rails.canRide(from, to);
  }

  private fromLane(spot: Position2D, station: StationPlace, network: Network): RoutePoint[] | undefined {
    const stationLeg: RouteLeg = { kind: "station", body: station.body };
    if (station.atShaft)
      return [
        this.point({ x: spot.x, y: station.body.y }, TRAVEL.lane, LANE_LEG),
        this.point(stopOf(station.body), TRAVEL.walk, stationLeg),
      ];
    const entries = this.entries(spot.x, spot.y, network.shaftStation);
    const ends = stationRailEnds(station.body).map((end) => ({ corner: end, cost: 0 }));
    const corners = this.rails.route(
      entries.map((entry) => entry.start),
      ends,
      linksOf(network),
    );
    if (!corners) return undefined;
    const entry = entries.find((entry) => isSame(entry.start.corner, corners[0]));
    assert(entry !== undefined, "The rails' route starts off every entry");
    const route = [this.point({ x: spot.x, y: entry.row }, TRAVEL.lane, LANE_LEG)];
    const shaftLeg: RouteLeg = { kind: "station", body: network.shaftStation };
    let first: RouteLeg = shaftLeg;
    if (entry.joint) {
      route.push(this.point({ x: this.wallOf(entry.joint), y: entry.row }, TRAVEL.walk, FREE_LEG));
      first = { kind: "joint", tile: entry.joint.tile };
    } else route.push(this.point(stopOf(network.shaftStation), TRAVEL.walk, shaftLeg));
    route.push(...this.alongRails(corners, first));
    route.push(this.point(stopOf(station.body), TRAVEL.walk, stationLeg));
    return route;
  }

  private alongRails(corners: Position2D[], first: RouteLeg) {
    return corners.map((corner, index) => this.point(onRail(corner), TRAVEL.rail, index === 0 ? first : RAIL_LEG));
  }

  private tunnelsTo(from: Position2D, body: Box): RoutePoint[] | undefined {
    const footprint = stationFootprint(body);
    const room = { x: footprint.x - 1, y: footprint.y - 1, w: footprint.w + 2, h: footprint.h + 2 };
    const stop = stopOf(body);
    const open = (x: number, y: number) => !this.terrain.isSolid(x, y);
    const tiles = Grid.findShortestPath(
      this.terrain.world.mapInTiles,
      this.terrain.worldToTile(from),
      open,
      (x, y) => Grid.isTileInBox(room, { x: x, y: y }),
      stop,
    );
    if (!tiles) return undefined;
    const start = toTiles(from, this.terrain.tile);
    const way = Grid.smoothPath([start, ...tiles.slice(1).map((tile) => ({ x: tile.x + 0.5, y: tile.y + 0.5 }))], open);
    return [
      { position: { x: from.x, y: from.y }, speed: 0, leg: TUNNEL_LEG },
      ...way.slice(1).map((point) => this.point(point, TRAVEL.tunnel, TUNNEL_LEG)),
      this.point(stop, TRAVEL.walk, { kind: "station", body: body }),
    ];
  }

  private entries(lane: number, row: number, shaftStation: Box): Entry[] {
    const entries: Entry[] = this.rails.workingJoints.map((joint) => {
      const at = joint.anchor.y - rideHeight();
      return {
        start: { corner: joint.anchor, cost: Math.abs(at - row) + Math.abs(joint.anchor.x - lane) },
        row: at,
        joint: joint,
      };
    });
    const stop = stopOf(shaftStation);
    for (const end of stationRailEnds(shaftStation))
      entries.push({
        start: { corner: end, cost: Math.abs(stop.y - row) + Math.abs(end.x - lane) },
        row: shaftStation.y,
        joint: undefined,
      });
    return entries;
  }

  private wallOf(joint: ShaftJoint) {
    const columns = shaftColumns(this.terrain.world);
    return joint.tile.x < columns.from ? columns.from : columns.to + 1;
  }

  private get door() {
    assert(this.tavernDoor !== undefined, "No tavern to ride out of");
    return this.tavernDoor;
  }

  // out of the door, along the building's deck to the shaft and over to the lane
  private outOfDoor(door: BuildingDoor, lane: number): RoutePoint[] {
    const columns = shaftColumns(this.terrain.world);
    const wall = door.side === "left" ? columns.from : columns.to + 1;
    const floor = door.tile.y;
    return [
      this.point(door.tile, 0, FREE_LEG),
      this.point({ x: wall, y: floor }, TRAVEL.walk, FREE_LEG),
      this.point({ x: lane, y: floor }, TRAVEL.walk, FREE_LEG),
    ];
  }

  private randomLane() {
    return laneX(this.terrain.world, AxiomMath.randomInt(0, STRUCTURES.shaft.look.lanes.count - 1));
  }

  private point(tile: Position2D, speed: number, leg: RouteLeg): RoutePoint {
    const size = this.terrain.tile;
    return { position: { x: tile.x * size, y: tile.y * size }, speed: speed * size, leg: leg };
  }
}

function here(at: Position2D): RoutePoint {
  return { position: { x: at.x, y: at.y }, speed: 0, leg: FREE_LEG };
}

function linksOf(network: Network) {
  return network.bodies.map((body) => stationRailEnds(body));
}

function reversed(route: RoutePoint[]): RoutePoint[] {
  return route.map((point, index) => {
    const leg = index === 0 ? route[route.length - 1] : route[route.length - index];
    return {
      position: route[route.length - 1 - index].position,
      speed: index === 0 ? 0 : leg.speed,
      leg: leg.leg,
    };
  });
}

function toTiles(position: Position2D, tile: number): Position2D {
  return { x: position.x / tile, y: position.y / tile };
}

function onRail(corner: Position2D): Position2D {
  return { x: corner.x, y: corner.y - rideHeight() };
}

function cornerOf(position: Position2D, tile: number): Position2D {
  return { x: Math.round(position.x / tile), y: Math.round(position.y / tile + rideHeight()) };
}

function isOnCorner(position: Position2D, tile: number) {
  const corner = onRail(cornerOf(position, tile));
  return AxiomMath.distance2d(corner, toTiles(position, tile)) < 0.001;
}

function isSameBox(a: Box, b: Box) {
  return a.x === b.x && a.y === b.y && a.w === b.w && a.h === b.h;
}

function rideHeight() {
  return STRUCTURES.rails.look.width / 2 + TRAVEL.belly;
}

function stopOf(body: Box): Position2D {
  return { x: body.x + body.w / 2, y: body.y + body.h - rideHeight() - TRAVEL.deck };
}

function isSame(a: Position2D, b: Position2D) {
  return a.x === b.x && a.y === b.y;
}
