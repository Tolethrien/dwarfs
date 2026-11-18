import { assert } from "@axiom/utils";
import { gamePanel } from "../debugCommands";
import type Dwarf from "../actors/dwarf";
import Equipment from "../components/equipment";
import Traits from "../components/traits";
import { GEAR_SLOT_NAMES, GEAR_SLOTS, ITEMS, type GearSlot, type ItemID } from "../content/gear";
import { DwarfRank } from "../content/dwarfs";
import { MAIN_TRAITS, TRAITS, type MainTraitsID, type TraitsID } from "../content/traits";

// Object.keys gives enum numbers as strings
const CLASS_IDS = Object.keys(MAIN_TRAITS).map(Number) as MainTraitsID[];
const TRAIT_IDS = Object.keys(TRAITS).map(Number) as TraitsID[];
const ITEM_IDS = Object.keys(ITEMS).map(Number) as ItemID[];

const TEMPLATE = { none: "—", ranks: ["worker", "foreman"] };

export default class SpawnTemplate {
  public apply = false;
  private main: MainTraitsID = CLASS_IDS[0];
  private foreman = false;
  private count = 1;
  private readonly traits = new Set<TraitsID>();
  private readonly items = new Map<GearSlot, ItemID>();

  public spawn: (count: number) => void = () => {};

  constructor() {
    this.register();
  }

  public get mainTrait() {
    return this.main;
  }

  public get rank() {
    return this.foreman ? DwarfRank.foreman : DwarfRank.worker;
  }

  public dress(dwarf: Dwarf) {
    const traits = dwarf.getComponent(Traits);
    assert(traits !== undefined, `Dwarf ${dwarf.name} has no Traits`);
    for (const trait of this.traits) traits.add(trait);
    if (!this.foreman) return;
    const equipment = dwarf.getComponent(Equipment);
    assert(equipment !== undefined, `Dwarf ${dwarf.name} is a foreman without Equipment`);
    for (const item of this.items.values()) equipment.equip(item);
  }

  private itemsFor(slot: GearSlot) {
    return ITEM_IDS.filter((id) => ITEMS[id].slot === slot);
  }

  private register() {
    gamePanel("spawn", {
      title: "Spawn template",
      live: true,
      sections: [
        {
          title: "Dwarf",
          call: "game.dwarf",
          arg: "object",
          fields: [
            { key: "apply", label: "every new dwarf looks like this", control: { kind: "toggle" } },
            { key: "class", control: { kind: "select", options: CLASS_IDS.map((id) => MAIN_TRAITS[id].name) } },
            { key: "rank", control: { kind: "select", options: TEMPLATE.ranks } },
          ],
          get: () => ({
            apply: this.apply,
            class: MAIN_TRAITS[this.main].name,
            rank: TEMPLATE.ranks[this.foreman ? 1 : 0],
          }),
          set: (values) => {
            if (typeof values.apply === "boolean") this.apply = values.apply;
            const main = CLASS_IDS.find((id) => MAIN_TRAITS[id].name === values.class);
            if (main !== undefined) this.main = main;
            if (typeof values.rank === "string") this.foreman = values.rank === TEMPLATE.ranks[1];
          },
        },
        {
          title: "Traits",
          call: "game.dwarf",
          arg: "object",
          fields: TRAIT_IDS.map((id) => ({ key: String(id), label: TRAITS[id].name, control: { kind: "toggle" } })),
          get: () => Object.fromEntries(TRAIT_IDS.map((id) => [String(id), this.traits.has(id)])),
          set: (values) => {
            for (const id of TRAIT_IDS) {
              if (values[String(id)] === true) this.traits.add(id);
              if (values[String(id)] === false) this.traits.delete(id);
            }
          },
        },
        {
          title: "Items (foreman only)",
          call: "game.dwarf",
          arg: "object",
          fields: GEAR_SLOTS.map((slot) => ({
            key: String(slot),
            label: GEAR_SLOT_NAMES[slot],
            control: { kind: "select", options: [TEMPLATE.none, ...this.itemsFor(slot).map((id) => ITEMS[id].name)] },
          })),
          get: () =>
            Object.fromEntries(
              GEAR_SLOTS.map((slot) => {
                const item = this.items.get(slot);
                return [String(slot), item === undefined ? TEMPLATE.none : ITEMS[item].name];
              }),
            ),
          set: (values) => {
            for (const slot of GEAR_SLOTS) {
              const name = values[String(slot)];
              const item = this.itemsFor(slot).find((id) => ITEMS[id].name === name);
              if (item === undefined) this.items.delete(slot);
              else this.items.set(slot, item);
            }
          },
        },
        {
          title: "Spawn",
          call: "game.dwarf",
          arg: "object",
          fields: [
            { key: "count", control: { kind: "number", step: 1 } },
            { key: "spawn", label: "", control: { kind: "button", text: "Spawn into the tavern" } },
          ],
          get: () => ({ count: this.count, spawn: false }),
          set: (values) => {
            if (typeof values.count === "number") this.count = Math.max(1, Math.round(values.count));
            if (values.spawn === true) this.spawn(this.count);
          },
        },
      ],
    });
  }
}
