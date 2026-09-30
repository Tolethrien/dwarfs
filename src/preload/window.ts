import { ipcRenderer } from "electron";

export const WINDOW = {
  onWindowResize: (callback: (size: Size2D) => void) =>
    ipcRenderer.on("window-resized", (_, value: Size2D) => callback(value)),
  getWindowSize: async () =>
    (await ipcRenderer.invoke("get-window-size")) as Promise<Size2D>,
  onFocusChanged: (callback: (bool: boolean) => void) =>
    ipcRenderer.on("window-focus-changed", (_, bool: boolean) =>
      callback(bool),
    ),
  setFullScreen: (bool: boolean) => ipcRenderer.send("set-full-screen", bool),
  toggleFullScreen: () => ipcRenderer.send("toggle-full-screen"),
  isFullScreen: async () =>
    (await ipcRenderer.invoke("is-full-screen")) as boolean,
  onFullScreenChanged: (callback: (bool: boolean) => void) =>
    ipcRenderer.on("window-full-screen-changed", (_, bool: boolean) =>
      callback(bool),
    ),
  getRefreshRate: async () =>
    (await ipcRenderer.invoke("get-refresh-rate")) as number,
};
