import InputManager from "@engine/inputManager";
import { KEY } from "@engine/keys";

export const ACTION = {
  cameraUp: "cameraUp",
  cameraDown: "cameraDown",
  cameraLeft: "cameraLeft",
  cameraRight: "cameraRight",
  zoomIn: "zoomIn",
  zoomOut: "zoomOut",
  zoomReset: "zoomReset",
  shoot: "shoot",
  changeMode: "changeMode",
  placeBlock: "placeBlock",
  mineTile: "mineTile",
  interact: "interact",
  pause: "pause",
} as const;

export function registerInputsBindings() {
  InputManager.bindAction({ name: ACTION.cameraUp, key: KEY.w, mods: [] });
  InputManager.bindAction({ name: ACTION.cameraDown, key: KEY.s, mods: [] });
  InputManager.bindAction({ name: ACTION.cameraLeft, key: KEY.a, mods: [] });
  InputManager.bindAction({ name: ACTION.cameraRight, key: KEY.d, mods: [] });
  InputManager.bindAction({ name: ACTION.zoomIn, key: KEY.arrowUp, mods: [] });
  InputManager.bindAction({ name: ACTION.changeMode, key: KEY.tab, mods: [] });
  InputManager.bindAction({ name: ACTION.zoomReset, key: KEY.p, mods: [] });
  InputManager.bindAction({
    name: ACTION.zoomOut,
    key: KEY.arrowDown,
    mods: [],
  });
  InputManager.bindAction({ name: ACTION.shoot, mouse: "RIGHT", mods: [] });
  InputManager.bindAction({ name: ACTION.placeBlock, mouse: "LEFT", mods: [] });
  // build mode only, the same button shoots in game mode
  InputManager.bindAction({ name: ACTION.mineTile, mouse: "RIGHT", mods: [] });
  InputManager.bindAction({ name: ACTION.interact, mouse: "LEFT", mods: [] });
  InputManager.bindAction({ name: ACTION.pause, key: KEY.escape, mods: [] });
}
