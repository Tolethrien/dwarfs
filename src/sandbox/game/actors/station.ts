import PragmaActor from "@pragma/actor";
import { boxShape, type Removable } from "../build/space";
import BuildFootprint from "../components/structures/buildFootprint";
import ShaftBottom from "../components/mine/shaftBottom";
import Launcher from "../components/mine/launcher";
import StationLook from "../components/mine/stationLook";
import Lamp from "../components/common/lamp";
import Revealer from "../components/common/revealer";
import Haul from "../components/mine/haul";
import Storage from "../components/common/storage";
import { STRUCTURES } from "../content/structures";
import { stationFootprint } from "../world/stationShape";

export const STATION = {
  manualLimit: 3,
  spacing: 30,
  shift: { min: 2, max: 8, start: 2 },
};

interface StationProps {
  name: string;
  tile: number;
  position?: Position2D;
  removable: (station: Station) => Removable;
}

export default class Station extends PragmaActor {
  public name: string;
  public priority = 0;
  public readonly atShaft: boolean;

  constructor(props: StationProps) {
    super();
    this.name = props.name;
    this.atShaft = props.position === undefined;
    // first: in place before the revealer discovers around it
    if (props.position) this.transform.teleport(props.position.x, props.position.y);
    else this.addComponent(ShaftBottom);
    const launcher = this.addComponent(Launcher, { tile: props.tile });
    this.addComponent(BuildFootprint, {
      shape: boxShape(stationFootprint(launcher.tiles)),
      hitShape: boxShape(launcher.tiles),
      removable: props.removable(this),
    });
    this.addComponent(Storage);
    this.addComponent(Haul);
    this.addComponent(StationLook, { name: () => this.name });
    this.addComponent(Lamp, { light: STRUCTURES.station.look.light });
    this.addComponent(Revealer, { radius: STRUCTURES.station.reveal });
  }
}
