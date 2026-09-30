import { ipcRenderer } from "electron";

export const PROFILER = {
  setTitleBarColors: (colors: { color: string; symbolColor: string }) =>
    ipcRenderer.send("profiler:setTitleBarColors", colors),
};
