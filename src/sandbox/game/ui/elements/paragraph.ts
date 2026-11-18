import Navi from "@navi/navi";
import UINode, { NodeProps } from "@navi/node";
import UITextBox from "@navi/elements/textbox";
import { auto, pw, px } from "@navi/units";
import TextLayout from "@aurora/text/textLayout";
import { UI_THEME } from "../../content/ui";
import { TextContent, TextLook, textSource } from "./text";

export interface ParagraphLook extends TextLook {
  maxWidth?: number;
}

class UIParagraph extends UITextBox {
  constructor(
    private readonly read: () => string,
    private readonly maxWidth: number | undefined,
    props: NodeProps,
  ) {
    super(read, props);
  }

  public measureSelf(scale: number) {
    if (this.maxWidth !== undefined) {
      const style = this.style;
      const line = TextLayout.measure(
        style.textFont,
        this.read(),
        style.textSize * scale,
      );
      this.size.width = px(
        Math.min(Math.ceil(line.width / scale), this.maxWidth),
      );
    }
    super.measureSelf(scale);
  }
}

export function paragraph(
  parent: UINode,
  content: TextContent,
  look: ParagraphLook = {},
) {
  const node = new UIParagraph(textSource(content), look.maxWidth, {
    size: { width: pw(100), height: auto() },
    input: "none",
    style: {
      direction: "row",
      textColor: look.color ?? UI_THEME.colors.text,
      textSize: look.size ?? UI_THEME.text.body,
      lineGap: UI_THEME.paragraph.lineGap,
    },
  });
  Navi.append(node, parent);
  return node;
}
