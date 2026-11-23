import Navi from "@navi/navi";
import UINode from "@navi/node";
import { Tweens } from "@navi/tween";
import { auto, ph, pw, px } from "@navi/units";
import InputManager from "@engine/inputManager";
import { Camera } from "@engine/camera/camera";
import { KEY } from "@engine/keys";
import AxiomMath from "@axiom/math";
import { assert } from "@axiom/utils";
import { COLOR } from "@axiom/color";
import { UI_SHEET, UI_THEME } from "../../content/ui";
import { text, TextContent } from "./text";
import { button, buttonIn } from "./button";
import { closeMenuOf, openMenu, updateMenu } from "./contextMenu";
import { UISlot } from "./slot";
import { UIDropdown } from "./dropdown";
import { takeSubmitted } from "./input";
import { panelStyle } from "./panel";

export type WindowKind = "modal" | "docked";
export type WindowSlot = "left" | "right" | "center" | "bottomRight";
export interface CloseOnMove {
  position: () => Position2D;
  distance: number;
}
export interface WindowOptions {
  kind: WindowKind;
  width: number;
  title?: TextContent;
  slot?: WindowSlot;
  offsetY?: number;
  tag?: string;
  dim?: boolean;
  blur?: boolean;
  required?: boolean;
  closeOnMove?: CloseOnMove;
  owner?: UIWindow;
  plate?: WindowPlate;
  paper?: boolean;
  titleGradient?: { from: RGBA; to: RGBA; start?: number; end?: number };
  onClose?: () => void;
}
export interface WindowPlate {
  image: string;
  crop: Crop;
  height: number;
}

const WINDOWS = {
  slots: new Map<WindowSlot, UIWindow>(),
  modal: undefined as UIWindow | undefined,
  opened: [] as UIWindow[],
};

// for a window of a building or a station: it closes when the camera leaves it behind
export function closeOnCameraMove(): CloseOnMove {
  return {
    position: () => Camera.getPosition,
    distance: UI_THEME.worldWindow.closeDistance,
  };
}

export function isAnyWindowOpen() {
  return WINDOWS.opened.length > 0;
}

export function closeAllWindows() {
  while (WINDOWS.opened.length > 0)
    WINDOWS.opened[WINDOWS.opened.length - 1].close();
}

export class UIWindow {
  private panel: UINode | undefined;
  private bodyHost: UINode | undefined;
  private content: UINode | undefined;
  private backdrop: UINode | undefined;
  private openedAt: Position2D = { x: 0, y: 0 };

  constructor(private readonly options: WindowOptions) {}

  public get isOpen() {
    return this.panel !== undefined;
  }

  public get frame() {
    assert(
      this.bodyHost !== undefined,
      "Window must be open to access its frame",
    );
    return this.bodyHost;
  }

  private get slot() {
    return this.options.slot ?? "center";
  }

  private get isPaper() {
    return this.options.paper ?? true;
  }

  public open() {
    if (this.content) return this.content;
    // a modal with an owner stands over it, the owner's update runs it and holds off its input
    if (this.options.kind === "modal") {
      if (this.options.owner === undefined) {
        WINDOWS.modal?.close();
        WINDOWS.modal = this;
      }
      this.backdrop = Navi.append(this.createBackdrop());
    } else {
      WINDOWS.slots.get(this.slot)?.close();
      WINDOWS.slots.set(this.slot, this);
    }
    WINDOWS.opened.push(this);
    if (this.options.closeOnMove) {
      const position = this.options.closeOnMove.position();
      this.openedAt = { x: position.x, y: position.y };
    }

    const plate = this.options.plate;
    const panel = Navi.append(
      plate ? this.createPlate(plate) : this.createPanel(),
    );
    if (this.options.tag) panel.tags.add(this.options.tag);
    const content = plate ? panel : this.addHeaderAndContent(panel);
    panel.play(Tweens.popIn(UI_THEME.motion.popInMs));
    Navi.focus(panel);
    this.panel = panel;
    this.content = content;
    return content;
  }

  public toggle() {
    if (this.isOpen) this.close();
    else this.open();
  }

  public clear() {
    if (!this.content) return;
    Navi.clear(this.content);
  }

