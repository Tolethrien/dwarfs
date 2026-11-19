import Navi from "@navi/navi";
import UINode from "@navi/node";
import UIText from "@navi/elements/text";
import { auto, pw, px } from "@navi/units";
import { assert } from "@axiom/utils";
import { COLOR } from "@axiom/color";
import type Dwarf from "../actors/dwarf";
import LayeredSprite from "../components/layeredSprite";
import Traits from "../components/traits";
import Drinker from "../components/drinker";
import Effects from "../components/effects";
import Equipment from "../components/equipment";
import Outfit from "../components/outfit";
import Morale from "../components/morale";
import { STAT_NAMES, type StatName } from "../effects/effect";
import { SPECIAL_BEERS } from "../content/beers";
import { DwarfRank } from "../content/dwarfs";
import { FOREMAN_TRAIT, MAIN_TRAITS, TRAITS, WORKER_TRAITS, type TraitData } from "../content/traits";
import { BASE_GEAR, GEAR_SLOT_NAMES, GEAR_SLOTS, ITEMS, RARITIES, type GearSlot } from "../content/gear";
import type Workforce from "../systems/workforce";
import { RENDER_SHEET } from "../content/render";
import { UI_THEME } from "../content/ui";
import { UIWindow } from "./elements/window";
import { UIButton } from "./elements/button";
import { text } from "./elements/text";
import { paragraph } from "./elements/paragraph";
import { tooltip } from "./elements/tooltip";
import { bar } from "./elements/bar";

export interface DwarfCardActions {
  previous: (dwarf: Dwarf) => Dwarf;
  next: (dwarf: Dwarf) => Dwarf;
}
interface ButtonLook {
  size: Size2D;
  frame: Crop;
  textSize: number;
}

const LOOK = UI_THEME.card;
const SHEET = {
  card: { x: 2, y: 2, width: 1280, height: 1080 },
  button: { x: 1286, y: 2, width: 248, height: 80 },
  close: { x: 1536, y: 2, width: 56, height: 56 },
  slot: { x: 1286, y: 246, width: 112, height: 112 },
  slotRound: { x: 1400, y: 246, width: 96, height: 96 },
};
const CARD = {
  size: { width: 640, height: 540 },
  portrait: { x: 28, y: 28, size: 144 },
  name: { x: 190, y: 26 },
  type: { x: 190, y: 60 },
  close: { x: 600, y: 8 },
  beer: { text: { x: 204, y: 104 }, slot: { x: 546, y: 104, size: 48 } },
  equipment: { x: 42, y: 196, size: 56, gap: 12 },
  stats: { x: 42, y: 304, width: 250, rowHeight: 22 },
  morale: { x: 42, y: 404, width: 250, gap: 4 },
  traits: { x: 334, y: 196, width: 276, gap: 10 },
  buttons: { y: 466, x: { previous: 28, next: 488 } },
  labelHeight: 24,
};
const BUTTON: Record<"wide" | "close", ButtonLook> = {
  wide: { size: { width: 124, height: 40 }, frame: SHEET.button, textSize: LOOK.textSize.button },
  close: { size: { width: 32, height: 32 }, frame: SHEET.close, textSize: LOOK.textSize.close },
};
const RANK_NAMES: Record<DwarfRank, string> = {
  [DwarfRank.worker]: "Worker",
  [DwarfRank.foreman]: "Foreman",
};

export default class DwarfCardUI {
  private readonly window = new UIWindow({
    kind: "modal",
    width: CARD.size.width,
    plate: { image: RENDER_SHEET.dwarfCard, crop: SHEET.card, height: CARD.size.height },
    onClose: () => {
      this.dwarf = undefined;
      const back = this.back;
      this.back = undefined;
      back?.();
    },
  });
  private dwarf: Dwarf | undefined;
  private back: (() => void) | undefined;
  private portraitLayers: UINode[] = [];
  private traitList: UINode | undefined;
  private shownTraits = "";
  // the trade union brings morale into the game
  private moraleShown = false;
  private moraleNode: UINode | undefined;
  private readonly slotMarks = new Map<GearSlot, UINode>();
  private readonly slots = new Map<GearSlot, UINode>();

  constructor(
    private readonly actions: DwarfCardActions,
    private readonly workforce: Workforce,
  ) {}

  public get isOpen() {
    return this.window.isOpen;
  }

  public update() {
    if (this.dwarf) {
      this.showTraits(this.dwarf);
      this.showSlots();
      this.paintSlotMarks();
      this.moraleNode?.setActive(this.moraleShown);
    }
    this.window.update();
  }

