import PragmaSystem from "@pragma/system";
import Time from "@engine/time";
import { assert } from "@axiom/utils";
import { debug } from "@debug";
import { gameCommands, gamePanel } from "../debugCommands";
import { STAT_NAMES, STATS, type StatModifiers, type StatName } from "../effects/effect";
import { BUFFS, type BuffID } from "../content/buffs";
import BuffBarUI from "../ui/buffBar";

// Object.keys gives enum numbers as strings
const BUFF_IDS = Object.keys(BUFFS).map(Number) as BuffID[];

// the buffs working now and the seconds each has left, summed once for every dwarf: the dwarfs
// (most of them out of the scene) read the sum on every stat read; with a timed buff working it is
// summed again every frame
export default class Buffs extends PragmaSystem {
  private readonly active = new Map<BuffID, number>();
  private readonly modifiers = Object.fromEntries(
    STATS.map((stat) => [stat, { add: 0, multiply: 1 }]),
  ) as StatModifiers;
  private timed = false;
  private dirty = true;
  declare private bar: BuffBarUI;

  awake(): void {
    this.bar = new BuffBarUI(this);
    const buffs = this;
    debug.game.connect("buffs", () =>
      BUFF_IDS.map((id) => ({
        name: BUFFS[id].name,
        description: BUFFS[id].description,
        seconds: BUFFS[id].seconds,
        secondsLeft: this.active.get(id) ?? null,
      })),
    );
    gamePanel("buffs", {
      title: "Buffs",
      live: true,
      sections: [
        {
          title: "Working",
          call: "game.buff",
          arg: "object",
          fields: BUFF_IDS.map((id) => ({ key: String(id), label: BUFFS[id].name, control: { kind: "toggle" } })),
          get: () => Object.fromEntries(BUFF_IDS.map((id) => [String(id), this.active.has(id)])),
          set: (values) => {
            for (const id of BUFF_IDS) {
              const on = values[String(id)];
              if (on === true && !this.active.has(id)) this.add(id);
              if (on === false && this.active.has(id)) this.remove(id);
            }
          },
        },
        {
          title: "Time left",
          call: "game.buff",
          arg: "object",
          fields: BUFF_IDS.map((id) => ({ key: String(id), label: BUFFS[id].name, control: { kind: "info" } })),
          get: () =>
            Object.fromEntries(BUFF_IDS.map((id) => [String(id), this.left(id)])),
          set: () => {},
        },
        {
          title: "Total",
          call: "game.buff",
          arg: "object",
          fields: STATS.map((stat) => ({ key: stat, label: STAT_NAMES[stat], control: { kind: "info" } })),
          get: () => Object.fromEntries(STATS.map((stat) => [stat, this.total(stat)])),
          set: () => {},
        },
      ],
    });
    gameCommands("buff", {
      get active() {
        return buffs.active;
      },
      add: (id: BuffID) => this.add(id),
      remove: (id: BuffID) => this.remove(id),
    });
  }

  update(): void {
    const delta = Time.getDeltaTime();
    for (const [id, left] of this.active) {
      if (left > delta) this.active.set(id, left - delta);
      else this.remove(id);
    }
    if (this.timed) this.dirty = true;
    this.bar.update();
  }

  private left(id: BuffID) {
    const left = this.active.get(id);
    return left === undefined ? "off" : `${Math.ceil(left)} s`;
  }

  private total(stat: StatName) {
    const modifiers = this.stats[stat];
    const sign = modifiers.add >= 0 ? "+" : "";
    return `${sign}${modifiers.add} ×${Math.round(modifiers.multiply * 100) / 100}`;
  }

  public touch() {
    this.dirty = true;
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
    this.active.set(id, BUFFS[id].seconds);
    this.dirty = true;
  }

  public remove(id: BuffID) {
    assert(this.active.has(id), `Buff ${BUFFS[id].name} is not working now`);
    this.active.delete(id);
    this.dirty = true;
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
        effect.modifyAt(this.modifiers, buff.seconds - left);
        this.timed = true;
      }
    }
    this.dirty = false;
  }
}
