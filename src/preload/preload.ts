import { contextBridge } from "electron";
import { WINDOW } from "./window";
import { SAVES } from "./saves";
import { DEBUG } from "./debug";
import { PROFILER } from "./profiler";

export const API = {
  WINDOW,
  SAVES,
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