  public open(dwarf: Dwarf, back?: () => void) {
    const opened = this.window.isOpen;
    this.dwarf = dwarf;
    if (back) this.back = back;
    if (!opened) this.build(this.window.open());
    this.showLook(dwarf);
    this.showTraits(dwarf);
  }

  public close() {
    this.window.close();
  }

  public showMorale() {
    this.moraleShown = true;
  }

  private get current() {
    assert(this.dwarf !== undefined, "The dwarf card is read with no dwarf open");
    return this.dwarf;
  }

  private build(card: UINode) {
    this.portraitLayers = this.addPortrait(card);
    this.addText(card, CARD.name, () => this.current.name, LOOK.plateText, LOOK.textSize.name);
    this.addText(card, CARD.type, () => this.typeText(this.current), LOOK.plateMuted, LOOK.textSize.type);
    this.addBeer(card);
    this.addEquipment(card);
    this.addStats(card);
    this.moraleNode = this.addMorale(card);
    this.traitList = this.addTraitList(card);
    this.shownTraits = "";
    const row = CARD.buttons;
    this.addButton(card, "×", CARD.close, BUTTON.close, () => this.close());
    this.addButton(card, "Previous", { x: row.x.previous, y: row.y }, BUTTON.wide, () =>
      this.open(this.actions.previous(this.current)),
    );
    this.addButton(card, "Next", { x: row.x.next, y: row.y }, BUTTON.wide, () =>
      this.open(this.actions.next(this.current)),
    );
  }

  private addBeer(card: UINode) {
    const beer = CARD.beer;
    const name = () => {
      const poured = this.drinker(this.current).specialBeer;
      return poured === undefined ? "No special beer" : SPECIAL_BEERS[poured].name;
    };
    this.addText(card, beer.text, () => `Beer · ${name()}`, LOOK.muted, LOOK.textSize.body);
    const slot = this.addSlot(card, beer.slot, beer.slot.size, SHEET.slotRound);
    tooltip(slot, () => {
      const poured = this.drinker(this.current).specialBeer;
      if (poured === undefined) return "No special beer this shift";
      const beer = SPECIAL_BEERS[poured];
      return [beer.name, beer.description, ...beer.effects.map((effect) => effect.describe())].join("\n");
    });
  }

  private addEquipment(card: UINode) {
    const equipment = CARD.equipment;
    this.addLabel(card, equipment, "EQUIPMENT");
    GEAR_SLOTS.forEach((slot, index) => {
      const at = {
        x: equipment.x + index * (equipment.size + equipment.gap),
        y: equipment.y + CARD.labelHeight,
      };
      const node = this.addSlot(card, at, equipment.size, SHEET.slot);
      const mark = Navi.append(
        new UIText(() => this.slotMark(slot), {
          size: { width: auto(), height: auto() },
          input: "none",
          style: {
            anchorX: "center",
            anchorY: "center",
            textColor: LOOK.text,
            textSize: LOOK.textSize.name,
          },
        }),
        node,
      );
      this.slots.set(slot, node);
      this.slotMarks.set(slot, mark);
      tooltip(node, () => this.gearText(slot));
    });
  }

  private item(slot: GearSlot) {
    return this.equipment(this.current)?.worn(slot);
  }

  private equipment(dwarf: Dwarf) {
    if (!this.traits(dwarf).foreman) return undefined;
    const equipment = dwarf.getComponent(Equipment);
    assert(equipment !== undefined, `Foreman ${dwarf.name} has no Equipment`);
    return equipment;
  }

  private outfit(dwarf: Dwarf) {
    if (this.traits(dwarf).foreman) return undefined;
    const outfit = dwarf.getComponent(Outfit);
    assert(outfit !== undefined, `Worker ${dwarf.name} has no Outfit`);
    return outfit;
  }

  // a worker wears its base gear as one piece, in the first slot
  private showSlots() {
    const foreman = this.traits(this.current).foreman;
    for (const [slot, node] of this.slots) if (slot !== GEAR_SLOTS[0]) node.setActive(foreman);
  }

  private slotMark(slot: GearSlot) {
    if (this.traits(this.current).foreman) {
      const item = this.item(slot);
      return item === undefined ? "" : RARITIES[ITEMS[item].rarity].letter;
    }
    const worn = this.outfit(this.current)?.worn;
    return worn === undefined ? "" : `${worn.level}`;
  }

  private paintSlotMarks() {
    for (const [slot, mark] of this.slotMarks) {
      const item = this.item(slot);
      mark.style.textColor = item === undefined ? LOOK.text : RARITIES[ITEMS[item].rarity].color;
    }
  }

