import Navi from "@navi/navi";
import UINode from "@navi/node";
import { auto } from "@navi/units";
import AxiomMath from "@axiom/math";
import { UI_THEME } from "../../content/ui";
import { icon } from "./icon";
import { pop, UIPop } from "./pop";
import { text, TextContent } from "./text";
import { tooltip } from "./tooltip";

export interface CounterOptions {
  value: () => number;
  icon?: Crop;
  format?: (value: number) => string;
  tooltip?: TextContent;
  pops?: "sum" | "each";
  iconAfter?: boolean;
  scatter?: PopScatter;
  paper?: boolean;
}
export interface PopScatter {
  x: number;
  y: number;
  size: number;
}

interface CounterPop {
  pop: UIPop;
  add: (change: number) => number;
}

class UICounter extends UINode {
  private shown: number | undefined;
  private last: CounterPop | undefined;

  constructor(
    private readonly value: () => number,
    private readonly format: (value: number) => string,
    private readonly sums: boolean,
    private readonly scatter: PopScatter,
  ) {
    super({
      size: { width: auto(), height: auto() },
      style: {
        backgroundColor: UI_THEME.colors.transparent,
        layout: "stack",
        direction: "row",
        alignCross: "center",
        gap: UI_THEME.cost.innerGap,
      },
    });
  }

  public contentChanged() {
    const value = this.value();
    if (this.shown === undefined) this.shown = value;
    if (value === this.shown) return false;
    const change = value - this.shown;
    this.shown = value;
    if (!this.sums || !this.last?.pop.isShowing) this.last = this.newPop();
    const sum = this.last.add(change);
    this.last.pop.restart(sum > 0 ? UI_THEME.colors.gain : UI_THEME.colors.lacking);
    return true;
  }

  private newPop(): CounterPop {
    const scatter = this.scatter;
    let sum = 0;
    const node = pop(this, {
      text: () => (sum > 0 ? `+${this.format(sum)}` : this.format(sum)),
      color: UI_THEME.colors.gain,
      position: {
        x: AxiomMath.randomFloat(-scatter.x, scatter.x),
        y: -UI_THEME.counter.popTop - AxiomMath.randomFloat(0, scatter.y),
      },
      anchorX: "end",
      overlay: true,
      // whole sizes only: every new size rasterizes the font once more
      textSize: UI_THEME.text.body + AxiomMath.randomInt(-scatter.size, scatter.size),
    });
    return { pop: node, add: (change) => (sum += change) };
  }
}

export function counter(parent: UINode, options: CounterOptions) {
  const format = options.format ?? ((value: number) => `${value}`);
  const node = new UICounter(options.value, format, (options.pops ?? "sum") === "sum", options.scatter ?? { x: 0, y: 0, size: 0 });
  Navi.append(node, parent);
  if (options.icon && !options.iconAfter)
    icon(node, options.icon, { size: UI_THEME.counter.iconSize });
  text(node, () => format(options.value()), (options.paper ?? true) ? { color: UI_THEME.paper.ink } : {});
  if (options.icon && options.iconAfter)
    icon(node, options.icon, { size: UI_THEME.counter.iconSize });
  if (options.tooltip !== undefined) tooltip(node, options.tooltip);
  return node;
}
