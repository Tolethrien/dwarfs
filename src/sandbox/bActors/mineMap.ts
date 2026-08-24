import PragmaActor from "@/core/pragma/actor";
import mapDirector from "../systems/mapDirector";
import MapDiscovery from "../systems/mapDiscovery";

export default class MineMap extends PragmaActor {
  constructor() {
    super();
    this.addComponent(mapDirector);
    this.addComponent(MapDiscovery);
  }
}
