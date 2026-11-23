import PragmaActor from "@pragma/actor";
import LayeredSprite, { type SpriteLayer } from "../components/common/layeredSprite";
import { RENDER_SHEET, SORT_ORDER } from "../content/render";
import { DWARF_LOOK, DwarfRank } from "../content/dwarfs";
import { MAIN_TRAITS, type MainTraitsID } from "../content/traits";
import Drinker from "../components/dwarfs/drinker";
import Traits from "../components/dwarfs/traits";
import Ball from "../components/dwarfs/ball";
import Effects from "../components/dwarfs/effects";
import Equipment from "../components/dwarfs/equipment";
import Outfit from "../components/dwarfs/outfit";
import Shift from "../components/dwarfs/shift";
import Lamp from "../components/common/lamp";
import Revealer from "../components/common/revealer";
import Travel from "../components/common/travel";
import Morale from "../components/dwarfs/morale";
import type Buffs from "../systems/dwarfs/buffs";
import type Workforce from "../systems/dwarfs/workforce";
import type GameEvents from "../systems/core/gameEvents";

export const DWARF = {
  reveal: 20,
  helmetLamp: { x: 16, y: -26, radius: 5.5 },
};

interface DwarfProps {
  uuid?: string;
  mainTrait: MainTraitsID;
  rank: DwarfRank;
  look: SpriteLayer[];
  name: string;
  // out of the scene most of the time, so it can't reach the systems itself
  buffs: Buffs;
  workforce: Workforce;
  events: GameEvents;
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
    this.addComponent(Effects, { buffs: props.buffs, workforce: props.workforce, events: props.events });
    this.addComponent(Ball, { radius: DWARF_LOOK.cell / 2 });
    this.addComponent(Shift);
    this.addComponent(Lamp, {
      light: MAIN_TRAITS[props.mainTrait].light,
      offset: DWARF.helmetLamp,
      bulb: { radius: DWARF.helmetLamp.radius, zIndex: SORT_ORDER.dwarfs + 0.01 },
    });
    this.addComponent(Revealer, { radius: DWARF.reveal, onStart: false });
    this.addComponent(Travel);
    this.addComponent(Morale);
  }
}
