import Navi from "@navi/navi";
import UINode from "@navi/node";
import { auto, pw } from "@navi/units";
import { UI_THEME } from "../../content/ui";
import type { PanelDef } from "../../systems/ui/gameUI";
import type Inbox from "../../systems/ui/inbox";
import type { InboxEntry, InboxKind } from "../../systems/ui/inbox";
import { button } from "../elements/button";
import { paragraph } from "../elements/paragraph";
import { row } from "../elements/row";
import { scrollList } from "../elements/scrollList";
import { tabs, type TabItem } from "../elements/tabs";
import { text } from "../elements/text";

const INBOX_UI = {
  width: 420,
  listHeight: 340,
  stripeWidth: 3,
  cardPadding: { top: 6, right: 8, bottom: 6, left: 10 },
};

type InboxTab = "all" | "warnings";

const TABS: TabItem<InboxTab>[] = [
  { id: "all", title: "All" },
  { id: "warnings", title: "Warnings" },
];

function kindColor(kind: InboxKind) {
  if (kind === "warning") return UI_THEME.colors.lacking;
  if (kind === "important") return UI_THEME.colors.gain;
  return UI_THEME.colors.text;
}

function formatStamp(entry: InboxEntry) {
  const hour = String(entry.hour).padStart(2, "0");
  return `D${entry.day} ${hour}:00`;
}

export function inboxPanel(inbox: Inbox): PanelDef {
  let tab: InboxTab = "all";
  let list: UINode | undefined;
  let shownVersion = -1;

  function renderEntries() {
    if (!list) return;
    shownVersion = inbox.version;
    Navi.clear(list);
    const items = tab === "warnings" ? inbox.entries.filter((entry) => entry.kind === "warning") : inbox.entries;
    if (items.length === 0) {
      text(list, tab === "warnings" ? "No warnings" : "No messages yet", { color: UI_THEME.colors.muted });
      return;
    }
    for (const entry of items) addEntry(list, entry);
  }

  return {
    id: "inbox",
    title: "Inbox",
    label: "Inbox",
    bar: "bottomRight",
    width: INBOX_UI.width,
    badge: () => inbox.unreadCount,
    onClose() {
      list = undefined;
      shownVersion = -1;
    },
    build(content) {
      inbox.markAllRead();
      tabs(content, TABS, () => tab, (picked) => {
        tab = picked;
        renderEntries();
      });
      const top = row(content, { fit: true });
      button(top, "Clear", () => inbox.clear());
      const padding = UI_THEME.panel.window.padding;
      const listWidth = INBOX_UI.width - padding.left - padding.right;
      list = scrollList(content, { width: listWidth, height: INBOX_UI.listHeight, autoScroll: true });
      renderEntries();
    },
    update() {
      if (shownVersion !== inbox.version) renderEntries();
    },
  };
}

function addEntry(parent: UINode, entry: InboxEntry) {
  const color = kindColor(entry.kind);
  const card = Navi.append(
    new UINode({
      size: { width: pw(100), height: auto() },
      style: {
        backgroundColor: UI_THEME.colors.row,
        padding: INBOX_UI.cardPadding,
        shadow: { color: color, offset: { x: INBOX_UI.stripeWidth, y: 0 }, inset: true },
        layout: "stack",
        direction: "col",
        alignCross: "stretch",
        gap: UI_THEME.spacing.listGap,
      },
    }),
    parent,
  );
  const head = row(card, { align: "between" });
  text(head, entry.title, { color: color });
  text(head, formatStamp(entry), { color: UI_THEME.colors.muted });
  if (entry.body) paragraph(card, entry.body, { color: UI_THEME.colors.muted });
  if (entry.action) button(card, entry.action.label, entry.action.run);
}
