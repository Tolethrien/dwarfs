import UINode from "@navi/node";
import { button } from "./button";
import { row } from "./row";
import { text, TextContent } from "./text";

export interface StepperOptions {
  tag?: string;
  minusTag?: string;
  plusTag?: string;
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
  text(line, title);
  const controls = row(line, { fit: true });
  button(controls, "-", () => change(-1), { tag: options.minusTag });
  text(controls, value);
  button(controls, "+", () => change(1), { tag: options.plusTag });
  return line;
}
