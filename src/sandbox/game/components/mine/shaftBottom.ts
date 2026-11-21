import PragmaComponent from "@pragma/component";
import { assert } from "@axiom/utils";
import { boxShape } from "../../build/space";
import { STRUCTURES } from "../../content/structures";
import Terrain from "../../systems/world/terrain";
import GameEvents from "../../systems/core/gameEvents";
import { craterCenter } from "../../world/shaftShape";
import { standStation, stationFootprint } from "../../world/stationShape";
import BuildFootprint from "../structures/buildFootprint";
import Launcher from "./launcher";

// the starting station: in the middle of the crater under the shaft's bottom, its body solid, down
// with it to the new bottom when the shaft goes deeper. The old body and connectors stay: they're
// under the shaft's columns, the new segment takes them
export default class ShaftBottom extends PragmaComponent {
  declare private terrain: Terrain;

  awake(): void {
    this.terrain = this.scene.getSystem(Terrain);
    const events = this.scene.getSystem(GameEvents);
    this.connect(events.shaft.deepened, () => this.followBottom());
    assert(
      STRUCTURES.station.look.body.width + 2 <= STRUCTURES.shaft.width,
      "The station at the shaft's bottom with its connectors must be narrower than the shaft, its old tiles are left there",
    );
  }

  // the first one: before the lamp's, it discovers around where the station stands
  start(): void {
    this.followBottom();
  }

  private followBottom() {
    const world = this.terrain.world;
    const center = craterCenter(world, world.shaftDepth);
    this.actor.transform.teleport(center.x * this.terrain.tile, center.y * this.terrain.tile);
    const launcher = this.getSibling(Launcher);
    assert(launcher !== undefined, `ShaftBottom needs Launcher on actor: ${this.actor.ID.description}`);
    const body = launcher.tiles;
    standStation(this.terrain, body);
    this.getSibling(BuildFootprint)?.updateShape(boxShape(stationFootprint(body)), boxShape(body));
  }
}
