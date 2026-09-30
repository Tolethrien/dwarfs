import { ipcRenderer } from "electron";

export const SAVES = {
  list: () => ipcRenderer.invoke("saves:list") as Promise<SaveGameInfo[]>,
  read: (gameId: string, file: string) =>
    ipcRenderer.invoke("saves:read", gameId, file) as Promise<ArrayBuffer>,
  write: (request: SaveWriteRequest, data: ArrayBuffer) =>
    ipcRenderer.invoke("saves:write", request, data) as Promise<string>,
  delete: (gameId: string, file?: string) =>
    ipcRenderer.invoke("saves:delete", gameId, file) as Promise<void>,
};
