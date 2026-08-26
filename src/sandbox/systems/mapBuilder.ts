import InputManager from "@/core/engine/inputManager";
import PragmaComponent from "@/core/pragma/component";
import { ACTION } from "../inputActions";
import { GameMode } from "../scenes/gameScene";
import MapObject, { LAYER } from "../managers/mapObject";
import { BlocksID } from "../managers/entitiesObject";

interface MapBuilderProps {}
interface StructurePlacedEvent {}
export default class MapBuilder extends PragmaComponent {
  constructor(internal: InternalPCProps, props?: MapBuilderProps) {
    super(internal);
  }
  preUpdate(): void {
    const gameMode = this.systemSharedData.get<GameMode>("gameMode");
    if (!gameMode) return;
    if (InputManager.onActionPressed(ACTION.changeMode)) {
      if (gameMode.mode === "build") gameMode.mode = "game";
      else gameMode.mode = "build";
    }
    if (gameMode.mode !== "build") return;
    if (InputManager.onActionPressed(ACTION.placeBlock)) {
      const tilePos = MapObject.mouseToTile();
      if (!this.isTileEmpty(tilePos)) {
        console.log("cos tam jest!");
        return;
      }
      this.placeTile(tilePos.x, tilePos.y);
    }
  }
  public isTileEmpty({ x, y }: Position2D) {
    const tileType = MapObject.getTileType(x, y, LAYER.solid);
    return tileType === BlocksID.air;
  }
  public placeTile(gx: number, gy: number) {
    console.log("stawiam");
    MapObject.setTile(gx, gy, BlocksID.rocksLightBrown, 0); //TODO: faktyczne stawianie konkretnego bloku a nie tylko coal
    // this.emitSceneEvent<StructurePlacedEvent>("StructurePlaced", {});
  }
}
