import PragmaSystem from "@pragma/system";
import Navi from "@navi/navi";
import UINode from "@navi/node";
import UIText from "@navi/elements/text";
import { auto, px } from "@navi/units";
import { DrawGui } from "@aurora/urp/draw/draw";
import Time from "@engine/time";
import AxiomMath from "@axiom/math";
import AxiomColor from "@axiom/color";
import Materials from "../../shaders/materials";

// pretend time of day, only shown: nothing in the game follows it (underground anyway)
const DAY = { seconds: 30, startHour: 8 };

const LOOK = {
  plate: [22, 17, 14, 215] as RGBA,
  rim: [120, 88, 56, 230] as RGBA,
  marker: [242, 210, 150, 255] as RGBA,
  text: [242, 228, 204, 255] as RGBA,
  shadow: AxiomColor.withAlpha([0, 0, 0, 255], 140),
  // the sky high up and at the horizon, by day, at dusk and dawn, at night
  sky: {
    day: { top: [70, 140, 215, 255] as RGBA, horizon: [170, 215, 240, 255] as RGBA },
    dusk: { top: [90, 80, 150, 255] as RGBA, horizon: [250, 150, 90, 255] as RGBA },
    night: { top: [10, 12, 36, 255] as RGBA, horizon: [30, 36, 80, 255] as RGBA },
  },
  star: [225, 230, 255, 255] as RGBA,
  // width in design pixels, the dome is half of it high
  width: 132,
  ground: 10,
};

// shares of the dome's radius; sun and moon live in clockSky.wgsl
const FACE = {
  sky: 0.88,
  // sun height (-1 under the ground, 1 at the top) where the day turns and the dusk is strongest
  dayFrom: -0.2,
  dayTo: 0.3,
  duskWidth: 0.35,
  // [x share across, height share, size in px, twinkle phase]
  stars: [
    [-0.62, 0.22, 1.6, 0.0],
    [-0.4, 0.55, 1.2, 1.3],
    [-0.15, 0.32, 1.8, 2.1],
    [0.05, 0.72, 1.3, 0.7],
    [0.22, 0.45, 1.6, 3.0],
    [0.45, 0.25, 1.2, 1.9],
    [0.6, 0.58, 1.5, 2.6],
    [-0.3, 0.12, 1.1, 0.4],
    [0.35, 0.1, 1.2, 2.3],
  ],
};

// half a dial over the horizon: sun and moon go round its centre, opposite each other, and set
// under the ground; the sky follows the sun, blue by day, warm at dusk and dawn, dark with stars at
// night. Sun and moon are one shader rect (clockSky.wgsl): gui shapes snap to whole pixels, moving
// slowly they would step
class ClockFace extends UINode {
  constructor(private readonly clock: GameClock) {
    super({
      size: { width: px(LOOK.width), height: px(LOOK.width / 2 + LOOK.ground) },
      input: "none",
      style: { backgroundColor: [0, 0, 0, 0] },
    });
  }

