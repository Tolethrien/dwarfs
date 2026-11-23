import Navi from "@navi/navi";
import UINode, { NodeProps } from "@navi/node";
import UIText from "@navi/elements/text";
import { Tweens } from "@navi/tween";
import { auto, ph, pw, px } from "@navi/units";
import { COLOR } from "@axiom/color";
import { UI_SHEET, UI_THEME } from "../../content/ui";
import { icon } from "./icon";
import { TextContent, textSource } from "./text";

export type ButtonSprite = "dark" | "red" | "paper" | "tab" | "minus" | "plus" | "close";

export interface ButtonOptions {
  // a function is read live: the button shows it without being rebuilt
  selected?: boolean | (() => boolean);
  disabled?: boolean;
  color?: RGBA;
  sprite?: ButtonSprite;
  icon?: Crop;
  iconSize?: number;
  big?: boolean;
  compact?: boolean;
  pulse?: { amount: number; ms: number };
  tag?: string;
}

// clicks are handled by whoever owns the button (UIWindow), not in tick: see .plans/ui-elementy.md
export class UIButton extends UINode {
  private selection: { plate: UINode; selected: () => boolean } | undefined;

  constructor(
    public readonly run: () => void,
    props: NodeProps,
  ) {
    super(props);
  }

  public get isDisabled() {
    return this.input === "disabled";
  }

  public showSelected(plate: UINode, selected: () => boolean) {
    this.selection = { plate: plate, selected: selected };
    plate.motion.alpha = selected() ? 1 : 0;
  }

  public contentChanged() {
    if (this.selection) this.selection.plate.motion.alpha = this.selection.selected() ? 1 : 0;
    return false;
  }
}

export function buttonIn(node: UINode | undefined, ...panels: UINode[]) {
  if (!(node instanceof UIButton) || node.isDisabled) return undefined;
  const inside = panels.some((panel) => node === panel || node.isDescendantOf(panel));
  return inside ? node : undefined;
}

// for panels outside a window, which runs its own buttons in UIWindow.update
export function runClicked(...panels: UINode[]) {
  buttonIn(Navi.getClicked, ...panels)?.run();
}

export function button(
  parent: UINode,
  label: TextContent,
  run: () => void,
  options: ButtonOptions = {},
) {
  const node = new UIButton(run, options.pulse ? clearProps(options) : buttonProps(options));
  if (options.tag) node.tags.add(options.tag);
  Navi.append(node, parent);
  if (options.pulse) pulsingPlate(node, options, options.pulse);
  if (typeof options.selected === "function") node.showSelected(selectionPlate(node, options), options.selected);
  fillButton(node, label, options);
  return node;
}

// a pulsing button: only the plate under the label pulses, the label keeps still
function clearProps(options: ButtonOptions): NodeProps {
  const props = buttonProps(options);
  const clear = UI_THEME.colors.transparent;
  return {
    ...props,
    style: { ...props.style, backgroundColor: clear, backgroundImage: undefined },
    states: {
      hovered: { backgroundColor: clear, backgroundImage: undefined },
      pressed: { backgroundColor: clear, backgroundImage: undefined, transitionMs: 0 },
      disabled: { backgroundColor: clear, backgroundImage: undefined },
    },
  };
}

function resolvedSprite(options: ButtonOptions): ButtonSprite | undefined {
  if (options.sprite) return options.sprite;
  if (options.color !== undefined) return undefined;
  return "dark";
}

function selectionPlate(node: UIButton, options: ButtonOptions) {
  const sprite = resolvedSprite(options);
  const red = sprite === "tab" ? UI_SHEET.tabRedA : UI_SHEET.btnRed;
  const style = sprite
    ? {
        backgroundColor: COLOR.WHITE,
        backgroundImage: UI_SHEET.image,
        backgroundImageCrop: red.crop,
        backgroundImageSlice: red.slice,
        overlay: true,
        zIndex: -1,
      }
    : {
        backgroundColor: UI_THEME.colors.selected,
        rounded: UI_THEME.radius.button,
        shadow: blockEdge(UI_THEME.colors.closeButton),
        overlay: true,
        zIndex: -1,
      };
  return Navi.append(
    new UINode({
      size: { width: pw(100), height: ph(100) },
      input: "none",
      style,
    }),
    node,
  );
}

function pulsingPlate(node: UIButton, options: ButtonOptions, pulse: { amount: number; ms: number }) {
  const props = buttonProps(options);
  const plate = Navi.append(
    new UINode({
      size: { width: pw(100), height: ph(100) },
      input: "none",
      inheritState: true,
      style: {
        backgroundColor: props.style?.backgroundColor,
        backgroundImage: props.style?.backgroundImage,
        backgroundImageCrop: props.style?.backgroundImageCrop,
        backgroundImageSlice: props.style?.backgroundImageSlice,
        rounded: UI_THEME.radius.button,
        shadow: props.style?.shadow,
        transitionMs: UI_THEME.motion.hoverMs,
        overlay: true,
        zIndex: -1,
      },
      states: props.states,
    }),
    node,
  );
  plate.play(Tweens.pulse(pulse.amount, pulse.ms));
}

// the dark edge along the bottom of a block is an inset shadow pushed up by its width
function blockEdge(color: RGBA) {
  return { color: color, offset: { x: 0, y: -UI_THEME.block.edge }, inset: true };
}

