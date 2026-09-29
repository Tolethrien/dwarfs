import Time from "../time";
import { debug } from "@debug";
import { Signal } from "@axiom/events";

export type CoroutineTime = "game" | "real" | "fixed";
export type CoroutineState = "running" | "done" | "stopped" | "failed";
export interface CoroutineOptions {
  time: CoroutineTime;
  // shown in the profiler, default = the script function's name
  name: string;
}
export interface CoroutineWait {
  tick(delta: number): boolean;
  skip?(): void;
  dispose?(): void;
  // what it waits on, for the profiler
  describe?(): string;
}
export interface CoroutineWaitUntilOptions {
  skippable: boolean;
}
interface Watch<Value> {
  settled: boolean;
  failed: boolean;
  value: Value | undefined;
  error: unknown;
}
export type CoroutineScript<Result = unknown> = (
  co: Coroutine,
) => Generator<CoroutineWait | void, Result, void>;

export default class Coroutine<Result = unknown> implements CoroutineWait {
  private static readonly SKIP_STEP_LIMIT = 1000;
  public readonly name: string;
  // its seconds only, on top of its time kind; children multiply it down the tree
  public timeScale = 1;
  // kept for restart
  private readonly source: CoroutineScript<Result>;
  private script: Generator<CoroutineWait | void, Result, void>;
  private readonly children: Coroutine[] = [];
  private readonly cleanups: (() => void)[] = [];
  private readonly time: CoroutineTime;
  private wait: CoroutineWait | void = undefined;
  private status: CoroutineState = "running";
  private resultValue: Result | undefined = undefined;
  private errorValue: unknown = undefined;
  private failure: { error: unknown } | null = null;
  private hasParent = false;
  private running = false;
  private stopRequested = false;
  private restartRequested = false;
  private skipping = false;
  // started by a skipping parent: isSkipping during its first step only
  private skippingFirstStep = false;
  private skipWaitRequested = false;
  private held = false;

  constructor(script: CoroutineScript<Result>, options?: Partial<CoroutineOptions>) {
    this.source = script;
    this.script = script(this);
    this.time = options?.time ?? "game";
    this.name = options?.name ?? (script.name || "anonymous");
    debug.coroutines.track(this);
  }
  public get done() {
    return this.status !== "running";
  }
  public get state() {
    return this.status;
  }
  public get result() {
    return this.resultValue;
  }
  public get error() {
    return this.errorValue;
  }
  public get isSkipping() {
    return this.skipping || this.skippingFirstStep;
  }
  public get timeKind() {
    return this.time;
  }
  // pause() or a game pause for game and fixed time
  public get isPaused() {
    return this.held || (this.time !== "real" && Time.getPaused());
  }
  public get isRoot() {
    return !this.hasParent;
  }
  public get waitingOn() {
    if (this.failure !== null) return "error at the next step";
    if (!this.wait) return "next frame";
    return this.wait.describe?.() ?? "wait";
  }
  public getChildren(): readonly Coroutine[] {
    return this.children;
  }

  public update() {
    this.step(1);
  }
  public tick() {
    if (this.status === "failed") throw this.errorValue;
    return this.status !== "running";
  }
  public describe() {
    return `coroutine ${this.name}`;
  }

