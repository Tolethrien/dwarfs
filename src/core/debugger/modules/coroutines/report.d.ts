export interface CoroutineNode {
  id: number;
  name: string;
  // running, skipping, frozen (owner off), paused, done, stopped, failed
  status: string;
  waiting: string;
  time: string;
  group: string | null;
  phase: string | null;
  owner: string | null;
  key: string | null;
  // real seconds since it started
  age: number;
  error: string | null;
  children: CoroutineNode[];
}

export interface CoroutineReport {
  running: CoroutineNode[];
  // the latest finished roots, newest last
  finished: CoroutineNode[];
}
