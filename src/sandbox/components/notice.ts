import { DrawGui } from "@aurora/urp/draw/draw";
import TextLayout from "@aurora/text/textLayout";
import AxiomColor, { COLOR } from "@axiom/color";
import { Camera } from "@engine/camera/camera";
import Time from "@engine/time";
import PragmaComponent from "@pragma/component";
import Navi from "@navi/navi";
import UINode from "@navi/node";
import { pw, ph } from "@navi/units";

interface NoticeProps {
  // world units above the actor's centre
  offset: number;
  // a line always shown on the actor's centre (a placeholder building's name and state)
  title?: () => string;
}

// screen pixels (× the UI scale)
const NOTICE = {
  seconds: 1.8,
  rise: 40,
  size: 24,
  font: "lato",
  color: COLOR.IVORY,
  shadow: AxiomColor.withAlpha(COLOR.BLACK, 200),
  title: { size: 15, color: COLOR.SNOW },
};

// a short line of text over the actor that rises and fades: "not enough beer", "+1 beer". Drawn in
// the GUI: world text needs an mtsdf font and the game has only the dynamic one
export default class Notice extends PragmaComponent {
  private readonly offset: number;
  private readonly title: (() => string) | undefined;
  private text = "";
  private age = Infinity;
  declare private node: NoticeNode;

  constructor(internal: InternalPCProps, props: NoticeProps) {
    super(internal);
    this.offset = props.offset;
    this.title = props.title;
  }

  start(): void {
    this.node = Navi.append(new NoticeNode(this)) as NoticeNode;
  }

  destroy(): void {
    Navi.remove(this.node, Navi.root);
  }

  public show(text: string) {
    this.text = text;
    this.age = 0;
  }

  update(): void {
    this.age += Time.getDeltaTime();
  }

  public draw() {
    this.drawTitle();
    if (this.age >= NOTICE.seconds) return;
    const scale = Navi.getScale;
    const left = 1 - this.age / NOTICE.seconds;
    const size = NOTICE.size * scale;
    const position = this.actor.transform.getRenderPosition();
    const anchor = Camera.worldToScreen({ x: position.x, y: position.y - this.offset });
    const width = TextLayout.measure(NOTICE.font, this.text, size).width;
    const alpha = Math.min(left * 2, 1);
    DrawGui.text({
      position: {
        x: anchor.x - width / 2,
        y: anchor.y - (1 - left) * NOTICE.rise * scale - size * 1.5,
      },
      text: this.text,
      font: NOTICE.font,
      size,
      color: AxiomColor.withAlpha(NOTICE.color, 255 * alpha),
      shadow: {
        color: AxiomColor.withAlpha(NOTICE.shadow, NOTICE.shadow[3] * alpha),
        offset: { x: 0, y: 2 },
        blur: 3,
      },
    });
  }

  private drawTitle() {
    if (!this.title) return;
    const text = this.title();
    const size = NOTICE.title.size * Navi.getScale;
    const center = Camera.worldToScreen(this.actor.transform.getRenderPosition());
    const lines = text.split("\n");
    lines.forEach((line, index) => {
      const width = TextLayout.measure(NOTICE.font, line, size).width;
      DrawGui.text({
        position: {
          x: center.x - width / 2,
          y: center.y + (index - lines.length / 2) * size * 1.25,
        },
        text: line,
        font: NOTICE.font,
        size,
        color: NOTICE.title.color,
        shadow: { color: NOTICE.shadow, offset: { x: 0, y: 1 }, blur: 2 },
      });
    });
  }
}

// a see-through layer over the whole screen, only to draw its notice in the GUI pass
class NoticeNode extends UINode {
  constructor(private readonly notice: Notice) {
    super({
      size: { width: pw(100), height: ph(100) },
      input: "none",
      style: { backgroundColor: COLOR.TRANSPARENT },
    });
  }

  public draw(box: Box) {
    super.draw(box);
    this.notice.draw();
  }
}
