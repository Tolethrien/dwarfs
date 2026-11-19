import PragmaSystem from "@pragma/system";
import AxiomMath from "@axiom/math";
import { assert } from "@axiom/utils";
import { gameCommands } from "../debugCommands";
import type Dwarf from "../actors/dwarf";
import Morale from "../components/morale";
import Traits from "../components/traits";
import Shift from "../components/shift";
import { TraitsID } from "../content/traits";
import GameEvents from "./gameEvents";
import Roster from "./roster";

// work and tavern: points a full hour; rate: the sum of every modifier, 0.1 is 10% faster both ways;
// below tiredBelow a dwarf gets Tired, at restedAt it loses it
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
    const welfare = this;
    gameCommands("morale", {
      get isOn() {
        return welfare.isOn;
      },
      begin: () => this.begin(),
      set: (index: number, value: number) => this.set(this.roster.dwarfs[index], value),
    });
  }

  // every dwarf starts full, the ones working too; it moves from the next full hour
  public begin() {
    this.isOn = true;
    this.roster.showMorale();
    for (const dwarf of this.roster.dwarfs) this.set(dwarf, MORALE.start);
  }

  private hour() {
    if (!this.isOn) return;
    for (const dwarf of this.roster.dwarfs) {
      const state = this.roster.stateOf(dwarf);
      if (state === "working") this.change(dwarf, MORALE.work);
      if (state === "tavern") this.change(dwarf, MORALE.tavern);
    }
  }

  private change(dwarf: Dwarf, points: number) {
    this.set(dwarf, this.morale(dwarf).value + points * (1 + MORALE.rate));
    if (this.morale(dwarf).value > 0 || this.roster.stateOf(dwarf) !== "working") return;
    const shift = dwarf.getComponent(Shift);
    assert(shift !== undefined, `Dwarf ${dwarf.name} has no Shift`);
    shift.cutShort();
  }

  private set(dwarf: Dwarf, value: number) {
    const morale = this.morale(dwarf);
    morale.value = AxiomMath.clamp(value, MORALE.min, MORALE.max);
    const traits = dwarf.getComponent(Traits);
    assert(traits !== undefined, `Dwarf ${dwarf.name} has no Traits`);
    const tired = traits.has(TraitsID.tired);
    if (!tired && morale.value < MORALE.tiredBelow) traits.add(TraitsID.tired);
    if (tired && morale.value >= MORALE.restedAt) traits.remove(TraitsID.tired);
  }

  private morale(dwarf: Dwarf) {
    const morale = dwarf.getComponent(Morale);
    assert(morale !== undefined, `Dwarf ${dwarf.name} has no Morale`);
    return morale;
  }
}
