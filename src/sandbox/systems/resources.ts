import GameResources, { GameResourcesID } from "../managers/resourcesObject";
import PragmaComponent from "@/core/pragma/component";
import { TileMinedEvent } from "./mapDirector";
import EntitiesObject from "../managers/entitiesObject";
import Draw from "@/core/aurora/draw";
import { SPRITES } from "../managers/generalData";
import Aurora from "@/core/aurora/core";
const RESOURCE_COUNT =
  Object.keys(GameResourcesID).filter((k) => isNaN(Number(k))).length - 1; // no none - all class need to -1 index
export default class PlayerResources extends PragmaComponent {
  private resList: number[] = new Array(RESOURCE_COUNT).fill(0);
  constructor(internal: InternalPCProps) {
    super(internal);
    this.addResource(GameResourcesID.coal, 6);
    this.removeResource(GameResourcesID.coal, 3);
  }
  awake(): void {
    this.onSceneEvent<TileMinedEvent>("tileMined", (event) =>
      this.blockMined(event),
    );
  }
  public addResource(res: GameResourcesID, value: number) {
    this.resList[res - 1] += value;
  }
  public removeResource(res: GameResourcesID, value: number) {
    const amount = this.resList[res - 1];
    if (amount < value) return;
    this.resList[res - 1] -= value;
  }
  public hasEnough(res: GameResourcesID, value: number) {
    return this.resList[res - 1] >= value;
  }
  public blockMined(event: TileMinedEvent) {
    const res = EntitiesObject.blocks[event.type].resource;
    if (!res) return;
    this.addResource(res, 1);
  }
  render(): void {
    const PADDING = 8;
    const ICON_SIZE = 25;
    const ROW_HEIGHT = 30;
    const ROW_WIDTH = 70;
    const MARGIN_RIGHT = 10;
    const TEXT_COLUMN_WIDTH = 30;

    const panelHeight = PADDING * 2 + this.resList.length * ROW_HEIGHT;
    const x = Aurora.canvas.width - ROW_WIDTH - MARGIN_RIGHT;
    const y = 10;

    Draw.guiRect({
      position: { x, y },
      size: { width: ROW_WIDTH, height: panelHeight },
      tint: [0, 0, 0, 200],
    });

    for (let slot = 0; slot < this.resList.length; slot++) {
      const res = (slot + 1) as GameResourcesID;
      const amount = this.resList[slot];
      const crop = GameResources.resources[res].crop;
      const rowY = y + PADDING + slot * ROW_HEIGHT;

      Draw.guiText({
        position: { x: x + PADDING, y: rowY + 3, mode: "pixel" },
        text: String(amount),
        font: "lato",
        fontSize: { size: 14, mode: "pixel" },
        fontColor: [255, 55, 55, 255],
      });

      Draw.guiRect({
        position: { x: x + PADDING + TEXT_COLUMN_WIDTH, y: rowY },
        size: { width: ICON_SIZE, height: ICON_SIZE },
        background: SPRITES.icons,
        crop,
      });
    }
  }
}