  public close() {
    if (!this.panel) return;
    for (const child of this.children) child.close();
    closeMenuOf(this);
    Navi.remove(this.panel, Navi.root);
    if (this.backdrop) Navi.remove(this.backdrop, Navi.root);
    this.panel = undefined;
    this.bodyHost = undefined;
    this.content = undefined;
    this.backdrop = undefined;
    if (WINDOWS.modal === this) WINDOWS.modal = undefined;
    if (WINDOWS.slots.get(this.slot) === this) WINDOWS.slots.delete(this.slot);
    WINDOWS.opened.splice(WINDOWS.opened.indexOf(this), 1);
    WINDOWS.opened[WINDOWS.opened.length - 1]?.focus();
    this.options.onClose?.();
  }

  public update() {
    if (!this.panel) return;
    if (this.updateChildren()) return;
    if (updateMenu(this)) return;
    if (this.isClosedByInput()) {
      this.close();
      return;
    }
    for (const field of takeSubmitted(this.panel)) field.submit?.(field.value);
    const clicked = this.ownButton(Navi.getClicked);
    if (clicked instanceof UIDropdown) {
      const box = clicked.pixelBox;
      openMenu(
        this,
        clicked.items(),
        { x: box.x, y: box.y + box.h },
        { offset: 0, minWidth: box.w },
      );
      return;
    }
    if (clicked) {
      clicked.run();
      if (clicked instanceof UISlot && clicked.doubleClicked)
        clicked.options.doubleClick?.();
      return;
    }
    const rightClicked = this.ownButton(Navi.getRightClicked);
    if (!(rightClicked instanceof UISlot)) return;
    const items = rightClicked.options.menu?.();
    if (items) openMenu(this, items, InputManager.getMousePos());
  }

  private get children() {
    return WINDOWS.opened.filter((window) => window.options.owner === this);
  }

  private updateChildren() {
    let blocked = false;
    for (const child of this.children) {
      child.update();
      if (child.isOpen && child.options.kind === "modal") blocked = true;
    }
    return blocked;
  }

  private ownButton(node: UINode | undefined) {
    if (!this.panel) return undefined;
    return buttonIn(node, this.panel);
  }

  private isClosedByInput() {
    if (this.options.required) return false;
    if (this.backdrop && (this.backdrop.clicked || this.backdrop.rightClicked))
      return true;
    if (this.isMovedAway()) return true;
    const panel = this.panel;
    if (!panel?.focused || !InputManager.isKeyPressed(KEY.escape)) return false;
    // focus handed over this frame by a window closed with the same Esc
    return !panel.focusGained;
  }

  private focus() {
    if (this.panel) Navi.focus(this.panel);
  }

  private isMovedAway() {
    const closeOnMove = this.options.closeOnMove;
    if (!closeOnMove) return false;
    const moved = AxiomMath.distance2d(closeOnMove.position(), this.openedAt);
    return moved > closeOnMove.distance;
  }

  private createBackdrop() {
    const dim = this.options.dim
      ? UI_THEME.colors.dim
      : UI_THEME.colors.transparent;
    return new UINode({
      size: { width: pw(100), height: ph(100) },
      input: "absorb",
      style: {
        backgroundColor: dim,
        backdrop: this.options.blur
          ? { blur: UI_THEME.backdrop.blur }
          : undefined,
      },
    });
  }

  private createPanel() {
    const margin = UI_THEME.spacing.screenMargin;
    const anchorX = {
      left: "start",
      right: "end",
      center: "center",
      bottomRight: "end",
    } as const;
    const anchorY = {
      left: "center",
      right: "center",
      center: "center",
      bottomRight: "end",
    } as const;
    const posY =
      this.slot === "bottomRight" ? margin + (this.options.offsetY ?? 0) : 0;
    const baseStyle = this.isPaper
      ? { backgroundColor: UI_THEME.colors.transparent }
      : panelStyle("window");
    const panelPad = this.isPaper
      ? { top: 12, right: 0, bottom: 0, left: 0 }
      : { top: 0, right: 0, bottom: 0, left: 0 };
    return new UINode({
      focusable: true,
      position: { x: px(this.slot === "center" ? 0 : margin), y: px(posY) },
      size: { width: px(this.options.width), height: auto() },
      style: {
        anchorX: anchorX[this.slot],
        anchorY: anchorY[this.slot],
        ...baseStyle,
        padding: panelPad,
        layout: "stack",
        direction: "col",
        alignCross: "stretch",
      },
    });
  }

