import PragmaComponent from "@/core/pragma/component";
import Navi from "@/core/navi/navi";
import UINode, { NodeStates } from "@/core/navi/node";
import UIText from "@/core/navi/elements/text";
import UITextBox from "@/core/navi/elements/textbox";
import UIScrollBar from "@/core/navi/elements/scrollbar";
import { auto, ph, pw, px } from "@/core/navi/units";
import SlotNode, { MENU_ITEMS } from "@/core/navi/elements/slot";
import { Tween, Tweens } from "@/core/navi/tween";
import Easing from "@/core/axiom/easing";
import Time from "@/core/engine/time";
import UIInput from "@/core/navi/elements/input";
const LABEL = { textColor: [150, 150, 175, 255] as RGBA, textSize: 12 };
const SLOT_HOVER = {
  hovered: { backgroundColor: [230, 180, 70, 255] as RGBA },
};

export default class TestUI extends PragmaComponent {
  private openSlot: SlotNode | undefined;
  private catcher!: UINode;
  private actions: Map<UINode, () => void> = new Map();
  private pulseTween: Tween | undefined;
  private spawnCount = 0;
  private lastClick = "kliknij slot";
  private bars: UINode[] = [];
  private barFill = 0;
  private barTime = 0;
  constructor(internal: InternalPCProps) {
    super(internal);
  }

  awake(): void {
    // pas górny — stany i przejścia
    this.buildStates(10, 10);
    this.buildTransitions(690, 10);
    this.buildTransform(1020, 10);

    // layout
    this.buildAutoBox(20, 135);
    this.buildMinMax(20, 535);
    this.buildTextBox(20, 300);
    this.buildGrid(20, 705);

    // przewijanie
    this.buildScrollX(1510, 900);
    this.buildScroll2D(1510, 610);
    this.buildScrollY(1510, 20);
    this.buildBarLooks(1510, 340);

    // animacje
    this.buildTweens(470, 130);
    this.buildSpawn(470, 460);

    //bars
    this.buildBars(470, 700);
    this.buildInput(470, 920);
    this.buildCatcher();
  }
  update(): void {
    if (Navi.didScroll) {
      this.closeMenu();
      return;
    }
    if (this.bars.length > 0) {
      this.barTime += Time.getRawDeltaTime();
      this.barFill = (Math.sin(this.barTime * 1.4) + 1) / 2;
      for (const fill of this.bars) fill.motion.scale.x = this.barFill;
    }
    const right = Navi.getRightClicked;
    if (right instanceof SlotNode) {
      this.closeMenu();
      right.openMenu();
      this.catcher.setActive(true);
      this.openSlot = right;
      this.lastClick = `menu na slocie ${right.index}`;
      return;
    }

    const left = Navi.getClicked;
    if (!left) return;
    const action = this.actions.get(left);
    if (action) {
      action();
      return;
    }
    // while the menu is open, any click closes it — on an item it acts first
    if (this.openSlot?.menu) {
      if (left.parent === this.openSlot.menu) {
        this.lastClick = `${MENU_ITEMS[left.indexInParent]} → slot ${this.openSlot.index}`;
        console.log(this.lastClick);
      }
      this.closeMenu();
      return;
    }

    if (left instanceof SlotNode) {
      this.lastClick = left.doubleClicked
        ? `DWUKLIK slot ${left.index}`
        : `klik slot ${left.index}`;
      console.log(this.lastClick);
    }
  }
  private closeMenu() {
    this.openSlot?.closeMenu();
    this.catcher.setActive(false);
    this.openSlot = undefined;
  }

  /** titled container every test hangs itself in */
  private section(title: string, x: number, y: number) {
    const box = Navi.append(
      new UINode({
        position: { x: px(x), y: px(y) },
        size: { width: auto(), height: auto() },
        style: {
          backgroundColor: [10, 10, 16, 220],
          layout: "stack",
          direction: "col",
          gap: 6,
          padding: { top: 6, right: 8, bottom: 8, left: 8 },
          alignCross: "start",
        },
      }),
    );

    Navi.append(
      new UIText(() => title, {
        size: { width: auto(), height: auto() },
        style: LABEL,
      }),
      box,
    );

    return box;
  }

