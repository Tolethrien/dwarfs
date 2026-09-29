import Time from "../time";
import { debug } from "@debug";
import Coroutine, { type CoroutineScript, type CoroutineTime } from "./coroutine";

export interface CoroutineGroupOptions<Phase extends string> {
  // shown in the profiler
  name: string;
  // phases stepped several times a frame (fixed steps)
  stepPhases: Phase[];
}
export interface CoroutineStartOptions<Phase extends string> {
  phase: Phase;
  owner: symbol;
  // shown in the profiler instead of the owner symbol's description
  ownerName: string;
  key: string;
  time: CoroutineTime;
  name: string;
  // false = frozen, not stepped (a disabled owner)
  active: () => boolean;
}
interface GroupEntry<Phase extends string> {
  coroutine: Coroutine;
  phase: Phase;
  owner: symbol | null;
  key: string | null;
  active: (() => boolean) | null;
  startFrame: number;
}
interface OwnerRecord<Phase extends string> {
  entries: Set<GroupEntry<Phase>>;
  slots: Map<string, GroupEntry<Phase>>;
}

export default class CoroutineGroup<Phase extends string> {
  private static count = 0;
  public readonly name: string;
  private readonly defaultPhase: Phase;
  private readonly stepPhases: ReadonlySet<Phase>;
  private readonly buckets = new Map<Phase, GroupEntry<Phase>[]>();
  private readonly owners = new Map<symbol, OwnerRecord<Phase>>();
  private readonly globalSlots = new Map<string, GroupEntry<Phase>>();

  constructor(defaultPhase: Phase, options?: Partial<CoroutineGroupOptions<Phase>>) {
    this.defaultPhase = defaultPhase;
    this.name = options?.name ?? `group ${++CoroutineGroup.count}`;
    this.stepPhases = new Set(options?.stepPhases);
  }

  public start<Result>(
    script: CoroutineScript<Result>,
    options?: Partial<CoroutineStartOptions<Phase>>,
  ): Coroutine<Result> {
    // an anonymous script is shown under its key
    const name = options?.name ?? (script.name || options?.key);
    const coroutine = new Coroutine(script, { time: options?.time, name });
    const entry: GroupEntry<Phase> = {
      coroutine,
      phase: options?.phase ?? this.defaultPhase,
      owner: options?.owner ?? null,
      key: options?.key ?? null,
      active: options?.active ?? null,
      startFrame: Time.getFrame(),
    };
    if (entry.key !== null) this.stop(entry.key, options?.owner);
    this.register(entry);
    debug.coroutines.describe(coroutine, {
      group: this.name,
      phase: entry.phase,
      owner: options?.ownerName ?? entry.owner?.description ?? null,
      key: entry.key,
      active: entry.active,
    });
    coroutine.update();
    return coroutine;
  }
  public step(phase: Phase) {
    const bucket = this.buckets.get(phase);
    if (bucket === undefined) return;
    // started during this step: only its first step, from start. A frame phase also skips the
    // ones started earlier this frame (yield = next frame), a step phase doesn't (next step)
    const count = bucket.length;
    const everyStep = this.stepPhases.has(phase);
    const frame = Time.getFrame();
    for (let index = 0; index < count; index++) {
      const entry = bucket[index];
      if (!everyStep && entry.startFrame === frame) continue;
      if (entry.active !== null && !entry.active()) continue;
      entry.coroutine.update();
    }
    let kept = 0;
    for (const entry of bucket) {
      if (entry.coroutine.done) this.forget(entry);
      else bucket[kept++] = entry;
    }
    bucket.length = kept;
  }
  public stop(key: string, owner?: symbol) {
    this.slotsOf(owner ?? null)?.get(key)?.coroutine.stop();
  }
  // its first step runs now, so this frame's step leaves it alone
  public restart(key: string, owner?: symbol) {
    const entry = this.slotsOf(owner ?? null)?.get(key);
    if (entry === undefined) return;
    entry.startFrame = Time.getFrame();
    entry.coroutine.restart();
  }
  public skip(key: string, owner?: symbol) {
    this.slotsOf(owner ?? null)?.get(key)?.coroutine.skip();
  }
  public skipWait(key: string, owner?: symbol) {
    this.slotsOf(owner ?? null)?.get(key)?.coroutine.skipWait();
  }
  public stopOwner(owner: symbol) {
    const record = this.owners.get(owner);
    if (record === undefined) return;
    this.owners.delete(owner);
    for (const entry of record.entries) entry.coroutine.stop();
  }
  public stopAll() {
    for (const bucket of this.buckets.values()) {
      for (const entry of bucket) entry.coroutine.stop();
    }
    this.owners.clear();
    this.globalSlots.clear();
  }

  private register(entry: GroupEntry<Phase>) {
    let bucket = this.buckets.get(entry.phase);
    if (bucket === undefined) {
      bucket = [];
      this.buckets.set(entry.phase, bucket);
    }
    bucket.push(entry);
    if (entry.owner !== null) {
      let record = this.owners.get(entry.owner);
      if (record === undefined) {
        record = { entries: new Set(), slots: new Map() };
        this.owners.set(entry.owner, record);
      }
      record.entries.add(entry);
    }
    if (entry.key !== null) this.slotsOf(entry.owner)?.set(entry.key, entry);
  }
  private forget(entry: GroupEntry<Phase>) {
    const slots = this.slotsOf(entry.owner);
    if (entry.key !== null && slots?.get(entry.key) === entry) slots.delete(entry.key);
    if (entry.owner === null) return;
    const record = this.owners.get(entry.owner);
    if (record === undefined) return;
    record.entries.delete(entry);
    if (record.entries.size === 0) this.owners.delete(entry.owner);
  }
  private slotsOf(owner: symbol | null) {
    if (owner === null) return this.globalSlots;
    return this.owners.get(owner)?.slots;
  }
}
