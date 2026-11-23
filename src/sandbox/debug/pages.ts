import { assert } from "@axiom/utils";
import { debug } from "@debug";
import type { DebugCategoryID } from "./categories";
import type Effect from "../game/effects/effect";
import { STAT_NAMES, type StatName } from "../game/effects/effect";

type TweakPanel = Parameters<typeof debug.tweak.register>[1];
type TuneOptions = Parameters<typeof debug.tweak.tune>[2];
export type Section = TweakPanel["sections"][number];
type Field = Extract<Section, { arg: "action" }>["fields"][number];
export type Control = Field["control"];
export type Args = Record<string, unknown>;

// game.<group>.<action>(...) in the console runs the same as the action's button
export const GAME_COMMANDS: Record<string, Record<string, (...values: unknown[]) => void>> = {};

const PAGES = {
  prefix: "game.",
  hint: "game.<group>.<action>(...): the actions of the profiler's Game categories, the arguments in the order of their fields",
};

// pages and tune pages share one order, so each category lists them as its system registers them
let order = 0;

export const control = {
  number: (step = 1): Control => ({ kind: "number", step }),
  slider: (min: number, max: number, step: number): Control => ({ kind: "slider", min, max, step }),
  toggle: { kind: "toggle" } as Control,
  select: (options: readonly string[]): Control => ({ kind: "select", options }),
  info: { kind: "info" } as Control,
};

export function exposeCommands() {
  debug.command.expose("game", () => GAME_COMMANDS, { editable: true, hint: PAGES.hint });
}

// live: the sections are built again while the page is open (lists of dwarfs, stations); their count must stay.
// Built only when the debugger reads them, so a production build never does
export function page(
  category: DebugCategoryID,
  name: string,
  title: string,
  description: string,
  build: () => Section[],
  live = false,
) {
  let built: Section[] | undefined;
  debug.tweak.register(PAGES.prefix + name, {
    title,
    description,
    category,
    order: order++,
    live,
    command: false,
    exportable: false,
    presets: false,
    get sections() {
      if (live) return build();
      built ??= build();
      return built;
    },
  });
}

export function tune(category: DebugCategoryID, name: string, target: object, options: Omit<TuneOptions, "category" | "order">) {
  debug.tweak.tune(name, target, { ...options, category, order: order++ });
}

export interface Arg {
  key: string;
  label?: string;
  hint?: string;
  control: Control;
  value?: unknown;
}

export function action(group: string, name: string, title: string, args: Arg[], run: (args: Args) => void): Section {
  GAME_COMMANDS[group] ??= {};
  GAME_COMMANDS[group][name] = (...values) =>
    run(Object.fromEntries(args.map((arg, index) => [arg.key, values[index] ?? arg.value])));
  return {
    title,
    call: `game.${group}.${name}`,
    arg: "action",
    fields: args.map((arg) => ({ key: arg.key, label: arg.label, hint: arg.hint, control: arg.control })),
    defaults: Object.fromEntries(args.filter((arg) => arg.value !== undefined).map((arg) => [arg.key, arg.value])),
    run,
  };
}

export interface Value {
  key: string;
  label?: string;
  hint?: string;
  control: Control;
  get: () => unknown;
  set?: (value: unknown) => void;
}

export function values(title: string, call: string, entries: Value[]): Section {
  return {
    title,
    call,
    arg: "object",
    fields: entries.map((entry) => ({ key: entry.key, label: entry.label, hint: entry.hint, control: entry.control })),
    get: () => Object.fromEntries(entries.map((entry) => [entry.key, entry.get()])),
    set: (changed) => {
      for (const entry of entries) if (entry.key in changed) entry.set?.(changed[entry.key]);
    },
  };
}

// a select over ids shown by name, back to the id when an action runs
export function choice<ID>(ids: readonly ID[], nameOf: (id: ID) => string) {
  const names = ids.map(nameOf);
  return {
    names,
    control: control.select(names),
    name: (id: unknown) => names[ids.indexOf(id as ID)] ?? String(id),
    id(value: unknown): ID {
      const index = names.indexOf(String(value));
      assert(index !== -1, `"${String(value)}" is none of: ${names.join(", ")}`);
      return ids[index];
    },
  };
}

// Object.keys gives enum numbers as strings
export function idsOf<ID extends number>(table: Partial<Record<ID, unknown>>) {
  return Object.keys(table).map(Number) as ID[];
}

