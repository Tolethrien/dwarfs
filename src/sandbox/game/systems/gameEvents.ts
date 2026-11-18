import PragmaSystem from "@pragma/system";
import { Signal } from "@axiom/events";
import type { TerrainSignals } from "./terrain";
import type { CalendarSignals } from "./calendar";
import type { ResourcesSignals } from "./resources";
import type { BiomesSignals } from "./biomes";
import type { ShiftSignals } from "../components/shift";
import type { RailsSignals } from "./rails";
import type { ShaftSignals } from "../components/shaftDigging";

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
  public readonly dwarfs: ShiftSignals = {
    shiftEnded: new Signal(),
  };
}