  public draw(box: Box) {
    const scale = Navi.getScale;
    const radius = box.w / 2;
    const center = { x: box.x + radius, y: box.y + radius };
    const sky = radius * FACE.sky;
    // noon at the top: the angle grows clockwise from the east, y points down
    const sunAngle = (this.clock.hour / 24) * Math.PI * 2 - Math.PI * 1.5;
    const height = -Math.sin(sunAngle);
    const day = AxiomMath.smoothstep(FACE.dayFrom, FACE.dayTo, height);
    const dusk = Math.max(0, 1 - Math.abs(height) / FACE.duskWidth);
    const colors = LOOK.sky;
    const top = AxiomMath.lerpRGBA(
      AxiomMath.lerpRGBA(colors.night.top, colors.day.top, day),
      colors.dusk.top,
      dusk * 0.5,
    );
    const horizon = AxiomMath.lerpRGBA(
      AxiomMath.lerpRGBA(colors.night.horizon, colors.day.horizon, day),
      colors.dusk.horizon,
      dusk * 0.8,
    );

    // everything of the dome stays above the ground
    DrawGui.pushClip({
      position: { x: Math.floor(box.x), y: Math.floor(box.y) },
      size: { width: Math.ceil(box.w), height: Math.round(center.y - box.y) },
    });
    DrawGui.circle({
      position: center,
      radius,
      color: LOOK.plate,
      outline: { width: 3 * scale, color: LOOK.rim },
      shadow: { color: LOOK.shadow, offset: { x: 0, y: 4 * scale }, blur: 14 * scale },
    });
    DrawGui.circle({ position: center, radius: sky, color: top });
    // the horizon glow: discs sunk under the ground, each smaller and closer to the horizon colour
    for (let layer = 1; layer <= 3; layer++) {
      const share = layer / 3;
      DrawGui.circle({
        position: { x: center.x, y: center.y + sky * 0.35 * share },
        radius: sky * (1 - 0.18 * share),
        color: AxiomColor.withAlpha(horizon, 90 + 40 * share),
      });
    }
    this.drawStars(center, sky, 1 - AxiomMath.smoothstep(-0.25, 0.15, height), scale);
    DrawGui.rect({
      position: { x: box.x, y: box.y },
      size: { width: box.w, height: radius },
      material: Materials.clockSky,
      params: [sunAngle, scale, 0, 0],
    });
    // a soft dark edge inside the dome: depth instead of a flat disc
    DrawGui.circle({
      position: center,
      radius: sky,
      color: [0, 0, 0, 0],
      shadow: { color: AxiomColor.withAlpha([0, 0, 0, 255], 120), blur: 10 * scale, inset: true },
    });
    DrawGui.popClip();

    // the ground the bodies set behind, with the marker of now in the middle of the top
    DrawGui.rect({
      position: { x: box.x, y: center.y - 2 * scale },
      size: { width: box.w, height: LOOK.ground * scale },
      color: LOOK.rim,
      rounded: 4 * scale,
      shadow: { color: LOOK.shadow, offset: { x: 0, y: 2 * scale }, blur: 6 * scale },
    });
    DrawGui.line({
      from: { x: center.x, y: center.y - radius + 1 * scale },
      to: { x: center.x, y: center.y - radius + 9 * scale },
      width: 3 * scale,
      color: LOOK.marker,
      cap: "round",
    });
  }

  private drawStars(center: Position2D, sky: number, shown: number, scale: number) {
    if (shown <= 0) return;
    for (const [across, up, size, phase] of FACE.stars) {
      const twinkle = 0.6 + 0.4 * Math.sin(this.clock.elapsed * 2.5 + phase * 2);
      DrawGui.circle({
        position: { x: center.x + across * sky, y: center.y - up * sky },
        radius: size * scale,
        color: AxiomColor.withAlpha(LOOK.star, 255 * shown * twinkle),
        shadow: { color: AxiomColor.withAlpha(LOOK.star, 120 * shown * twinkle), blur: 4 * scale },
      });
    }
  }
}

export default class GameClock extends PragmaSystem {
  // seconds since the game started, in game time
  public elapsed = 0;
  private panel!: UINode;

  constructor(internal: InternalPSProps) {
    super(internal);
  }

  awake(): void {
    this.buildPanel();
  }

  update(): void {
    this.elapsed += Time.getDeltaTime();
  }

  destroy(): void {
    Navi.remove(this.panel, Navi.root);
  }

  // 0-24
  public get hour() {
    return (DAY.startHour + (this.elapsed / DAY.seconds) * 24) % 24;
  }

  public get day() {
    return 1 + Math.floor(DAY.startHour / 24 + this.elapsed / DAY.seconds);
  }

  private get label() {
    const hour = this.hour;
    const hours = String(Math.floor(hour)).padStart(2, "0");
    const minutes = String(Math.floor((hour % 1) * 60)).padStart(2, "0");
    return `Day ${this.day} · ${hours}:${minutes}`;
  }

  private buildPanel() {
    this.panel = Navi.append(
      new UINode({
        position: { x: px(16), y: px(16) },
        size: { width: auto(), height: auto() },
        input: "none",
        style: {
          backgroundColor: [0, 0, 0, 0],
          layout: "stack",
          direction: "col",
          alignCross: "center",
          gap: 6,
        },
      }),
    );
    Navi.append(new ClockFace(this), this.panel);
    const plate = Navi.append(
      new UINode({
        size: { width: auto(), height: auto() },
        input: "none",
        style: {
          backgroundColor: LOOK.plate,
          rounded: 10,
          outline: { width: 2, color: LOOK.rim },
          padding: { top: 4, right: 12, bottom: 4, left: 12 },
        },
      }),
      this.panel,
    );
    Navi.append(
      new UIText(() => this.label, {
        size: { width: auto(), height: auto() },
        input: "none",
        style: {
          textColor: LOOK.text,
          textSize: 16,
          textShadow: { color: LOOK.shadow, offset: { x: 0, y: 1 }, blur: 2 },
        },
      }),
      plate,
    );
  }
}
