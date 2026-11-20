import Navi from "@navi/navi";
import UINode, { NodeProps } from "@navi/node";
import UIText from "@navi/elements/text";
import { Tweens } from "@navi/tween";
import { auto, ph, pw } from "@navi/units";
import { UI_THEME } from "../../content/ui";
import { icon } from "./icon";
import { TextContent, textSource } from "./text";

export interface ButtonOptions {
  // a function is read live: the button shows it without being rebuilt
  selected?: boolean | (() => boolean);
  disabled?: boolean;
  color?: RGBA;
  icon?: Crop;
  iconSize?: number;
  big?: boolean;
  pulse?: { amount: number; ms: number };
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
  Navi.append(node, parent);
  if (options.pulse) pulsingPlate(node, options, options.pulse);
  if (typeof options.selected === "function") node.showSelected(selectionPlate(node), options.selected);
  fillButton(node, label, options);
  return node;
}

// a pulsing button: only the plate under the label pulses, the label keeps still
function clearProps(options: ButtonOptions): NodeProps {
  const props = buttonProps(options);
  const clear = UI_THEME.colors.transparent;
  return {
    ...props,
    style: { ...props.style, backgroundColor: clear },
    states: {
      hovered: { backgroundColor: clear },
      pressed: { backgroundColor: clear, transitionMs: 0 },
      disabled: { backgroundColor: clear },
    },
  };
}

function selectionPlate(node: UIButton) {
  return Navi.append(
    new UINode({
      size: { width: pw(100), height: ph(100) },
      input: "none",
      style: {
        backgroundColor: UI_THEME.colors.selected,
        rounded: UI_THEME.radius.button,
        shadow: blockEdge(UI_THEME.colors.closeButton),
        overlay: true,
        zIndex: -1,
      },
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

export function fillButton(
  node: UIButton,
  label: TextContent,
  options: ButtonOptions,
) {
  const colors = UI_THEME.colors;
  if (options.icon)
    icon(node, options.icon, { size: options.iconSize ?? UI_THEME.icon.size });
  if (label === "") return;
  Navi.append(
    new UIText(textSource(label), {
      size: { width: auto(), height: auto() },
      input: "none",
      inheritState: true,
      style: {
        textColor: colors.text,
        textSize: options.big ? UI_THEME.text.bigButton : UI_THEME.text.button,
        textFont: UI_THEME.font.display,
      },
      states: { disabled: { textColor: colors.muted } },
    }),
    node,
  );
}
