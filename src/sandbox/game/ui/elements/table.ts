import Navi from "@navi/navi";
import UINode from "@navi/node";
import { auto, px } from "@navi/units";
import { UI_THEME } from "../../content/ui";
import { buttonProps, UIButton } from "./button";
import { row } from "./row";
import { scrollList } from "./scrollList";
import { text, TextContent } from "./text";

export interface TableColumn {
  title: string;
  width: number;
  align?: "start" | "center" | "end";
}
export interface TableOptions {
  height?: number;
  offset?: number;
  paper?: boolean;
}
export type TableCell = TextContent | { build: (cell: UINode) => void };
export interface TableRowOptions {
  // a clickable row is one button, so its cells must not hold buttons of their own
  click?: () => void;
  selected?: boolean;
}

export class UITable {
  public readonly body: UINode;
  private readonly paper: boolean;

  constructor(
    parent: UINode,
    private readonly columns: TableColumn[],
    options: TableOptions = {},
  ) {
    this.paper = options.paper ?? true;
    const header = this.line(parent);
    for (const column of columns)
      text(this.cell(header, column), column.title, {
        color: this.paper ? UI_THEME.paper.inkRed : UI_THEME.colors.muted,
      });
    const scroll = (this.paper ? 10 : UI_THEME.scroll.width) + UI_THEME.spacing.gap;
    const framePad = this.paper ? 30 : 0;
    this.body =
      options.height === undefined
        ? this.column(parent)
        : scrollList(parent, {
            width: this.width + framePad + scroll,
            height: options.height,
            offset: options.offset,
            paper: this.paper,
          });
  }

  public row(cells: TableCell[], options: TableRowOptions = {}) {
    const rowBg = this.paper ? [165, 138, 108, 45] as RGBA : UI_THEME.colors.row;
    const line = options.click
      ? this.clickableLine(options.click, options.selected ?? false)
      : this.line(this.body, rowBg);
    this.columns.forEach((column, index) => {
      const content = cells[index];
      if (content === undefined) return;
      const cell = this.cell(line, column);
      if (typeof content === "object") content.build(cell);
      else text(cell, content, this.paper ? { color: UI_THEME.paper.ink } : {});
    });
    return line;
  }

  private get width() {
    const padding = UI_THEME.spacing.rowPadding;
    const columns = this.columns.reduce((sum, column) => sum + column.width, 0);
    const gaps = UI_THEME.spacing.gap * (this.columns.length - 1);
    return columns + gaps + padding.left + padding.right;
  }

  private line(parent: UINode, background?: RGBA) {
    return row(parent, {
      fit: true,
      background: background,
      padding: UI_THEME.spacing.rowPadding,
    });
  }

  private clickableLine(click: () => void, selected: boolean) {
    if (this.paper) {
      const base: RGBA = selected ? [152, 27, 23, 55] : [165, 138, 108, 45];
      const hover: RGBA = selected ? [152, 27, 23, 80] : [165, 138, 108, 105];
      const line = new UIButton(click, {
        size: { width: auto(), height: auto() },
        input: "absorb",
        style: {
          backgroundColor: base,
          transitionMs: UI_THEME.motion.hoverMs,
          padding: UI_THEME.spacing.rowPadding,
          layout: "stack",
          direction: "row",
          alignCross: "center",
          gap: UI_THEME.spacing.gap,
        },
        states: {
          hovered: { backgroundColor: hover },
          pressed: { backgroundColor: [140, 114, 86, 130], transitionMs: 0 },
        },
      });
      Navi.append(line, this.body);
      return line;
    }
    const props = buttonProps({ selected: selected });
    props.style = {
      ...props.style,
      padding: UI_THEME.spacing.rowPadding,
      direction: "row",
    };
    const line = new UIButton(click, props);
    Navi.append(line, this.body);
    return line;
  }

  private column(parent: UINode) {
    return Navi.append(
      new UINode({
        size: { width: auto(), height: auto() },
        style: {
          backgroundColor: UI_THEME.colors.transparent,
          layout: "stack",
          direction: "col",
          alignCross: "stretch",
          gap: UI_THEME.spacing.listGap,
        },
      }),
      parent,
    );
  }

  private cell(parent: UINode, column: TableColumn) {
    return Navi.append(
      new UINode({
        size: { width: px(column.width), height: auto() },
        style: {
          backgroundColor: UI_THEME.colors.transparent,
          layout: "stack",
          direction: "row",
          alignMain: column.align ?? "start",
          alignCross: "center",
        },
      }),
      parent,
    );
  }
}

export function tableWindowWidth(columns: readonly TableColumn[], scrolled = true) {
  const windowPadding = UI_THEME.panel.window.padding;
  const rowPadding = UI_THEME.spacing.rowPadding;
  const columnsWidth = columns.reduce((sum, column) => sum + column.width, 0);
  const gaps = UI_THEME.spacing.gap * Math.max(columns.length - 1, 0);
  const framePad = scrolled ? 30 : 0;
  const scroll = scrolled ? UI_THEME.scroll.width + UI_THEME.spacing.gap : 0;
  return columnsWidth + gaps + rowPadding.left + rowPadding.right + framePad + scroll + windowPadding.left + windowPadding.right;
}

export function table(
  parent: UINode,
  columns: TableColumn[],
  options: TableOptions = {},
) {
  return new UITable(parent, columns, options);
}
