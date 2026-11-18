import { contextBridge } from "electron";
import { WINDOW } from "./window";
import { DEBUG } from "./debug";
import { PROFILER } from "./profiler";

export const API = {
  WINDOW,
  DEBUG,
  PROFILER,
};
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld("API", API);
  } catch (error) {
    console.error(error);
  }
}
