import PragmaSystem from "@pragma/system";
import AxiomMath from "@axiom/math";
import { assert } from "@axiom/utils";
import type Dwarf from "../actors/dwarf";
import Morale from "../components/morale";
import Effects from "../components/effects";
import Traits from "../components/traits";
import Shift from "../components/shift";
import { TraitsID } from "../content/traits";
import GameEvents from "./gameEvents";
import Roster, { type DwarfGroup } from "./roster";

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

// the dwarfs' morale: down every hour of a shift (from the shot, the ride doesn't count), up every
// hour in the tavern; off until the trade union event
export default class Welfare extends PragmaSystem {
  public isOn = false;
  declare private roster: Roster;

  awake(): void {
    this.roster = this.scene.getSystem(Roster);
    const events = this.scene.getSystem(GameEvents);
    events.calendar.hourStarted.connect(() => this.hour());
    events.dwarfs.statsChanged.connect((changed) => this.fit(changed));
  }

  // every dwarf starts full, the ones working too; it moves from the next full hour
  public begin() {
    this.isOn = true;
    this.roster.showMorale();
    for (const dwarf of this.roster.dwarfs) this.set(dwarf, MORALE.start);
  }

  public valueOf(dwarf: Dwarf) {
    return this.morale(dwarf).value;
  }

  public rangeOf(dwarf: Dwarf) {
    const effects = dwarf.getComponent(Effects);
    assert(effects !== undefined, `Dwarf ${dwarf.name} has no Effects`);
    const range = {
      min: effects.modified("moraleMin", MORALE.min),
      max: effects.modified("moraleMax", MORALE.max),
      rate: effects.modified("moraleRate", MORALE.rate),
    };
    assert(range.min <= range.max, `Dwarf ${dwarf.name} has morale min ${range.min} above max ${range.max}`);
    return range;
  }

  public set(dwarf: Dwarf, value: number) {
    const morale = this.morale(dwarf);
    const range = this.rangeOf(dwarf);
    morale.value = AxiomMath.clamp(value, range.min, range.max);
    const traits = dwarf.getComponent(Traits);
    assert(traits !== undefined, `Dwarf ${dwarf.name} has no Traits`);
    const tired = traits.has(TraitsID.tired);
    if (!tired && morale.value < MORALE.tiredBelow) traits.add(TraitsID.tired);
    if (tired && morale.value >= MORALE.restedAt) traits.remove(TraitsID.tired);
    if (morale.value > 0 || this.roster.stateOf(dwarf) !== "working") return;
    const shift = dwarf.getComponent(Shift);
    assert(shift !== undefined, `Dwarf ${dwarf.name} has no Shift`);
    shift.cutShort();
  }

  public change(dwarf: Dwarf, points: number) {
    this.set(dwarf, this.valueOf(dwarf) + points * (1 + this.rangeOf(dwarf).rate));
  }

  public give(dwarf: Dwarf, points: number) {
    this.set(dwarf, this.valueOf(dwarf) + points);
  }

  public giveAll(points: number, where: DwarfGroup = "all") {
    for (const dwarf of this.roster.dwarfsIn(where)) this.give(dwarf, points);
  }

  public setAll(value: number, where: DwarfGroup = "all") {
    for (const dwarf of this.roster.dwarfsIn(where)) this.set(dwarf, value);
  }

  public changeAll(points: number, where: DwarfGroup = "all") {
    for (const dwarf of this.roster.dwarfsIn(where)) this.change(dwarf, points);
  }

  private hour() {
    if (!this.isOn) return;
    for (const dwarf of this.roster.dwarfs) {
      const state = this.roster.stateOf(dwarf);
      if (state === "working") this.change(dwarf, MORALE.work);
      else if (state === "tavern") this.change(dwarf, MORALE.tavern);
    }
  }

  // only when out of the range: set adds Tired, which changes the stats again
  private fit(changed: Dwarf | "all") {
    if (!this.isOn) return;
    const dwarfs = changed === "all" ? this.roster.dwarfs : [changed];
    for (const dwarf of dwarfs) {
      if (!this.roster.dwarfs.includes(dwarf)) continue;
      const range = this.rangeOf(dwarf);
      const value = this.valueOf(dwarf);
      if (value < range.min || value > range.max) this.set(dwarf, value);
    }
  }

  private morale(dwarf: Dwarf) {
    const morale = dwarf.getComponent(Morale);
    assert(morale !== undefined, `Dwarf ${dwarf.name} has no Morale`);
    return morale;
  }
}
