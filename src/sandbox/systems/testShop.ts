import PragmaComponent from "@pragma/component";
import Navi from "@navi/navi";
import UINode from "@navi/node";
import UIText from "@navi/elements/text";
import UIScrollBar from "@navi/elements/scrollbar";
import { auto, px } from "@navi/units";
import { Tweens } from "@navi/tween";
import GameResources, { GameResourcesID } from "../managers/resourcesObject";
import { SPRITES } from "../managers/generalData";

type ShopMode = "buy" | "sell";
type ShopCategory = "resources" | "items";

interface ShopEntry {
  id: string;
  name: string;
  crop: Crop;
  price: number;
  owned: number;
  stock: number; // -1 = nieograniczony
}

const QTY_PRESETS = [1, 5, 10];

export default class TestShop extends PragmaComponent {
  private mode: ShopMode = "buy";
  private category: ShopCategory = "resources";
  private gold = 500;
  private qty = 1;
  private message = "";
  private selected: ShopEntry | undefined;
  private actions: Map<UINode, () => void> = new Map();

  private resourceStock: ShopEntry[] = [];
  private itemStock: ShopEntry[] = [];

  private grid!: UINode;
  private viewport!: UINode;
  private modeButtons: Record<ShopMode, UINode> = {} as Record<
    ShopMode,
    UINode
  >;
  private categoryButtons: Record<ShopCategory, UINode> = {} as Record<
    ShopCategory,
    UINode
  >;
  private qtyButtons: UINode[] = [];
  private detailAction!: UINode;

  constructor(internal: InternalPCProps) {
    super(internal);
  }

  awake(): void {
    this.seedStock();
    this.buildWindow();
    this.populateGrid();
  }

  update(): void {
    const clicked = Navi.getClicked;
    if (!clicked) return;
    this.actions.get(clicked)?.();
  }

  //=============================== dane zaślepkowe

  private seedStock() {
    let i = 0;
    for (const id of Object.values(GameResourcesID)) {
      if (typeof id !== "number" || id === GameResourcesID.none) continue;
      const data = GameResources.resources[id as GameResourcesID];
      this.resourceStock.push({
        id: `res-${id}`,
        name: data.name,
        crop: data.crop,
        price: 8 + ((i * 7) % 40),
        owned: (i * 3) % 12,
        stock: -1,
      });
      i++;
    }

    // brak jeszcze modelu przedmiotów w grze — zaślepka tylko do testu
    const mockItems = [
      "Kilof",
      "Latarnia",
      "Peleryna",
      "Bukłak",
      "Mapa",
      "Lina",
    ];
    mockItems.forEach((name, idx) => {
      this.itemStock.push({
        id: `item-${idx}`,
        name,
        crop: GameResources.resources[GameResourcesID.gold].crop,
        price: 30 + idx * 15,
        owned: idx % 3,
        stock: 5,
      });
    });
  }

  private get activeList() {
    const list =
      this.category === "resources" ? this.resourceStock : this.itemStock;
    if (this.mode === "sell") return list.filter((e) => e.owned > 0);
    return list;
  }

  //=============================== okno

  private buildWindow() {
    const window = Navi.append(
      new UINode({
        size: { width: px(900), height: px(600) },
        style: {
          anchorX: "center",
          anchorY: "center",
          backgroundColor: [16, 16, 22, 245],
          rounded: 0.05,
          layout: "stack",
          direction: "col",
          gap: 12,
          padding: { top: 14, right: 14, bottom: 14, left: 14 },
          alignCross: "stretch",
        },
      }),
    );

    this.buildHeader(window);
    this.buildToggles(window);
    this.buildBody(window);
  }

