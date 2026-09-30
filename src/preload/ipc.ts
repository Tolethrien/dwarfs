import { ipcRenderer, IpcRendererEvent } from "electron";

//send off to profiler to clear
export const on = <T>(channel: string, callback: (data: T) => void) => {
  const handler = (_: IpcRendererEvent, data: T) => callback(data);
  ipcRenderer.on(channel, handler);
  return () => ipcRenderer.off(channel, handler);
};
