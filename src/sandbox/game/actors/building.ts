import PragmaActor from "@pragma/actor";
import { boxShape } from "../build/space";
import BuildFootprint from "../components/structures/buildFootprint";
import BuildingLook from "../components/buildings/buildingLook";
import Lamp from "../components/common/lamp";
import Revealer from "../components/common/revealer";
import Tavern from "../components/buildings/tavern";
import Market from "../components/buildings/market";
import Smelter from "../components/buildings/smelter";
import Headquarters from "../components/buildings/headquarters";
import Storage from "../components/common/storage";
import { BUILDINGS, BuildingsID } from "../content/structures";
import type { BuildingPlace } from "../world/buildingShape";

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
    if (props.place.base.y >= 0) {
      this.addComponent(BuildFootprint, {
        shape: boxShape(props.place.reserve),
        showReserve: props.place.reserve,
      });
    }
    this.addComponent(BuildingLook, { id: props.id, place: props.place });
    this.addComponent(Lamp, { light: BUILDINGS[props.id].light });
    this.addComponent(Revealer, { radius: BUILDINGS[props.id].reveal });
    switch (props.id) {
      case BuildingsID.tavern:
        this.addComponent(Tavern);
        break;
      case BuildingsID.market:
        this.addComponent(Market);
        break;
      case BuildingsID.smelter:
        this.addComponent(Smelter);
        break;
      case BuildingsID.headquarters:
        this.addComponent(Storage, { camp: true });
        this.addComponent(Headquarters);
        break;
    }
  }
}