  public stop() {
    if (this.status !== "running") return;
    if (this.running) {
      this.stopRequested = true;
      return;
    }
    this.finish("stopped");
  }
  // thrown into the script at its current yield, on its next step
  public throw(error: unknown) {
    if (this.status === "running" && this.failure === null) this.failure = { error };
  }
  // from the beginning on the same object (key, owner, group stay): the current run ends like a
  // stop (children, finally, cleanups), then the script runs to its first yield at once
  public restart() {
    if (this.status !== "running") {
      debug.log
        .scope("coroutine")
        .warn(`restart of the finished coroutine ${this.name} does nothing, start it again`);
      return;
    }
    if (this.running) {
      this.restartRequested = true;
      return;
    }
    this.finish("stopped");
    this.status = "running";
    this.resultValue = undefined;
    this.errorValue = undefined;
    this.failure = null;
    this.stopRequested = false;
    this.restartRequested = false;
    this.skipping = false;
    this.skipWaitRequested = false;
    this.script = this.source(this);
    debug.coroutines.track(this);
    this.update();
  }
  // stands still, frames and children too, until resume()
  public pause() {
    this.held = true;
  }
  public resume() {
    this.held = false;
  }
  public skip() {
    if (this.status === "running") this.skipping = true;
  }
  public skipWait() {
    if (this.status === "running") this.skipWaitRequested = true;
  }
  public defer(cleanup: () => void) {
    this.cleanups.push(cleanup);
  }
  public take<Lease extends { release(): void }>(lease: Lease): Lease {
    this.defer(() => lease.release());
    return lease;
  }
  public start<ChildResult>(script: CoroutineScript<ChildResult>): Coroutine<ChildResult> {
    const child = new Coroutine(script, { time: this.time });
    child.hasParent = true;
    this.children.push(child);
    // a skipping parent: the child's first step sees it (no sound, no line); skipping it fully is
    // up to the parent's yield on it, a child in the background then runs normally
    child.skippingFirstStep = this.isSkipping;
    child.update();
    child.skippingFirstStep = false;
    return child;
  }
  public join<ChildResult>(
    target: Coroutine<ChildResult>,
  ): Generator<CoroutineWait, ChildResult | undefined, void>;
  public join<Value>(target: PromiseLike<Value>): Generator<CoroutineWait, Value, void>;
  public join<Value>(
    target: Signal<Value>,
    filter?: (value: Value) => boolean,
  ): Generator<CoroutineWait, Value, void>;
  public *join<Value>(
    target: Coroutine<Value> | PromiseLike<Value> | Signal<Value>,
    filter?: (value: Value) => boolean,
  ): Generator<CoroutineWait, Value | undefined, void> {
    if (target instanceof Coroutine) {
      yield target;
      return target.result;
    }
    const watch = Coroutine.createWatch<Value>();
    yield target instanceof Signal
      ? Coroutine.watchSignal(target, watch, filter)
      : Coroutine.watchPromise(target, watch);
    return watch.value;
  }

  public waitSeconds(seconds: number): CoroutineWait {
    let remaining = seconds;
    return {
      tick: (delta) => (remaining -= delta) <= 0,
      skip: () => {
        remaining = 0;
      },
      describe: () => `${Math.max(remaining, 0).toFixed(2)} s left`,
    };
  }
  public waitFrames(frames: number): CoroutineWait {
    let remaining = frames;
    return {
      tick: () => --remaining <= 0,
      skip: () => {
        remaining = 0;
      },
      describe: () => `${Math.max(remaining, 0)} frames left`,
    };
  }
  public waitUntil(
    predicate: () => boolean,
    options?: Partial<CoroutineWaitUntilOptions>,
  ): CoroutineWait {
    const label = `until ${predicate.name || "predicate"}`;
    if (!options?.skippable) return { tick: () => predicate(), describe: () => label };
    let skipped = false;
    return {
      tick: () => skipped || predicate(),
      skip: () => {
        skipped = true;
      },
      describe: () => `${label} (skippable)`,
    };
  }
  public all(waits: CoroutineWait[]): CoroutineWait {
    const pending = new Set(waits);
    return {
      tick: (delta) => {
        for (const wait of pending) if (wait.tick(delta)) pending.delete(wait);
        return pending.size === 0;
      },
      skip: () => {
        for (const wait of pending) wait.skip?.();
      },
      dispose: () => {
        for (const wait of waits) wait.dispose?.();
      },
      describe: () => `all: ${Coroutine.describeAll([...pending], ", ")}`,
    };
  }
  public race(waits: CoroutineWait[]): CoroutineWait {
    return {
      tick: (delta) => waits.some((wait) => wait.tick(delta)),
      skip: () => {
        for (const wait of waits) wait.skip?.();
      },
      dispose: () => {
        for (const wait of waits) wait.dispose?.();
      },
      describe: () => `race: ${Coroutine.describeAll(waits, " | ")}`,
    };
  }
  public waitPromise(promise: PromiseLike<unknown>): CoroutineWait {
    return Coroutine.watchPromise(promise, Coroutine.createWatch());
  }
  public waitSignal<Value>(
    signal: Signal<Value>,
    filter?: (value: Value) => boolean,
  ): CoroutineWait {
    return Coroutine.watchSignal(signal, Coroutine.createWatch<Value>(), filter);
  }

