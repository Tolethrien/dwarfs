import Table from "../../blocks/table";
import { Block, Rows } from "../../grid/layout";
import { coroutineStore } from "../../coroutines/store";

const STATUS_COLORS: Record<string, string> = {
  done: "var(--color-fg-dim)",
  stopped: "var(--color-warn)",
  failed: "var(--color-error)",
};

export default function CoroutinesFinishedPanel() {
  // newest first
  const finished = () => [...coroutineStore.finished()].reverse();
  const rows = () =>
    finished().map((node) => [
      node.name,
      node.status,
      node.owner ?? "—",
      node.key ?? "—",
      `${node.age.toFixed(1)} s`,
      node.error ?? "",
    ]);

  return (
    <Rows>
      <Block size="fit" class="flex items-center justify-between">
        <span class="text-caption text-fg-dim">{finished().length} kept</span>
        <button
          class="cursor-pointer rounded border border-divider px-2 py-0.5 text-fg-dim not-disabled:hover:text-fg disabled:cursor-default disabled:opacity-40"
          disabled={finished().length === 0}
          onClick={() => coroutineStore.clearFinished()}
        >
          Clear
        </button>
      </Block>
      <Block size="fill">
        <Table
          columns={[
            { label: "Name", width: "minmax(8rem,1fr)" },
            { label: "Ended", width: "auto" },
            { label: "Owner", width: "minmax(5rem,1fr)" },
            { label: "Key", width: "auto" },
            { label: "Lived", width: "auto", align: "right" },
            { label: "Error", width: "minmax(8rem,2fr)" },
          ]}
          rows={rows()}
          cellColor={(row, column) =>
            column === 1 ? STATUS_COLORS[finished()[row]?.status ?? ""] : undefined
          }
          empty="nothing finished yet"
        />
      </Block>
    </Rows>
  );
}