// the enum's member names by value, for tune's keyNames
export function enumNames(ids: readonly number[], names: Record<number, string>) {
  return Object.fromEntries(ids.map((id) => [String(id), names[id]]));
}

// a number or toggle in a game table, edited in place; path is where it lives in the code, for the export
export interface Ref {
  owner: object;
  key: string;
  path: string;
  label: string;
  hint?: string;
  range?: [min: number, max: number, step: number];
  // the number field's arrow step, when the starting value would guess wrong (a price of 1 can be 1.5)
  step?: number;
  // radians in the game, degrees in the profiler
  angle?: boolean;
  // a select over ids: the field shows names, the object keeps the id
  choice?: { names: readonly string[]; id(name: unknown): unknown; name(id: unknown): string };
}

const TUNED = { minStep: 0.01 };

export function ref(owner: object, key: string, path: string, label: string, hint?: string, range?: Ref["range"]): Ref {
  return { owner, key, path: `${path}.${key}`, label, hint, range };
}

function refControl(ref: Ref, value: unknown): Control {
  if (ref.choice) return control.select(ref.choice.names);
  if (ref.angle) return { kind: "angle" } as Control;
  if (Array.isArray(value)) return { kind: "color" } as Control;
  if (ref.step !== undefined) return control.number(ref.step);
  if (typeof value === "boolean") return control.toggle;
  if (ref.range) return control.slider(ref.range[0], ref.range[1], ref.range[2]);
  const number = Number(value);
  if (Number.isInteger(number)) return control.number(1);
  return control.number(Math.max(TUNED.minStep, 10 ** Math.floor(Math.log10(Math.abs(number) || 1) - 1)));
}

// one element of a table (a class, a block, a gear) with all its numbers in one section
export function tuned(title: string, refs: Ref[], onChange?: () => void, group?: string): Section {
  const paths = refs.map((ref) => ref.path);
  assert(new Set(paths).size === paths.length, `tuned "${title}": two fields share a path, one would hide the other (${paths.join(", ")})`);
  const slot = (ref: Ref) => ref.owner as Record<string, unknown>;
  const read = (ref: Ref) => (ref.choice ? ref.choice.name(slot(ref)[ref.key]) : slot(ref)[ref.key]);
  const pick = () => Object.fromEntries(refs.map((ref) => [ref.path, read(ref)]));
  return {
    title,
    call: title,
    arg: "object",
    group,
    fields: refs.map((ref) => ({ key: ref.path, label: ref.label, hint: ref.hint, control: refControl(ref, slot(ref)[ref.key]) })),
    defaults: structuredClone(pick()),
    get: pick,
    set: (values) => {
      for (const ref of refs) {
        if (!(ref.path in values)) continue;
        const value = values[ref.path];
        slot(ref)[ref.key] = ref.choice ? ref.choice.id(value) : value;
      }
      onChange?.();
    },
    format: (values) => Object.entries(values).map(([path, value]) => `${path} = ${JSON.stringify(value)}`).join("\n"),
  };
}

// a Tune page: exportable, with presets and Revert
export function tunePage(category: DebugCategoryID, name: string, title: string, description: string, build: () => Section[]) {
  let built: Section[] | undefined;
  debug.tweak.register(PAGES.prefix + name, {
    title,
    description,
    category,
    order: order++,
    command: false,
    get sections() {
      built ??= build();
      return built;
    },
  });
}

// "fullPull" → "full pull"
export function words(key: string) {
  return key.replace(/([a-z0-9])([A-Z])/g, "$1 $2").toLowerCase();
}

// add and multiply read as the stat they change ("Damage +", "Speed ×"), the rest by their name
function effectLabel(effect: Effect, key: string, keys: number) {
  const stat = /^(Add|Multiply) (\w+)$/.exec(effect.name);
  if (stat) return `${STAT_NAMES[stat[2] as StatName] ?? stat[2]} ${stat[1] === "Add" ? "+" : "×"}`;
  return keys === 1 ? effect.name : `${effect.name} · ${words(key)}`;
}

export function effectRefs(effects: readonly Effect[], path: string, prefix = ""): Ref[] {
  return effects.flatMap((effect, index) => {
    const props = effect.props as Record<string, unknown> | undefined;
    if (!props) return [];
    const keys = Object.keys(props).filter((key) => typeof props[key] === "number");
    return keys.map((key) => ({
      owner: props,
      key,
      path: `${path}.effects[${index}].props.${key}`,
      label: `${prefix}${effectLabel(effect, key, keys.length)}`,
      hint: effect.describe(),
    }));
  });
}