  private stack(parent: UINode, direction: "row" | "col", gap: number) {
    return Navi.append(
      new UINode({
        size: { width: auto(), height: auto() },
        style: {
          backgroundColor: [0, 0, 0, 0],
          layout: "stack",
          direction,
          gap,
        },
      }),
      parent,
    );
  }
  private togglePulse(node: UINode) {
    if (this.pulseTween) {
      node.stopTween(this.pulseTween);
      this.pulseTween = undefined;
      return;
    }
    this.pulseTween = node.play(Tweens.pulse(0.12, 700));
  }

  /** onDone przekazuje pałeczkę dalej — schodkowy start bez pola `delay` */
  private cascade(nodes: UINode[]) {
    for (let i = 0; i < nodes.length; i++) {
      nodes[i].play(Tweens.after(i * 60, Tweens.hop(14, 220)));
    }
  }
  //=============================== stany

  private buildStates(x: number, y: number) {
    const root = this.section(
      "stany: hover / pressed / focus / disabled",
      x,
      y,
    );
    const row = this.stack(root, "row", 8);
    const SIZE = { width: px(120), height: px(40) };

    const full = Navi.append(
      new UINode({
        size: { ...SIZE },
        focusable: true,
        style: { backgroundColor: [70, 70, 95, 255], rounded: 0.3 },
        states: {
          hovered: { backgroundColor: [110, 110, 150, 255] },
          pressed: { backgroundColor: [45, 45, 65, 255] },
          focused: { backgroundColor: [90, 130, 90, 255] },
        },
      }),
      row,
    );

    const hoverOnly = Navi.append(
      new UINode({
        size: { ...SIZE },
        style: { backgroundColor: [95, 70, 70, 255], rounded: 0.3 },
        states: { hovered: { backgroundColor: [150, 110, 110, 255] } },
      }),
      row,
    );

    // the red hover is never reachable — disabled leaves the hit test entirely
    const disabled = Navi.append(
      new UINode({
        size: { ...SIZE },
        input: "disabled",
        focusable: true,
        style: { backgroundColor: [70, 95, 70, 255], rounded: 0.3 },
        states: {
          hovered: { backgroundColor: [255, 0, 0, 255] },
          disabled: { backgroundColor: [45, 48, 45, 255] },
        },
      }),
      row,
    );

    const focusOnly = Navi.append(
      new UINode({
        size: { ...SIZE },
        focusable: true,
        wantsKeys: true,
        style: { backgroundColor: [70, 85, 95, 255], rounded: 0.3 },
        states: { focused: { backgroundColor: [200, 160, 60, 255] } },
      }),

      row,
    );

    const button = Navi.append(
      new UINode({
        size: { width: auto(), height: auto() },
        input: "absorb",
        focusable: true,
        style: {
          backgroundColor: [80, 60, 40, 255],
          rounded: 0.3,
          layout: "stack",
          alignMain: "center",
          alignCross: "center",
          padding: { top: 10, right: 18, bottom: 10, left: 18 },
        },
        states: {
          hovered: { backgroundColor: [125, 95, 55, 255] },
          pressed: { backgroundColor: [55, 40, 26, 255] },
        },
      }),
      row,
    );

    Navi.append(
      new UIText(() => "Kup drewno", {
        size: { width: auto(), height: auto() },
        inheritState: true,
        style: { textColor: [225, 210, 185, 255] },
        states: {
          hovered: { textColor: [255, 245, 225, 255] },
          pressed: { textColor: [160, 145, 125, 255] },
        },
      }),
      button,
    );

    const name = (node: UINode | undefined) => {
      if (node === full) return "1";
      if (node === hoverOnly) return "2";
      if (node === disabled) return "3";
      if (node === focusOnly) return "4";
      if (node === button) return "5";
      return "-";
    };

    Navi.append(
      new UIText(
        () =>
          `hover: ${name(Navi.getHovered)}   focus: ${name(Navi.getFocused)}`,
        { size: { width: auto(), height: auto() }, style: LABEL },
      ),
      root,
    );
  }

  //=============================== auto w wolnym layoucie

  private buildAutoBox(x: number, y: number) {
    const root = this.section("auto obejmuje najdalsze dziecko", x, y);

    const box = Navi.append(
      new UINode({
        size: { width: auto(), height: auto() },
        style: {
          backgroundColor: [40, 40, 60, 255],
          padding: { top: 10, right: 10, bottom: 10, left: 10 },
        },
      }),
      root,
    );

    Navi.append(
      new UINode({
        position: { x: px(0), y: px(0) },
        size: { width: px(40), height: px(40) },
        style: { backgroundColor: [220, 80, 80, 255] },
      }),
      box,
    );

    Navi.append(
      new UINode({
        position: { x: px(160), y: px(60) },
        size: { width: px(40), height: px(40) },
        style: { backgroundColor: [80, 220, 120, 255] },
      }),
      box,
    );
  }

