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
}
export type TableCell = TextContent | { build: (cell: UINode) => void };
export interface TableRowOptions {
  // a clickable row is one button, so its cells must not hold buttons of their own
  click?: () => void;
  selected?: boolean;
}

export class UITable {
  public readonly body: UINode;

  constructor(
    parent: UINode,
    private readonly columns: TableColumn[],
    options: TableOptions = {},
  ) {
    const header = this.line(parent);
    for (const column of columns)
      text(this.cell(header, column), column.title, {
        color: UI_THEME.colors.muted,
      });
    const scroll = UI_THEME.scroll.width + UI_THEME.spacing.gap;
    this.body =
      options.height === undefined
        ? this.column(parent)
        : scrollList(parent, {
            width: this.width + scroll,
            height: options.height,
            offset: options.offset,
          });
  }

  public row(cells: TableCell[], options: TableRowOptions = {}) {
    const line = options.click
      ? this.clickableLine(options.click, options.selected ?? false)
      : this.line(this.body, UI_THEME.colors.row);
    this.columns.forEach((column, index) => {
      const content = cells[index];
      if (content === undefined) return;
      const cell = this.cell(line, column);
      if (typeof content === "object") content.build(cell);
      else text(cell, content);
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

export function table(
  parent: UINode,
  columns: TableColumn[],
  options: TableOptions = {},
) {
  return new UITable(parent, columns, options);
}
