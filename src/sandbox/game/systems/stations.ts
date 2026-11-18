import PragmaSystem from "@pragma/system";
import { debug } from "@debug";
import Grid from "@axiom/grid";
import InputManager from "@engine/inputManager";
import { Camera } from "@engine/camera/camera";
import { assert } from "@axiom/utils";
import AxiomMath from "@axiom/math";
import AABB from "@axiom/AABB";
import { gameCommands } from "../debugCommands";
import Station, { STATION } from "../actors/station";
import type Dwarf from "../actors/dwarf";
import Launcher from "../components/launcher";
import Haul from "../components/haul";
import Drinker from "../components/drinker";
import Shift from "../components/shift";
import Travel, { type RoutePoint } from "../components/travel";
import { MainTraitsID } from "../content/traits";
import type { SpecialBeerID } from "../content/beers";
import { ResourcesID } from "../content/resources";
import { BlocksID } from "../content/blocks";
import { STRUCTURES } from "../content/structures";
import {
  clearStation,
  stationBodyAt,
  stationFootprint,
  stationRailEnds,
  standStation,
} from "../world/stationShape";
import ShootingBarUI from "../ui/shootingBar";
import StationMenuUI from "../ui/stations/menu";
import { toast } from "../ui/elements/toast";
import Roster from "./roster";
import Resources from "./resources";
import Terrain from "./terrain";
import Discovery from "./discovery";
import Rails from "./rails";
import Transport, { type Network, type RideGoal, type StationPlace } from "./transport";
import GameEvents from "./gameEvents";

const STATIONS = { leaveGap: 0.5 };

interface Departure {
  dwarf: Dwarf;
  route: RoutePoint[];
  trip: Trip;
  onArrive: () => void;
}

type Trip = { to: "station"; station: Station } | { to: "tavern"; station: Station | undefined };

const HOME: Trip = { to: "tavern", station: undefined };

export type OrderProblem =
  "notConnected" | "noFreeDwarf" | "noBeer" | "stationFull";

const ORDER_PROBLEMS: Record<OrderProblem, (main: MainTraitsID) => string> = {
  notConnected: () => "The station isn't connected to the shaft",
  noFreeDwarf: (main) => `No free ${MainTraitsID[main]}`,
  noBeer: () => "Not enough beer for the wage",
  stationFull: () => "The station is full",
};

export type StationProblem = "outsideMap" | "tooClose" | "notDug" | "taken";

export const STATION_PROBLEMS: Record<StationProblem, string> = {
  outsideMap: "It doesn't fit in the map",
  tooClose: `Stations stand at least ${STATION.spacing} tiles apart`,
  notDug: "Dig its room out first",
  taken: "Something else keeps this room",
};

export type RemoveProblem = "atShaft" | "working";

export const REMOVE_PROBLEMS: Record<RemoveProblem, string> = {
  atShaft: "The station at the shaft's bottom stays",
  working: "Recall the working ones first",
};

export interface StationRefusal {
  problem: StationProblem;
  tiles: Position2D[];
}

export default class Stations extends PragmaSystem {
  public readonly stations: Station[] = [];
  private readonly departures = new Map<Station | "tavern", Departure[]>();
  private readonly trips = new Map<Dwarf, Trip>();
  // rails or tiles changed this frame: the rides check the way to their next node once, in the next
  // update
  private networkChanged = false;
  // pressed on this station: released on it too, it was a click
  private pressed: Station | undefined;
  private shooting: Station | undefined;
  private built = 0;
  private from: Position2D | null = null;
  declare private roster: Roster;
  declare private resources: Resources;
  declare private terrain: Terrain;
  declare private discovery: Discovery;
  declare private rails: Rails;
  declare private transport: Transport;
  declare private bar: ShootingBarUI;
  declare private menu: StationMenuUI;

