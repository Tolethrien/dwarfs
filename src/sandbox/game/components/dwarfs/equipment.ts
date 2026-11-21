import PragmaComponent from "@pragma/component";
import { assert } from "@axiom/utils";
import { ITEMS, type GearSlot, type ItemID } from "../../content/gear";
import Effects from "./effects";

export default class Equipment extends PragmaComponent {
  private readonly items = new Map<GearSlot, ItemID>();

  public get list(): ReadonlyMap<GearSlot, ItemID> {
    return this.items;
  }

  public worn(slot: GearSlot) {
    return this.items.get(slot);
  }

  public equip(item: ItemID) {
    this.items.set(ITEMS[item].slot, item);
    this.effects().changed();
  }

  public unequip(slot: GearSlot) {
    this.items.delete(slot);
    this.effects().changed();
  }

  private effects() {
    const effects = this.getSibling(Effects);
    assert(effects !== undefined, `Equipment needs Effects on actor: ${this.actor.ID.description}`);
    return effects;
  }
}
