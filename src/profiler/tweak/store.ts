import { createSignal } from "solid-js";
import type {
  TweakCategoryInfo,
  TweakMessage,
  TweakPanelInfo,
  TweakValues,
} from "@/core/debugger/modules/tweak/report";
import { isValueControl } from "@/core/debugger/modules/tweak/controls";

interface OpenPanel {
  name: string;
  values: TweakValues;
}

const [categories, setCategories] = createSignal<TweakCategoryInfo[]>([]);
const [registry, setRegistry] = createSignal<TweakPanelInfo[]>([]);
const [opened, setOpened] = createSignal<OpenPanel | null>(null);
const [exported, setExported] = createSignal<string | null>(null);
const [presets, setPresets] = createSignal<Record<string, TweakValues>>({});

function presetsKey(panelName: string) {
  return `tweak:presets:${panelName}`;
}

function loadPresets(panelName: string) {
  try {
    const stored = localStorage.getItem(presetsKey(panelName));
    setPresets(stored ? JSON.parse(stored) : {});
  } catch {
    setPresets({});
  }
}

function storePresets(panelName: string, next: Record<string, TweakValues>) {
  setPresets(next);
  localStorage.setItem(presetsKey(panelName), JSON.stringify(next));
}

// a field being dragged or typed in keeps its local value until released
const editing = {
  key: null as string | null,
};

const history = {
  ready: false,
  queue: [] as TweakMessage[],
};

type ListItems = Record<string, unknown>[];

function fieldKey(section: number, key: string) {
  return `${section}:${key}`;
}

function itemKey(section: number, index: number, key: string) {
  return `${section}:${index}:${key}`;
}

function itemsOf(record: Record<string, unknown> | undefined): ListItems {
  return (record?.items as ListItems | undefined) ?? [];
}

function openedInfo() {
  const current = opened();
  return registry().find((entry) => entry.name === current?.name);
}

function addPanel(panel: TweakPanelInfo) {
  setRegistry((previous) => [
    ...previous.filter((entry) => entry.name !== panel.name),
    panel,
  ]);
}

function keepEdited(
  incoming: Record<string, unknown>,
  current: Record<string, unknown> | undefined,
  keyOf: (key: string) => string,
) {
  const merged = { ...incoming };
  for (const key of Object.keys(incoming)) {
    if (keyOf(key) === editing.key) merged[key] = current?.[key];
  }
  return merged;
}

function mergeValues(incoming: TweakValues, current: TweakValues) {
  if (editing.key === null) return incoming;
  const info = openedInfo();
  return incoming.map((section, index) => {
    if (info?.sections[index]?.arg !== "list")
      return keepEdited(section, current[index], (key) => fieldKey(index, key));
    const currentItems = itemsOf(current[index]);
    return {
      items: itemsOf(section).map((item, itemIndex) =>
        keepEdited(item, currentItems[itemIndex], (key) => itemKey(index, itemIndex, key)),
      ),
    };
  });
}

function apply(message: TweakMessage) {
  switch (message.type) {
    case "category":
      addCategory(message.category);
      return;
    case "add":
      addPanel(message.panel);
      return;
    case "remove":
      setRegistry((previous) =>
        previous.filter((entry) => entry.name !== message.name),
      );
      if (opened()?.name === message.name) setOpened(null);
      return;
    case "open":
      setExported(null);
      loadPresets(message.name);
      setOpened({ name: message.name, values: message.values });
      return;
    case "values": {
      const current = opened();
      if (!current || current.name !== message.name) return;
      setOpened({
        name: current.name,
        values: mergeValues(message.values, current.values),
      });
      return;
    }
    case "export": {
      const current = opened();
      if (!current) return;
      const category = registry().find((entry) => entry.name === current.name)?.category;
      if (current.name === message.name || category === message.name) setExported(message.text);
      return;
    }
  }
}

function addCategory(category: TweakCategoryInfo) {
  setCategories((previous) =>
    previous.some((entry) => entry.id === category.id)
      ? previous.map((entry) => (entry.id === category.id ? category : entry))
      : [...previous, category],
  );
}

function categoryPanels(category: string) {
  return registry()
    .filter((entry) => entry.category === category)
    .sort((a, b) => a.order - b.order);
}

function openPage(name: string) {
  window.API.DEBUG.sendTweakInput({ type: "open", name });
}

// the game remembers the last page, so the button and aurora.config() open the same one
function openCategory(category: string) {
  if (categoryPanels(category).length > 0)
    window.API.DEBUG.sendTweakInput({ type: "openCategory", category });
}

function requestCategoryExport(category: string, onlyChanged: boolean) {
  window.API.DEBUG.sendTweakInput({ type: "exportCategory", category, onlyChanged });
}

// apply "release": the value changes only here until commitValue sends it
const staged = {
  key: null as string | null,
};

function stageValue(section: number, key: string, value: unknown) {
  staged.key = fieldKey(section, key);
  setValue(section, key, value, false);
}

function commitValue(section: number, key: string) {
  if (staged.key !== fieldKey(section, key)) return;
  staged.key = null;
  const value = opened()?.values[section]?.[key];
  if (value !== undefined) setValue(section, key, value);
}

function setValue(section: number, key: string, value: unknown, send = true) {
  const current = opened();
  if (!current) return;
  const values = current.values.map((record, index) =>
    index === section ? { ...record, [key]: value } : record,
  );
  setOpened({ name: current.name, values });
  if (!send) return;
  window.API.DEBUG.sendTweakInput({
    type: "set",
    name: current.name,
    section,
    key,
    value,
  });
}

function stageItemValue(section: number, index: number, key: string, value: unknown) {
  staged.key = itemKey(section, index, key);
  setItemValue(section, index, key, value, false);
}

