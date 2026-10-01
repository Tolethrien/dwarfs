import { GameResourcesID, RESOURCES } from "../../content/resources";
import PragmaSystem from "@pragma/system";
import type { TileMinedEvent } from "./terrain";
import { BLOCKS } from "../../content/blocks";
import { SPRITES } from "../../content/sprites";
import Navi from "@navi/navi";
import UINode from "@navi/node";
import { auto, px } from "@navi/units";
import UIText from "@navi/elements/text";
import AxiomColor, { COLOR } from "@axiom/color";
const RESOURCE_COUNT =
  Object.keys(GameResourcesID).filter((k) => isNaN(Number(k))).length - 1; // no none - all class need to -1 index
export default class PlayerResources extends PragmaSystem {
  private panel!: UINode;
  private resList: number[] = new Array(RESOURCE_COUNT).fill(0);
  constructor(internal: InternalPSProps) {
    super(internal);
  }
  awake(): void {
    this.onSceneEvent<TileMinedEvent>("tileMined", (event) =>
      this.blockMined(event),
    );
    this.buildPanel();
  }

  destroy(): void {
    Navi.remove(this.panel, Navi.root);
  }

  // [id, amount] of what the player has, for the save
  public snapshot(): [GameResourcesID, number][] {
    const pairs: [GameResourcesID, number][] = [];
    this.resList.forEach((amount, slot) => {
      if (amount > 0) pairs.push([slot + 1, amount]);
    });
    return pairs;
  }

  // ids this game does not know are skipped, the missing ones stay at 0
  public restore(pairs: readonly [number, number][]) {
    this.resList.fill(0);
    for (const [id, amount] of pairs) {
      const slot = id - 1;
      if (slot >= 0 && slot < this.resList.length) this.resList[slot] = amount;
    }
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
    const res = BLOCKS[event.type].resource;
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
          backgroundColor: AxiomColor.withAlpha(COLOR.BLACK, 200),
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
            backgroundColor: COLOR.TRANSPARENT,
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
            textColor: COLOR.TOMATO,
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
            backgroundImageCrop: RESOURCES[res].crop,
          },
        }),
        row,
      );
    }
  }
}
