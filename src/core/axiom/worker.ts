// a job on another thread. Vite builds a worker only from `new Worker(new URL("./file.ts",
// import.meta.url), { type: "module" })` written at the call site, so the caller passes `create`

type WorkerMessage<Output> =
  | { type: "progress"; value: unknown }
  | { type: "done"; result: Output }
  | { type: "error"; message: string; stack?: string };

export interface WorkerJob<Input, Output> {
  create: () => Worker;
  // the same job on this thread, only when the worker does not start (missing file, broken
  // module); an error thrown by the job itself is a bug and rejects, it never falls back here
  inline?: (input: Input) => Output;
  onFallback?: (reason: unknown) => void;
  timeoutMs?: number;
  signal?: AbortSignal;
  onProgress?: (value: unknown) => void;
}

export interface WorkerAnswer<Output> {
  result: Output;
  // buffers handed back without a copy
  transfer?: Transferable[];
}

interface WorkerScope {
  onmessage: ((event: MessageEvent) => void) | null;
  postMessage(message: unknown, transfer?: Transferable[]): void;
}

export function runWorker<Input, Output>(
  job: WorkerJob<Input, Output>,
  input: Input,
  transfer: Transferable[] = [],
): Promise<Output> {
  return new Promise<Output>((resolve, reject) => {
    if (job.signal?.aborted) {
      reject(cancelled());
      return;
    }

    const fallback = (reason: unknown) => {
      if (!job.inline) {
        reject(reason instanceof Error ? reason : new Error(`worker did not start: ${String(reason)}`));
        return;
      }
      job.onFallback?.(reason);
      const inline = job.inline;
      // a macrotask, so whatever the caller shows first (a loading screen) gets drawn;
      // the abort listener is already gone here, so a cancel in between is checked by hand
      setTimeout(() => {
        if (job.signal?.aborted) {
          reject(cancelled());
          return;
        }
        try {
          resolve(inline(input));
        } catch (error) {
          reject(error);
        }
      });
    };

    let worker: Worker;
    try {
      worker = job.create();
    } catch (error) {
      fallback(error);
      return;
    }

    let timer: ReturnType<typeof setTimeout> | undefined;
    const onAbort = () => {
      finish();
      reject(cancelled());
    };
    const finish = () => {
      clearTimeout(timer);
      job.signal?.removeEventListener("abort", onAbort);
      worker.terminate();
    };
    if (job.timeoutMs !== undefined)
      timer = setTimeout(() => {
        finish();
        reject(new Error(`worker: no result after ${job.timeoutMs} ms`));
      }, job.timeoutMs);
    job.signal?.addEventListener("abort", onAbort, { once: true });

    worker.onmessage = (event: MessageEvent<WorkerMessage<Output>>) => {
      const message = event.data;
      if (message.type === "progress") {
        job.onProgress?.(message.value);
        return;
      }
      finish();
      if (message.type === "done") {
        resolve(message.result);
        return;
      }
      const error = new Error(message.message);
      if (message.stack) error.stack = message.stack;
      reject(error);
    };
    // serveWorker catches the job's errors, so this is the worker failing to load
    worker.onerror = (event) => {
      event.preventDefault();
      finish();
      fallback(new Error(`worker failed: ${event.message}`));
    };
    worker.onmessageerror = () => {
      finish();
      reject(new Error("worker: a message could not be read"));
    };
    worker.postMessage(input, transfer);
  });
}

// worker side: one handler, errors go back with their stack instead of a bare onerror
export function serveWorker<Input, Output>(
  handler: (input: Input, report: (value: unknown) => void) => WorkerAnswer<Output>,
) {
  const scope = self as unknown as WorkerScope;
  const report = (value: unknown) => scope.postMessage({ type: "progress", value });
  scope.onmessage = (event: MessageEvent<Input>) => {
    try {
      const answer = handler(event.data, report);
      scope.postMessage({ type: "done", result: answer.result }, answer.transfer ?? []);
    } catch (error) {
      const failure = error instanceof Error ? error : new Error(String(error));
      scope.postMessage({ type: "error", message: failure.message, stack: failure.stack });
    }
  };
}

export function isCancelled(error: unknown) {
  return error instanceof DOMException && error.name === "AbortError";
}

function cancelled() {
  return new DOMException("worker: cancelled", "AbortError");
}