  private buildHeader(parent: UINode) {
    const row = Navi.append(
      new UINode({
        size: { width: auto(), height: auto() },
        style: {
          backgroundColor: [0, 0, 0, 0],
          layout: "stack",
          direction: "row",
          alignMain: "between",
          alignCross: "center",
        },
      }),
      parent,
    );

    Navi.append(
      new UIText(() => "Targowisko", {
        size: { width: auto(), height: auto() },
        style: { textColor: [230, 220, 200, 255], textSize: 22 },
      }),
      row,
    );

    Navi.append(
      new UIText(() => `Złoto: ${this.gold}`, {
        size: { width: auto(), height: auto() },
        style: { textColor: [235, 200, 90, 255], textSize: 16 },
      }),
      row,
    );
  }

  private makeToggle(
    parent: UINode,
    label: string,
    onClick: () => void,
  ): UINode {
    const button = Navi.append(
      new UINode({
        size: { width: auto(), height: auto() },
        input: "absorb",
        style: {
          backgroundColor: [45, 45, 60, 255],
          rounded: 0.2,
          transitionMs: 90,
          layout: "stack",
          alignMain: "center",
          alignCross: "center",
          padding: { top: 8, right: 16, bottom: 8, left: 16 },
        },
        states: { hovered: { backgroundColor: [65, 65, 85, 255] } },
      }),
      parent,
    );

    Navi.append(
      new UIText(() => label, {
        size: { width: auto(), height: auto() },
        inheritState: true,
        style: { textColor: [200, 200, 220, 255], textSize: 13 },
        states: { hovered: { textColor: [255, 255, 255, 255] } },
      }),
      button,
    );

    this.actions.set(button, onClick);
    return button;
  }

  private buildToggles(parent: UINode) {
    const row = Navi.append(
      new UINode({
        size: { width: auto(), height: auto() },
        style: {
          backgroundColor: [0, 0, 0, 0],
          layout: "stack",
          direction: "row",
          gap: 20,
        },
      }),
      parent,
    );

    const modeGroup = Navi.append(
      new UINode({
        size: { width: auto(), height: auto() },
        style: {
          backgroundColor: [0, 0, 0, 0],
          layout: "stack",
          direction: "row",
          gap: 6,
        },
      }),
      row,
    );
    this.modeButtons.buy = this.makeToggle(modeGroup, "Kup", () =>
      this.setMode("buy"),
    );
    this.modeButtons.sell = this.makeToggle(modeGroup, "Sprzedaj", () =>
      this.setMode("sell"),
    );

    const categoryGroup = Navi.append(
      new UINode({
        size: { width: auto(), height: auto() },
        style: {
          backgroundColor: [0, 0, 0, 0],
          layout: "stack",
          direction: "row",
          gap: 6,
        },
      }),
      row,
    );
    this.categoryButtons.resources = this.makeToggle(
      categoryGroup,
      "Zasoby",
      () => this.setCategory("resources"),
    );
    this.categoryButtons.items = this.makeToggle(
      categoryGroup,
      "Przedmioty",
      () => this.setCategory("items"),
    );

    this.paintToggles();
  }

  private setMode(mode: ShopMode) {
    if (this.mode === mode) return;
    this.mode = mode;
    this.qty = 1;
    this.message = "";
    this.paintToggles();
    this.paintQty();
    this.rebuildList();
  }

  private setCategory(category: ShopCategory) {
    if (this.category === category) return;
    this.category = category;
    this.selected = undefined;
    this.message = "";
    this.paintToggles();
    this.rebuildList();
  }

  // NodeStates (hovered/pressed/focused/disabled) to stany sterowane inputem —
  // "aktywny tryb" jest stanem gry, więc kolor przełącznika ustawiamy ręcznie
  private paintToggles() {
    this.modeButtons.buy.style.backgroundColor =
      this.mode === "buy" ? [90, 130, 90, 255] : [45, 45, 60, 255];
    this.modeButtons.sell.style.backgroundColor =
      this.mode === "sell" ? [130, 90, 90, 255] : [45, 45, 60, 255];
    this.categoryButtons.resources.style.backgroundColor =
      this.category === "resources" ? [70, 95, 150, 255] : [45, 45, 60, 255];
    this.categoryButtons.items.style.backgroundColor =
      this.category === "items" ? [70, 95, 150, 255] : [45, 45, 60, 255];
  }

