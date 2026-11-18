import PragmaComponent from "@pragma/component";
import { assert } from "@axiom/utils";
import type { SpecialBeerID } from "../content/beers";
import Effects from "./effects";

export default class Drinker extends PragmaComponent {
  public specialBeer: SpecialBeerID | undefined;

  public get beerPerHour() {
    return this.effects().bph;
  }

  public wageFor(hours: number) {
    return hours * this.beerPerHour;
  }

  public pour(specialBeer: SpecialBeerID) {
    assert(
      this.specialBeer === undefined,
      `Dwarf ${this.actor.ID.description} already has a special beer for this shift`,
    );
    this.specialBeer = specialBeer;
    this.effects().changed();
  }

  public empty() {
    this.specialBeer = undefined;
    this.effects().changed();
  }

  private effects() {
    const effects = this.getSibling(Effects);
    assert(effects !== undefined, `Drinker needs Effects on actor: ${this.actor.ID.description}`);
    return effects;
  }
}
