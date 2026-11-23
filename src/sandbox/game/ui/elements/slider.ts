import Navi from "@navi/navi";
import UINode, { KeyInput, NodeProps } from "@navi/node";
import { pw, px } from "@navi/units";
import InputManager from "@engine/inputManager";
import AxiomMath from "@axiom/math";
import { COLOR } from "@axiom/color";
import { UI_SHEET, UI_THEME } from "../../content/ui";

export interface SliderOptions {
  min: number;
  max: number;
  step?: number;
  value?: number;
  width?: number;
}

// no change callback: dragging runs inside Navi's phases, so the owner reads `value`
// (live labels through text(() => ...), actions on its own buttons)
export class UISlider extends UINode {
  private readonly thumb: UINode;
  private current: number;

  constructor(
    private readonly options: SliderOptions,
    props: NodeProps,
    thumb: NodeProps,
  ) {
    super(props);
    this.current = this.snap(options.value ?? options.min);
    this.thumb = new UINode(thumb);
    this.thumb.parent = this;
    this.children.push(this.thumb);
  }

  public get value() {
    return this.current;
  }

  public setValue(value: number) {
    this.current = this.snap(value);
    Navi.markLayoutDirty();
  }

  public onPress(mouse: Position2D) {
    this.pick(mouse.x);
  }

  public onDrag() {
    this.pick(InputManager.getMousePos().x);
  }

  public onKeys(input: KeyInput) {
    for (const key of input.keys) {
      if (key === "ArrowLeft") this.setValue(this.current - this.keyStep);
      if (key === "ArrowRight") this.setValue(this.current + this.keyStep);
    }
  }

  // a smooth slider still moves by a hundredth of its range per press
  private get keyStep() {
    const step = this.options.step ?? 1;
    if (step > 0) return step;
    return (this.options.max - this.options.min) / 100;
  }

  public layoutChildren(scale: number) {
    const thumbWidth = UI_THEME.slider.thumb * scale;
    const offset = this.ratio * (this.pixelBox.w - thumbWidth);
    this.thumb.setBox(
      this.pixelBox.x + offset,
      this.pixelBox.y,
      thumbWidth,
      this.pixelBox.h,
    );
  }

  private get ratio() {
    const range = this.options.max - this.options.min;
    if (range <= 0) return 0;
    return (this.current - this.options.min) / range;
  }

  private pick(mouseX: number) {
    const thumbWidth = UI_THEME.slider.thumb * Navi.getScale;
    const travel = this.pixelBox.w - thumbWidth;
    if (travel <= 0) return;
    const ratio = AxiomMath.clamp(
      (mouseX - this.pixelBox.x - thumbWidth / 2) / travel,
      0,
      1,
    );
    this.setValue(AxiomMath.lerp(this.options.min, this.options.max, ratio));
  }

  private snap(value: number) {
    const step = this.options.step ?? 1;
    const min = this.options.min;
    const snapped =
      step > 0 ? min + Math.round((value - min) / step) * step : value;
    return AxiomMath.clamp(snapped, min, this.options.max);
  }
}

export function slider(parent: UINode, options: SliderOptions) {
  const track = UI_SHEET.barTrack;
  const knob = UI_SHEET.sliderKnob;
  const node = new UISlider(
    options,
    {
      size: {
        width: options.width === undefined ? pw(100) : px(options.width),
        height: px(UI_THEME.slider.height),
      },
      input: "absorb",
      focusable: true,
      wantsKeys: true,
      style: {
        backgroundColor: COLOR.WHITE,
        backgroundImage: UI_SHEET.image,
        backgroundImageCrop: track.crop,
        backgroundImageSlice: track.slice,
      },
      states: {
        focused: { backgroundColor: UI_THEME.paper.hoverTint },
      },
    },
    {
      input: "none",
      inheritState: true,
      style: {
        backgroundColor: COLOR.WHITE,
        backgroundImage: UI_SHEET.image,
        backgroundImageCrop: knob.crop,
        transitionMs: UI_THEME.motion.hoverMs,
      },
      states: { hovered: { backgroundColor: UI_THEME.paper.hoverTint } },
    },
  );
  Navi.append(node, parent);
  return node;
}