  //=============================== lista + panel szczegółów

  private buildBody(parent: UINode) {
    const row = Navi.append(
      new UINode({
        size: { width: auto(), height: px(420) },
        style: {
          backgroundColor: [0, 0, 0, 0],
          layout: "stack",
          direction: "row",
          gap: 10,
          alignCross: "stretch",
        },
      }),
      parent,
    );

    this.viewport = Navi.append(
      new UINode({
        size: { width: px(580), height: auto() },
        style: {
          overflowY: "scroll",
          backgroundColor: [22, 22, 30, 255],
          padding: { top: 8, right: 8, bottom: 8, left: 8 },
        },
      }),
      row,
    );

    this.grid = Navi.append(
      new UINode({
        size: { width: auto(), height: auto() },
        style: {
          backgroundColor: [0, 0, 0, 0],
          layout: "grid",
          direction: "row",
          gridCount: 7,
          gap: 6,
          gapCross: 6,
        },
      }),
      this.viewport,
    );

    Navi.append(
      new UIScrollBar(this.viewport, "y", {
        size: { width: px(10), height: auto() },
        style: { backgroundColor: [30, 30, 42, 255], rounded: 0.4 },
        thumb: {
          style: { backgroundColor: [140, 140, 160, 255], rounded: 0.4 },
        },
      }),
      row,
    );

    this.buildDetailPanel(row);
  }

  private buildDetailPanel(parent: UINode) {
    const panel = Navi.append(
      new UINode({
        size: { width: px(270), height: auto() },
        style: {
          backgroundColor: [22, 22, 30, 255],
          padding: { top: 10, right: 10, bottom: 10, left: 10 },
          layout: "stack",
          direction: "col",
          gap: 8,
          alignCross: "stretch",
        },
      }),
      parent,
    );

    Navi.append(
      new UINode({
        size: { width: px(72), height: px(72) },
        style: { backgroundColor: [30, 30, 42, 255], alignSelf: "center" },
      }),
      panel,
    );

    Navi.append(
      new UIText(() => this.selected?.name ?? "wybierz towar", {
        size: { width: auto(), height: auto() },
        style: { textColor: [230, 225, 210, 255], textSize: 16 },
      }),
      panel,
    );

    Navi.append(
      new UIText(
        () => (this.selected ? `cena: ${this.unitPrice(this.selected)}` : ""),
        {
          size: { width: auto(), height: auto() },
          style: { textColor: [235, 200, 90, 255], textSize: 13 },
        },
      ),
      panel,
    );

    Navi.append(
      new UIText(
        () => {
          if (!this.selected) return "";
          return this.mode === "buy"
            ? `w magazynie: ${this.selected.stock < 0 ? "∞" : this.selected.stock}`
            : `posiadasz: ${this.selected.owned}`;
        },
        {
          size: { width: auto(), height: auto() },
          style: { textColor: [150, 150, 175, 255], textSize: 12 },
        },
      ),
      panel,
    );

    const qtyRow = Navi.append(
      new UINode({
        size: { width: auto(), height: auto() },
        style: {
          backgroundColor: [0, 0, 0, 0],
          layout: "stack",
          direction: "row",
          gap: 6,
        },
      }),
      panel,
    );
    for (const preset of QTY_PRESETS) {
      this.qtyButtons.push(
        this.makeToggle(qtyRow, `x${preset}`, () => {
          this.qty = preset;
          this.paintQty();
        }),
      );
    }
    this.paintQty();

    this.detailAction = Navi.append(
      new UINode({
        size: { width: auto(), height: auto() },
        input: "absorb",
        style: {
          backgroundColor: [80, 60, 40, 255],
          rounded: 0.2,
          transitionMs: 90,
          layout: "stack",
          alignMain: "center",
          alignCross: "center",
          padding: { top: 10, right: 10, bottom: 10, left: 10 },
        },
        states: {
          hovered: { backgroundColor: [110, 85, 55, 255] },
          pressed: { backgroundColor: [55, 40, 26, 255] },
        },
      }),
      panel,
    );
    Navi.append(
      new UIText(() => (this.mode === "buy" ? "Kup" : "Sprzedaj"), {
        size: { width: auto(), height: auto() },
        inheritState: true,
        style: { textColor: [225, 210, 185, 255], textSize: 14 },
      }),
      this.detailAction,
    );
    this.actions.set(this.detailAction, () => this.trade());

    Navi.append(
      new UIText(() => this.message, {
        size: { width: auto(), height: auto() },
        style: { textColor: [220, 100, 100, 255], textSize: 12 },
      }),
      panel,
    );
  }

