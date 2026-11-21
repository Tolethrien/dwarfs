import PragmaSystem from "@pragma/system";
import type { Signal } from "@axiom/events";
import { BlocksID } from "../../content/blocks";
import GameEvents from "./gameEvents";

export interface PlayerSignals {
  unlocked: Signal<string>;
}

// the player's own record: who signed the directive, what they did since
export default class PlayerStats extends PragmaSystem {
  public name = "";
  private readonly mined = new Map<BlocksID, number>();
  private readonly plans = new Set<string>();
  private total = 0;
  declare private events: GameEvents;

  awake(): void {
    this.events = this.scene.getSystem(GameEvents);
    this.connect(this.events.terrain.mined, (struck) => this.countMined(struck.type));
  }

  public unlock(plan: string) {
    if (this.plans.has(plan)) return;
    this.plans.add(plan);
    this.events.player.unlocked.emit(plan);
  }

  public hasPlan(plan: string) {
    return this.plans.has(plan);
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
