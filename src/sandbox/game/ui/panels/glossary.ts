import Navi from "@navi/navi";
import UINode from "@navi/node";
import { pw } from "@navi/units";
import { BlocksID } from "../../content/blocks";
import {
  GLOSSARY_BY_ID,
  GLOSSARY_CATEGORIES,
  GLOSSARY_SUBCATEGORIES,
  type GlossaryCategoryID,
  type GlossaryEntryData,
  type GlossarySubcategoryID,
} from "../../content/glossary";
import { UI_THEME } from "../../content/ui";
import type Glossary from "../../systems/core/glossary";
import type PlayerStats from "../../systems/core/playerStats";
import type { PanelDef } from "../../systems/ui/gameUI";
import { button } from "../elements/button";
import { collapsible } from "../elements/collapsible";
import { divider } from "../elements/divider";
import { paragraph } from "../elements/paragraph";
import { row } from "../elements/row";
import { scrollList } from "../elements/scrollList";
import { tabs, type TabItem } from "../elements/tabs";
import { text } from "../elements/text";

const GLOSSARY_UI = {
  width: 680,
  height: 380,
  listWidth: 230,
  stripeWidth: 3,
};

type GlossaryTab = GlossaryCategoryID | "stats";

function formatBlockName(type: BlocksID) {
  const raw = BlocksID[type] ?? String(type);
  return raw.charAt(0).toUpperCase() + raw.slice(1);
}

