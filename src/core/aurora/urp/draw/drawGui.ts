import type TextBox from "@aurora/text/textBox";
import type GuiPass from "../passes/guiPass";
import { COLOR } from "@axiom/color";
import BaseDraw, { BoxGeometry, visibleOutline } from "./baseDraw";
import { GuiShape, InstanceWriter, writeCorners } from "./drawInternal";
import { DEFAULT_MATERIAL } from "./materials";
import type { BackdropSource } from "../backdrop/backdrop";
import type { Bounds } from "@axiom/AABB";
import type {
  DrawBackdrop,
  DrawShadow,
  GuiChar,
  GuiCircle,
  GuiEllipse,
  GuiLine,
  GuiQuad,
  GuiRect,
  GuiSprite,
  GuiText,
  GuiTextBoxStyle,
  ShapeStyle,
} from "./drawTypes";

export class GuiDraw extends BaseDraw<InstanceWriter> {
  private target: GuiPass | null = null;
  private readonly effectStyle: ShapeStyle = {};

  constructor() {
    super("DrawGui");
  }

  public setTarget(target: GuiPass) {
    this.target = target;
  }

  // box effects in order: outer shadows, backdrop, the box itself (tinting the backdrop), inner shadows
  public rect(props: GuiRect) {
    const box = this.rectBox(props);
    const source = this.classifyBackdrop(props.backdrop, box);
    this.writeShadows(props.shadow, box, props, false);
    this.writeBackdrop(props.backdrop, box, props, source);
    this.drawBox(box, props, props.color ?? COLOR.WHITE, 0, undefined);
    this.writeShadows(props.shadow, box, props, true);
  }
  public circle(props: GuiCircle) {
    const box = this.circleBox(props);
    const source = this.classifyBackdrop(props.backdrop, box);
    this.writeShadows(props.shadow, box, props, false);
    this.writeBackdrop(props.backdrop, box, props, source);
    this.drawBox(box, props, props.color ?? COLOR.WHITE, 0, undefined);
    this.writeShadows(props.shadow, box, props, true);
  }
  public ellipse(props: GuiEllipse) {
    this.drawEllipse(props, 0, undefined);
  }
  public line(props: GuiLine) {
    this.drawLine(props, 0, undefined);
  }
  public sprite(props: GuiSprite) {
    const atlas = props.atlas ?? "ui";
    const box = this.spriteBox(props, atlas);
    const source = this.classifyBackdrop(props.backdrop, box);
    this.writeShadows(props.shadow, box, props, false);
    this.writeBackdrop(props.backdrop, box, props, source);
    this.drawSprite(box, props, atlas, 0, undefined);
    this.writeShadows(props.shadow, box, props, true);
  }
  public quad(props: GuiQuad) {
    this.drawQuad(props, props.atlas ?? "ui", 0, undefined);
  }
  public text(props: GuiText) {
    this.drawText(props, 0, undefined, props.shadow);
  }
  public textBox(box: TextBox, props: GuiTextBoxStyle) {
    this.drawTextBox(box, props, 0, undefined, props.shadow);
  }
  public glyph(props: GuiChar) {
    return this.drawChar(props, 0, undefined, props.shadow);
  }

  protected get clipBuffer() {
    return this.target?.getClips ?? null;
  }
  protected pushInstance() {
    return this.target?.push() ?? null;
  }
  protected place(_view: InstanceWriter, bounds: Bounds) {
    this.target?.getBackdrops.mark(bounds);
  }
  protected textSort() {
    return undefined;
  }
  protected acceptsGlyph() {
    return true;
  }

  private writeShadows(
    shadow: DrawShadow | DrawShadow[] | undefined,
    box: BoxGeometry,
    style: ShapeStyle,
    inset: boolean,
  ) {
    if (!shadow) return;
    if (!Array.isArray(shadow)) {
      this.writeShadow(shadow, box, style, inset);
      return;
    }
    for (let i = shadow.length - 1; i >= 0; i--) {
      this.writeShadow(shadow[i], box, style, inset);
    }
  }
  private writeShadow(
    shadow: DrawShadow,
    box: BoxGeometry,
    style: ShapeStyle,
    inset: boolean,
  ) {
    if ((shadow.inset ?? false) !== inset) return;
    const effect = this.effectOf(style);
    const blur = Math.max(shadow.blur ?? 0, 0);
    const spread = shadow.spread ?? 0;
    const offsetX = shadow.offset?.x ?? 0;
    const offsetY = shadow.offset?.y ?? 0;

    const bounds = this.boxBounds(box);
    if (!inset) {
      const reach =
        Math.hypot(offsetX, offsetY) + Math.max(spread, 0) + 1.5 * blur;
      bounds.minX -= reach;
      bounds.minY -= reach;
      bounds.maxX += reach;
      bounds.maxY += reach;
    }
    const view = this.fillShape(
      effect,
      shadow.color,
      bounds,
      0,
      undefined,
      false,
    );
    if (!view) return;
    view.position(box.x, box.y);
    view.size(box.width, box.height);
    view.rotation(box.rotation);
    writeCorners(view, box.rounded);
    view.outlineWidth(blur);
    const boxOutline = inset ? this.outlineWidthOf(style, box) : 0;
    view.params(offsetX, offsetY, spread, boxOutline);
    view.shape(inset ? GuiShape.InnerShadow : GuiShape.Shadow);
  }
  private classifyBackdrop(
    backdrop: DrawBackdrop | undefined,
    box: BoxGeometry,
  ) {
    const target = this.target;
    if (!backdrop || !target || backdrop.blur <= 0) return null;
    return target.getBackdrops.classify(this.boxBounds(box), backdrop.blur);
  }
  private writeBackdrop(
    backdrop: DrawBackdrop | undefined,
    box: BoxGeometry,
    style: ShapeStyle,
    source: BackdropSource | null,
  ) {
    const target = this.target;
    if (!backdrop || !target || !source) return;
    const sigma = backdrop.blur;
    const bounds = this.boxBounds(box);
    const view = this.fillShape(
      this.effectOf(style),
      COLOR.WHITE,
      bounds,
      0,
      undefined,
      false,
    );
    if (!view) return;
    view.position(box.x, box.y);
    view.size(box.width, box.height);
    view.rotation(box.rotation);
    writeCorners(view, box.rounded);
    view.params(sigma, 0, 0, 0);
    view.shape(source === "scene" ? GuiShape.BackdropScene : GuiShape.Backdrop);
    target.getBackdrops.add(source, target.getLastIndex, bounds, sigma);
  }
  private effectOf(style: ShapeStyle) {
    const effect = this.effectStyle;
    effect.material =
      style.material?.blend === "additive" ? DEFAULT_MATERIAL : style.material;
    effect.params = style.params;
    effect.outline = undefined;
    return effect;
  }
  private outlineWidthOf(style: ShapeStyle, box: BoxGeometry) {
    const outline = visibleOutline(style.outline);
    return outline
      ? Math.min(outline.width, Math.min(box.width, box.height) / 2)
      : 0;
  }
}

export const guiDraw = new GuiDraw();
