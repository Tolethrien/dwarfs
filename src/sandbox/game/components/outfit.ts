import PragmaComponent from "@pragma/component";
import { assert } from "@axiom/utils";
import { BASE_GEAR } from "../content/gear";
import type { WornGear } from "../systems/workforce";
import Effects from "./effects";

// the base gear a worker took when ordered, kept for the whole shift
export default class Outfit extends PragmaComponent {
  private gear: WornGear | undefined;

  public get worn(): Readonly<WornGear> | undefined {
    return this.gear;
  }

  public get effects() {
    if (this.gear === undefined) return [];
    return BASE_GEAR[this.gear.gear].levels[this.gear.level - 1];
  }

  public wear(gear: WornGear | undefined) {
    this.gear = gear;
    const effects = this.getSibling(Effects);
    assert(effects !== undefined, `Outfit needs Effects on actor: ${this.actor.ID.description}`);
    effects.changed();
  }
}