function commitItemValue(section: number, index: number, key: string) {
  if (staged.key !== itemKey(section, index, key)) return;
  staged.key = null;
  const value = itemsOf(opened()?.values[section])[index]?.[key];
  if (value !== undefined) setItemValue(section, index, key, value);
}

function setItemValue(
  section: number,
  index: number,
  key: string,
  value: unknown,
  send = true,
) {
  const current = opened();
  if (!current) return;
  const values = current.values.map((record, sectionIndex) =>
    sectionIndex === section
      ? {
          items: itemsOf(record).map((item, itemIndex) =>
            itemIndex === index ? { ...item, [key]: value } : item,
          ),
        }
      : record,
  );
  setOpened({ name: current.name, values });
  if (!send) return;
  window.API.DEBUG.sendTweakInput({
    type: "listSet",
    name: current.name,
    section,
    index,
    key,
    value,
  });
}

// no local change: the game answers with the new list and its item fields
const list = {
  add(section: number) {
    const current = opened();
    if (current) window.API.DEBUG.sendTweakInput({ type: "listAdd", name: current.name, section });
  },
  remove(section: number, index: number) {
    const current = opened();
    if (current)
      window.API.DEBUG.sendTweakInput({ type: "listRemove", name: current.name, section, index });
  },
  move(section: number, from: number, to: number) {
    const current = opened();
    if (current)
      window.API.DEBUG.sendTweakInput({ type: "listMove", name: current.name, section, from, to });
  },
  resetField(section: number, index: number, key: string) {
    const current = opened();
    if (current)
      window.API.DEBUG.sendTweakInput({
        type: "listReset",
        name: current.name,
        section,
        index,
        key,
      });
  },
};

function close() {
  const current = opened();
  if (!current) return;
  setOpened(null);
  setExported(null);
  editing.key = null;
  window.API.DEBUG.sendTweakInput({ type: "close", name: current.name });
}

function savePreset(presetName: string) {
  const current = opened();
  const trimmed = presetName.trim();
  if (!current || trimmed === "") return;
  storePresets(current.name, {
    ...presets(),
    [trimmed]: structuredClone(current.values),
  });
}

function loadPreset(presetName: string) {
  const current = opened();
  const preset = presets()[presetName];
  if (!current || !preset) return;
  const info = openedInfo();
  preset.forEach((record, section) => {
    const sectionInfo = info?.sections[section];
    if (sectionInfo?.arg === "list") {
      if (Array.isArray(record.items))
        window.API.DEBUG.sendTweakInput({
          type: "listReplace",
          name: current.name,
          section,
          items: structuredClone(record.items),
        });
      return;
    }
    const infoKeys = sectionInfo?.fields
      .filter((field) => !isValueControl(field.control))
      .map((field) => field.key);
    for (const [key, value] of Object.entries(record)) {
      if (infoKeys?.includes(key)) continue;
      if (key in (current.values[section] ?? {})) setValue(section, key, value);
    }
  });
}

function deletePreset(presetName: string) {
  const current = opened();
  if (!current) return;
  const { [presetName]: _removed, ...rest } = presets();
  storePresets(current.name, rest);
}

function resetField(section: number, key: string) {
  const current = opened();
  if (current)
    window.API.DEBUG.sendTweakInput({ type: "reset", name: current.name, section, key });
}

function revert() {
  const current = opened();
  if (current) window.API.DEBUG.sendTweakInput({ type: "revert", name: current.name });
}

function run(section: number) {
  const current = opened();
  if (current) window.API.DEBUG.sendTweakInput({ type: "run", name: current.name, section });
}

function requestExport(onlyChanged: boolean) {
  const current = opened();
  if (current)
    window.API.DEBUG.sendTweakInput({ type: "export", name: current.name, onlyChanged });
}

window.API.DEBUG.onTweak((message) => {
  if (history.ready) apply(message);
  else history.queue.push(message);
});

window.API.DEBUG.getTweakRegistry().then((stored) => {
  stored.categories.forEach(addCategory);
  stored.panels.forEach(addPanel);
  history.queue.forEach(apply);
  history.queue.length = 0;
  history.ready = true;
});

// one listener for the modal and the category window, whichever is showing the opened panel
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && opened() !== null) close();
});

// the reloaded game registers its categories and panels again, one it no longer has must not stay
window.API.DEBUG.onGameReloaded(() => {
  setCategories([]);
  setRegistry([]);
  setOpened(null);
  setExported(null);
  editing.key = null;
});

export const tweakStore = {
  panel: () => {
    const current = opened();
    if (!current) return null;
    return registry().find((entry) => entry.name === current.name) ?? null;
  },
  name: () => opened()?.name ?? null,
  values: () => opened()?.values ?? [],
  exported,
  hideExport: () => setExported(null),
  items: (section: number) => itemsOf(opened()?.values[section]),
  beginEdit: (section: number, key: string) => {
    editing.key = fieldKey(section, key);
  },
  beginItemEdit: (section: number, index: number, key: string) => {
    editing.key = itemKey(section, index, key);
  },
  endEdit: () => {
    editing.key = null;
  },
  setValue,
  stageValue,
  commitValue,
  setItemValue,
  stageItemValue,
  commitItemValue,
  resetField,
  list,
  presetNames: () => Object.keys(presets()),
  savePreset,
  loadPreset,
  deletePreset,
  close,
  revert,
  requestExport,
  run,
  categoriesOf: (tab: string) => categories().filter((category) => category.tab === tab),
  category: (id: string) => categories().find((category) => category.id === id),
  categoryPanels,
  openPage,
  openCategory,
  requestCategoryExport,
};
