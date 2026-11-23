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
import Dropdown, { DROPDOWN_ITEM } from "./blocks/dropdown";

export type TabId = "custom" | "console" | "watch" | "game" | "aurora" | "coroutines";

interface TabDefinition {
  label: string;
  component?: Component;
  panels?: PanelId[] | (() => PanelId[]);
  empty?: string;
}

function CategoryMenu() {
  const categories = () => tweakStore.categoriesOf(activeTab());
  const isOpen = (id: string) => tweakStore.panel()?.category === id;
  return (
    <Show when={categories().length > 0}>
      <span class="uppercase tracking-[0.1em] text-fg-dim">Tweak</span>
      <Dropdown
        label="☰ Categories"
        align="right"
        closeOnClick
        highlighted={categories().some((category) => isOpen(category.id))}
      >
        <For each={categories()}>
          {(category) => {
            const empty = () => tweakStore.categoryPanels(category.id).length === 0;
            return (
              <button
                type="button"
                class={DROPDOWN_ITEM + " disabled:cursor-default disabled:opacity-40 disabled:hover:bg-transparent"}
                classList={{ "text-live": isOpen(category.id) }}
                disabled={empty()}
                title={empty() ? "no pages yet" : undefined}
                onClick={() => tweakStore.openCategory(category.id)}
              >
                <span class="w-4 text-center">{category.icon}</span>
                {category.title}
              </button>
            );
          }}
        </For>
      </Dropdown>
    </Show>
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
  game: {
    label: "Game",
    panels: [
      "gameDwarfs",
      "gameNetwork",
      "gameCamp",
      "gameStored",
      "gameEvents",
      "gameMarket",
      "gameSmelter",
      "gameCosts",
      "gameWorkforce",
      "gameBuffs",
      "gamePlayer",
    ],
  },
  aurora: {
    label: "Aurora",
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
          actions={CategoryMenu}
        />
      }
    >
      {(component) => <Dynamic component={component()} />}
    </Show>
  );
}
