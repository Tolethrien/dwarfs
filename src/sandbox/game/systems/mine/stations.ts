import PragmaSystem from "@pragma/system";
import InputManager from "@engine/inputManager";
import { Camera } from "@engine/camera/camera";
import { assert } from "@axiom/utils";
import AABB from "@axiom/AABB";
import Station, { STATION } from "../../actors/station";
import type Dwarf from "../../actors/dwarf";
import type { Removable } from "../../build/space";
import BuildFootprint from "../../components/structures/buildFootprint";
import Launcher from "../../components/mine/launcher";
import Storage, { type Stock } from "../../components/common/storage";
import Drinker from "../../components/dwarfs/drinker";
import Shift from "../../components/dwarfs/shift";
import Travel from "../../components/common/travel";
import { MainTraitsID } from "../../content/traits";
import type { SpecialBeerID } from "../../content/beers";
import { ResourcesID } from "../../content/resources";
import { BuildingsID, STRUCTURES } from "../../content/structures";
import { CAMP_STORE } from "../../sceneData";
import { clearStation, stationRailEnds, standStation } from "../../world/stationShape";
import StationMenuUI from "../../ui/stations/menu";
import { toast } from "../../ui/elements/toast";
import Roster from "../dwarfs/roster";
import Terrain from "../world/terrain";
import Discovery from "../world/discovery";
import Rails from "./rails";
import Transport, { type RideOrder, type StationPlace } from "./transport";
import GameEvents from "../core/gameEvents";
import ShootMode from "./shootMode";

export type OrderProblem = "notConnected" | "noFreeDwarf" | "noBeer" | "stationFull";

const ORDER_PROBLEMS: Record<OrderProblem, (main: MainTraitsID) => string> = {
  notConnected: () => "The station isn't connected to the shaft",
  noFreeDwarf: (main) => `No free ${MainTraitsID[main]}`,
  noBeer: () => "Not enough beer for the wage",
  stationFull: () => "The station is full",
};

const REMOVE_PROBLEMS = {
  atShaft: "The station at the shaft's bottom stays",
  working: "Recall the working ones first",
};

export default class Stations extends PragmaSystem {
  public readonly stations: Station[] = [];
  // pressed on this station: released on it too, it was a click
  private pressed: Station | undefined;
  private built = 0;
  declare private roster: Roster;
  declare private store: Stock;
  declare private terrain: Terrain;
  declare private discovery: Discovery;
  declare private rails: Rails;
  declare private transport: Transport;
  declare private events: GameEvents;
  declare private shootMode: ShootMode;
  declare private menu: StationMenuUI;

