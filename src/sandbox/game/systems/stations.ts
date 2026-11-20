import PragmaSystem from "@pragma/system";
import { debug } from "@debug";
import Grid from "@axiom/grid";
import InputManager from "@engine/inputManager";
import { Camera } from "@engine/camera/camera";
import { assert } from "@axiom/utils";
import AxiomMath from "@axiom/math";
import AABB from "@axiom/AABB";
import Station, { STATION } from "../actors/station";
import type Dwarf from "../actors/dwarf";
import Launcher from "../components/launcher";
import Storage from "../components/storage";
import Drinker from "../components/drinker";
import Shift from "../components/shift";
import Travel from "../components/travel";
import { MainTraitsID } from "../content/traits";
import type { SpecialBeerID } from "../content/beers";
import { ResourcesID } from "../content/resources";
import { BLOCKS, BlocksID } from "../content/blocks";
import { BuildingsID, STRUCTURES } from "../content/structures";
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
import Buildings from "./buildings";
import Terrain from "./terrain";
import Discovery from "./discovery";
import Rails from "./rails";
import Transport, { type RideOrder, type StationPlace } from "./transport";
import GameEvents from "./gameEvents";
import GameMode from "./gameMode";

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
  // pressed on this station: released on it too, it was a click
  private pressed: Station | undefined;
  private shooting: Station | undefined;
  private built = 0;
  private from: Position2D | null = null;
  declare private roster: Roster;
  declare private buildings: Buildings;
  declare private terrain: Terrain;
  declare private discovery: Discovery;
  declare private rails: Rails;
  declare private transport: Transport;
  declare private gameMode: GameMode;
  declare private bar: ShootingBarUI;
  declare private menu: StationMenuUI;

  awake(): void {
    this.roster = this.scene.getSystem(Roster);
    this.buildings = this.scene.getSystem(Buildings);
    this.terrain = this.scene.getSystem(Terrain);
    this.discovery = this.scene.getSystem(Discovery);
    this.rails = this.scene.getSystem(Rails);
    this.transport = this.scene.getSystem(Transport);
    this.gameMode = this.scene.getSystem(GameMode);
    const events = this.scene.getSystem(GameEvents);
    events.dwarfs.shiftEnded.connect((dwarf) => this.sendHome(dwarf));
    events.terrain.mined.connect((tile) => {
      const drop = BLOCKS[tile.type].drops;
      if (drop) tile.hit.by.storage.stock.add(drop.id, drop.amount);
    });
    this.transport.useStations(() =>
      this.stations.map((station) => ({ station: station, place: this.placeOf(station) })),
    );
    this.bar = new ShootingBarUI({ stop: () => this.stopShooting() });
    this.menu = new StationMenuUI({
      freeCount: (main) => this.roster.freeCount(main),
      wage: (main, hours) => {
        const dwarf = this.roster.freeWorker(main);
        return dwarf ? this.wage(dwarf, hours) : undefined;
      },
      lacking: (wage) => this.buildings.store.missing(wage),
      connected: (station) => this.isConnected(station),
      haul: (station) => {
        const storage = station.getComponent(Storage);
        assert(storage !== undefined, `${station.name} has no Storage`);
        return storage.stock.text;
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
  }

  public openShaftStation() {
    this.built++;
    const station = new Station({ name: `Station ${this.built}`, tile: this.terrain.tile });
    this.stations.push(station);
    this.scene.spawnActor(station);
  }

  update(): void {
    this.bar.update();
    this.menu.update();
    if (this.shooting) {
      this.updateShooting(this.shooting);
      return;
    }
    this.clickStation();
  }

  public get isMenuOpen() {
    return this.menu.isOpen;
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

  private placeOf(station: Station): StationPlace {
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
    if (!this.buildings.store.canAfford(this.wage(dwarf, hours))) return "noBeer";
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
    this.buildings.store.pay(this.wage(dwarf, hours));
    this.roster.send(dwarf, station);
    const launcher = this.launcherOf(station);
    this.transport.send(dwarf, BuildingsID.tavern, {
      goal: { to: "station", station: station },
      onArrive: () => {
        this.scene.deleteActor(dwarf);
        this.roster.arrive(dwarf);
        launcher.enqueue(dwarf, hours, beer);
      },
      onCutOff: () => this.cutOff(dwarf),
    });
  }

  private cutOff(dwarf: Dwarf) {
    this.roster.leave(dwarf);
    if (!this.travelOf(dwarf).riding) {
      this.roster.returnHome(dwarf);
      return;
    }
    debug.log.log(`${dwarf.name} is cut off`);
    this.transport.turnBack(dwarf, this.homeOrder(dwarf));
  }

  private homeOrder(dwarf: Dwarf, leaving?: Station): RideOrder {
    return {
      goal: { to: "building", id: BuildingsID.tavern, leaving: leaving },
      onArrive: () => this.arriveHome(dwarf),
      onCutOff: () => this.arriveHome(dwarf),
    };
  }

  private sendHome(dwarf: Dwarf) {
    const station = this.roster.stationOf(dwarf);
    assert(
      station !== undefined,
      `Dwarf ${dwarf.name} ended a shift from no station`,
    );
    this.roster.leave(dwarf);
    this.transport.send(dwarf, "here", this.homeOrder(dwarf, station));
  }

  private arriveHome(dwarf: Dwarf) {
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
        if (this.transport.cancel(dwarf)) this.roster.returnHome(dwarf);
        else this.transport.turnBack(dwarf, this.homeOrder(dwarf));
        continue;
      }
      if (state === "waiting") {
        launcher.remove(dwarf);
        this.roster.leave(dwarf);
        // the route is taken while the station still stands, it may be removed right after
        this.transport.send(dwarf, station, this.homeOrder(dwarf));
        continue;
      }
      if (!working) continue;
      const shift = dwarf.getComponent(Shift);
      assert(shift !== undefined, `Dwarf ${dwarf.name} has no Shift`);
      shift.cutShort();
    }
  }

  public tryOrder(
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
    this.gameMode.set("shoot");
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
    this.gameMode.set("game");
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

  public launcherOf(station: Station) {
    const launcher = station.getComponent(Launcher);
    assert(launcher !== undefined, `Station ${station.name} has no Launcher`);
    return launcher;
  }
}