  awake(): void {
    this.roster = this.scene.getSystem(Roster);
    this.resources = this.scene.getSystem(Resources);
    this.terrain = this.scene.getSystem(Terrain);
    this.discovery = this.scene.getSystem(Discovery);
    this.rails = this.scene.getSystem(Rails);
    this.transport = this.scene.getSystem(Transport);
    const events = this.scene.getSystem(GameEvents);
    events.dwarfs.shiftEnded.connect((dwarf) => this.sendHome(dwarf));
    events.rails.changed.connect(() => (this.networkChanged = true));
    events.terrain.changed.connect(() => (this.networkChanged = true));
    this.bar = new ShootingBarUI({ stop: () => this.stopShooting() });
    this.menu = new StationMenuUI({
      freeCount: (main) => this.roster.freeCount(main),
      wage: (main, hours) => {
        const dwarf = this.roster.freeWorker(main);
        return dwarf ? this.wage(dwarf, hours) : undefined;
      },
      lacking: (wage) => this.resources.missing(wage),
      connected: (station) => this.isConnected(station),
      haul: (station) => {
        const haul = station.getComponent(Haul);
        assert(haul !== undefined, `${station.name} has no Haul`);
        return haul.text;
      },
      order: (main, hours, beer, station) =>
        this.tryOrder(main, hours, beer, station),
      beerOf: (dwarf, station) => this.beerOf(dwarf, station),
      rename: (station, name) => (station.name = name),
      setPriority: (station, priority) => (station.priority = priority),
      assigned: (station) => this.roster.assignedTo(station),
      stateOf: (dwarf) => this.roster.stateOf(dwarf),
      canShoot: (station) => this.launcherOf(station).queue.length > 0,
      shoot: (station) => this.startShooting(station),
      recall: (station, working) => this.recall(station, working),
      inTavern: () => this.roster.inTavern(),
      sendNow: (dwarf, hours, beer, station) => this.sendNow(dwarf, hours, beer, station),
    });
    debug.game.connect("stations", () =>
      this.stations.map((station) => {
        const body = this.launcherOf(station).tiles;
        return {
          name: station.name,
          position: `${body.x}, ${body.y}`,
          atShaft: station.atShaft,
          connected: this.isConnected(station),
          priority: station.priority,
          queue: this.launcherOf(station).queue.length,
          ordered: this.roster.assignedTo(station).length,
          manualLimit: STATION.manualLimit,
        };
      }),
    );
    const stations = this;
    gameCommands("station", {
      get list() {
        return stations.stations;
      },
      order: (
        main: MainTraitsID,
        hours: number = STATION.shift.start,
        beer: SpecialBeerID | undefined = undefined,
        index: number = 0,
      ) => this.tryOrder(main, hours, beer, this.at(index)),
      recall: (working: boolean = false, index: number = 0) =>
        this.recall(this.at(index), working),
    });
  }

  public openShaftStation() {
    this.built++;
    const station = new Station({ name: `Station ${this.built}`, tile: this.terrain.tile });
    this.stations.push(station);
    this.scene.spawnActor(station);
  }

  update(): void {
    if (this.networkChanged) {
      this.networkChanged = false;
      this.checkAhead();
    }
    this.bar.update();
    this.menu.update();
    if (this.shooting) {
      this.updateShooting(this.shooting);
      return;
    }
    this.clickStation();
  }

  public get isShooting() {
    return this.shooting !== undefined;
  }

  public get footprints(): Box[] {
    return this.stations.map((station) =>
      stationFootprint(this.launcherOf(station).tiles),
    );
  }

  public isConnected(station: Station) {
    if (station.atShaft) return true;
    return this.rails.leads(
      this.railEndsOf(station),
      [...this.railEndsOf(this.shaftStation), ...this.rails.workingJoints.map((joint) => joint.anchor)],
      this.links,
    );
  }

  public get network(): Network {
    return {
      shaftStation: this.launcherOf(this.shaftStation).tiles,
      bodies: this.stations.map((station) => this.launcherOf(station).tiles),
    };
  }

  public placeOf(station: Station): StationPlace {
    return { body: this.launcherOf(station).tiles, atShaft: station.atShaft };
  }

  private get shaftStation() {
    const shaft = this.stations.find((station) => station.atShaft);
    assert(shaft !== undefined, "No station at the shaft's bottom");
    return shaft;
  }

  private get links() {
    return this.stations.map((station) => this.railEndsOf(station));
  }

  private railEndsOf(station: Station) {
    return stationRailEnds(this.launcherOf(station).tiles);
  }

  public get railAnchors(): Position2D[] {
    return this.stations.flatMap((station) => this.railEndsOf(station));
  }

  public placeAt(tile: Position2D) {
    return stationBodyAt(tile);
  }

  public problem(body: Box, kept: Box[]): StationRefusal | undefined {
    const footprint = stationFootprint(body);
    const world = this.terrain.world;
    const fits =
      footprint.x >= 0 &&
      footprint.y >= 0 &&
      footprint.x + footprint.w <= world.mapInTiles.width &&
      footprint.y + footprint.h <= world.mapInTiles.height;
    if (!fits) return { problem: "outsideMap", tiles: [] };
    const middle = AABB.getCenter(body);
    const near = this.stations.some(
      (station) =>
        AxiomMath.distance2d(
          AABB.getCenter(this.launcherOf(station).tiles),
          middle,
        ) < STATION.spacing,
    );
    if (near) return { problem: "tooClose", tiles: [] };
    const others = [...kept, ...this.footprints];
    const tiles = Grid.tilesIn(footprint);
    const taken = tiles.filter((tile) =>
      others.some((other) => Grid.isTileInBox(other, tile)),
    );
    if (taken.length > 0) return { problem: "taken", tiles: taken };
    const rock = tiles.filter(
      (tile) => world.getType(tile.x, tile.y) !== BlocksID.air,
    );
    if (rock.length > 0) return { problem: "notDug", tiles: rock };
    return undefined;
  }

