import { Index, Show } from "solid-js";
import type { StatProps } from "./stat";

// one wrapping line of label + value pairs, for counters that do not need big numbers
export default function StatStrip(props: { stats: Omit<StatProps, "big">[] }) {
  return (
    <div class="flex flex-wrap items-baseline gap-x-4 gap-y-1">
      <Index each={props.stats}>
        {(stat) => (
          <span class="whitespace-nowrap">
            <span class="text-caption uppercase tracking-[0.1em] text-fg-dim">{stat().label}</span>
            <span class="ml-1.5 font-semibold tabular-nums">{stat().value}</span>
            <Show when={stat().unit}>
              <span class="ml-1 text-fg-dim">{stat().unit}</span>
            </Show>
          </span>
        )}
      </Index>
    </div>
  );
}
