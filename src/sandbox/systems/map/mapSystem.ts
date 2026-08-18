import PragmaActor from "@/core/pragma/actor";
import MapComponent from "./mapComponent";

export default class MapSystem extends PragmaActor {
  constructor() {
    super();
    this.addComponent(MapComponent);
  }
}
