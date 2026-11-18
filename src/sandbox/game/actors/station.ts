import PragmaActor from "@pragma/actor";
import ShaftBottom from "../components/shaftBottom";
import Launcher from "../components/launcher";
import StationLook from "../components/stationLook";
import LampLight from "../components/lampLight";
import Haul from "../components/haul";
import { STRUCTURES } from "../content/structures";

export const STATION = {
  manualLimit: 3,
  spacing: 30,
  shift: { min: 2, max: 8, start: 4 },
};

interface StationProps {
  name: string;
  tile: number;
  position?: Position2D;
}

export default class Station extends PragmaActor {
  public name: string;
  public priority = 0;
  public readonly atShaft: boolean;

  constructor(props: StationProps) {
    super();
    this.name = props.name;
    this.atShaft = props.position === undefined;
    // first: in place before the lamp discovers around it
    if (props.position) this.transform.teleport(props.position.x, props.position.y);
    else this.addComponent(ShaftBottom);
    this.addComponent(Launcher, { tile: props.tile });
    this.addComponent(Haul);
    this.addComponent(StationLook, { name: () => this.name });
    this.addComponent(LampLight, { light: STRUCTURES.station.look.light });
  }
}
