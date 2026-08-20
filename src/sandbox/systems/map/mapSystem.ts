import PragmaActor from "@/core/pragma/actor";
import mapDirector from "./mapDirector";
import MapDiscovery from "./mapDiscovery";

export default class MapSystem extends PragmaActor {
  constructor() {
    super();
    this.addComponent(mapDirector);
    this.addComponent(MapDiscovery);
  }
}
