import { Show, onCleanup, onMount } from "solid-js";
import { Dynamic } from "solid-js/web";
import {
  panelDefinition,
  panelTitle,
  type PanelDefinition,
  type PanelId,
} from "../panels/registry";
import PinMenu from "./pinMenu";
import { gridArea, type Area, type Cell } from "./layouts";
import { PanelFit } from "./layout";

export default function Panel(props: {
  id: PanelId;
  area: Area;
  draggable: boolean;
  dragOffset?: Cell;
  onGrab: (event: PointerEvent) => void;
  // fit panels only: the size in pixels the whole panel needs for its content, width unwrapped
  onMeasure?: (size: Size2D) => void;
}) {
  const definition = (): PanelDefinition => panelDefinition(props.id);
  const live = () => definition().live?.() ?? true;
  const fit = definition().fit === true;
  let section!: HTMLElement;
  let content!: HTMLDivElement;
  let inner!: HTMLDivElement;

  // header, borders and padding: everything of the section that is not the content itself
  function measure() {
    const style = getComputedStyle(content);
    const chrome = {
      width: section.offsetWidth - content.clientWidth + parseFloat(style.paddingLeft) + parseFloat(style.paddingRight),
      height: section.offsetHeight - content.clientHeight + parseFloat(style.paddingTop) + parseFloat(style.paddingBottom),
    };
    // the width the content takes with nothing wrapped or squeezed, read without a frame in between
    inner.style.width = "max-content";
    const width = inner.offsetWidth;
    inner.style.width = "";
    props.onMeasure?.({ width: chrome.width + width, height: chrome.height + inner.offsetHeight });
  }

  onMount(() => {
    if (!fit) return;
    const resize = new ResizeObserver(measure);
    resize.observe(inner);
    // a longer cell inside a squeezed table changes neither size of the content box
    const mutation = new MutationObserver(measure);
    mutation.observe(inner, { subtree: true, childList: true, characterData: true });
    onCleanup(() => {
      resize.disconnect();
      mutation.disconnect();
    });
  });

  return (
    <section
      ref={section}
      class="@container flex flex-col overflow-hidden rounded-panel border border-outline bg-panel"
      classList={{ "z-10 opacity-60 shadow-lg": !!props.dragOffset }}
      style={{
        ...gridArea(props.area),
        transform: props.dragOffset
          ? `translate(${props.dragOffset.x}px, ${props.dragOffset.y}px)`
          : undefined,
      }}
    >
      <header
        class="flex h-panel-head shrink-0 items-center gap-2 border-b border-divider px-2"
        classList={{
          "touch-none select-none": props.draggable,
          "cursor-grab": props.draggable && !props.dragOffset,
          "cursor-grabbing": !!props.dragOffset,
        }}
        onPointerDown={(event) => props.draggable && props.onGrab(event)}
      >
        <span class="min-w-0 truncate text-caption uppercase tracking-[0.1em] text-fg-dim">
          {panelTitle(definition())}
        </span>
        <div class="ml-auto flex items-center">
          <PinMenu id={props.id} />
        </div>
      </header>

      <div
        ref={content}
        class="min-h-0 flex-1 p-2 text-body"
        classList={{ "overflow-auto": fit, "overflow-hidden": !fit }}
      >
        <div ref={inner} classList={{ "h-full": !fit }}>
          <PanelFit.Provider value={fit}>
            <Show
              when={live()}
              fallback={<span class="italic text-fg-dim">waiting for game</span>}
            >
              <Dynamic component={definition().component} />
            </Show>
          </PanelFit.Provider>
        </div>
      </div>
    </section>
  );
}