  // ask problem first; it blows its crater around it like the starting one's, so a ball has room
  // to fly out (no resources of it, the structures stay); nobody is sent to it until it's connected
  public build(body: Box) {
    const crater = STRUCTURES.station.crater;
    const middle = AABB.getCenter(body);
    this.terrain.blast(middle, {
      radius: crater.built,
      power: Infinity,
      edge: 1,
      jag: crater.jag,
    });
    this.discovery.revealCrater(middle, crater.built);
    standStation(this.terrain, body);
    const tile = this.terrain.tile;
    const station = new Station({
      name: `Station ${++this.built}`,
      tile: tile,
      position: {
        x: (body.x + body.w / 2) * tile,
        y: (body.y + body.h / 2) * tile,
      },
    });
    this.stations.push(station);
    this.scene.spawnActor(station);
  }

  // for testing: any dwarf from the tavern straight into the station's sling, no ride and no wage
  private sendNow(dwarf: Dwarf, hours: number, beer: SpecialBeerID | undefined, station: Station) {
    if (this.roster.stateOf(dwarf) !== "tavern") {
      toast(`${dwarf.name} isn't free in the tavern`, "error");
      return;
    }
    this.roster.send(dwarf, station);
    this.roster.arrive(dwarf);
    this.launcherOf(station).enqueue(dwarf, hours, beer);
  }

  public orderedTo(station: Station) {
    return this.roster.assignedTo(station);
  }

  public removeProblem(station: Station): RemoveProblem | undefined {
    if (station.atShaft) return "atShaft";
    if (
      this.roster
        .assignedTo(station)
        .some((dwarf) => this.roster.stateOf(dwarf) === "working")
    )
      return "working";
    return undefined;
  }

  // ask removeProblem first: the ones ordered and waiting go back to the tavern, its tiles open
  // again, the crater and the rails to it stay
  public remove(station: Station) {
    assert(
      this.removeProblem(station) === undefined,
      `${station.name} can't be removed now`,
    );
    this.recall(station, false);
    clearStation(this.terrain, this.launcherOf(station).tiles);
    this.stations.splice(this.stations.indexOf(station), 1);
    this.scene.deleteActor(station);
  }

  public orderProblem(
    main: MainTraitsID,
    hours: number,
    station: Station,
  ): OrderProblem | undefined {
    if (!this.isConnected(station)) return "notConnected";
    if (this.roster.assignedTo(station).length >= STATION.manualLimit)
      return "stationFull";
    const dwarf = this.roster.freeWorker(main);
    if (!dwarf) return "noFreeDwarf";
    if (!this.resources.canAfford(this.wage(dwarf, hours))) return "noBeer";
    return undefined;
  }

  // ask orderProblem first: the wage for the whole shift now; it rides from the tavern to the
  // station and waits inside
  public order(
    main: MainTraitsID,
    hours: number,
    beer: SpecialBeerID | undefined,
    station: Station,
  ) {
    const problem = this.orderProblem(main, hours, station);
    const dwarf = this.roster.freeWorker(main);
    assert(
      problem === undefined && dwarf !== undefined,
      `Order of ${MainTraitsID[main]} to ${station.name} has a problem: ${problem}`,
    );
    this.resources.pay(this.wage(dwarf, hours));
    this.roster.send(dwarf, station);
    const launcher = this.launcherOf(station);
    const route = this.transport.toStation(this.placeOf(station), this.network);
    assert(route !== undefined, `No way to ${station.name}, it's connected`);
    this.depart("tavern", {
      dwarf: dwarf,
      route: route,
      trip: { to: "station", station: station },
      onArrive: () => {
        this.scene.deleteActor(dwarf);
        this.roster.arrive(dwarf);
        launcher.enqueue(dwarf, hours, beer);
      },
    });
  }

  private sendHome(dwarf: Dwarf) {
    const station = this.roster.stationOf(dwarf);
    assert(
      station !== undefined,
      `Dwarf ${dwarf.name} ended a shift from no station`,
    );
    this.roster.leave(dwarf);
    const place = this.placeOf(station);
    const route = this.transport.home(dwarf.transform.getPosition(), place, this.network);
    if (route) this.ride(dwarf, route, { to: "tavern", station: station }, () => this.arriveHome(dwarf));
    else this.arriveHome(dwarf);
  }

