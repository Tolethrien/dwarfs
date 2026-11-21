import PragmaSystem from "@pragma/system";
import { Signal } from "@axiom/events";
import type { TerrainSignals } from "../world/terrain";
import type { CalendarSignals } from "./calendar";
import type { ResourcesSignals } from "../../components/common/storage";
import type { BiomesSignals } from "../world/biomes";
import type { ShiftSignals } from "../../components/dwarfs/shift";
import type { EffectsSignals } from "../../components/dwarfs/effects";
import type { RailsSignals } from "../mine/rails";
import type { ShaftSignals } from "../../components/mine/shaftDigging";
import type { TavernSignals } from "../../components/buildings/tavern";
import type { HeadquartersSignals } from "../../components/buildings/headquarters";
import type { InboxSignals } from "../ui/inbox";
import type { PlayerSignals } from "./playerStats";

// only the owner of a group emits on it, everyone else just connects
export default class GameEvents extends PragmaSystem {
  public readonly terrain: TerrainSignals = {
    damaged: new Signal(),
    mined: new Signal(),
    deflected: new Signal(),
    changed: new Signal(),
  };
  public readonly calendar: CalendarSignals = {
    hourStarted: new Signal(),
    dayStarted: new Signal(),
    weekStarted: new Signal(),
  };
  public readonly resources: ResourcesSignals = {
    changed: new Signal(),
  };
  public readonly biomes: BiomesSignals = {
    ballEntered: new Signal(),
    discovered: new Signal(),
    cameraEntered: new Signal(),
  };
  public readonly shaft: ShaftSignals = {
    deepened: new Signal(),
  };
  public readonly rails: RailsSignals = {
    changed: new Signal(),
  };
  public readonly dwarfs: ShiftSignals & EffectsSignals = {
    shiftEnded: new Signal(),
    statsChanged: new Signal(),
  };
  public readonly tavern: TavernSignals = {
    arrived: new Signal(),
  };
  public readonly headquarters: HeadquartersSignals = {
    upgraded: new Signal(),
    shipped: new Signal(),
  };
  public readonly inbox: InboxSignals = {
    push: new Signal(),
  };
  public readonly player: PlayerSignals = {
    unlocked: new Signal(),
  };
}
