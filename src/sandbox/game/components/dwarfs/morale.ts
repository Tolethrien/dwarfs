import PragmaComponent from "@pragma/component";
import AxiomMath from "@axiom/math";
import { assert } from "@axiom/utils";
import { TraitsID } from "../../content/traits";
import Effects from "./effects";
import Traits from "./traits";

// work and tavern: points a full hour; min, max and rate: the base the effects (moraleMin, moraleMax,
// moraleRate) build on, rate 0.1 is 10% faster both ways; below tiredBelow a dwarf gets Tired, at
// restedAt it loses it
export const MORALE = {
  start: 100,
  min: 0,
  max: 100,
  work: -8,
  tavern: 10,
  rate: 0,
  tiredBelow: 30,
  restedAt: 60,
};

export interface MoraleRange {
  min: number;
  max: number;
  rate: number;
}

export default class Morale extends PragmaComponent {
  public value = MORALE.start;

  public get range(): MoraleRange {
    const effects = this.getSibling(Effects);
    assert(effects !== undefined, `Morale needs Effects on actor: ${this.actor.ID.description}`);
    const range = {
      min: effects.modified("moraleMin", MORALE.min),
      max: effects.modified("moraleMax", MORALE.max),
      rate: effects.modified("moraleRate", MORALE.rate),
    };
    assert(
      range.min <= range.max,
      `Actor ${this.actor.ID.description} has morale min ${range.min} above max ${range.max}`,
    );
    return range;
  }

  public set(value: number) {
    const range = this.range;
    this.value = AxiomMath.clamp(value, range.min, range.max);
    const traits = this.getSibling(Traits);
    assert(traits !== undefined, `Morale needs Traits on actor: ${this.actor.ID.description}`);
    const tired = traits.has(TraitsID.tired);
    if (!tired && this.value < MORALE.tiredBelow) traits.add(TraitsID.tired);
    if (tired && this.value >= MORALE.restedAt) traits.remove(TraitsID.tired);
  }

  public change(points: number) {
    this.set(this.value + points * (1 + this.range.rate));
  }

  public give(points: number) {
    this.set(this.value + points);
  }

  // only when out of the range: set adds Tired, which changes the stats again
  public fit() {
    const range = this.range;
    if (this.value >= range.min && this.value <= range.max) return false;
    this.set(this.value);
    return true;
  }
}