  private paintQty() {
    for (let i = 0; i < QTY_PRESETS.length; i++) {
      this.qtyButtons[i].style.backgroundColor =
        QTY_PRESETS[i] === this.qty ? [70, 95, 150, 255] : [45, 45, 60, 255];
    }
  }

  //=============================== lista towarów — animowana wymiana

  private rebuildList() {
    const old = [...this.grid.children];

    if (old.length === 0) {
      this.populateGrid();
      return;
    }

    this.grid.input = "disabled"; // nic nie da się kliknąć w trakcie przejścia

    let remaining = old.length;
    for (const child of old) {
      child.play(
        Tweens.popOut(110, undefined, () => {
          Navi.remove(child, this.grid);
          remaining--;
          if (remaining === 0) this.populateGrid();
        }),
      );
    }
  }

  private populateGrid() {
    this.activeList.forEach((entry, i) => {
      const slot = this.makeSlot(entry);
      slot.motion.scale.x = 0;
      slot.motion.scale.y = 0; // bez tego jedna klatka mignie w pełnym rozmiarze
      slot.play(Tweens.after(i * 18, Tweens.popIn(160)));
    });
    this.grid.input = "normal";
  }

  private makeSlot(entry: ShopEntry): UINode {
    const slot = Navi.append(
      new UINode({
        size: { width: px(58), height: px(58) },
        input: "absorb",
        style: {
          backgroundColor: [45, 45, 60, 255],
          rounded: 0.1,
          transitionMs: 90,
        },
        states: {
          hovered: { backgroundColor: [70, 95, 150, 255] },
          pressed: { backgroundColor: [35, 35, 48, 255] },
        },
      }),
      this.grid,
    );

    Navi.append(
      new UINode({
        position: { x: px(4), y: px(4) },
        size: { width: px(50), height: px(50) },
        style: {
          backgroundImage: SPRITES.icons,
          backgroundImageCrop: entry.crop,
        },
      }),
      slot,
    );

    this.actions.set(slot, () => {
      this.selected = entry;
      this.qty = 1;
      this.message = "";
      this.paintQty();
    });

    return slot;
  }

  //=============================== transakcja

  private unitPrice(entry: ShopEntry) {
    return this.mode === "buy" ? entry.price : Math.floor(entry.price / 2);
  }

  private trade() {
    const entry = this.selected;
    if (!entry) return;

    const total = this.unitPrice(entry) * this.qty;

    if (this.mode === "buy") {
      if (entry.stock >= 0 && entry.stock < this.qty) {
        this.message = "za mało towaru";
        return;
      }
      if (this.gold < total) {
        this.message = "za mało złota";
        return;
      }
      this.gold -= total;
      entry.owned += this.qty;
      if (entry.stock >= 0) entry.stock -= this.qty;
    } else {
      if (entry.owned < this.qty) {
        this.message = "nie masz tyle";
        return;
      }
      entry.owned -= this.qty;
      this.gold += total;
      // w trybie sprzedaży lista pokazuje tylko to co masz — sprzedane do zera znika
      if (entry.owned === 0) this.rebuildList();
    }

    this.message = "";
  }
}
