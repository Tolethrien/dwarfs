import InputManager, { type ActionBinding } from "@engine/inputManager";
import { KEY } from "@engine/keys";

export const ACTIONS = {
  cameraUp: { key: KEY.w, mods: "NoMod" },
  cameraDown: { key: KEY.s, mods: "NoMod" },
  cameraLeft: { key: KEY.a, mods: "NoMod" },
  cameraRight: { key: KEY.d, mods: "NoMod" },
  zoomIn: { key: KEY.arrowUp, mods: "NoMod" },
  zoomOut: { key: KEY.arrowDown, mods: "NoMod" },
  aim: { mouse: "LEFT", mods: "NoMod" },
  select: { mouse: "LEFT", mods: "NoMod" },
  stopShooting: { key: KEY.escape, mods: "NoMod" },
  toggleDig: { key: KEY.f5, mods: "NoMod" },
  dig: { mouse: "LEFT", mods: "NoMod" },
  toggleBuild: { key: KEY.tab, mods: "NoMod" },
  cancelBuild: { key: KEY.escape, mods: "NoMod" },
  place: { mouse: "LEFT", mods: "NoMod" },
  rotateBuild: { mouse: "RIGHT", mods: "NoMod" },
} satisfies Record<string, ActionBinding>;

export type ActionName = keyof typeof ACTIONS;

export function bindActions() {
  for (const name of Object.keys(ACTIONS) as ActionName[])
    InputManager.bindAction({ name: name, ...ACTIONS[name] });
}
