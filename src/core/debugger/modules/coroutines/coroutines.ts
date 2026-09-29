import type Coroutine from "@engine/coroutines/coroutine";
import type { CoroutineGroupInfo, ICoroutineModule } from "../../interfaces";
import type { CoroutineNode, CoroutineReport } from "./report";
import { profilerState } from "../../profilerState";

const COROUTINES = {
  intervalMs: 250,
  finishedKept: 30,
};

interface CoroutineRecord {
  id: number;
  startedAt: number;
  info: CoroutineGroupInfo | null;
}

export class DevCoroutines implements ICoroutineModule {
  private readonly records = new WeakMap<Coroutine, CoroutineRecord>();
  // every tracked coroutine until it turns out to be a child or ends; children are reached through
  // their parents
  private readonly roots = new Set<Coroutine>();
  private readonly finished: CoroutineNode[] = [];
  private nextId = 1;
  private lastReport = -Infinity;

  // a restart tracks again: a new run with a new id, the group info stays
  public track(coroutine: Coroutine) {
    const info = this.records.get(coroutine)?.info ?? null;
    this.records.set(coroutine, { id: this.nextId++, startedAt: performance.now(), info });
    this.roots.add(coroutine);
  }
  public describe(coroutine: Coroutine, info: CoroutineGroupInfo) {
    const record = this.records.get(coroutine);
    if (record) record.info = info;
  }

  public endFrame() {
    const now = performance.now();
    if (now - this.lastReport < COROUTINES.intervalMs) return;
    this.lastReport = now;
    const open = profilerState.isOpen;
    const running: CoroutineNode[] = [];
    for (const coroutine of this.roots) {
      if (!coroutine.isRoot) {
        this.roots.delete(coroutine);
        continue;
      }
      if (coroutine.done) {
        this.roots.delete(coroutine);
        this.finished.push(this.node(coroutine, now));
        if (this.finished.length > COROUTINES.finishedKept) this.finished.shift();
        continue;
      }
      if (open) running.push(this.node(coroutine, now));
    }
    if (open) this.send({ running, finished: this.finished });
  }

  private node(coroutine: Coroutine, now: number): CoroutineNode {
    const record = this.records.get(coroutine);
    const info = record?.info ?? null;
    return {
      id: record?.id ?? 0,
      name: coroutine.name,
      status: DevCoroutines.status(coroutine, info),
      waiting: coroutine.done ? "" : coroutine.waitingOn,
      time: coroutine.timeKind,
      group: info?.group ?? null,
      phase: info?.phase ?? null,
      owner: info?.owner ?? null,
      key: info?.key ?? null,
      age: record ? (now - record.startedAt) / 1000 : 0,
      error: coroutine.state === "failed" ? String(coroutine.error) : null,
      children: coroutine.getChildren().map((child) => this.node(child, now)),
    };
  }
  private static status(coroutine: Coroutine, info: CoroutineGroupInfo | null) {
    if (coroutine.done) return coroutine.state;
    if (info?.active && !info.active()) return "frozen";
    if (coroutine.isPaused) return "paused";
    if (coroutine.isSkipping) return "skipping";
    return "running";
  }
  private send(report: CoroutineReport) {
    window.API.DEBUG.sendCoroutines(report);
  }
}

const noop = () => {};
export const prodCoroutines: ICoroutineModule = {
  track: noop,
  describe: noop,
  endFrame: noop,
};
