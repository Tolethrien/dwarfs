import PragmaSystem from "@pragma/system";
import type { Signal } from "@axiom/events";
import { formatAmount, ResourcesID } from "../../content/resources";
import Calendar from "../core/calendar";
import GameEvents from "../core/gameEvents";
import GameUI from "./gameUI";

const INBOX = {
  max: 50,
};

export interface InboxSignals {
  push: Signal<InboxMessage>;
}

export type InboxKind = "info" | "warning" | "important";

export interface InboxAction {
  label: string;
  run: () => void;
}

export interface InboxMessage {
  kind?: InboxKind;
  title: string;
  body?: string;
  action?: InboxAction;
}

export interface InboxEntry {
  id: number;
  day: number;
  hour: number;
  kind: InboxKind;
  title: string;
  body?: string;
  read: boolean;
  action?: InboxAction;
}

export default class Inbox extends PragmaSystem {
  private readonly list: InboxEntry[] = [];
  private nextId = 1;
  private changes = 0;
  declare private calendar: Calendar;
  declare private gameUI: GameUI;

  awake(): void {
    this.calendar = this.scene.getSystem(Calendar);
    this.gameUI = this.scene.getSystem(GameUI);
    const events = this.scene.getSystem(GameEvents);
    this.connect(events.inbox.push, (message) => this.push(message));
    this.connect(events.biomes.discovered, (found) =>
      this.push({ kind: "info", title: `Discovered: ${found.name}` }),
    );
    this.connect(events.tavern.arrived, (arrived) =>
      this.push({ kind: "info", title: `New recruits in the tavern (${arrived.length})` }),
    );
    this.connect(events.headquarters.upgraded, (level) =>
      this.push({ kind: "important", title: `Headquarters raised to level ${level}` }),
    );
    this.connect(events.headquarters.shipped, (sent) =>
      this.push({
        kind: "info",
        title: `Stone shipment: ${formatAmount(ResourcesID.stone, sent.stone)} for ${formatAmount(ResourcesID.beer, sent.beer)} beer`,
      }),
    );
  }

  public get entries(): readonly InboxEntry[] {
    return this.list;
  }

  public get version() {
    return this.changes;
  }

  public get unreadCount() {
    let unread = 0;
    for (const entry of this.list) if (!entry.read) unread++;
    return unread;
  }

  public push(message: InboxMessage) {
    const kind = message.kind ?? "info";
    const open = this.gameUI.isOpen("inbox");
    this.list.unshift({
      id: this.nextId++,
      day: this.calendar.day,
      hour: this.calendar.hour,
      kind: kind,
      title: message.title,
      body: message.body,
      read: open,
      action: message.action,
    });
    if (this.list.length > INBOX.max) this.list.length = INBOX.max;
    this.changes++;
    if (!open && kind !== "info") this.gameUI.hop("panel:inbox");
  }

  public markAllRead() {
    let changed = false;
    for (const entry of this.list) {
      if (entry.read) continue;
      entry.read = true;
      changed = true;
    }
    if (changed) this.changes++;
  }

  public clear() {
    if (this.list.length === 0) return;
    this.list.length = 0;
    this.changes++;
  }
}
