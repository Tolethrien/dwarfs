import PragmaComponent from "@pragma/component";
import { assert } from "@axiom/utils";
import type Effect from "../effects/effect";
import { STATS, type FlightModifiers, type StatModifiers, type StatName } from "../effects/effect";
import { SPECIAL_BEERS } from "../content/beers";
import { FOREMAN_TRAIT, MAIN_TRAITS, TRAITS, type MainTraitData } from "../content/traits";
import { ITEMS } from "../content/gear";
import type Buffs from "../systems/buffs";
import type Workforce from "../systems/workforce";
import Traits from "./traits";
import Drinker from "./drinker";
import Equipment from "./equipment";
import Outfit from "./outfit";
import Ball from "./ball";

interface EffectsProps {
  buffs: Buffs;
  workforce: Workforce;
}

// every effect the dwarf has now (the class, the foreman's trait, the traits, the beer, a worker's
// base gear and AGH traits or a foreman's items) and what they give; summed again only after a change,
// physics and the card read the ready numbers; the timed ones (TimedStat) are added on top at every
// read, only for dwarfs that have them; the buffs come summed for the whole mine, added at every read
export default class Effects extends PragmaComponent {
  private readonly buffs: Buffs;
  private readonly workforce: Workforce;
  private workforceVersion = -1;
  private readonly modifiers = {} as StatModifiers;
  private readonly scratch = {} as StatModifiers;
  private readonly timed: Effect[] = [];
  private readonly flying: Effect[] = [];
  declare private base: MainTraitData;
  private readonly flightModifiers: FlightModifiers = {
    pierceAbove: Infinity,
    overSpeedPower: 0,
    penetrateRatio: Infinity,
    bounceBoost: 1,
    bounceCooldown: 0,
    blastRadius: 0,
    blastEdge: 0,
    splashRadius: 0,
    splashDamage: 0,
  };
  private readonly active: Effect[] = [];
  private dirty = true;

  constructor(internal: InternalPCProps, props: EffectsProps) {
    super(internal);
    this.buffs = props.buffs;
    this.workforce = props.workforce;
  }

  private get stale() {
    return this.dirty || this.workforceVersion !== this.workforce.version;
  }

  public get speed() {
    return this.stat("speed");
  }

  public get power() {
    return this.stat("power");
  }

  public get bph() {
    return this.stat("bph");
  }

  public get flight(): Readonly<FlightModifiers> {
    if (this.stale) this.refresh();
    return this.flightModifiers;
  }

  public get inFlight(): readonly Effect[] {
    if (this.stale) this.refresh();
    return this.flying;
  }

  public get list(): readonly Effect[] {
    if (this.stale) this.refresh();
    return this.active;
  }

  public changed() {
    this.dirty = true;
  }

  private stat(name: StatName) {
    if (this.stale) this.refresh();
    if (this.timed.length === 0) return this.sum(name, this.modifiers);
    for (const stat of STATS) {
      this.scratch[stat].add = this.modifiers[stat].add;
      this.scratch[stat].multiply = this.modifiers[stat].multiply;
    }
    const seconds = this.flightSeconds();
    for (const effect of this.timed) effect.modifyAt(this.scratch, seconds);
    return this.sum(name, this.scratch);
  }

  private flightSeconds() {
    if (!this.actor.getAlive()) return 0;
    const ball = this.getSibling(Ball);
    return ball === undefined ? 0 : ball.flightSeconds;
  }

  private sum(name: StatName, modifiers: StatModifiers) {
    const buffs = this.buffs.stats[name];
    const add = modifiers[name].add + buffs.add;
    return (this.base[name] + add) * modifiers[name].multiply * buffs.multiply;
  }

  private traits() {
    const traits = this.getSibling(Traits);
    assert(traits !== undefined, `Effects needs Traits on actor: ${this.actor.ID.description}`);
    return traits;
  }

  private refresh() {
    const traits = this.traits();
    const drinker = this.getSibling(Drinker);
    assert(drinker !== undefined, `Effects needs Drinker on actor: ${this.actor.ID.description}`);

    this.base = MAIN_TRAITS[traits.main];
    this.active.length = 0;
    this.active.push(...this.base.effects);
    if (traits.foreman) {
      this.active.push(...FOREMAN_TRAIT.effects);
      const equipment = this.getSibling(Equipment);
      assert(equipment !== undefined, `A foreman needs Equipment on actor: ${this.actor.ID.description}`);
      for (const item of equipment.list.values()) this.active.push(...ITEMS[item].effects);
    } else {
      const outfit = this.getSibling(Outfit);
      assert(outfit !== undefined, `A worker needs Outfit on actor: ${this.actor.ID.description}`);
      this.active.push(...outfit.effects, ...this.workforce.researchedEffects);
    }
    for (const trait of traits.list) this.active.push(...TRAITS[trait].effects);
    if (drinker.specialBeer !== undefined) this.active.push(...SPECIAL_BEERS[drinker.specialBeer].effects);

    for (const name of STATS) {
      this.modifiers[name] = { add: 0, multiply: 1 };
      this.scratch[name] = { add: 0, multiply: 1 };
    }
    this.timed.length = 0;
    this.flying.length = 0;
    this.flightModifiers.pierceAbove = Infinity;
    this.flightModifiers.overSpeedPower = 0;
    this.flightModifiers.penetrateRatio = Infinity;
    this.flightModifiers.bounceBoost = 1;
    this.flightModifiers.bounceCooldown = 0;
    this.flightModifiers.blastRadius = 0;
    this.flightModifiers.blastEdge = 0;
    this.flightModifiers.splashRadius = 0;
    this.flightModifiers.splashDamage = 0;
    for (const effect of this.active) {
      effect.modify(this.modifiers);
      effect.modifyFlight(this.flightModifiers);
      if (effect.timed) this.timed.push(effect);
      if (effect.inFlight) this.flying.push(effect);
    }
    this.dirty = false;
    this.workforceVersion = this.workforce.version;
  }
}
