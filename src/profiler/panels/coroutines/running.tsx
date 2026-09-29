import type { CoroutineNode } from "@/core/debugger/modules/coroutines/report";
import TreeTable, { type TreeRow } from "../../blocks/treeTable";
import StatGrid from "../../blocks/statGrid";
import { Block, Rows } from "../../grid/layout";
import { coroutineStore } from "../../coroutines/store";

// the tree flattened depth first, children right under their parent
function flatten(nodes: CoroutineNode[], depth: number, rows: TreeRow[]) {
  for (const node of nodes) {
    rows.push({
      id: String(node.id),
      depth,
      hasChildren: node.children.length > 0,
      cells: [
        node.name,
        node.status,
        node.waiting,
        node.time,
        node.phase ?? "—",
        node.owner ?? "—",
        node.key ?? "—",
        `${node.age.toFixed(1)} s`,
        node.group ?? "—",
      ],
    });
    flatten(node.children, depth + 1, rows);
  }
  return rows;
}
function countAll(nodes: CoroutineNode[]): number {
  let count = nodes.length;
  for (const node of nodes) count += countAll(node.children);
  return count;
}

export default function CoroutinesRunningPanel() {
  const running = () => coroutineStore.report()?.running ?? [];
  const rows = () => flatten(running(), 0, []);

  return (
    <Rows>
      <Block size="fit">
        <StatGrid
          stats={[
            { label: "Roots", value: String(running().length) },
            { label: "All, children too", value: String(countAll(running())) },
          ]}
        />
      </Block>
      <Block size="fill">
        <TreeTable
          columns={[
            { label: "Name", width: "minmax(8rem,1.2fr)" },
            { label: "Status", width: "auto" },
            { label: "Waiting on", width: "minmax(8rem,1.5fr)" },
            { label: "Time", width: "auto" },
            { label: "Phase", width: "auto" },
            { label: "Owner", width: "minmax(5rem,1fr)" },
            { label: "Key", width: "auto" },
            { label: "Age", width: "auto", align: "right" },
            { label: "Group", width: "auto" },
          ]}
          rows={rows()}
          storageKey="coroutinesRunning"
          empty="no coroutines running"
        />
      </Block>
    </Rows>
  );
}
