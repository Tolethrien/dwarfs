import { ipcMain } from "electron";
import { sendToGame, sendToProfiler } from "../windows/profiler";
import type {
  TweakCategoryInfo,
  TweakInput,
  TweakMessage,
  TweakPanelInfo,
  TweakRegistry,
} from "../../core/debugger/modules/tweak/report";

// kept for a profiler that opens after the game registered its categories and panels
const registry = {
  categories: new Map<string, TweakCategoryInfo>(),
  panels: new Map<string, TweakPanelInfo>(),
};

export function registerTweakIPC() {
  ipcMain.on("debug:tweak", (_, message: TweakMessage) => {
    if (message.type === "category") registry.categories.set(message.category.id, message.category);
    else if (message.type === "add") registry.panels.set(message.panel.name, message.panel);
    else if (message.type === "remove") registry.panels.delete(message.name);
    sendToProfiler("debug:tweak", message);
  });
  ipcMain.handle(
    "debug:tweakRegistry",
    (): TweakRegistry => ({
      categories: [...registry.categories.values()],
      panels: [...registry.panels.values()],
    }),
  );
  ipcMain.on("debug:tweakInput", (_, input: TweakInput) =>
    sendToGame("debug:tweakInput", input),
  );
}

export function resetTweakSession() {
  registry.categories.clear();
  registry.panels.clear();
}
