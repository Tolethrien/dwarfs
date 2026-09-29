import PragmaActor from "@pragma/actor";
import mapDirector from "../systems/mapDirector";
import MapDiscovery from "../systems/mapDiscovery";
import MapBuilder from "../systems/mapBuilder";

export default class MineMap extends PragmaActor {
  constructor() {
    super();
    this.addComponent(mapDirector);
    this.addComponent(MapDiscovery);
    this.addComponent(MapBuilder);
  }
}