  private ride(dwarf: Dwarf, route: RoutePoint[], trip: Trip, onArrive: () => void) {
    this.trips.set(dwarf, trip);
    this.travelOf(dwarf).ride(
      route,
      () => {
        this.trips.delete(dwarf);
        onArrive();
      },
      (index) => this.atPoint(dwarf, index),
    );
  }

  private atPoint(dwarf: Dwarf, index: number) {
    const ride = this.travelOf(dwarf).riding;
    const trip = this.trips.get(dwarf);
    if (!ride || !trip) return false;
    const network = this.network;
    if (!this.transport.isNode(ride.route[index].position, network)) return false;
    if (this.transport.isIntact(ride.route, index + 1, network)) return false;
    this.reroute(dwarf, trip, index + 1);
    return true;
  }

  private arriveHome(dwarf: Dwarf) {
    this.trips.delete(dwarf);
    if (dwarf.scene) this.scene.deleteActor(dwarf);
    this.roster.returnHome(dwarf);
  }

  private travelOf(dwarf: Dwarf) {
    const travel = dwarf.getComponent(Travel);
    assert(travel !== undefined, `Dwarf ${dwarf.name} has no Travel`);
    return travel;
  }

  public recall(station: Station, working: boolean) {
    const launcher = this.launcherOf(station);
    for (const dwarf of this.roster.assignedTo(station)) {
      const state = this.roster.stateOf(dwarf);
      if (state === "travelling") {
        this.roster.leave(dwarf);
        if (this.cancelDeparture(dwarf)) this.roster.returnHome(dwarf);
        else this.turnBack(dwarf);
        continue;
      }
      if (state === "waiting") {
        launcher.remove(dwarf);
        this.roster.leave(dwarf);
        // taken while the station still stands, it may be removed right after
        const route = this.transport.fromStation(this.placeOf(station), this.network);
        if (route) this.depart(station, { dwarf: dwarf, route: route, trip: HOME, onArrive: () => this.arriveHome(dwarf) });
        else this.roster.returnHome(dwarf);
        continue;
      }
      if (!working) continue;
      const shift = dwarf.getComponent(Shift);
      assert(shift !== undefined, `Dwarf ${dwarf.name} has no Shift`);
      shift.cutShort();
    }
  }

  private turnBack(dwarf: Dwarf) {
    const travel = this.travelOf(dwarf);
    this.trips.set(dwarf, HOME);
    travel.turnBack(
      () => this.arriveHome(dwarf),
      (index) => this.atPoint(dwarf, index),
    );
    const back = travel.riding;
    if (back && !this.transport.isIntact(back.route, back.next, this.network)) this.reroute(dwarf, HOME, back.next);
  }

  private checkAhead() {
    const network = this.network;
    for (const [dwarf, trip] of [...this.trips]) {
      const travel = this.travelOf(dwarf);
      const ride = travel.riding;
      if (!ride || !this.transport.isCutAhead(ride.route, ride.next, network)) continue;
      const goal = this.goalOf(trip);
      const at = dwarf.transform.getPosition();
      const back = goal && this.transport.backThroughNode(at, ride.route, ride.next, goal, network);
      if (back) travel.redirect(back);
      else this.reroute(dwarf, trip, ride.next);
    }
  }

  private reroute(dwarf: Dwarf, trip: Trip, next: number) {
    const travel = this.travelOf(dwarf);
    const ride = travel.riding;
    assert(ride !== undefined, `Dwarf ${dwarf.name} rides nowhere`);
    const goal = this.goalOf(trip);
    const route = goal && this.transport.reroute(dwarf.transform.getPosition(), ride.route, next, goal, this.network);
    if (route) {
      travel.redirect(route);
      return;
    }
    debug.log.log(`${dwarf.name} is cut off`);
    if (trip.to === "tavern") {
      this.arriveHome(dwarf);
      return;
    }
    this.roster.leave(dwarf);
    this.turnBack(dwarf);
  }

  private freshRoute(from: Station | "tavern", trip: Trip) {
    if (trip.to === "station")
      return this.isStanding(trip.station) ? this.transport.toStation(this.placeOf(trip.station), this.network) : undefined;
    if (from === "tavern" || !this.isStanding(from)) return undefined;
    return this.transport.fromStation(this.placeOf(from), this.network);
  }