  //=============================== min / max

  private buildMinMax(x: number, y: number) {
    const root = this.section("minSize / maxSize — 200, 150, 192", x, y);

    const panel = Navi.append(
      new UINode({
        size: { width: px(400), height: auto() },
        style: {
          backgroundColor: [30, 30, 40, 255],
          layout: "stack",
          direction: "col",
          gap: 8,
          padding: { top: 8, right: 8, bottom: 8, left: 8 },
          alignCross: "start",
        },
      }),
      root,
    );

    Navi.append(
      new UINode({
        size: { width: px(50), height: px(30) },
        minSize: { width: px(200) },
        style: { backgroundColor: [220, 80, 80, 255] },
      }),
      panel,
    );

    Navi.append(
      new UINode({
        size: { width: px(400), height: px(30) },
        maxSize: { width: px(150) },
        style: { backgroundColor: [80, 220, 120, 255] },
      }),
      panel,
    );

    Navi.append(
      new UINode({
        size: { width: px(384), height: px(30) },
        maxSize: { width: px(192) },
        style: { backgroundColor: [90, 140, 240, 255] },
      }),
      panel,
    );
  }

  //=============================== grid

  private buildGrid(x: number, y: number) {
    const root = this.section("grid — komórka = największe dziecko", x, y);

    const grid = Navi.append(
      new UINode({
        size: { width: auto(), height: auto() },
        style: {
          backgroundColor: [20, 20, 28, 255],
          layout: "grid",
          direction: "row",
          gridCount: 4,
          gap: 6,
          gapCross: 14,
          padding: { top: 8, right: 8, bottom: 8, left: 8 },
          cellAlignX: "stretch",
          cellAlignY: "stretch",
        },
      }),
      root,
    );

    const sizes = [40, 40, 60, 40, 25, 40, 40, 40, 30];
    for (let i = 0; i < sizes.length; i++) {
      const cell = Navi.append(
        new UINode({
          size: { width: auto(), height: auto() },
          style: {
            backgroundColor:
              i % 2 === 0 ? [55, 55, 80, 255] : [80, 55, 55, 255],
            layout: "stack",
            alignMain: "center",
            alignCross: "center",
          },
        }),
        grid,
      );

      Navi.append(
        new UINode({
          size: { width: px(sizes[i]), height: px(sizes[i]) },
          style: { backgroundColor: [225, 175, 70, 255] },
        }),
        cell,
      );
    }
  }

  //=============================== tekst

  private buildTextBox(x: number, y: number) {
    const root = this.section(
      "textBox — zawijanie w poziomie i w pionie",
      x,
      y,
    );
    const row = this.stack(root, "row", 12);

    const paragraph = Navi.append(
      new UINode({
        size: { width: px(280), height: auto() },
        style: {
          backgroundColor: [25, 25, 35, 255],
          padding: { top: 8, right: 8, bottom: 8, left: 8 },
          textAlign: "end",
        },
      }),
      row,
    );

    Navi.append(
      new UITextBox(
        () =>
          "Krasnoludy latają po kopalni jak kulki i rozbijają bloki, a piwo które mają przy sobie wyznacza im czas życia.",
        {
          size: { width: pw(100), height: auto() },
          style: {
            direction: "row",
            textColor: [235, 220, 190, 255],
            textSize: 14,
            lineGap: 4,
          },
        },
      ),
      paragraph,
    );

    const runes = Navi.append(
      new UINode({
        size: { width: auto(), height: px(180) },
        style: {
          backgroundColor: [25, 25, 35, 255],
          padding: { top: 8, right: 8, bottom: 8, left: 8 },
        },
      }),
      row,
    );

    Navi.append(
      new UITextBox(() => "RUNA OGNIA LODU WIATRU", {
        size: { width: auto(), height: ph(100) },
        style: {
          direction: "col",
          textColor: [150, 200, 255, 255],
          textSize: 16,
          lineGap: 2,
        },
      }),
      runes,
    );
  }

  //=============================== scroll w pionie

