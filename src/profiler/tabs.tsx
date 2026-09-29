import { For, Show, type Component } from "solid-js";
import { Dynamic } from "solid-js/web";
import { useLocalStorage } from "./hooks/useLocalStorage";
import ConsoleTab from "./tabs/console";
import Grid from "./grid/grid";
import { watchPanelId, type PanelId } from "./panels/registry";
import { watchStore } from "./watch/store";
import CustomTab from "./tabs/custom";
import OptionsMenu from "./components/optionsMenu";
import { tweakStore } from "./tweak/store";
import { tabVisibility } from "./tabVisibility";

export type TabId = "custom" | "console" | "watch" | "aurora" | "coroutines";

interface TabDefinition {
  label: string;
  component?: Component;
  panels?: PanelId[] | (() => PanelId[]);
  empty?: string;
  actions?: Component;
}

function GroupButton(props: { group: string; label: string }) {
  return (
    <button
      class="cursor-pointer rounded border border-divider px-2 py-0.5 text-fg-dim not-disabled:hover:text-fg disabled:cursor-default disabled:opacity-40"
      disabled={tweakStore.groupPanels(props.group).length === 0}
      onClick={() => tweakStore.openGroup(props.group)}
    >
      {props.label}
    </button>
  );
}

function AuroraActions() {
  return (
    <div class="flex gap-1">
      <GroupButton group="aurora" label="⚙ Settings" />
      <GroupButton group="camera" label="🎥 Camera" />
    </div>
  );
}

export const TABS: Record<TabId, TabDefinition> = {
  custom: { label: "Custom", component: CustomTab },
  console: { label: "Console", component: ConsoleTab },
  watch: {
    label: "Watch",
    panels: () => watchStore.names().map(watchPanelId),
    empty: "no watches, register one with debug.watch.add(...)",
  },
  aurora: {
    label: "Aurora",
    actions: AuroraActions,
    panels: [
      "auroraFrame",
      "auroraGpuTimings",
      "auroraTimeline",
      "auroraDraw",
      "auroraResources",
      "auroraVram",
      "auroraConfig",
      "auroraPreset",
    ],
  },
  coroutines: {
    label: "Coroutines",
    panels: ["coroutinesRunning", "coroutinesFinished"],
  },
};

const TAB_IDS = Object.keys(TABS) as TabId[];

const [storedTab, setActiveTab] = useLocalStorage<string>(
  "activeTab",
  TAB_IDS[0],
);

const visibleTabIds = () => TAB_IDS.filter((id) => !tabVisibility.isHidden(id));

// a hidden stored tab falls back to the first visible one
export const activeTab = (): TabId => {
  const visible = visibleTabIds();
  const stored = storedTab() as TabId;
  if (visible.includes(stored)) return stored;
  return visible[0] ?? TAB_IDS[0];
};

export { setActiveTab };

export function TabBar() {
  return (
    <nav class="flex shrink-0 border-b border-outline bg-titlebar">
      <For each={visibleTabIds()}>
        {(id) => (
          <button
            class="cursor-pointer border-b-2 border-transparent px-3 py-1.5 text-body text-fg-dim hover:text-fg data-[active]:border-live data-[active]:text-fg"
            data-active={activeTab() === id ? "" : undefined}
            onClick={() => setActiveTab(id)}
          >
            {TABS[id].label}
          </button>
        )}
      </For>
      <OptionsMenu tabs={TAB_IDS.map((id) => ({ id, label: TABS[id].label }))} />
    </nav>
  );
}

export function TabContent() {
  const tab = () => TABS[activeTab()];
  return (
    <Show
      when={tab().component}
      fallback={
        <Grid
          tabId={activeTab()}
          panels={
            typeof tab().panels === "function"
              ? (tab().panels as () => PanelId[])()
              : ((tab().panels as PanelId[] | undefined) ?? [])
          }
          empty={tab().empty}
          actions={tab().actions}
        />
      }
    >
      {(component) => <Dynamic component={component()} />}
    </Show>
  );
}