  private gearText(slot: GearSlot) {
    const name = GEAR_SLOT_NAMES[slot];
    const traits = this.traits(this.current);
    if (traits.foreman) {
      const item = this.item(slot);
      if (item === undefined) return `${name} · empty`;
      const data = ITEMS[item];
      const effects = data.effects.map((effect) => effect.describe());
      return [`${name} · ${data.name}`, RARITIES[data.rarity].name, data.description, ...effects].join("\n");
    }
    const outfit = this.outfit(this.current);
    const worn = outfit?.worn;
    if (outfit === undefined || worn === undefined) return "No gear";
    const gear = BASE_GEAR[worn.gear];
    const effects = outfit.effects.map((effect) => effect.describe());
    return [`${gear.name} · level ${worn.level}`, gear.description, ...effects].join("\n");
  }

  private addSlot(parent: UINode, at: Position2D, size: number, crop: Crop) {
    return Navi.append(
      new UINode({
        position: { x: px(at.x), y: px(at.y) },
        size: { width: px(size), height: px(size) },
        input: "none",
        style: {
          backgroundColor: COLOR.WHITE,
          backgroundImage: RENDER_SHEET.dwarfCard,
          backgroundImageCrop: crop,
        },
      }),
      parent,
    );
  }

  private drinker(dwarf: Dwarf) {
    const drinker = dwarf.getComponent(Drinker);
    assert(drinker !== undefined, `Dwarf ${dwarf.name} has no Drinker`);
    return drinker;
  }

  private addStats(card: UINode) {
    const stats = CARD.stats;
    this.addLabel(card, stats, "STATS");
    const lines: { label: string; stat: StatName }[] = [
      { label: STAT_NAMES.speed, stat: "speed" },
      { label: STAT_NAMES.power, stat: "power" },
      { label: STAT_NAMES.bph, stat: "bph" },
    ];
    lines.forEach((line, index) => {
      const row = Navi.append(
        new UINode({
          position: {
            x: px(stats.x),
            y: px(stats.y + CARD.labelHeight + index * stats.rowHeight),
          },
          size: { width: px(stats.width), height: px(stats.rowHeight) },
          input: "none",
          style: {
            backgroundColor: UI_THEME.colors.transparent,
            layout: "stack",
            direction: "row",
            alignMain: "between",
          },
        }),
        card,
      );
      text(row, line.label, { color: LOOK.muted, size: LOOK.textSize.body });
      text(row, () => this.statText(line.stat), { color: LOOK.text, size: LOOK.textSize.body });
    });
  }

  // the scale is 0–100, a buff only moves its min and max within it
  private addMorale(card: UINode) {
    const morale = CARD.morale;
    const section = Navi.append(
      new UINode({
        position: { x: px(morale.x), y: px(morale.y) },
        size: { width: px(morale.width), height: auto() },
        input: "none",
        style: { backgroundColor: UI_THEME.colors.transparent, layout: "stack", direction: "col", alignCross: "stretch", gap: morale.gap },
      }),
      card,
    );
    text(section, "MORALE", { color: LOOK.label, size: LOOK.textSize.label });
    bar(section, { value: () => this.morale(this.current) / 100, label: () => `${Math.round(this.morale(this.current))}` });
    section.setActive(this.moraleShown);
    return section;
  }

  private morale(dwarf: Dwarf) {
    const morale = dwarf.getComponent(Morale);
    assert(morale !== undefined, `Dwarf ${dwarf.name} has no Morale`);
    return morale.value;
  }

  private statText(stat: StatName) {
    const effects = this.current.getComponent(Effects);
    assert(effects !== undefined, `Dwarf ${this.current.name} has no Effects`);
    const value = Math.round(effects[stat] * 10) / 10;
    return stat === "bph" ? `${value} L/h` : `${value}`;
  }

  private addTraitList(card: UINode) {
    const traits = CARD.traits;
    this.addLabel(card, traits, "TRAITS");
    return Navi.append(
      new UINode({
        position: { x: px(traits.x), y: px(traits.y + CARD.labelHeight) },
        size: { width: px(traits.width), height: auto() },
        input: "none",
        style: {
          backgroundColor: UI_THEME.colors.transparent,
          layout: "stack",
          direction: "col",
          alignCross: "stretch",
          gap: traits.gap,
        },
      }),
      card,
    );
  }