  awake(): void {
    this.roster = this.scene.getSystem(Roster);
    this.store = this.scene.sharedData.require(CAMP_STORE);
    this.terrain = this.scene.getSystem(Terrain);
    this.discovery = this.scene.getSystem(Discovery);
    this.rails = this.scene.getSystem(Rails);
    this.transport = this.scene.getSystem(Transport);
    this.events = this.scene.getSystem(GameEvents);
    this.shootMode = this.scene.getSystem(ShootMode);
    this.connect(this.events.dwarfs.shiftEnded, (dwarf) => this.sendHome(dwarf));
    this.transport.useStations(() =>
      this.stations.map((station) => ({ station: station, place: this.placeOf(station) })),
    );
    this.menu = new StationMenuUI({
      classes: () => this.roster.recruitable(),
      freeCount: (main) => this.roster.freeCount(main),
      wage: (main, hours) => {
        const dwarf = this.roster.freeWorker(main);
        return dwarf ? this.wage(dwarf, hours) : undefined;
      },
      lacking: (wage) => this.store.missing(wage),
      connected: (station) => this.isConnected(station),
      haul: (station) => {
        const storage = station.getComponent(Storage);
        assert(storage !== undefined, `${station.name} has no Storage`);
        return storage.stock.text;
      },
      order: (main, hours, beer, station) => this.tryOrder(main, hours, beer, station),
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
    const station = new Station({
      name: `Station ${this.built}`,
      tile: this.terrain.tile,
      removable: (actor) => this.removableFor(actor),
    });
    this.stations.push(station);
    this.scene.spawnActor(station);
  }

  update(): void {
    this.menu.update();
    this.clickStation();
  }

  public get isMenuOpen() {
    return this.menu.isOpen;
  }

  public get selectedHours() {
    return this.menu.selectedHours;
  }

  public get waitingCount() {
    let waiting = 0;
    for (const station of this.stations) waiting += this.launcherOf(station).queue.length;
    return waiting;
  }

  public focusStation(station: Station) {
    const box = this.launcherOf(station).tiles;
    const tile = this.terrain.tile;
    Camera.setPosition({ x: (box.x + box.w / 2) * tile, y: (box.y + box.h / 2) * tile });
    this.menu.open(station);
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

  // it blows its crater around it like the starting one's, so a ball has room to fly out (no
  // resources of it, the structures stay); nobody is sent to it until it's connected
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
      removable: (actor) => this.removableFor(actor),
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

  private removeProblem(station: Station): string | undefined {
    if (station.atShaft) return REMOVE_PROBLEMS.atShaft;
    if (this.roster.assignedTo(station).some((dwarf) => this.roster.stateOf(dwarf) === "working"))
      return REMOVE_PROBLEMS.working;
    return undefined;
  }

  private removableFor(station: Station): Removable {
    return {
      label: () => station.name,
      canRemove: () => this.removeProblem(station),
      warning: () => {
        const ordered = this.orderedTo(station).length;
        return ordered > 0 ? `${ordered} ordered dwarfs go back to the tavern` : undefined;
      },
      remove: () => this.remove(station),
    };
  }

  // the ones ordered and waiting go back to the tavern, its tiles open again, the crater and the
  // rails to it stay
  public remove(station: Station) {
    assert(this.removeProblem(station) === undefined, `${station.name} can't be removed now`);
    this.recall(station, false);
    clearStation(this.terrain, this.launcherOf(station).tiles);
    station.getComponent(BuildFootprint)?.detach();
    this.stations.splice(this.stations.indexOf(station), 1);
    this.scene.deleteActor(station);
  }

  public orderProblem(main: MainTraitsID, hours: number, station: Station): OrderProblem | undefined {
    if (!this.isConnected(station)) return "notConnected";
    if (this.roster.assignedTo(station).length >= STATION.manualLimit) return "stationFull";
    const dwarf = this.roster.freeWorker(main);
    if (!dwarf) return "noFreeDwarf";
    if (!this.store.canAfford(this.wage(dwarf, hours))) return "noBeer";
    return undefined;
  }

  // ask orderProblem first: the wage for the whole shift now; it rides from the tavern to the
  // station and waits inside
  public order(main: MainTraitsID, hours: number, beer: SpecialBeerID | undefined, station: Station) {
    const problem = this.orderProblem(main, hours, station);
    const dwarf = this.roster.freeWorker(main);
    assert(
      problem === undefined && dwarf !== undefined,
      `Order of ${MainTraitsID[main]} to ${station.name} has a problem: ${problem}`,
    );
    this.store.pay(this.wage(dwarf, hours));
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
    this.events.inbox.push.emit({
      kind: "warning",
      title: `${dwarf.name} is cut off`,
      body: "No path back on the rails — turning back to the tavern.",
    });
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
    assert(station !== undefined, `Dwarf ${dwarf.name} ended a shift from no station`);
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

  public tryOrder(main: MainTraitsID, hours: number, beer: SpecialBeerID | undefined, station: Station) {
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
    if (InputManager.onActionPressed("select")) this.pressed = this.underMouse();
    if (!InputManager.onActionReleased("select")) return;
    const target = this.underMouse();
    if (target && target === this.pressed) this.menu.open(target);
    this.pressed = undefined;
  }

  private underMouse() {
    const point = Camera.screenToWorld(InputManager.getMousePos());
    return this.stations.find((station) => this.launcherOf(station).contains(point));
  }

  private startShooting(station: Station) {
    const launcher = this.launcherOf(station);
    if (launcher.queue.length === 0) {
      toast(`Nobody waits at ${station.name}`, "info");
      return;
    }
    this.menu.close();
    this.shootMode.enter({
      canShoot: () => launcher.queue.length > 0,
      label: () => `Shooting · ${station.name} · waiting ${launcher.queue.length}`,
      pull: (from, to) => launcher.pull(from, to),
      release: () => launcher.release(),
      dropAim: () => launcher.dropAim(),
    });
  }

  public launcherOf(station: Station) {
    const launcher = station.getComponent(Launcher);
    assert(launcher !== undefined, `Station ${station.name} has no Launcher`);
    return launcher;
  }
}
