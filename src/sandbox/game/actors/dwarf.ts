import PragmaActor from "@pragma/actor";
import LayeredSprite, { type SpriteLayer } from "../components/layeredSprite";
import { RENDER_SHEET, SORT_ORDER } from "../content/render";
import { DWARF_LOOK, DwarfRank } from "../content/dwarfs";
import type { MainTraitsID } from "../content/traits";
import Drinker from "../components/drinker";
import Traits from "../components/traits";
import Ball from "../components/ball";
import Effects from "../components/effects";
import Equipment from "../components/equipment";
import Outfit from "../components/outfit";
import Shift from "../components/shift";
import Headlight from "../components/headlight";
import Travel from "../components/travel";
import type Buffs from "../systems/buffs";
import type Workforce from "../systems/workforce";

interface DwarfProps {
  uuid?: string;
  mainTrait: MainTraitsID;
  rank: DwarfRank;
  look: SpriteLayer[];
  name: string;
  // out of the scene most of the time, so it can't reach the systems itself
  buffs: Buffs;
  workforce: Workforce;
}
export default class Dwarf extends PragmaActor {
  public readonly name: string;
  constructor(props: DwarfProps) {
    super(props.uuid);
    this.tags.add(DwarfRank[props.rank]);
    this.name = props.name;

    this.addComponent(LayeredSprite, {
      zIndex: SORT_ORDER.dwarfs,
      sprite: RENDER_SHEET.dwarfs,
      size: { width: DWARF_LOOK.cell, height: DWARF_LOOK.cell },
      layers: props.look,
      plan: "token",
    });
    this.addComponent(Traits, {
      main: props.mainTrait,
      foreman: props.rank === DwarfRank.foreman,
      traits: [],
    });
    this.addComponent(Drinker);
    if (props.rank === DwarfRank.foreman) this.addComponent(Equipment);
    else this.addComponent(Outfit);
    this.addComponent(Effects, { buffs: props.buffs, workforce: props.workforce });
    this.addComponent(Ball, { radius: DWARF_LOOK.cell / 2 });
    this.addComponent(Shift);
    this.addComponent(Headlight);
    this.addComponent(Travel);
  }
}
