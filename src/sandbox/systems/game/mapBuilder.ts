import InputManager from "@engine/inputManager";
import PragmaSystem from "@pragma/system";
import AxiomMath from "@axiom/math";
import { Camera } from "@engine/camera/camera";
import { ACTION } from "../../inputActions";
import Palisade from "../../bActors/palisade";
import Terrain from "./terrain";

// build mode, for testing: left click puts a palisade under the cursor, turned at random;
// right click mines the tile under it by the game rules
export default class MapBuilder extends PragmaSystem {
  constructor(internal: InternalPSProps) {
    super(internal);
  }

  preUpdate(): void {
    const position = Camera.screenToWorld(InputManager.getMousePos());
    if (InputManager.onActionPressed(ACTION.placeBlock))
      this.scene.spawnActor(new Palisade({ position, rotation: AxiomMath.randomFloat(0, Math.PI) }));
    if (InputManager.onActionPressed(ACTION.mineTile)) {
      const terrain = this.scene.getSystem(Terrain);
      const tile = terrain.world.worldToTile(position);
      terrain.mine(tile.x, tile.y);
    }
  }
}
