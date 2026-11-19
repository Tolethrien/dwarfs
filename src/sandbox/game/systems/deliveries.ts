import PragmaSystem from "@pragma/system";
import { assert } from "@axiom/utils";
import { gameCommands } from "../debugCommands";
import Cargo from "../actors/cargo";
import type Station from "../actors/station";
import Haul from "../components/haul";
import Travel, { type RoutePoint } from "../components/travel";
import { BLOCKS } from "../content/blocks";
import { BuildingsID } from "../content/structures";
import Stations from "./stations";
import Buildings from "./buildings";
import Transport from "./transport";
import Resources from "./resources";
import GameEvents from "./gameEvents";

// dropOff: where the hauls go, the first of them that stands
const DELIVERIES = {
  dropOff: [BuildingsID.headquarters],
};

// every hour each station sends its haul to the drop-off; cut off on the way, a cargo goes on to the
// nearest station it still reaches and waits in its haul, with no station at all it lands in the
// store at once
export default class Deliveries extends PragmaSystem {
  // undefined: on the way to the drop-off
  private readonly rides = new Map<Cargo, Station | undefined>();
  // rails or tiles changed this frame: the rides check the way to their next node once, in the next
  // update
  private networkChanged = false;
  declare private stations: Stations;
  declare private buildings: Buildings;
  declare private transport: Transport;
  declare private resources: Resources;

  awake(): void {
    this.stations = this.scene.getSystem(Stations);
    this.buildings = this.scene.getSystem(Buildings);
    this.transport = this.scene.getSystem(Transport);
    this.resources = this.scene.getSystem(Resources);
    const events = this.scene.getSystem(GameEvents);
    events.terrain.mined.connect((tile) => {
      const drop = BLOCKS[tile.type].drops;
      if (drop) tile.hit.by.haul.add(drop.id, drop.amount);
    });
    events.calendar.hourStarted.connect(() => this.sendAll());
    events.rails.changed.connect(() => (this.networkChanged = true));
    events.terrain.changed.connect(() => (this.networkChanged = true));
    gameCommands("delivery", { send: () => this.sendAll() });
  }

  update(): void {
    if (!this.networkChanged) return;
    this.networkChanged = false;
    this.checkAhead();
  }

  // asked anew at every send and reroute, so a new drop-off takes over on the way
  private get dropOffDoor() {
    for (const id of DELIVERIES.dropOff) {
      const place = this.buildings.placeOf(id);
      if (place !== undefined) return this.transport.doorOf(id, place);
    }
    return undefined;
  }

  // a station with no way to the drop-off keeps its haul for the next hour
  private sendAll() {
    const door = this.dropOffDoor;
    if (!door) return;
    const network = this.stations.network;
    for (const station of this.stations.stations) {
      const haul = haulOf(station);
      if (haul.isEmpty) continue;
      const route = this.transport.toDoor(door, this.stations.placeOf(station), network);
      if (!route) continue;
      const cargo = new Cargo(haul.take());
      this.ride(cargo, route, undefined);
      this.scene.spawnActor(cargo);
    }
  }

  private ride(cargo: Cargo, route: RoutePoint[], to: Station | undefined) {
    this.rides.set(cargo, to);
    travelOf(cargo).ride(
      route,
      () => this.arrive(cargo),
      (index) => this.atPoint(cargo, index),
    );
  }

  private arrive(cargo: Cargo) {
    const to = this.rides.get(cargo);
    this.rides.delete(cargo);
    this.scene.deleteActor(cargo);
    if (to && this.stations.stations.includes(to)) haulOf(to).addAll(cargo.load);
    else this.resources.addAll(cargo.load);
  }

  private atPoint(cargo: Cargo, index: number) {
    const ride = travelOf(cargo).riding;
    if (!ride) return false;
    const network = this.stations.network;
    if (!this.transport.isNode(ride.route[index].position, network)) return false;
    if (this.transport.isIntact(ride.route, index + 1, network)) return false;
    this.reroute(cargo, index + 1);
    return true;
  }

  private checkAhead() {
    const network = this.stations.network;
    for (const cargo of [...this.rides.keys()]) {
      const ride = travelOf(cargo).riding;
      if (ride && this.transport.isCutAhead(ride.route, ride.next, network)) this.reroute(cargo, ride.next);
    }
  }

  private reroute(cargo: Cargo, next: number) {
    const travel = travelOf(cargo);
    const ride = travel.riding;
    assert(ride !== undefined, "A cargo rides nowhere");
    const at = cargo.transform.getPosition();
    const network = this.stations.network;
    const door = this.dropOffDoor;
    if (this.rides.get(cargo) === undefined && door) {
      const route = this.transport.rerouteToDoor(at, ride.route, next, door, network);
      if (route) {
        travel.redirect(route);
        return;
      }
    }
    const places = this.stations.stations.map((station) => this.stations.placeOf(station));
    const found = this.transport.rerouteToStations(at, ride.route, next, places, network);
    if (found) {
      this.rides.set(cargo, this.stations.stations[places.indexOf(found.station)]);
      travel.redirect(found.route);
      return;
    }
    this.rides.delete(cargo);
    this.scene.deleteActor(cargo);
    this.resources.addAll(cargo.load);
  }
}

function haulOf(station: Station) {
  const haul = station.getComponent(Haul);
  assert(haul !== undefined, `${station.name} has no Haul`);
  return haul;
}

function travelOf(cargo: Cargo) {
  const travel = cargo.getComponent(Travel);
  assert(travel !== undefined, "A cargo has no Travel");
  return travel;
}
