import { createSignal, type Signal } from "solid-js";
import {
  LAYOUT_MODES,
  LAYOUT_SORTS,
  type Cell,
  type LayoutMode,
  type LayoutSort,
} from "./layouts";

export interface TabLayout {
  mode: LayoutMode;
  sort: LayoutSort;
  positions: Record<string, Cell>;
}

const DEFAULT_LAYOUT: TabLayout = { mode: "shelf", sort: "size", positions: {} };

// cells of older layouts, by stored version (none: 90px cells, 2: 90px columns and 30px rows),
// scaled to the current 45px columns and 30px rows
const LAYOUT = {
  version: 3,
  scales: { none: { x: 2, y: 3 }, 2: { x: 2, y: 1 } } as Record<string, Cell>,
};

const storageKey = (tabId: string) => `layout.${tabId}`;

const layouts = new Map<string, Signal<TabLayout>>();

function scaledPositions(positions: Record<string, Cell>, version: number | undefined) {
  const scale = version === LAYOUT.version ? { x: 1, y: 1 } : LAYOUT.scales[version ?? "none"];
  return Object.fromEntries(
    Object.entries(positions).map(([id, cell]) => [id, { x: cell.x * scale.x, y: cell.y * scale.y }]),
  );
}

function load(tabId: string): TabLayout {
  try {
    const stored = JSON.parse(
      localStorage.getItem(storageKey(tabId)) ?? "null",
    ) as (Partial<TabLayout> & { version?: number }) | null;
    return {
      mode: (LAYOUT_MODES as readonly unknown[]).includes(stored?.mode)
        ? stored!.mode!
        : DEFAULT_LAYOUT.mode,
      sort: (LAYOUT_SORTS as readonly unknown[]).includes(stored?.sort)
        ? stored!.sort!
        : DEFAULT_LAYOUT.sort,
      positions:
        stored?.positions && typeof stored.positions === "object"
          ? scaledPositions(stored.positions, stored.version)
          : {},
    };
  } catch {
    return { ...DEFAULT_LAYOUT };
  }
}

// written directly instead of through an effect, layouts are created lazily outside any root
export function tabLayout(tabId: string) {
  let entry = layouts.get(tabId);
  if (!entry) {
    entry = createSignal(load(tabId));
    layouts.set(tabId, entry);
  }
  const [layout, setLayout] = entry;

  const update = (patch: Partial<TabLayout>) => {
    const next = { ...layout(), ...patch };
    setLayout(next);
    localStorage.setItem(storageKey(tabId), JSON.stringify({ ...next, version: LAYOUT.version }));
  };

  return { layout, update };
}
