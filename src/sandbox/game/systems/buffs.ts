import PragmaSystem from "@pragma/system";
import { assert } from "@axiom/utils";
import { STATS, type StatModifiers } from "../effects/effect";
import { BUFFS, type BuffID } from "../content/buffs";
import BuffBarUI from "../ui/buffBar";
import Calendar from "./calendar";
import GameEvents from "./gameEvents";

// the buffs working now and the game hours each has left, summed once for every dwarf: the dwarfs
// (most of them out of the scene) read the sum on every stat read; with a timed buff working it is
// summed again every frame
export default class Buffs extends PragmaSystem {
  private readonly active = new Map<BuffID, number>();
  private readonly modifiers = Object.fromEntries(
    STATS.map((stat) => [stat, { add: 0, multiply: 1 }]),
  ) as StatModifiers;
  private timed = false;
  private dirty = true;
  private lastTime = 0;
  declare private calendar: Calendar;
  declare private events: GameEvents;
  declare private bar: BuffBarUI;

  awake(): void {
    this.calendar = this.scene.getSystem(Calendar);
    this.events = this.scene.getSystem(GameEvents);
    this.lastTime = this.calendar.time;
    this.bar = new BuffBarUI(this);
  }

  update(): void {
    const delta = this.calendar.time - this.lastTime;
    this.lastTime = this.calendar.time;
    for (const [id, left] of this.active) {
      if (left > delta) this.active.set(id, left - delta);
      else this.remove(id);
    }
    if (this.timed) this.dirty = true;
    this.bar.update();
  }

  public touch() {
    this.changed();
  }

  public get stats(): Readonly<StatModifiers> {
    if (this.dirty) this.sum();
    return this.modifiers;
  }

  public get list(): ReadonlyMap<BuffID, number> {
    return this.active;
  }

  public has(id: BuffID) {
    return this.active.has(id);
  }

  public add(id: BuffID) {
    this.active.set(id, BUFFS[id].hours);
    this.changed();
  }

  public remove(id: BuffID) {
    assert(this.active.has(id), `Buff ${BUFFS[id].name} is not working now`);
    this.active.delete(id);
    this.changed();
  }

  private changed() {
    this.dirty = true;
    this.events.dwarfs.statsChanged.emit("all");
  }

  private sum() {
    for (const stat of STATS) {
      this.modifiers[stat].add = 0;
      this.modifiers[stat].multiply = 1;
    }
    this.timed = false;
    for (const [id, left] of this.active) {
      const buff = BUFFS[id];
      for (const effect of buff.effects) {
        effect.modify(this.modifiers);
        if (!effect.timed) continue;
        effect.modifyAt(this.modifiers, buff.hours - left);
        this.timed = true;
      }
    }
    this.dirty = false;
  }
}