export function buttonProps(options: ButtonOptions): NodeProps {
  const sprite = resolvedSprite(options);
  if (sprite) return spriteButtonProps(options, sprite);
  const colors = UI_THEME.colors;
  const background = options.selected === true
    ? colors.selected
    : (options.color ?? colors.row);
  const hover = options.selected === true ? colors.selected : colors.rowHover;
  return {
    size: { width: auto(), height: auto() },
    input: options.disabled ? "disabled" : "absorb",
    style: {
      backgroundColor: background,
      rounded: UI_THEME.radius.button,
      shadow: blockEdge(colors.frame),
      transitionMs: UI_THEME.motion.hoverMs,
      padding: options.big ? UI_THEME.spacing.bigButtonPadding : UI_THEME.spacing.buttonPadding,
      layout: "stack",
      direction: options.icon ? "col" : "row",
      alignCross: "center",
      gap: UI_THEME.spacing.gap,
    },
    states: {
      hovered: { backgroundColor: hover },
      pressed: { backgroundColor: colors.pressed, transitionMs: 0 },
      // a disabled button takes the hover (for its tooltip), but must not light up
      disabled: { backgroundColor: background },
    },
  };
}

const SQUARE_SPRITES: Record<"minus" | "plus" | "close", { crop: Crop; size: number }> = {
  minus: { crop: UI_SHEET.btnMinus.crop, size: 28 },
  plus: { crop: UI_SHEET.btnPlus.crop, size: 28 },
  close: { crop: UI_SHEET.btnClose.crop, size: 30 },
};

const RECT_SPRITES = {
  red: UI_SHEET.btnRed,
  paper: UI_SHEET.btnPaper,
  tab: UI_SHEET.tabPaperA,
  dark: UI_SHEET.btnDark,
};

function buttonTextColor(options: ButtonOptions): RGBA {
  const sprite = resolvedSprite(options);
  if (!sprite) return UI_THEME.colors.text;
  const light = sprite === "paper" || sprite === "tab";
  if (light && options.selected !== true) return UI_THEME.paper.ink;
  return UI_THEME.paper.inkCream;
}

function spriteButtonPadding(options: ButtonOptions, kind: ButtonSprite) {
  if (kind === "tab") return { top: 8, right: 18, bottom: 6, left: 18 };
  if (options.compact) return { top: 4, right: 8, bottom: 4, left: 8 };
  return options.big ? UI_THEME.spacing.bigButtonPadding : UI_THEME.spacing.buttonPadding;
}

function buttonTextSize(options: ButtonOptions) {
  if (options.big) return UI_THEME.text.bigButton;
  if (options.compact) return 16;
  return UI_THEME.text.button;
}

function spriteButtonProps(options: ButtonOptions, kind: ButtonSprite): NodeProps {
  const paper = UI_THEME.paper;
  if (kind === "minus" || kind === "plus" || kind === "close") {
    const entry = SQUARE_SPRITES[kind];
    return {
      size: { width: px(entry.size), height: px(entry.size) },
      input: options.disabled ? "disabled" : "absorb",
      style: {
        backgroundColor: COLOR.WHITE,
        backgroundImage: UI_SHEET.image,
        backgroundImageCrop: entry.crop,
        transitionMs: UI_THEME.motion.hoverMs,
      },
      states: {
        hovered: { backgroundColor: paper.hoverTint },
        pressed: { backgroundColor: paper.pressTint, transitionMs: 0 },
        disabled: { backgroundColor: paper.inkDisabled },
      },
    };
  }
  const activeSheet = kind === "tab" ? UI_SHEET.tabRedA : UI_SHEET.btnRed;
  const sheet = options.selected === true ? activeSheet : RECT_SPRITES[kind];
  return {
    size: { width: auto(), height: auto() },
    input: options.disabled ? "disabled" : "absorb",
    style: {
      backgroundColor: COLOR.WHITE,
      backgroundImage: UI_SHEET.image,
      backgroundImageCrop: sheet.crop,
      backgroundImageSlice: sheet.slice,
      transitionMs: UI_THEME.motion.hoverMs,
      padding: spriteButtonPadding(options, kind),
      layout: "stack",
      direction: options.icon ? "col" : "row",
      alignCross: "center",
      gap: UI_THEME.spacing.gap,
    },
    states: {
      hovered: { backgroundColor: paper.hoverTint },
      pressed: { backgroundColor: paper.pressTint, transitionMs: 0 },
      disabled: {
        backgroundColor: COLOR.WHITE,
        backgroundImage: UI_SHEET.image,
        backgroundImageCrop: UI_SHEET.btnDisabled.crop,
        backgroundImageSlice: UI_SHEET.btnDisabled.slice,
      },
    },
  };
}

export function fillButton(
  node: UIButton,
  label: TextContent,
  options: ButtonOptions,
) {
  const colors = UI_THEME.colors;
  if (options.icon)
    icon(node, options.icon, { size: options.iconSize ?? UI_THEME.icon.size });
  if (label === "") return;
  const textColor = buttonTextColor(options);
  const disabledColor = resolvedSprite(options) ? UI_THEME.paper.inkDisabled : colors.muted;
  Navi.append(
    new UIText(textSource(label), {
      size: { width: auto(), height: auto() },
      input: "none",
      inheritState: true,
      style: {
        textColor: textColor,
        textSize: buttonTextSize(options),
        textFont: UI_THEME.font.display,
      },
      states: { disabled: { textColor: disabledColor } },
    }),
    node,
  );
}
