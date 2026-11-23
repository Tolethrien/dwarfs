import UINode from "@navi/node";
import { UI_THEME } from "../../content/ui";
import { button } from "./button";
import { row } from "./row";
import { text, TextContent } from "./text";

export interface StepperOptions {
  tag?: string;
  minusTag?: string;
  plusTag?: string;
  paper?: boolean;
}

export function stepper(
  parent: UINode,
  title: TextContent,
  value: TextContent,
  change: (step: -1 | 1) => void,
  options: StepperOptions = {},
) {
  const line = row(parent, { align: "between" });
  if (options.tag) line.tags.add(options.tag);
  const isPaper = options.paper ?? true;
  const textLook = isPaper ? { color: UI_THEME.paper.ink } : {};
  text(line, title, textLook);
  const controls = row(line, { fit: true });
  if (isPaper) {
    button(controls, "", () => change(-1), { tag: options.minusTag, sprite: "minus" });
    text(controls, value, textLook);
    button(controls, "", () => change(1), { tag: options.plusTag, sprite: "plus" });
  } else {
    button(controls, "-", () => change(-1), { tag: options.minusTag });
    text(controls, value);
    button(controls, "+", () => change(1), { tag: options.plusTag });
  }
  return line;
}
