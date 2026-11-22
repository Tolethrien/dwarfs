import PragmaComponent from "@pragma/component";
import { AGH_UPGRADES, type AghUpgradeID, type AghUpgradeLevel } from "../../content/agh";
import PlayerStats from "../../systems/core/playerStats";
import Workforce from "../../systems/dwarfs/workforce";
import AghUI from "../../ui/buildings/agh";
import { toast } from "../../ui/elements/toast";

export default class Agh extends PragmaComponent {
  private readonly levels = new Map<AghUpgradeID, number>();
  declare private playerStats: PlayerStats;
  declare private workforce: Workforce;
  declare private window: AghUI;

  awake(): void {
    this.playerStats = this.scene.getSystem(PlayerStats);
    this.workforce = this.scene.getSystem(Workforce);
    this.onActorEvent("open", () => this.open());
    this.window = new AghUI({
      levelOf: (id) => this.levelOf(id),
      maxLevelOf: (id) => this.maxLevelOf(id),
      nextLevel: (id) => this.nextLevel(id),
      upgrade: (id) => this.upgrade(id),
    });
  }

  update(): void {
    this.window.update();
  }

  destroy(): void {
    this.window.close();
  }

  public open() {
    this.window.open();
  }

  public levelOf(id: AghUpgradeID) {
    return this.levels.get(id) ?? 0;
  }

  public maxLevelOf(id: AghUpgradeID) {
    return AGH_UPGRADES[id].levels.length;
  }

  public isMaxed(id: AghUpgradeID) {
    return this.levelOf(id) >= this.maxLevelOf(id);
  }

  public nextLevel(id: AghUpgradeID): AghUpgradeLevel | undefined {
    return AGH_UPGRADES[id].levels[this.levelOf(id)];
  }

  public upgrade(id: AghUpgradeID) {
    const next = this.nextLevel(id);
    if (next === undefined) return false;
    this.levels.set(id, this.levelOf(id) + 1);
    next.apply({ playerStats: this.playerStats, workforce: this.workforce });
    toast(`${next.title} researched`, "success");
    return true;
  }
}
