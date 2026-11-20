import PragmaSystem from "@pragma/system";
import { BlocksID } from "../content/blocks";
import GameEvents from "./gameEvents";

// the player's own record: who signed the directive, what they did since
export default class PlayerStats extends PragmaSystem {
  public name = "";
  private readonly mined = new Map<BlocksID, number>();
  private total = 0;

  awake(): void {
    this.scene.getSystem(GameEvents).terrain.mined.connect((struck) => this.countMined(struck.type));
  }

  public get minedList(): ReadonlyMap<BlocksID, number> {
    return this.mined;
  }

  public minedOf(block: BlocksID) {
    return this.mined.get(block) ?? 0;
  }

  public get minedTotal() {
    return this.total;
  }

  private countMined(block: BlocksID) {
    this.mined.set(block, this.minedOf(block) + 1);
    this.total++;
  }
}