  private static deltaOf(time: CoroutineTime) {
    if (time === "fixed") return Time.getFixedDeltaTime();
    if (time === "game") return Time.getDeltaTime();
    return Time.getRawDeltaTime();
  }
  private static createWatch<Value>(): Watch<Value> {
    return { settled: false, failed: false, value: undefined, error: undefined };
  }
  private static watchWait(
    watch: Watch<unknown>,
    label: string,
    dispose?: () => void,
  ): CoroutineWait {
    return {
      tick: () => {
        if (watch.failed) throw watch.error;
        return watch.settled;
      },
      dispose,
      describe: () => label,
    };
  }
  private static describeAll(waits: CoroutineWait[], separator: string) {
    return waits.map((wait) => wait.describe?.() ?? "wait").join(separator);
  }
  private static watchPromise<Value>(promise: PromiseLike<Value>, watch: Watch<Value>) {
    promise.then(
      (value) => {
        watch.settled = true;
        watch.value = value;
      },
      (error) => {
        watch.settled = true;
        watch.failed = true;
        watch.error = error;
      },
    );
    return Coroutine.watchWait(watch, "promise");
  }
  private static watchSignal<Value>(
    signal: Signal<Value>,
    watch: Watch<Value>,
    filter?: (value: Value) => boolean,
  ) {
    const listener = (value: Value) => {
      try {
        if (filter && !filter(value)) return;
        watch.value = value;
      } catch (error) {
        watch.failed = true;
        watch.error = error;
      }
      watch.settled = true;
      signal.disconnect(listener);
    };
    signal.connect(listener);
    return Coroutine.watchWait(watch, "signal", () => signal.disconnect(listener));
  }

  private step(inheritedScale: number) {
    if (this.status !== "running") return;
    if (this.isPaused) return;
    const scale = inheritedScale * this.timeScale;
    this.updateChildren(scale);
    if (this.status !== "running") return;
    if (!this.isWaitOver(Coroutine.deltaOf(this.time) * scale)) return;
    this.advance();
    if (this.skipping) this.fastForward();
  }
  private fastForward() {
    for (let steps = 0; steps < Coroutine.SKIP_STEP_LIMIT; steps++) {
      if (this.status !== "running" || !this.isWaitOver(0)) return;
      this.advance();
    }
    debug.log
      .scope("coroutine")
      .warn(`skip hit ${Coroutine.SKIP_STEP_LIMIT} steps in one frame, continuing next frame`);
  }
  private isWaitOver(delta: number) {
    if (this.failure !== null) return true;
    const wait = this.wait;
    const skipWait = this.skipping || this.skipWaitRequested;
    this.skipWaitRequested = false;
    if (!wait) return true;
    try {
      if (skipWait) wait.skip?.();
      return wait.tick(delta);
    } catch (error) {
      this.failure = { error };
      return true;
    }
  }

  private advance() {
    this.disposeWait();
    const failure = this.failure;
    this.failure = null;
    this.running = true;
    let step: IteratorResult<CoroutineWait | void, Result>;
    try {
      step = failure === null ? this.script.next() : this.script.throw(failure.error);
    } catch (error) {
      this.running = false;
      this.fail(error);
      return;
    }
    this.running = false;
    if (step.done) this.resultValue = step.value;
    else this.wait = step.value;
    // asked from inside the script; a stop asked in the same step wins
    if (this.restartRequested && !this.stopRequested) {
      this.restart();
      return;
    }
    if (step.done) {
      this.finish("done");
      return;
    }
    if (this.stopRequested) this.stop();
  }
  private updateChildren(scale: number) {
    for (let index = 0; index < this.children.length; index++) {
      const child = this.children[index];
      child.step(scale);
      if (!child.done) continue;
      this.children.splice(index, 1);
      index--;
      if (child.state === "failed" && this.failure === null) {
        this.failure = { error: child.error };
      }
    }
  }
  private disposeWait() {
    const wait = this.wait;
    this.wait = undefined;
    if (wait) wait.dispose?.();
  }
  private fail(error: unknown) {
    this.errorValue = error;
    this.finish("failed");
    if (!this.hasParent) console.error("Coroutine failed:", error);
  }
  private finish(status: CoroutineState) {
    this.status = status;
    this.disposeWait();
    for (const child of this.children) child.stop();
    this.children.length = 0;
    if (status === "stopped") this.closeScript();
    for (let index = this.cleanups.length - 1; index >= 0; index--) {
      try {
        this.cleanups[index]();
      } catch (error) {
        console.error("Coroutine cleanup failed:", error);
      }
    }
    this.cleanups.length = 0;
  }
  private closeScript() {
    try {
      this.script.return(undefined as Result);
    } catch (error) {
      console.error("Coroutine finally failed:", error);
    }
  }
}