  private buildScrollY(x: number, y: number) {
    const root = this.section("scroll Y — 50 slotów, kółko i pasek", x, y);
    const window = this.stack(root, "row", 6);
    window.style.alignCross = "stretch";

    const viewport = Navi.append(
      new UINode({
        size: { width: auto(), height: px(240) },
        style: {
          overflowY: "scroll",
          backgroundColor: [18, 18, 26, 255],
          padding: { top: 8, right: 8, bottom: 8, left: 8 },
        },
      }),
      window,
    );

    const grid = Navi.append(
      new UINode({
        size: { width: auto(), height: auto() },
        style: {
          backgroundColor: [0, 0, 0, 0],
          layout: "grid",
          direction: "row",
          gridCount: 5,
          gap: 6,
          gapCross: 6,
        },
      }),
      viewport,
    );

    for (let i = 0; i < 50; i++) {
      const slot = Navi.append(
        new SlotNode(i, {
          size: { width: px(54), height: px(54) },
          style: {
            backgroundColor:
              i % 2 === 0 ? [55, 55, 80, 255] : [75, 55, 55, 255],
            transitionMs: 90,
          },
          states: SLOT_HOVER,
        }),
        grid,
      );
    }

    Navi.append(
      new UIScrollBar(viewport, "y", {
        size: { width: px(12), height: auto() },
        style: { backgroundColor: [30, 30, 42, 255], rounded: 0.4 },
        thumb: {
          style: { backgroundColor: [140, 140, 160, 255], rounded: 0.4 },
          states: { hovered: { backgroundColor: [190, 190, 215, 255] } },
        },
      }),
      window,
    );
    Navi.append(
      new UIText(() => this.lastClick, {
        size: { width: auto(), height: auto() },
        style: { textColor: [220, 220, 235, 255], textSize: 13 },
      }),
      root,
    );
  }

  //=============================== scroll w poziomie

  private buildScrollX(x: number, y: number) {
    const root = this.section("scroll X — kółko bez shifta", x, y);

    const strip = Navi.append(
      new UINode({
        size: { width: px(320), height: auto() },
        style: {
          overflowX: "scroll",
          backgroundColor: [18, 18, 26, 255],
          padding: { top: 8, right: 8, bottom: 8, left: 8 },
          layout: "stack",
          direction: "row",
          gap: 6,
        },
      }),
      root,
    );

    for (let i = 0; i < 20; i++) {
      Navi.append(
        new UINode({
          size: { width: px(70), height: px(70) },
          style: {
            backgroundColor:
              i % 2 === 0 ? [60, 80, 60, 255] : [80, 60, 80, 255],
          },
          states: SLOT_HOVER,
        }),
        strip,
      );
    }

    Navi.append(
      new UIScrollBar(strip, "x", {
        size: { width: px(320), height: px(12) },
        style: { backgroundColor: [30, 30, 42, 255], rounded: 0.4 },
        thumb: {
          style: { backgroundColor: [140, 140, 160, 255], rounded: 0.4 },
        },
      }),
      root,
    );
  }

  //=============================== obie osie naraz

  private buildScroll2D(x: number, y: number) {
    const root = this.section("scroll 2D — shift na oś X", x, y);
    const row = this.stack(root, "row", 6);
    row.style.alignCross = "stretch";

    const viewport = Navi.append(
      new UINode({
        size: { width: px(300), height: px(220) },
        style: {
          overflowX: "scroll",
          overflowY: "scroll",
          backgroundColor: [18, 18, 26, 255],
          padding: { top: 8, right: 8, bottom: 8, left: 8 },
        },
      }),
      row,
    );

    const board = Navi.append(
      new UINode({
        size: { width: auto(), height: auto() },
        style: {
          backgroundColor: [0, 0, 0, 0],
          layout: "grid",
          direction: "row",
          gridCount: 6,
          gap: 6,
          gapCross: 6,
        },
      }),
      viewport,
    );

    for (let i = 0; i < 36; i++) {
      const dark = (Math.floor(i / 6) + (i % 6)) % 2 === 0;
      Navi.append(
        new UINode({
          size: { width: px(70), height: px(70) },
          style: {
            backgroundColor: dark ? [55, 65, 85, 255] : [85, 65, 55, 255],
          },
          states: SLOT_HOVER,
        }),
        board,
      );
    }

    Navi.append(
      new UIScrollBar(viewport, "y", {
        size: { width: px(12), height: auto() },
        style: { backgroundColor: [30, 30, 42, 255], rounded: 0.4 },
        thumb: {
          style: { backgroundColor: [140, 140, 160, 255], rounded: 0.4 },
        },
      }),
      row,
    );

    Navi.append(
      new UIScrollBar(viewport, "x", {
        size: { width: px(300), height: px(12) },
        style: { backgroundColor: [30, 30, 42, 255], rounded: 0.4 },
        thumb: {
          style: { backgroundColor: [140, 140, 160, 255], rounded: 0.4 },
        },
      }),
      root,
    );
  }

