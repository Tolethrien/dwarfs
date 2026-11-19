import PragmaComponent from "@pragma/component";
import type { Signal } from "@axiom/events";
import GameEvents from "../systems/gameEvents";
import { ResourcesID, type ResourceCost } from "../content/resources";
import { STRUCTURES } from "../content/structures";
import Resources from "../systems/resources";
import PlayerStats from "../systems/playerStats";
import Calendar, { type Alarm } from "../systems/calendar";
import HeadquartersUI from "../ui/buildings/headquarters";
import { toast } from "../ui/elements/toast";

// cost: to reach the level, from level 2 on
// shaft: tiles the shaft may go below its first segment
export interface HeadquartersLevel {
  cost?: ResourceCost;
  shaft: number;
}

export interface HeadquartersSignals {
  upgraded: Signal<number>;
}

// levels: from level 1 on; subsidy: the Party's daily beer, until the mine stands on its own
export const HEADQUARTERS = {
  levels: [{ shaft: 0 }, { cost: { [ResourcesID.ironBars]: 10, [ResourcesID.concrete]: 50 }, shaft: 90 }] as HeadquartersLevel[],
  subsidy: { hour: 12, beer: 100, untilLevel: 2 },
};

// the deepest row the shaft may reach at a level; no headquarters, no deeper than the first segment
export function shaftLimitAt(level: number) {
  const data = HEADQUARTERS.levels[level - 1];
  return STRUCTURES.shaft.startDepth + (data?.shaft ?? 0);
}

// its level is the mine's development: what can be built at all, how deep the shaft goes
export default class Headquarters extends PragmaComponent {
  public level = 1;
  declare private resources: Resources;
  declare private events: GameEvents;
  declare private window: HeadquartersUI;
  declare private subsidy: Alarm;

  awake(): void {
    this.resources = this.scene.getSystem(Resources);
    this.events = this.scene.getSystem(GameEvents);
    const subsidy = HEADQUARTERS.subsidy;
    const calendar = this.scene.getSystem(Calendar);
    this.subsidy = calendar.alarm(
      { hour: subsidy.hour, everyDays: 1 },
      () => this.resources.add(ResourcesID.beer, subsidy.beer),
      { until: () => this.level >= subsidy.untilLevel },
    );
    const playerStats = this.scene.getSystem(PlayerStats);
    this.window = new HeadquartersUI({
      director: () => playerStats.name,
      level: () => this.level,
      next: () => HEADQUARTERS.levels[this.level],
      shaftLimit: (level) => shaftLimitAt(level),
      missing: (cost) => this.resources.missing(cost),
      upgrade: () => this.upgrade(),
    });
  }

  update(): void {
    this.window.update();
  }

  destroy(): void {
    this.subsidy.cancel();
    this.window.close();
  }

  public open() {
    this.window.open();
  }

  private upgrade() {
    const cost = HEADQUARTERS.levels[this.level]?.cost;
    if (cost === undefined) return;
    if (!this.resources.pay(cost)) {
      toast("Not enough resources", "error");
      return;
    }
    this.level++;
    toast(`The mine is level ${this.level} now`, "success");
    this.window.close();
    this.events.headquarters.upgraded.emit(this.level);
  }
}
