import PragmaSystem from "@pragma/system";
import { debug } from "@debug";
import { gameCommands } from "../debugCommands";
import { BlocksID } from "../content/blocks";
import GameEvents from "./gameEvents";

// the player's own record: who signed the directive, what they did since
export default class PlayerStats extends PragmaSystem {
  public name = "";
  private readonly mined = new Map<BlocksID, number>();
  private total = 0;

  awake(): void {
    this.scene.getSystem(GameEvents).terrain.mined.connect((struck) => this.countMined(struck.type));
    debug.game.connect("player", () => ({
      name: this.name,
      minedTotal: this.total,
      mined: [...this.mined]
        .sort((a, b) => b[1] - a[1])
        .map(([block, count]) => ({ block: BlocksID[block], count: count })),
    }));
    const stats = this;
    gameCommands("player", {
      get name() {
        return stats.name;
      },
      rename: (name: string) => (this.name = name),
    });
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
