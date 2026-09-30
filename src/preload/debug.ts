import { ipcRenderer } from "electron";
import { on } from "./ipc";
import type {
  GpuInfo,
  PerformanceSnapshot,
} from "../core/debugger/report";
import type { AuroraReport } from "../core/debugger/modules/aurora/report";
import type { CoroutineReport } from "../core/debugger/modules/coroutines/report";
import type { MapGenReport } from "../core/debugger/modules/mapGen/report";
import type {
  LogEntry,
  LogMessage,
} from "../core/debugger/modules/log/report";
import type {
  WatchMessage,
  WatchState,
} from "../core/debugger/modules/watch/report";
import type {
  CommandCompleteQuery,
  CommandCompleteRequest,
  CommandCompleteResult,
  CommandCompletion,
  CommandEntry,
  CommandRegistryMessage,
} from "../core/debugger/modules/command/report";
import type {
  TweakInput,
  TweakMessage,
  TweakPanelInfo,
} from "../core/debugger/modules/tweak/report";

export const DEBUG = {
  //perf
  sendPerformanceSnapshot: (data: PerformanceSnapshot) =>
    ipcRenderer.send("debug:performance", data),
  onPerformanceSnapshot: (callback: (data: PerformanceSnapshot) => void) =>
    on("debug:performance", callback),
  //aurora
  sendAuroraReport: (data: AuroraReport) =>
    ipcRenderer.send("debug:aurora", data),
  onAuroraReport: (callback: (data: AuroraReport) => void) =>
    on("debug:aurora", callback),
  //coroutines
  sendCoroutines: (report: CoroutineReport) =>
    ipcRenderer.send("debug:coroutines", report),
  onCoroutines: (callback: (report: CoroutineReport) => void) =>
    on("debug:coroutines", callback),
  //map generator
  sendMapGen: (report: MapGenReport) => ipcRenderer.send("debug:mapGen", report),
  onMapGen: (callback: (report: MapGenReport) => void) => on("debug:mapGen", callback),
  //log
  sendLog: (message: LogMessage) => ipcRenderer.send("debug:log", message),
  onLog: (callback: (message: LogMessage) => void) => on("debug:log", callback),
  getLogHistory: () =>
    ipcRenderer.invoke("debug:logHistory") as Promise<LogEntry[]>,
  clearLogs: () => ipcRenderer.invoke("debug:logClear") as Promise<void>,
  dumpLogs: () => ipcRenderer.invoke("debug:logDump") as Promise<string>,
  crashGame: () => ipcRenderer.send("debug:crashGame"),
  //watch
  sendWatch: (message: WatchMessage) =>
    ipcRenderer.send("debug:watch", message),
  onWatchVisible: (callback: (names: string[]) => void) =>
    on("debug:watchVisible", callback),
  getWatchVisible: () =>
    ipcRenderer.invoke("debug:getWatchVisible") as Promise<string[]>,
  onWatch: (callback: (message: WatchMessage) => void) =>
    on("debug:watch", callback),
  getWatchState: () =>
    ipcRenderer.invoke("debug:watchState") as Promise<WatchState[]>,
  setWatchVisible: (names: string[]) =>
    ipcRenderer.send("debug:watchVisible", names),
  //command
  sendCommandRegistry: (message: CommandRegistryMessage) =>
    ipcRenderer.send("debug:command", message),
  onCommandRun: (callback: (text: string) => void) =>
    on("debug:commandRun", callback),
  onCommandComplete: (callback: (request: CommandCompleteRequest) => void) =>
    on("debug:commandComplete", callback),
  sendCommandCompleteResult: (result: CommandCompleteResult) =>
    ipcRenderer.send("debug:commandCompleteResult", result),
  onCommandRegistry: (callback: (message: CommandRegistryMessage) => void) =>
    on("debug:command", callback),
  getCommandRegistry: () =>
    ipcRenderer.invoke("debug:commandRegistry") as Promise<CommandEntry[]>,
  runCommand: (text: string) => ipcRenderer.send("debug:commandRun", text),
  completeCommand: (query: CommandCompleteQuery) =>
    ipcRenderer.invoke("debug:commandComplete", query) as Promise<
      CommandCompletion | null
    >,
  //tweak
  sendTweak: (message: TweakMessage) => ipcRenderer.send("debug:tweak", message),
  onTweak: (callback: (message: TweakMessage) => void) =>
    on("debug:tweak", callback),
  getTweakRegistry: () =>
    ipcRenderer.invoke("debug:tweakRegistry") as Promise<TweakPanelInfo[]>,
  sendTweakInput: (input: TweakInput) =>
    ipcRenderer.send("debug:tweakInput", input),
  onTweakInput: (callback: (input: TweakInput) => void) =>
    on("debug:tweakInput", callback),
  //reload
  onGameReloaded: (callback: () => void) => on("debug:gameReloaded", callback),
  onProfilerState: (callback: (isOpen: boolean) => void) =>
    on("debug:profilerState", callback),
  getProfilerState: () =>
    ipcRenderer.invoke("debug:getProfilerState") as Promise<boolean>,
  getGpuInfo: () => ipcRenderer.invoke("debug:getGpuInfo") as Promise<GpuInfo>,
  openProfiler: () => ipcRenderer.send("openProfiler"),
};