  private goalOf(trip: Trip): RideGoal | undefined {
    if (trip.to === "station") return this.isStanding(trip.station) ? { to: "station", station: this.placeOf(trip.station) } : undefined;
    const station = trip.station && this.isStanding(trip.station) ? this.placeOf(trip.station) : undefined;
    return { to: "tavern", station: station };
  }

  private isStanding(station: Station) {
    return this.stations.includes(station);
  }

  private depart(from: Station | "tavern", departure: Departure) {
    const queue = this.departures.get(from);
    if (queue) {
      queue.push(departure);
      return;
    }
    const waiting = [departure];
    this.departures.set(from, waiting);
    const stations = this;
    this.startCoroutine(function* departing(co) {
      while (waiting.length > 0) {
        const next = waiting.shift() as Departure;
        const route = stations.transport.isIntact(next.route, 1, stations.network)
          ? next.route
          : stations.freshRoute(from, next.trip);
        if (!route) {
          stations.stayHome(next);
          continue;
        }
        stations.scene.spawnActor(next.dwarf);
        stations.ride(next.dwarf, route, next.trip, next.onArrive);
        yield co.waitSeconds(STATIONS.leaveGap);
      }
      stations.departures.delete(from);
    });
  }

  private stayHome(departure: Departure) {
    if (departure.trip.to === "station") this.roster.leave(departure.dwarf);
    this.roster.returnHome(departure.dwarf);
  }

  private cancelDeparture(dwarf: Dwarf) {
    for (const queue of this.departures.values()) {
      const index = queue.findIndex((departure) => departure.dwarf === dwarf);
      if (index === -1) continue;
      queue.splice(index, 1);
      return true;
    }
    return false;
  }

  private tryOrder(
    main: MainTraitsID,
    hours: number,
    beer: SpecialBeerID | undefined,
    station: Station,
  ) {
    const problem = this.orderProblem(main, hours, station);
    if (problem) {
      toast(ORDER_PROBLEMS[problem](main), "error");
      return;
    }
    this.order(main, hours, beer, station);
  }

  private beerOf(dwarf: Dwarf, station: Station) {
    const waiting = this.launcherOf(station).waiting(dwarf);
    if (waiting) return waiting.beer;
    const drinker = dwarf.getComponent(Drinker);
    assert(drinker !== undefined, `Dwarf ${dwarf.name} has no Drinker`);
    return drinker.specialBeer;
  }

  private wage(dwarf: Dwarf, hours: number) {
    const drinker = dwarf.getComponent(Drinker);
    assert(drinker !== undefined, `Dwarf ${dwarf.name} has no Drinker`);
    return { [ResourcesID.beer]: drinker.wageFor(hours) };
  }

  private clickStation() {
    if (InputManager.onActionPressed("select"))
      this.pressed = this.underMouse();
    if (!InputManager.onActionReleased("select")) return;
    const target = this.underMouse();
    if (target && target === this.pressed) this.menu.open(target);
    this.pressed = undefined;
  }

  public underMouse() {
    const point = Camera.screenToWorld(InputManager.getMousePos());
    return this.stations.find((station) =>
      this.launcherOf(station).contains(point),
    );
  }

  private startShooting(station: Station) {
    const launcher = this.launcherOf(station);
    if (launcher.queue.length === 0) {
      toast(`Nobody waits at ${station.name}`, "info");
      return;
    }
    this.menu.close();
    this.shooting = station;
    this.bar.show(
      () => `Shooting · ${station.name} · waiting ${launcher.queue.length}`,
    );
  }

  private stopShooting() {
    const station = this.shooting;
    if (!station) return;
    this.launcherOf(station).dropAim();
    this.from = null;
    this.shooting = undefined;
    this.bar.hide();
  }

  private updateShooting(station: Station) {
    const launcher = this.launcherOf(station);
    if (
      InputManager.onActionPressed("stopShooting") ||
      launcher.queue.length === 0
    ) {
      this.stopShooting();
      return;
    }
    if (!this.from && InputManager.onActionPressed("aim")) {
      const mouse = InputManager.getMousePos();
      this.from = { x: mouse.x, y: mouse.y };
    }
    if (!this.from) return;
    if (InputManager.onActionHold("aim")) {
      launcher.pull(this.from, InputManager.getMousePos());
      return;
    }
    this.from = null;
    launcher.release();
  }

  private at(index: number) {
    const station = this.stations[index];
    assert(
      station !== undefined,
      `No station number ${index}, the mine has ${this.stations.length}`,
    );
    return station;
  }

  public launcherOf(station: Station) {
    const launcher = station.getComponent(Launcher);
    assert(launcher !== undefined, `Station ${station.name} has no Launcher`);
    return launcher;
  }
}
