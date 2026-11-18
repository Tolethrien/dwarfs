import PragmaComponent from "@pragma/component";
import { assert } from "@axiom/utils";
import type { Signal } from "@axiom/events";
import type Dwarf from "../actors/dwarf";
import Calendar, { type Alarm } from "../systems/calendar";
import GameEvents from "../systems/gameEvents";
import Drinker from "./drinker";
import Ball from "./ball";

export interface ShiftSignals {
  shiftEnded: Signal<Dwarf>;
}

export default class Shift extends PragmaComponent {
  private hours = 0;
  private alarm: Alarm | undefined;
  declare private events: GameEvents;

  awake(): void {
    this.events = this.scene.getSystem(GameEvents);
  }

  public begin(hours: number) {
    this.hours = hours;
  }

  public get endsAt() {
    return this.alarm?.at;
  }

  start(): void {
    if (this.hours === 0) return;
    const calendar = this.scene.getSystem(Calendar);
    this.alarm = calendar.alarm({ after: this.hours }, () => this.end());
  }

  destroy(): void {
    this.alarm?.cancel();
    this.alarm = undefined;
    this.hours = 0;
  }

  public cutShort() {
    assert(this.alarm !== undefined, `Dwarf ${this.actor.ID.description} has no shift to cut short`);
    this.alarm.cancel();
    this.end();
  }

  // it stays in the scene for the ride home, the next spawn mustn't begin the shift again
  private end() {
    this.alarm = undefined;
    this.hours = 0;
    const drinker = this.getSibling(Drinker);
    assert(drinker !== undefined, `Shift needs Drinker on actor: ${this.actor.ID.description}`);
    drinker.empty();
    const ball = this.getSibling(Ball);
    assert(ball !== undefined, `Shift needs Ball on actor: ${this.actor.ID.description}`);
    ball.land();
    this.events.dwarfs.shiftEnded.emit(this.actor as Dwarf);
  }
}