  private addHeaderAndContent(panel: UINode) {
    const header = Navi.append(this.createTitleBar(), panel);
    this.addTitle(header);
    if (!this.options.required) {
      if (this.isPaper)
        button(header, "", () => this.close(), { sprite: "close" });
      else
        button(header, "X", () => this.close(), {
          color: UI_THEME.colors.closeButton,
        });
    }
    const host = this.isPaper
      ? Navi.append(this.createPaperBody(), panel)
      : panel;
    this.bodyHost = host;
    return Navi.append(this.createColumn(), host);
  }

  private addTitle(header: UINode) {
    const gradient = this.options.titleGradient;
    const title = this.options.title ?? "";
    if (!gradient || typeof title !== "string") {
      text(header, title, {
        color: this.isPaper ? UI_THEME.paper.inkCream : UI_THEME.colors.title,
        size: UI_THEME.text.title,
        font: UI_THEME.font.display,
      });
      return;
    }
    const letters = Navi.append(
      new UINode({
        size: { width: auto(), height: auto() },
        input: "none",
        style: {
          backgroundColor: UI_THEME.colors.transparent,
          layout: "stack",
          direction: "row",
          alignCross: "center",
          gap: 0,
        },
      }),
      header,
    );
    const chars = [...title];
    const last = Math.max(1, chars.length - 1);
    const start = gradient.start ?? 0.1;
    const end = gradient.end ?? 0.9;
    const shadow = { color: [0, 0, 0, 255] as RGBA, offset: { x: 1, y: 2 } };
    chars.forEach((char, index) => {
      const linear = index / last;
      const u = AxiomMath.clamp(
        AxiomMath.inverseLerp(start, end, linear),
        0,
        1,
      );
      const t = u * u * (3 - 2 * u);
      const color: RGBA = [
        Math.round(AxiomMath.lerp(gradient.from[0], gradient.to[0], t)),
        Math.round(AxiomMath.lerp(gradient.from[1], gradient.to[1], t)),
        Math.round(AxiomMath.lerp(gradient.from[2], gradient.to[2], t)),
        Math.round(AxiomMath.lerp(gradient.from[3], gradient.to[3], t)),
      ];
      text(letters, char, {
        color,
        size: UI_THEME.text.title,
        font: UI_THEME.font.display,
        shadow,
      });
    });
  }

  private createPaperBody() {
    return new UINode({
      size: { width: pw(100), height: auto() },
      style: {
        backgroundColor: COLOR.WHITE,
        backgroundImage: UI_SHEET.image,
        backgroundImageCrop: UI_SHEET.paper.crop,
        backgroundImageSlice: UI_SHEET.paper.slice,
        layout: "stack",
        direction: "col",
        alignCross: "stretch",
      },
    });
  }

  private createPlate(plate: WindowPlate) {
    return new UINode({
      focusable: true,
      size: { width: px(this.options.width), height: px(plate.height) },
      style: {
        anchorX: "center",
        anchorY: "center",
        backgroundColor: COLOR.WHITE,
        backgroundImage: plate.image,
        backgroundImageCrop: plate.crop,
      },
    });
  }

  private createTitleBar() {
    if (this.isPaper) {
      const header = UI_SHEET.headerBarA;
      return new UINode({
        size: { width: pw(100), height: px(60) },
        style: {
          backgroundColor: COLOR.WHITE,
          backgroundImage: UI_SHEET.image,
          backgroundImageCrop: header.crop,
          backgroundImageSlice: header.slice,
          overlay: true,
          anchorY: "start",
          zIndex: 2,
          padding: { top: 12, right: 8, bottom: 2, left: 92 },
          layout: "stack",
          direction: "row",
          alignMain: "between",
          alignCross: "center",
        },
      });
    }
    const bar = UI_THEME.panel.titleBar;
    return new UINode({
      size: { width: pw(100), height: auto() },
      style: {
        backgroundColor: bar.color,
        rounded: 0,
        padding: bar.padding,
        shadow: {
          color: bar.stripe,
          offset: { x: bar.stripeWidth, y: 0 },
          inset: true,
        },
        layout: "stack",
        direction: "row",
        alignMain: "between",
        alignCross: "center",
      },
    });
  }

  private createColumn() {
    const pad = UI_THEME.panel.window.padding;
    const padding = this.isPaper
      ? { top: 56, right: pad.right, bottom: pad.bottom, left: pad.left }
      : pad;
    return new UINode({
      size: { width: pw(100), height: auto() },
      style: {
        backgroundColor: UI_THEME.colors.transparent,
        padding: padding,
        layout: "stack",
        direction: "col",
        alignCross: "stretch",
        gap: UI_THEME.spacing.windowGap,
      },
    });
  }
}