  private showTraits(dwarf: Dwarf) {
    const list = this.traitList;
    const traits = this.traits(dwarf);
    const own = [...traits.list].join(",");
    const shown = `${dwarf.ID.description}:${traits.main}:${traits.foreman}:${own}:${this.workforce.version}`;
    if (!list || shown === this.shownTraits) return;
    this.shownTraits = shown;
    for (const child of [...list.children]) Navi.remove(child, list);
    this.addTrait(list, MAIN_TRAITS[traits.main]);
    if (traits.foreman) this.addTrait(list, FOREMAN_TRAIT);
    for (const trait of traits.list) this.addTrait(list, TRAITS[trait]);
    if (traits.foreman) return;
    for (const trait of this.workforce.researched) this.addTrait(list, WORKER_TRAITS[trait]);
  }

  private addTrait(list: UINode, trait: TraitData) {
    const entry = Navi.append(
      new UINode({
        size: { width: pw(100), height: auto() },
        input: "none",
        style: {
          backgroundColor: UI_THEME.colors.transparent,
          layout: "stack",
          direction: "col",
          alignCross: "stretch",
        },
      }),
      list,
    );
    text(entry, trait.name, { color: LOOK.text, size: LOOK.textSize.body });
    paragraph(entry, trait.description, { color: LOOK.muted, size: LOOK.textSize.body });
    for (const effect of trait.effects) text(entry, effect.describe(), { color: LOOK.text, size: LOOK.textSize.body });
  }

  private traits(dwarf: Dwarf) {
    const traits = dwarf.getComponent(Traits);
    assert(traits !== undefined, `Dwarf ${dwarf.name} has no Traits`);
    return traits;
  }

  private typeText(dwarf: Dwarf) {
    const traits = this.traits(dwarf);
    const rank = dwarf.tags.has(DwarfRank[DwarfRank.foreman]) ? DwarfRank.foreman : DwarfRank.worker;
    return `${MAIN_TRAITS[traits.main].name} · ${RANK_NAMES[rank]}`;
  }

  private addPortrait(card: UINode) {
    const portrait = CARD.portrait;
    const frame = Navi.append(
      new UINode({
        position: { x: px(portrait.x), y: px(portrait.y) },
        size: { width: px(portrait.size), height: px(portrait.size) },
        input: "none",
        style: { backgroundColor: UI_THEME.colors.transparent },
      }),
      card,
    );
    return this.sprite(this.current).layers.map(() =>
      Navi.append(
        new UINode({
          size: { width: px(portrait.size), height: px(portrait.size) },
          input: "none",
          style: { backgroundColor: COLOR.WHITE, backgroundImage: RENDER_SHEET.dwarfs },
        }),
        frame,
      ),
    );
  }

  private showLook(dwarf: Dwarf) {
    const layers = this.sprite(dwarf).layers;
    this.portraitLayers.forEach((node, index) => {
      node.style.backgroundImageCrop = layers[index].crop;
      node.style.backgroundColor = layers[index].tint ?? COLOR.WHITE;
    });
  }

  private sprite(dwarf: Dwarf) {
    const sprite = dwarf.getComponent(LayeredSprite);
    assert(sprite !== undefined, `Dwarf ${dwarf.name} has no LayeredSprite`);
    return sprite;
  }

  private addButton(parent: UINode, label: string, at: Position2D, look: ButtonLook, run: () => void) {
    const frame = (state: number) => ({
      ...look.frame,
      y: look.frame.y + state * look.frame.height,
    });
    const node = new UIButton(run, {
      position: { x: px(at.x), y: px(at.y) },
      size: { width: px(look.size.width), height: px(look.size.height) },
      input: "absorb",
      style: {
        backgroundColor: COLOR.WHITE,
        backgroundImage: RENDER_SHEET.dwarfCard,
        backgroundImageCrop: frame(0),
        layout: "stack",
        direction: "row",
        alignMain: "center",
        alignCross: "center",
      },
      states: {
        hovered: { backgroundImageCrop: frame(1) },
        disabled: { backgroundImageCrop: frame(2) },
      },
    });
    Navi.append(node, parent);
    Navi.append(
      new UIText(() => label, {
        size: { width: auto(), height: auto() },
        inheritState: true,
        style: { textColor: LOOK.text, textSize: look.textSize },
        states: { disabled: { textColor: LOOK.disabled } },
      }),
      node,
    );
    return node;
  }

  private addLabel(parent: UINode, at: Position2D, label: string) {
    this.addText(parent, at, () => label, LOOK.label, LOOK.textSize.label);
  }

  private addText(parent: UINode, at: Position2D, text: () => string, color: RGBA, size: number) {
    Navi.append(
      new UIText(text, {
        position: { x: px(at.x), y: px(at.y) },
        size: { width: auto(), height: auto() },
        input: "none",
        style: { textColor: color, textSize: size },
      }),
      parent,
    );
  }
}
