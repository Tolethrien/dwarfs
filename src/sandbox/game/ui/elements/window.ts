import Navi from "@navi/navi";
import UINode from "@navi/node";
import { Tweens } from "@navi/tween";
import { auto, ph, pw, px } from "@navi/units";
import InputManager from "@engine/inputManager";
import { Camera } from "@engine/camera/camera";
import { KEY } from "@engine/keys";
import AxiomMath from "@axiom/math";
import { COLOR } from "@axiom/color";
import { UI_THEME } from "../../content/ui";
import { text, TextContent } from "./text";
import { button, UIButton } from "./button";
import { closeMenuOf, openMenu, updateMenu } from "./contextMenu";
import { UISlot } from "./slot";
import { UIDropdown } from "./dropdown";
import { takeSubmitted } from "./input";

export type WindowKind = "modal" | "docked";
export type WindowSlot = "left" | "right" | "center";
export interface CloseOnMove {
  position: () => Position2D;
  distance: number;
}
export interface WindowOptions {
  kind: WindowKind;
  width: number;
  title?: TextContent;
  slot?: WindowSlot;
  dim?: boolean;
  blur?: boolean;
  required?: boolean;
  closeOnMove?: CloseOnMove;
  owner?: UIWindow;
  plate?: WindowPlate;
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
  return { position: () => Camera.getPosition, distance: UI_THEME.worldWindow.closeDistance };
}

export function isAnyWindowOpen() {
  return WINDOWS.opened.length > 0;
}

export function closeAllWindows() {
  while (WINDOWS.opened.length > 0) WINDOWS.opened[WINDOWS.opened.length - 1].close();
}

export class UIWindow {
  private panel: UINode | undefined;
  private content: UINode | undefined;
  private backdrop: UINode | undefined;
  private openedAt: Position2D = { x: 0, y: 0 };

  constructor(private readonly options: WindowOptions) {}

  public get isOpen() {
    return this.panel !== undefined;
  }

  private get slot() {
    return this.options.slot ?? "center";
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
    const panel = Navi.append(plate ? this.createPlate(plate) : this.createPanel());
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
    for (const child of [...this.content.children])
      Navi.remove(child, this.content);
  }

  public close() {
    if (!this.panel) return;
    for (const child of this.children) child.close();
    closeMenuOf(this);
    Navi.remove(this.panel, Navi.root);
    if (this.backdrop) Navi.remove(this.backdrop, Navi.root);
    this.panel = undefined;
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
    const clicked = Navi.getClicked;
    if (clicked instanceof UIDropdown && this.isOwnButton(clicked)) {
      const box = clicked.pixelBox;
      openMenu(
        this,
        clicked.items(),
        { x: box.x, y: box.y + box.h },
        { offset: 0, minWidth: box.w },
      );
      return;
    }
    if (this.isOwnButton(clicked)) {
      clicked.run();
      if (clicked instanceof UISlot && clicked.doubleClicked)
        clicked.options.doubleClick?.();
      return;
    }
    const rightClicked = Navi.getRightClicked;
    if (!(rightClicked instanceof UISlot) || !this.isOwnButton(rightClicked))
      return;
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

  private isOwnButton(node: UINode | undefined): node is UIButton {
    if (!(node instanceof UIButton) || node.isDisabled) return false;
    return this.panel !== undefined && node.isDescendantOf(this.panel);
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
    const padding = UI_THEME.spacing.windowPadding;
    const margin = UI_THEME.spacing.screenMargin;
    const anchorX = { left: "start", right: "end", center: "center" } as const;
    return new UINode({
      focusable: true,
      position: { x: px(this.slot === "center" ? 0 : margin), y: px(0) },
      size: { width: px(this.options.width), height: auto() },
      style: {
        anchorX: anchorX[this.slot],
        anchorY: "center",
        backgroundColor: UI_THEME.colors.panel,
        outline: {
          width: UI_THEME.outline.window,
          color: UI_THEME.colors.frame,
        },
        rounded: UI_THEME.radius.window,
        layout: "stack",
        direction: "col",
        alignCross: "stretch",
        gap: UI_THEME.spacing.windowGap,
        padding: {
          top: padding,
          right: padding,
          bottom: padding,
          left: padding,
        },
      },
    });
  }

  private addHeaderAndContent(panel: UINode) {
    const header = Navi.append(this.createRow(), panel);
    text(header, this.options.title ?? "", {
      color: UI_THEME.colors.title,
      size: UI_THEME.text.title,
    });
    if (!this.options.required) button(header, "×", () => this.close());
    return Navi.append(this.createColumn(), panel);
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

  private createRow() {
    return new UINode({
      size: { width: pw(100), height: auto() },
      style: {
        backgroundColor: UI_THEME.colors.transparent,
        layout: "stack",
        direction: "row",
        alignMain: "between",
        alignCross: "center",
      },
    });
  }

  private createColumn() {
    return new UINode({
      size: { width: pw(100), height: auto() },
      style: {
        backgroundColor: UI_THEME.colors.transparent,
        layout: "stack",
        direction: "col",
        alignCross: "stretch",
        gap: UI_THEME.spacing.windowGap,
      },
    });
  }
}
