import Navi from "@navi/navi";
import UINode, { NodeProps } from "@navi/node";
import UIScrollBar from "@navi/elements/scrollbar";
import { ph, pw, px } from "@navi/units";
import InputManager from "@engine/inputManager";
import AxiomMath from "@axiom/math";
import { COLOR } from "@axiom/color";
import { UI_SHEET, UI_THEME } from "../../content/ui";
import { row } from "./row";

export interface ScrollListOptions {
  width: number;
  height: number;
  offset?: number;
  autoScroll?: boolean;
  paper?: boolean;
}

// scrolling is pure UI, so it can run in tick (unlike button actions)
class UIScrollArea extends UINode {
  private anchor: Position2D | undefined;

  constructor(
    private readonly autoScroll: boolean,
    props: NodeProps,
  ) {
    super(props);
  }

  public tick(dt: number) {
    if (!this.autoScroll) return;
    const mouse = InputManager.getMousePos();
    if (InputManager.isMouseClicked("MIDDLE") && this.hoveredWithin)
      this.anchor = { x: mouse.x, y: mouse.y };
    if (!this.anchor) return;
    if (!InputManager.isMouseHold("MIDDLE")) {
      this.anchor = undefined;
      return;
    }
    const auto = UI_THEME.scroll.auto;
    const distance = mouse.y - this.anchor.y;
    const beyond = Math.max(0, Math.abs(distance) - auto.deadzone);
    if (beyond === 0) return;
    const step = Math.sign(distance) * beyond * auto.speed * dt;
    this.scrollOffset.y = AxiomMath.clamp(this.scrollOffset.y - step, -this.maxScroll("y"), 0);
    Navi.markLayoutDirty();
    Navi.markScrolled();
  }
}

export function scrollList(parent: UINode, options: ScrollListOptions) {
  const colors = UI_THEME.colors;
  const scroll = UI_THEME.scroll;
  const body = row(parent, { fit: true });
  const frame = UI_SHEET.frameList;
  const isPaper = options.paper ?? true;
  const barWidth = isPaper ? 10 : scroll.width;
  const areaWidth = options.width - barWidth - UI_THEME.spacing.gap;
  const scrollHost = isPaper
    ? Navi.append(
        new UINode({
          size: { width: px(areaWidth), height: px(options.height) },
          input: "none",
          style: {
            backgroundColor: COLOR.WHITE,
            backgroundImage: UI_SHEET.image,
            backgroundImageCrop: frame.crop,
            backgroundImageSlice: frame.slice,
            padding: { top: 10, right: 10, bottom: 10, left: 10 },
          },
        }),
        body,
      )
    : body;
  const list = Navi.append(
    new UIScrollArea(options.autoScroll ?? false, {
      size: isPaper
        ? { width: pw(100), height: ph(100) }
        : { width: px(areaWidth), height: px(options.height) },
      style: {
        backgroundColor: colors.transparent,
        padding: isPaper ? { top: 4, right: 4, bottom: 4, left: 6 } : { top: 0, right: 0, bottom: 0, left: 0 },
        layout: "stack",
        direction: "col",
        alignCross: "stretch",
        gap: UI_THEME.spacing.listGap,
        overflowY: "scroll",
      },
    }),
    scrollHost,
  );
  list.scrollOffset.y = options.offset ?? 0;
  const track = UI_SHEET.scrollTrack;
  const thumb = UI_SHEET.scrollThumb;
  Navi.append(
    new UIScrollBar(list, "y", {
      size: { width: px(barWidth), height: px(options.height) },
      style: isPaper
        ? {
            backgroundColor: COLOR.WHITE,
            backgroundImage: UI_SHEET.image,
            backgroundImageCrop: track.crop,
            backgroundImageSlice: track.slice,
          }
        : { backgroundColor: colors.scrollTrack, rounded: UI_THEME.radius.scroll },
      thumb: {
        style: isPaper
          ? {
              backgroundColor: COLOR.WHITE,
              backgroundImage: UI_SHEET.image,
              backgroundImageCrop: thumb.crop,
              backgroundImageSlice: thumb.slice,
              transitionMs: UI_THEME.motion.hoverMs,
            }
          : {
              backgroundColor: colors.scrollThumb,
              rounded: UI_THEME.radius.scroll,
              transitionMs: UI_THEME.motion.hoverMs,
            },
        states: {
          hovered: {
            backgroundColor: isPaper ? UI_THEME.paper.hoverTint : colors.scrollThumbHover,
          },
        },
      },
    }),
    body,
  );
  return list;
}
