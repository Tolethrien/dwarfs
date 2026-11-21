import PragmaComponent from "@pragma/component";
import { assert } from "@axiom/utils";
import type { MainTraitsID, TraitsID } from "../../content/traits";
import Effects from "./effects";

interface TraitsProps {
  main: MainTraitsID;
  foreman: boolean;
  traits: TraitsID[];
}

export default class Traits extends PragmaComponent {
  public readonly main: MainTraitsID;
  public readonly foreman: boolean;
  private readonly owned: Set<TraitsID>;
  private readonly hoursLeft = new Map<TraitsID, number>();
  constructor(internal: InternalPCProps, props: TraitsProps) {
    super(internal);
    this.main = props.main;
    this.foreman = props.foreman;
    this.owned = new Set(props.traits);
  }

  public has(trait: TraitsID) {
    return this.owned.has(trait);
  }

  public add(trait: TraitsID, hours?: number) {
    this.owned.add(trait);
    if (hours === undefined) this.hoursLeft.delete(trait);
    else this.hoursLeft.set(trait, hours);
    this.effects().changed();
  }

  public remove(trait: TraitsID) {
    this.owned.delete(trait);
    this.hoursLeft.delete(trait);
    this.effects().changed();
  }

  public hoursOf(trait: TraitsID) {
    return this.hoursLeft.get(trait);
  }

  public hourPassed() {
    for (const [trait, hours] of this.hoursLeft) {
      if (hours > 1) this.hoursLeft.set(trait, hours - 1);
      else this.remove(trait);
    }
  }

  public get list(): ReadonlySet<TraitsID> {
    return this.owned;
  }

  private effects() {
    const effects = this.getSibling(Effects);
    assert(effects !== undefined, `Traits needs Effects on actor: ${this.actor.ID.description}`);
    return effects;
  }
}