export function glossaryPanel(glossary: Glossary, stats: PlayerStats): PanelDef {
  let tab: GlossaryTab = "mine";
  let selectedId: string | undefined;
  let tabBarHost: UINode | undefined;
  let bodyHost: UINode | undefined;
  let detailList: UINode | undefined;
  let shownVersion = -1;
  let shownMined = -1;
  let shownName = "";
  const openSubcategories = new Map<GlossarySubcategoryID, boolean>();

  function isSubOpen(id: GlossarySubcategoryID) {
    return openSubcategories.get(id) ?? true;
  }

  function innerWidth() {
    const padding = UI_THEME.panel.window.padding;
    return GLOSSARY_UI.width - padding.left - padding.right;
  }

  function renderTabs() {
    if (!tabBarHost) return;
    Navi.clear(tabBarHost);
    const items: TabItem<GlossaryTab>[] = GLOSSARY_CATEGORIES.map((category) => {
      const unread = glossary.unreadInCategory(category.id);
      return {
        id: category.id,
        title: unread > 0 ? `${category.title} (${unread})` : category.title,
      };
    });
    items.push({ id: "stats", title: "Stats" });
    tabs(tabBarHost, items, () => tab, (picked) => {
      if (tab === picked) return;
      tab = picked;
      selectedId = undefined;
      renderBody();
    });
  }

  function renderDetail() {
    if (!detailList) return;
    Navi.clear(detailList);
    const entry: GlossaryEntryData | undefined = selectedId ? GLOSSARY_BY_ID[selectedId] : undefined;
    if (!entry || !glossary.isUnlocked(entry.id)) {
      text(detailList, "Select an entry from the list.", { color: UI_THEME.colors.muted });
      return;
    }
    const sub = GLOSSARY_SUBCATEGORIES.find((item) => item.id === entry.subcategory);
    text(detailList, entry.title, { size: UI_THEME.text.title, color: UI_THEME.colors.title });
    if (sub) text(detailList, sub.title, { color: UI_THEME.colors.muted });
    paragraph(detailList, entry.lore);
    if (entry.facts && entry.facts.length > 0) {
      divider(detailList, "Details");
      for (const fact of entry.facts) paragraph(detailList, `• ${fact}`, { color: UI_THEME.colors.muted });
    }
  }

  function selectEntry(id: string) {
    if (!glossary.isUnlocked(id)) return;
    selectedId = id;
    const wasUnread = glossary.isUnread(id);
    if (wasUnread) glossary.markRead(id);
    if (wasUnread) {
      renderAll();
      return;
    }
    renderDetail();
  }

  function renderCategory(category: GlossaryCategoryID) {
    if (!bodyHost) return;
    const layout = row(bodyHost, { align: "start", gap: UI_THEME.spacing.windowGap });
    const list = scrollList(layout, { width: GLOSSARY_UI.listWidth, height: GLOSSARY_UI.height, autoScroll: true });
    const detailWidth = innerWidth() - GLOSSARY_UI.listWidth - UI_THEME.spacing.windowGap;
    detailList = scrollList(layout, { width: detailWidth, height: GLOSSARY_UI.height, autoScroll: true });

    const subcategories = GLOSSARY_SUBCATEGORIES.filter((sub) => sub.category === category);
    for (const sub of subcategories) {
      const unread = glossary.unreadInSubcategory(sub.id);
      const title = unread > 0 ? `${sub.title} (${unread})` : sub.title;
      const box = collapsible(list, title, isSubOpen(sub.id), (open) => openSubcategories.set(sub.id, open));
      for (const entry of glossary.entriesOf(sub.id)) {
        const unlocked = glossary.isUnlocked(entry.id);
        if (!unlocked) {
          const locked = button(box, "???", () => {}, { disabled: true });
          locked.size.width = pw(100);
          continue;
        }
        const isUnread = glossary.isUnread(entry.id);
        const label = isUnread ? `• ${entry.title}` : entry.title;
        const item = button(box, label, () => selectEntry(entry.id), {
          selected: () => selectedId === entry.id,
        });
        item.size.width = pw(100);
        if (isUnread) {
          item.style.shadow = {
            color: UI_THEME.colors.gain,
            offset: { x: GLOSSARY_UI.stripeWidth, y: 0 },
            inset: true,
          };
        }
      }
    }
    renderDetail();
  }

  function renderStats() {
    if (!bodyHost) return;
    detailList = undefined;
    shownMined = stats.minedTotal;
    shownName = stats.name;
    const list = scrollList(bodyHost, { width: innerWidth(), height: GLOSSARY_UI.height, autoScroll: true });
    if (stats.name) statRow(list, "Director", stats.name);
    statRow(list, "Glossary discovered", `${glossary.unlockedCount} / ${glossary.totalCount}`);
    statRow(list, "Total blocks mined", String(stats.minedTotal));
    divider(list, "Mined blocks");
    const mined = [...stats.minedList.entries()].sort((a, b) => b[1] - a[1]);
    if (mined.length === 0) {
      text(list, "No blocks mined yet", { color: UI_THEME.colors.muted });
      return;
    }
    for (const [block, count] of mined) statRow(list, formatBlockName(block), String(count));
  }

  function renderBody() {
    if (!bodyHost) return;
    Navi.clear(bodyHost);
    if (tab === "stats") renderStats();
    else renderCategory(tab);
  }

  function renderAll() {
    shownVersion = glossary.version;
    renderTabs();
    renderBody();
  }

  return {
    id: "glossary",
    title: "Glossary",
    label: "Glossary",
    bar: "top",
    width: GLOSSARY_UI.width,
    badge: () => glossary.unreadCount,
    onClose() {
      tabBarHost = undefined;
      bodyHost = undefined;
      detailList = undefined;
      shownVersion = -1;
      shownMined = -1;
      shownName = "";
    },
    build(content) {
      tabBarHost = row(content, { align: "start" });
      bodyHost = row(content, { align: "start" });
      renderAll();
    },
    update() {
      if (shownVersion !== glossary.version) {
        renderAll();
        return;
      }
      if (tab === "stats" && (shownMined !== stats.minedTotal || shownName !== stats.name)) renderBody();
    },
  };
}

function statRow(parent: UINode, label: string, value: string) {
  const line = row(parent, { align: "between" });
  text(line, label, { color: UI_THEME.colors.muted });
  text(line, value);
}
