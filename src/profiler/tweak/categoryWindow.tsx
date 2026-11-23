import { For, Show, createSignal } from "solid-js";
import { useLocalStorage } from "../hooks/useLocalStorage";
import Dropdown, { DROPDOWN_ITEM } from "../blocks/dropdown";
import { PanelBody } from "./modal";
import { HEADER_BUTTON } from "./section";
import { tweakStore } from "./store";

const WINDOW = {
  minWidth: 420,
  defaultWidth: 560,
};

function CategoryView(props: { category: string }) {
  const info = () => tweakStore.category(props.category);
  const [storedWidth, storeWidth] = useLocalStorage("tweak:category:width", WINDOW.defaultWidth);
  // dragged locally, stored once on release instead of on every pointer move
  const [dragWidth, setDragWidth] = createSignal<number | null>(null);
  const width = () => dragWidth() ?? storedWidth();
  const [full, setFull] = useLocalStorage("tweak:category:full", false);

  const startResize = (event: PointerEvent) => {
    const handle = event.currentTarget as HTMLElement;
    handle.setPointerCapture(event.pointerId);
    const move = (moveEvent: PointerEvent) =>
      setDragWidth(
        Math.min(
          window.innerWidth,
          Math.max(WINDOW.minWidth, window.innerWidth - moveEvent.clientX),
        ),
      );
    const stop = () => {
      const dragged = dragWidth();
      if (dragged !== null) storeWidth(dragged);
      setDragWidth(null);
      handle.removeEventListener("pointermove", move);
      handle.removeEventListener("pointerup", stop);
      handle.removeEventListener("pointercancel", stop);
    };
    handle.addEventListener("pointermove", move);
    handle.addEventListener("pointerup", stop);
    handle.addEventListener("pointercancel", stop);
  };

  return (
    <aside
      class="absolute bottom-0 right-0 top-titlebar flex max-w-full flex-col border-l border-outline bg-panel shadow-lg"
      style={{ width: full() ? "100%" : `${width()}px` }}
    >
      <Show when={!full()}>
        <div
          class="absolute -left-1 bottom-0 top-0 z-10 w-2 cursor-col-resize"
          onPointerDown={startResize}
        />
      </Show>
      <header class="flex items-center gap-2 border-b border-divider px-3 py-1.5">
        <div class="flex min-w-0 flex-1 items-center text-value">
          <Dropdown label={`${info()?.icon ?? ""} ${info()?.title ?? props.category}`} title="Switch category" closeOnClick>
            <For each={tweakStore.categoriesOf(info()?.tab ?? "")}>
              {(category) => (
                <button
                  type="button"
                  class={DROPDOWN_ITEM + " disabled:cursor-default disabled:opacity-40 disabled:hover:bg-transparent"}
                  classList={{ "text-live": category.id === props.category }}
                  disabled={tweakStore.categoryPanels(category.id).length === 0}
                  onClick={() => tweakStore.openCategory(category.id)}
                >
                  <span class="w-4 text-center">{category.icon}</span>
                  {category.title}
                </button>
              )}
            </For>
          </Dropdown>
        </div>
        <button
          class={HEADER_BUTTON}
          title="Every setting of every page"
          onClick={() => tweakStore.requestCategoryExport(props.category, false)}
        >
          Export all
        </button>
        <button
          class={HEADER_BUTTON}
          title="Only settings that differ from the defaults"
          onClick={() => tweakStore.requestCategoryExport(props.category, true)}
        >
          Export all changed
        </button>
        <button
          class={HEADER_BUTTON}
          title={full() ? "Restore width" : "Full window"}
          onClick={() => setFull(!full())}
        >
          {full() ? "❐" : "⛶"}
        </button>
        <button class={HEADER_BUTTON} title="Close" onClick={tweakStore.close}>
          ✕
        </button>
      </header>
      <div class="flex min-h-0 flex-1">
        <nav class="flex w-36 shrink-0 flex-col overflow-y-auto border-r border-divider">
          <For each={tweakStore.categoryPanels(props.category)}>
            {(page) => (
              <button
                class="cursor-pointer truncate px-3 py-1.5 text-left text-body text-fg-dim hover:text-fg data-[active]:bg-divider data-[active]:text-fg"
                data-active={tweakStore.name() === page.name ? "" : undefined}
                onClick={() => tweakStore.openPage(page.name)}
              >
                {page.title}
              </button>
            )}
          </For>
        </nav>
        <div class="flex min-w-0 flex-1 flex-col">
          <Show when={tweakStore.panel()}>
            {(panel) => <PanelBody panel={panel} />}
          </Show>
        </div>
      </div>
    </aside>
  );
}

export default function TweakCategoryWindow() {
  return (
    <Show when={tweakStore.panel()?.category}>
      {(category) => (
        <div class="pointer-events-none fixed inset-0 z-40">
          <div class="pointer-events-auto">
            <CategoryView category={category()} />
          </div>
        </div>
      )}
    </Show>
  );
}
