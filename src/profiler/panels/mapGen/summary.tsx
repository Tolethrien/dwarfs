import { Show } from "solid-js";
import KeyValue from "../../blocks/keyValue";
import { mapGenStore } from "../../mapGen/store";

export default function MapGenSummaryPanel() {
  return (
    <Show
      when={mapGenStore.report()}
      fallback={<span class="italic text-fg-dim">no map yet</span>}
    >
      {(report) => <KeyValue items={report().summary} />}
    </Show>
  );
}
