export type TweakControl =
  | { kind: "slider"; min: number; max: number; step: number }
  | { kind: "number"; step?: number }
  // radians in the game, degrees 0..360 in the UI
  | { kind: "angle" }
  // RGBA 0-255
  | { kind: "color" }
  | { kind: "select"; options: readonly string[] }
  | { kind: "toggle" }
  // Position2D in 0..1
  | { kind: "point" }
  // display only: never edited, left out of exports, revert and presets
  | { kind: "info" }
  // a press sends true, the section runs it; not a value (like info)
  | { kind: "button"; text?: string }
  // held direction { x, y } in -1..1, sent while dragged, { 0, 0 } on release; not a value
  | { kind: "stick" };

export interface TweakField {
  key: string;
  label?: string;
  // what the field is, shown on hover over its label
  hint?: string;
  control: TweakControl;
  // release: sent when the control is let go (slider released, number blurred), for settings that rebuild the graph; default live
  apply?: "live" | "release";
}

export interface TweakFieldsSectionInfo {
  title: string;
  call: string;
  // object: setter takes an object of fields, value: the only field's value itself
  arg: "object" | "value";
  fields: TweakField[];
  // sections in a row with the same group sit under one header with its name (a gear, its levels)
  group?: string;
}

// schema computed per current element on the game side, functions do not cross IPC
export interface TweakListSectionInfo {
  title: string;
  call: string;
  arg: "list";
  itemFields: TweakField[][];
  itemLabels: (string | null)[];
  // false when the game has nothing to create
  addable: boolean;
  group?: string;
}

// fields are the arguments, kept by the game between runs; never exported, reverted or in presets
export interface TweakActionSectionInfo {
  title: string;
  call: string;
  arg: "action";
  fields: TweakField[];
  // the run button's text, default "Run"
  button?: string;
}

export type TweakSectionInfo = TweakFieldsSectionInfo | TweakListSectionInfo | TweakActionSectionInfo;

// profiler tabs that show category buttons
export type TweakCategoryTab = "game" | "aurora";

export interface TweakCategory {
  title: string;
  icon: string;
}

export interface TweakCategoryInfo extends TweakCategory {
  id: string;
  tab: TweakCategoryTab;
}

export interface TweakPanelInfo {
  name: string;
  title: string;
  description: string | null;
  exportable: boolean;
  presets: boolean;
  category: string | null;
  order: number;
  sections: TweakSectionInfo[];
}

// one record per section, in schema order; list section: { items: [...] }
export type TweakValues = Record<string, unknown>[];

export interface TweakRegistry {
  categories: TweakCategoryInfo[];
  panels: TweakPanelInfo[];
}

export type TweakMessage =
  | { type: "category"; category: TweakCategoryInfo }
  | { type: "add"; panel: TweakPanelInfo }
  | { type: "remove"; name: string }
  | { type: "open"; name: string; values: TweakValues }
  | { type: "values"; name: string; values: TweakValues }
  | { type: "export"; name: string; text: string };

// section = index in TweakPanelInfo.sections, index = element of a list section
export type TweakInput =
  | { type: "set"; name: string; section: number; key: string; value: unknown }
  | { type: "reset"; name: string; section: number; key: string }
  | { type: "listSet"; name: string; section: number; index: number; key: string; value: unknown }
  | { type: "listReset"; name: string; section: number; index: number; key: string }
  | { type: "listAdd"; name: string; section: number }
  | { type: "listRemove"; name: string; section: number; index: number }
  | { type: "listMove"; name: string; section: number; from: number; to: number }
  | { type: "listReplace"; name: string; section: number; items: Record<string, unknown>[] }
  | { type: "run"; name: string; section: number }
  | { type: "revert"; name: string }
  | { type: "export"; name: string; onlyChanged: boolean }
  | { type: "close"; name: string }
  | { type: "open"; name: string }
  | { type: "openCategory"; category: string }
  | { type: "exportCategory"; category: string; onlyChanged: boolean };
