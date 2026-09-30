import { Show } from "solid-js";
import Table from "../../blocks/table";
import { mapGenStore } from "../../mapGen/store";

export default function MapGenOresPanel() {
  return (
    <Show
      when={mapGenStore.report()}
      fallback={<span class="italic text-fg-dim">no map yet</span>}
    >
      {(report) => (
        <Table
          columns={report().ores.columns.map((label, index) =>
            index === 0 ? { label } : { label, width: "auto", align: "right" as const },
          )}
          rows={report().ores.rows}
          empty="no ores on the map"
        />
      )}
    </Show>
  );
}
