import GameResources, { GameResourcesID } from "../managers/resourcesObject";
import PragmaSystem from "@pragma/system";
import { TileMinedEvent } from "./mapDirector";
import EntitiesObject from "../managers/entitiesObject";
import { SPRITES } from "../managers/generalData";
import Navi from "@navi/navi";
import UINode from "@navi/node";
import { auto, px } from "@navi/units";
import UIText from "@navi/elements/text";
const RESOURCE_COUNT =
  Object.keys(GameResourcesID).filter((k) => isNaN(Number(k))).length - 1; // no none - all class need to -1 index
export default class PlayerResources extends PragmaSystem {
  private panel!: UINode;
  private resList: number[] = new Array(RESOURCE_COUNT).fill(0);
  constructor(internal: InternalPSProps) {
    super(internal);
    this.addResource(GameResourcesID.coal, 6);
    this.removeResource(GameResourcesID.coal, 3);
  }
  awake(): void {
    this.onSceneEvent<TileMinedEvent>("tileMined", (event) =>
      this.blockMined(event),
    );
    this.buildPanel();
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
  private buildPanel() {
    const panel = Navi.append(
      new UINode({
        position: { x: px(10), y: px(10) },
        size: { width: auto(), height: auto() },
        style: {
          anchorX: "end",
          backgroundColor: [0, 0, 0, 200],
          layout: "stack",
          direction: "col",
          gap: 15,
          padding: { top: 8, right: 8, bottom: 8, left: 8 },
          alignCross: "stretch",
        },
      }),
    );
    this.panel = panel;
    for (let slot = 0; slot < this.resList.length; slot++) {
      const res = (slot + 1) as GameResourcesID;

      const row = Navi.append(
        new UINode({
          size: { width: auto(), height: auto() },
          input: "absorb",
          style: {
            backgroundColor: [0, 0, 0, 0],
            layout: "stack",
            direction: "row",
            gap: 5,
            alignMain: "end",
          },
        }),
        panel,
      );

      Navi.append(
        new UIText(() => String(this.resList[slot]), {
          size: { width: auto(), height: auto() },
          style: {
            textColor: [255, 55, 55, 255],
            textSize: 14,
          },
        }),
        row,
      );

      Navi.append(
        new UINode({
          size: { width: px(25), height: px(25) },
          style: {
            backgroundImage: SPRITES.icons,
            backgroundImageCrop: GameResources.resources[res].crop,
          },
        }),
        row,
      );
    }
  }
}
