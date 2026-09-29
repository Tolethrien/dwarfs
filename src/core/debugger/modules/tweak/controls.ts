import type { TweakControl } from "./report";

// kept out of exports, revert and presets
const NOT_VALUES: ReadonlySet<TweakControl["kind"]> = new Set(["info", "button", "stick"]);

export function isValueControl(control: TweakControl) {
  return !NOT_VALUES.has(control.kind);
}
