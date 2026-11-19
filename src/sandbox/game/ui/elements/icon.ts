import Navi from "@navi/navi";
import UINode from "@navi/node";
import { px } from "@navi/units";
import { UI_THEME } from "../../content/ui";
import { TextContent } from "./text";
import { tooltip } from "./tooltip";

export interface IconOptions {
  size?: number;
  image?: string;
  tooltip?: TextContent;
}

export function hasIcon(crop: Crop) {
  return crop.width > 0 && crop.height > 0;
}

export function icon(parent: UINode, crop: Crop, options: IconOptions = {}) {
  const size = options.size ?? UI_THEME.icon.size;
  const node = Navi.append(
    new UINode({
      size: { width: px(size), height: px(size) },
      // a tooltip needs the hover
      input: options.tooltip === undefined ? "none" : "absorb",
      style: {
        backgroundImage: options.image ?? UI_THEME.icon.image,
        backgroundImageCrop: crop,
      },
    }),
    parent,
  );
  if (options.tooltip !== undefined) tooltip(node, options.tooltip);
  return node;
}
