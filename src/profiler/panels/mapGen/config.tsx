import { Show } from "solid-js";
import Sections, { type Section } from "../../blocks/sections";
import { Block, Cols } from "../../grid/layout";
import { mapGenStore } from "../../mapGen/store";
import type { MapGenConfigSection } from "@/core/debugger/modules/mapGen/report";

const toSection = (section: MapGenConfigSection): Section => ({
  title: section.title,
  items: section.items,
  table: section.table && {
    columns: section.table.columns.map((label) => ({ label, width: "auto" })),
    rows: section.table.rows,
  },
});

// read only: what the shown map was generated with, new settings go through ⚙ Settings
export default function MapGenConfigPanel() {
  const halves = () => {
    const sections = mapGenStore.report()?.config.map(toSection) ?? [];
    const middle = Math.ceil(sections.length / 2);
    return { left: sections.slice(0, middle), right: sections.slice(middle) };
  };

  return (
    <Show
      when={mapGenStore.report()}
      fallback={<span class="italic text-fg-dim">no map yet</span>}
    >
      <Cols>
        <Block size="fill">
          <Sections sections={halves().left} />
        </Block>
        <Block size="fill">
          <Sections sections={halves().right} />
        </Block>
      </Cols>
    </Show>
  );
}