  //=============================== wyglądy pasków

  private buildBarLooks(x: number, y: number) {
    const root = this.section("pięć wyglądów, jeden cel", x, y);
    const row = this.stack(root, "row", 12);
    row.style.alignCross = "stretch";

    const viewport = Navi.append(
      new UINode({
        size: { width: px(180), height: px(220) },
        style: {
          overflowY: "scroll",
          backgroundColor: [22, 22, 30, 255],
          padding: { top: 6, right: 6, bottom: 6, left: 6 },
          layout: "stack",
          direction: "col",
          gap: 4,
          alignCross: "stretch",
        },
      }),
      row,
    );

    for (let i = 0; i < 15; i++) {
      Navi.append(
        new UINode({
          size: { width: auto(), height: px(30) },
          style: {
            backgroundColor:
              i % 2 === 0 ? [48, 52, 70, 255] : [62, 48, 52, 255],
          },
        }),
        viewport,
      );
    }

    // 1 — cienki
    Navi.append(
      new UIScrollBar(viewport, "y", {
        size: { width: px(8), height: auto() },
        style: { backgroundColor: [34, 34, 46, 255], rounded: 0.5 },
        thumb: {
          style: { backgroundColor: [130, 130, 150, 255], rounded: 0.5 },
        },
      }),
      row,
    );

    // 2 — gruba szyna z zapasem
    Navi.append(
      new UIScrollBar(viewport, "y", {
        size: { width: px(22), height: auto() },
        style: {
          backgroundColor: [46, 34, 24, 255],
          rounded: 0.35,
          padding: { top: 5, right: 4, bottom: 5, left: 4 },
        },
        thumb: {
          style: { backgroundColor: [190, 140, 70, 255], rounded: 0.35 },
        },
        minThumb: 30,
      }),
      row,
    );

    // 3 — bez szyny
    Navi.append(
      new UIScrollBar(viewport, "y", {
        size: { width: px(10), height: auto() },
        style: { backgroundColor: [0, 0, 0, 0] },
        thumb: {
          style: { backgroundColor: [235, 235, 245, 120], rounded: 0.5 },
        },
      }),
      row,
    );

    // 4 — głęboki rowek
    Navi.append(
      new UIScrollBar(viewport, "y", {
        size: { width: px(20), height: auto() },
        style: {
          backgroundColor: [10, 10, 16, 255],
          rounded: 0.2,
          padding: { top: 10, right: 7, bottom: 10, left: 7 },
        },
        thumb: {
          style: { backgroundColor: [90, 200, 160, 255], rounded: 0.5 },
        },
        minThumb: 26,
      }),
      row,
    );

    // 5 — gałka o stałej długości
    Navi.append(
      new UIScrollBar(viewport, "y", {
        size: { width: px(24), height: auto() },
        style: {
          backgroundColor: [26, 20, 34, 255],
          rounded: 0.15,
          padding: { top: 3, right: 3, bottom: 3, left: 3 },
        },
        thumb: {
          style: { backgroundColor: [210, 90, 130, 255], rounded: 0.5 },
        },
        thumbLength: 24,
      }),
      row,
    );
  }
  private buildTransitions(x: number, y: number) {
    const root = this.section("przejścia — 0 / 120 / 600 ms", x, y);
    const row = this.stack(root, "row", 8);

    const make = (ms: number, label: string) => {
      const button = Navi.append(
        new UINode({
          size: { width: auto(), height: auto() },
          input: "absorb",
          style: {
            backgroundColor: [60, 60, 80, 255],
            rounded: 0.3,
            transitionMs: ms,
            layout: "stack",
            alignMain: "center",
            alignCross: "center",
            padding: { top: 12, right: 20, bottom: 12, left: 20 },
          },
          states: {
            hovered: { backgroundColor: [225, 175, 70, 255] },
            pressed: { backgroundColor: [40, 40, 55, 255], transitionMs: 0 },
          },
        }),
        row,
      );

      Navi.append(
        new UIText(() => label, {
          size: { width: auto(), height: auto() },
          inheritState: true,
          style: { textColor: [200, 200, 220, 255], transitionMs: ms },
          states: { hovered: { textColor: [30, 25, 15, 255] } },
        }),
        button,
      );
    };

    make(0, "0 ms");
    make(120, "120 ms");
    make(600, "600 ms");
  }
  private buildTransform(x: number, y: number) {
    const root = this.section("skala i przesunięcie w stanach", x, y);
    const row = this.stack(root, "row", 10);

    const make = (label: string, states: NodeStates, ms = 160) => {
      const button = Navi.append(
        new UINode({
          size: { width: auto(), height: auto() },
          input: "absorb",
          style: {
            backgroundColor: [Math.random() * 150, 50, 75, 255],
            rounded: 0.1,
            transitionMs: ms,
            layout: "stack",
            alignMain: "center",
            alignCross: "center",
            padding: { top: 14, right: 22, bottom: 14, left: 22 },
          },
          states,
        }),
        row,
      );

      Navi.append(
        new UIText(() => label, {
          size: { width: auto(), height: auto() },
          inheritState: true,
          style: { textColor: [205, 200, 225, 255], transitionMs: ms },
          states: { hovered: { textColor: [35, 28, 12, 255] } },
        }),
        button,
      );
    };

    make("wszystko", {
      hovered: {
        backgroundColor: [235, 190, 80, 255],
        rounded: 0.5,
        scale: { x: 1.18, y: 1.18 },
        nudge: { x: 0, y: -8 },
        zIndex: 1,
      },
      pressed: {
        backgroundColor: [120, 80, 30, 255],
        scale: { x: 0.94, y: 0.94 },
        nudge: { x: 0, y: 3 },
        transitionMs: 60,
      },
    });

    make("rozciąganie X", {
      hovered: {
        backgroundColor: [90, 190, 150, 255],
        scale: { x: 1.6, y: 1 },
        zIndex: 1,
      },
    });

    make("spłaszczenie", {
      hovered: {
        backgroundColor: [200, 120, 160, 255],
        scale: { x: 1.08, y: 1.08 },
      },
      pressed: {
        backgroundColor: [150, 70, 110, 255],
        scale: { x: 1.28, y: 0.68 },
        transitionMs: 70,
      },
    });
  }
  private buildCatcher() {
    this.catcher = Navi.append(
      new UINode({
        style: {
          anchorX: "stretch",
          anchorY: "stretch",
          backgroundColor: [0, 0, 0, 0],
          zIndex: 500,
        },
      }),
    );
    this.catcher.setActive(false);
  }
  private buildTweens(x: number, y: number) {
    const root = this.section("tweeny — kliknij, żeby odpalić", x, y);

    // clip na scenie pokazuje, że wjazd idzie naprawdę zza krawędzi
    const stage = Navi.append(
      new UINode({
        size: { width: px(300), height: px(90) },
        style: {
          backgroundColor: [18, 18, 26, 255],
          overflowX: "clip",
          overflowY: "clip",
          layout: "stack",
          alignMain: "center",
          alignCross: "center",
        },
      }),
      root,
    );

    const puck = Navi.append(
      new UINode({
        size: { width: px(90), height: px(50) },
        style: { backgroundColor: [225, 175, 70, 255], rounded: 0.25 },
      }),
      stage,
    );

    const strip = this.stack(root, "row", 4);
    const pucks: UINode[] = [];
    for (let i = 0; i < 6; i++) {
      pucks.push(
        Navi.append(
          new UINode({
            size: { width: px(26), height: px(26) },
            style: { backgroundColor: [90, 190, 150, 255], rounded: 0.2 },
          }),
          strip,
        ),
      );
    }

    const pad = Navi.append(
      new UINode({
        size: { width: auto(), height: auto() },
        style: {
          backgroundColor: [0, 0, 0, 0],
          layout: "grid",
          direction: "row",
          gridCount: 4,
          gap: 4,
          gapCross: 4,
          cellAlignX: "stretch",
          cellAlignY: "stretch",
        },
      }),
      root,
    );

    const button = (label: string, action: () => void) => {
      const node = Navi.append(
        new UINode({
          size: { width: auto(), height: auto() },
          input: "absorb",
          style: {
            backgroundColor: [55, 55, 75, 255],
            rounded: 0.25,
            transitionMs: 90,
            layout: "stack",
            alignMain: "center",
            alignCross: "center",
            padding: { top: 7, right: 10, bottom: 7, left: 10 },
          },
          states: {
            hovered: { backgroundColor: [95, 95, 130, 255] },
            pressed: { backgroundColor: [40, 40, 55, 255], transitionMs: 0 },
          },
        }),
        pad,
      );

      Navi.append(
        new UIText(() => label, {
          size: { width: auto(), height: auto() },
          inheritState: true,
          style: { textColor: [205, 205, 225, 255], textSize: 12 },
          states: { hovered: { textColor: [255, 255, 255, 255] } },
        }),
        node,
      );

      this.actions.set(node, action);
    };

    button("z lewej", () => puck.play(Tweens.slideIn({ x: -220, y: 0 }, 2100)));
    button("z góry", () => puck.play(Tweens.slideIn({ x: 0, y: -90 }, 2100)));
    button("podskok", () => puck.play(Tweens.hop(18, 300)));
    button("trzęsienie", () => puck.play(Tweens.shake(10, 4, 380)));

    button("trzęsienie Y", () => puck.play(Tweens.shakeY(8, 4, 380)));
    button("pop in", () => puck.play(Tweens.popIn(220)));
    // onDone jest tu obowiązkowe: popOut kończy na skali zero, więc bez
    // następnego tweena krążek zostałby niewidzialny na zawsze
    button("znika i wraca", () =>
      puck.play(
        Tweens.popOut(140, undefined, () => puck.play(Tweens.popIn(240))),
      ),
    );
    button("puls", () => this.togglePulse(puck));

    // trzy naraz: skale się mnożą, przesunięcia dodają
    button("wszystko naraz", () => {
      puck.play(Tweens.slideIn({ x: -220, y: 0 }, 420));
      puck.play(Tweens.shakeY(6, 6, 420));
      puck.play(Tweens.popIn(420));
    });
    button("kaskada", () => this.cascade(pucks));
    button("stop", () => {
      puck.stopAllTweens();
      this.pulseTween = undefined;
    });

    Navi.append(
      new UIText(() => (puck.isTweening ? "tween leci" : "spoczynek"), {
        size: { width: auto(), height: auto() },
        style: LABEL,
      }),
      root,
    );
  }
  private spawnFlyer(stage: UINode) {
    const colors: RGBA[] = [
      [235, 190, 80, 255],
      [90, 190, 150, 255],
      [210, 90, 130, 255],
    ];
    const lane = this.spawnCount++ % 3;

    const flyer = Navi.append(
      new UINode({
        position: { x: px(12), y: px(16 + lane * 22) },
        size: { width: px(22), height: px(22) },
        style: { backgroundColor: colors[lane], rounded: 0.5 },
      }),
      stage,
    );

    // trzy tweeny naraz, ale onDone wisi na DOKŁADNIE jednym — dwa zdjęcia
    // tego samego węzła to ostrzeżenie z nodeManipulationPhase
    flyer.play(Tweens.slideOut({ x: 250, y: -12 }, 850, Easing.easeOutCubic));
    flyer.play(Tweens.scaleTo(2.6, 850));
    flyer.play(
      Tweens.fadeOut(850, Easing.easeInQuad, () => Navi.remove(flyer, stage)),
    );
  }
  private buildSpawn(x: number, y: number) {
    const root = this.section("spawn i despawn — leci, rośnie, gaśnie", x, y);

    const stage = Navi.append(
      new UINode({
        size: { width: px(300), height: px(90) },
        style: {
          backgroundColor: [14, 16, 22, 255],
          overflowX: "clip",
          overflowY: "clip",
        },
      }),
      root,
    );

    const pad = Navi.append(
      new UINode({
        size: { width: auto(), height: auto() },
        style: {
          backgroundColor: [0, 0, 0, 0],
          layout: "grid",
          direction: "row",
          gridCount: 3,
          gap: 4,
          gapCross: 4,
          cellAlignX: "stretch",
          cellAlignY: "stretch",
        },
      }),
      root,
    );

    const button = (label: string, action: () => void) => {
      const node = Navi.append(
        new UINode({
          size: { width: auto(), height: auto() },
          input: "absorb",
          style: {
            backgroundColor: [55, 55, 75, 255],
            rounded: 0.25,
            transitionMs: 90,
            layout: "stack",
            alignMain: "center",
            alignCross: "center",
            padding: { top: 7, right: 10, bottom: 7, left: 10 },
          },
          states: {
            hovered: { backgroundColor: [95, 95, 130, 255] },
            pressed: { backgroundColor: [40, 40, 55, 255], transitionMs: 0 },
          },
        }),
        pad,
      );

      Navi.append(
        new UIText(() => label, {
          size: { width: auto(), height: auto() },
          inheritState: true,
          style: { textColor: [205, 205, 225, 255], textSize: 12 },
          states: { hovered: { textColor: [255, 255, 255, 255] } },
        }),
        node,
      );

      this.actions.set(node, action);
    };

    button("spawn", () => this.spawnFlyer(stage));
    button("wachlarz", () => {
      for (let i = 0; i < 6; i++) this.spawnFlyer(stage);
    });

    // sekwencja przez onDone — bez pola `delay` inaczej się nie da
    button("wjazd, potem zejście", () => {
      const box = Navi.append(
        new UINode({
          position: { x: px(120), y: px(32) },
          size: { width: px(60), height: px(28) },
          style: { backgroundColor: [120, 160, 240, 255], rounded: 0.2 },
        }),
        stage,
      );

      box.play(Tweens.fadeIn(300));
      box.play(
        Tweens.slideIn({ x: -170, y: 0 }, 400, Easing.easeOutCubic, () => {
          box.play(Tweens.fadeOut(320));
          box.play(
            Tweens.popOut(320, undefined, () => Navi.remove(box, stage)),
          );
        }),
      );
    });

    Navi.append(
      new UIText(() => `w scenie: ${stage.children.length}`, {
        size: { width: auto(), height: auto() },
        style: LABEL,
      }),
      root,
    );
  }
  private buildBars(x: number, y: number) {
    const root = this.section(
      "paski postępu — origin decyduje o kierunku",
      x,
      y,
    );

    const make = (label: string, ox: number, tint: RGBA) => {
      const group = this.stack(root, "col", 3);

      Navi.append(
        new UIText(() => label, {
          size: { width: auto(), height: auto() },
          style: LABEL,
        }),
        group,
      );

      const track = Navi.append(
        new UINode({
          size: { width: px(400), height: px(18) },
          style: { backgroundColor: [22, 22, 30, 255], rounded: 0.5 },
        }),
        group,
      );

      const fill = Navi.append(
        new UINode({
          size: { width: pw(100), height: ph(100) },
          style: {
            backgroundColor: tint,
            rounded: 0.5,
            origin: { x: ox, y: 0.5 },
          },
        }),
        track,
      );

      this.bars.push(fill);
    };

    make("do przodu — origin.x = 0", 0, [90, 200, 160, 255]);
    make("do tyłu — origin.x = 1", 1, [225, 175, 70, 255]);
    make("od środka — origin.x = 0.5", 0.5, [200, 120, 200, 255]);

    Navi.append(
      new UIText(() => `wypełnienie: ${Math.round(this.barFill * 100)}%`, {
        size: { width: auto(), height: auto() },
        style: LABEL,
      }),
      root,
    );
  }
  private buildInput(x: number, y: number) {
    const root = this.section(
      "pole tekstowe — Enter zatwierdza, Esc anuluje",
      x,
      y,
    );

    const input = Navi.append(
      new UIInput({
        size: { width: px(260), height: px(30) },
        placeholder: "wpisz imię krasnoluda",
        maxLength: 24,
        style: {
          backgroundColor: [24, 24, 32, 255],
          rounded: 0.15,
          textColor: [235, 225, 205, 255],
          textSize: 14,
          transitionMs: 120,
          padding: { top: 6, right: 8, bottom: 6, left: 8 },
        },
        states: { focused: { backgroundColor: [36, 42, 58, 255] } },
        onSubmit: (v) => console.log("zatwierdzono:", v),
      }),
      root,
    );

    Navi.append(
      new UIText(() => `wartość: ${(input as UIInput).value || "—"}`, {
        size: { width: auto(), height: auto() },
        style: LABEL,
      }),
      root,
    );
  }
}
