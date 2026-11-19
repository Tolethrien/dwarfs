import PragmaActor from "@pragma/actor";
import BuildingLook from "../components/buildingLook";
import LampLight from "../components/lampLight";
import Tavern from "../components/tavern";
import Market from "../components/market";
import Smelter from "../components/smelter";
import Headquarters from "../components/headquarters";
import { BUILDINGS, BuildingsID } from "../content/structures";
import type { BuildingPlace } from "../systems/buildings";

interface BuildingProps {
  id: BuildingsID;
  place: BuildingPlace;
  position: Position2D;
}

export default class Building extends PragmaActor {
  public readonly id: BuildingsID;
  constructor(props: BuildingProps) {
    super();
    this.id = props.id;
    this.transform.teleport(props.position.x, props.position.y);
    this.addComponent(BuildingLook, { id: props.id, place: props.place });
    this.addComponent(LampLight, { light: BUILDINGS[props.id].light });
    if (props.id === BuildingsID.tavern) this.addComponent(Tavern);
    if (props.id === BuildingsID.market) this.addComponent(Market);
    if (props.id === BuildingsID.smelter) this.addComponent(Smelter);
    if (props.id === BuildingsID.headquarters) this.addComponent(Headquarters);
  }
}
