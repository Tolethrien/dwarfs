import Navi from "@navi/navi";
import UINode from "@navi/node";
import { px } from "@navi/units";

export function placeBeside(node: UINode, point: Position2D, offset: number) {
  const scale = Navi.getScale;
  const screen = Navi.root.pixelBox;
  const gap = offset * scale;
  let x = point.x + gap;
  let y = point.y + gap;
  if (x + node.pixelBox.w > screen.w) x = point.x - gap - node.pixelBox.w;
  if (y + node.pixelBox.h > screen.h) y = point.y - gap - node.pixelBox.h;
  const left = x / scale;
  const top = y / scale;
  if (left === node.position.x.value && top === node.position.y.value) return;
  node.position = { x: px(left), y: px(top) };
  Navi.markLayoutDirty();
}
