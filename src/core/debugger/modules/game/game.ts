import type { IGameModule } from "../../interfaces";
import type { GameReport } from "./report";
import { profilerState } from "../../profilerState";

const GAME = { intervalMs: 250 };

export class DevGame implements IGameModule {
  private readonly sources = new Map<keyof GameReport, () => unknown>();
  private lastReport = -Infinity;

  public connect<Key extends keyof GameReport>(key: Key, source: () => GameReport[Key]) {
    this.sources.set(key, source);
  }

  public endFrame() {
    const now = performance.now();
    if (now - this.lastReport < GAME.intervalMs || !profilerState.isOpen) return;
    this.lastReport = now;
    const report: Record<string, unknown> = {};
    for (const [key, source] of this.sources) report[key] = source();
    window.API.DEBUG.sendGame(report as Partial<GameReport>);
  }
}

const noop = () => {};
export const prodGame: IGameModule = {
  connect: noop,
  endFrame: noop,
};
