import PragmaComponent from "@pragma/component";
import type PragmaActor from "@pragma/actor";
import { assert } from "@axiom/utils";
import type Station from "../actors/station";
import Cargo from "../actors/cargo";
import Travel from "./travel";
import Storage from "./storage";
import { BuildingsID } from "../content/structures";
import Buildings from "../systems/buildings";
import Transport, { type RideOrder } from "../systems/transport";
import GameEvents from "../systems/gameEvents";

// dropOff: where the hauls go, the first of them that stands
const HAUL = { dropOff: [BuildingsID.headquarters] };

// every hour what the station's dwarfs mined rides as one cargo to the drop-off; cut off on the way
// the cargo goes on to the nearest station it still reaches and waits in its storage, with no
// station at all it lands in the camp's store at once
export default class Haul extends PragmaComponent {
  declare private buildings: Buildings;
  declare private transport: Transport;
  declare private events: GameEvents;

  awake(): void {
    this.buildings = this.scene.getSystem(Buildings);
    this.transport = this.scene.getSystem(Transport);
    this.events = this.scene.getSystem(GameEvents);
    this.events.calendar.hourStarted.connect(this.send);
  }

  destroy(): void {
    this.events.calendar.hourStarted.disconnect(this.send);
  }

  public readonly send = () => {
    const dropOff = HAUL.dropOff.find((id) => this.transport.hasDoor(id));
    const stock = storageOf(this.actor).stock;
    if (dropOff === undefined || stock.isEmpty) return;
    const cargo = new Cargo();
    stock.moveAllTo(storageOf(cargo).stock);
    this.transport.send(cargo, this.actor as Station, {
      goal: { to: "building", id: dropOff },
      onArrive: () => this.land(cargo),
      onCutOff: () => {
        if (cargo.getComponent(Travel)?.riding) this.transport.redirect(cargo, this.toNearestStation(cargo));
        else storageOf(cargo).stock.moveAllTo(stock);
      },
    });
  };

  private toNearestStation(cargo: Cargo): RideOrder {
    return {
      goal: { to: "nearestStation" },
      onArrive: (station) => this.land(cargo, station),
      onCutOff: () => this.land(cargo),
    };
  }

  private land(cargo: Cargo, station?: Station) {
    const to = station?.getAlive() ? storageOf(station).stock : this.buildings.store;
    storageOf(cargo).stock.moveAllTo(to);
    this.scene.deleteActor(cargo);
  }
}

function storageOf(actor: PragmaActor) {
  const storage = actor.getComponent(Storage);
  assert(storage !== undefined, `${actor.ID.description} has no Storage`);
  return storage;
}
