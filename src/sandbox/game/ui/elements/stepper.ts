import UINode from "@navi/node";
import { button } from "./button";
import { row } from "./row";
import { text, TextContent } from "./text";

export function stepper(
  parent: UINode,
  title: TextContent,
  value: TextContent,
  change: (step: -1 | 1) => void,
) {
  const line = row(parent, { align: "between" });
  text(line, title);
  const controls = row(line, { fit: true });
  button(controls, "-", () => change(-1));
  text(controls, value);
  button(controls, "+", () => change(1));
  return line;
}
