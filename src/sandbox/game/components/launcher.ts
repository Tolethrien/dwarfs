import PragmaComponent from "@pragma/component";
import { Draw } from "@aurora/urp/draw/draw";
import AxiomColor, { COLOR } from "@axiom/color";
import AxiomMath from "@axiom/math";
import { assert } from "@axiom/utils";
import type Dwarf from "../actors/dwarf";
import type { SpecialBeerID } from "../content/beers";
import { STRUCTURES } from "../content/structures";
import { SORT_ORDER } from "../content/render";
import Roster from "../systems/roster";
import Ball from "./ball";
import Haul from "./haul";
import Drinker from "./drinker";
import Shift from "./shift";

const LAUNCHER = {
  shotCone: AxiomMath.degToRad(50),
  maxBoost: 3,
  sling: { fullPull: 300, deadzone: 12 },
  aim: {
    length: 600,
    gap: 30,
    dot: 5,
    end: 12,
    alpha: { near: 230, far: 90 },
    weak: COLOR.WHITE,
    strong: COLOR.RED,
  },
};

export interface Waiting {
  dwarf: Dwarf;
  hours: number;
  beer: SpecialBeerID | undefined;
}

export interface LaunchAim {
  direction: Position2D;
  power: number;
}

interface LauncherProps {
  tile: number;
}

export default class Launcher extends PragmaComponent {
  public readonly queue: Waiting[] = [];
  private aim: LaunchAim | null = null;
  // known before awake: a station built this frame wakes up in the next one, its tiles are asked
  // for already
  private readonly tile: number;
  declare private roster: Roster;

  constructor(internal: InternalPCProps, props: LauncherProps) {
    super(internal);
    this.tile = props.tile;
  }

  awake(): void {
    this.roster = this.scene.getSystem(Roster);
  }

  public enqueue(dwarf: Dwarf, hours: number, beer: SpecialBeerID | undefined) {
    this.queue.push({ dwarf: dwarf, hours: hours, beer: beer });
  }

  public waiting(dwarf: Dwarf) {
    return this.queue.find((entry) => entry.dwarf === dwarf);
  }

  public remove(dwarf: Dwarf) {
    const index = this.queue.findIndex((entry) => entry.dwarf === dwarf);
    if (index !== -1) this.queue.splice(index, 1);
  }

  // the station's body in tiles, solid: the shot goes through it, the ball bounces off it after
  public get tiles(): Box {
    const center = this.actor.transform.getPosition();
    const body = STRUCTURES.station.look.body;
    const tile = this.tile;
    return {
      x: Math.round(center.x / tile - body.width / 2),
      y: Math.round(center.y / tile - body.height / 2),
      w: body.width,
      h: body.height,
    };
  }

  public contains(point: Position2D) {
    const center = this.actor.transform.getPosition();
    const body = STRUCTURES.station.look.body;
    const tile = this.tile;
    return (
      Math.abs(point.x - center.x) <= (body.width * tile) / 2 &&
      Math.abs(point.y - center.y) <= (body.height * tile) / 2
    );
  }

  public pull(from: Position2D, to: Position2D) {
    const x = from.x - to.x;
    const y = from.y - to.y;
    const length = Math.hypot(x, y);
    const sling = LAUNCHER.sling;
    if (length < sling.deadzone) {
      this.aim = null;
      return;
    }
    const side = x >= 0 ? 1 : -1;
    const angle = AxiomMath.clamp(Math.atan2(y, Math.abs(x)), -LAUNCHER.shotCone, LAUNCHER.shotCone);
    this.aim = {
      direction: { x: side * Math.cos(angle), y: Math.sin(angle) },
      power: Math.min(length / sling.fullPull, 1),
    };
  }

  public release() {
    const aim = this.aim;
    this.aim = null;
    const next = this.queue[0];
    if (!aim || !next) return;
    this.queue.shift();
    this.fire(next, aim);
  }

  public dropAim() {
    this.aim = null;
  }

  private fire(next: Waiting, aim: LaunchAim) {
    const dwarf = next.dwarf;
    const shift = dwarf.getComponent(Shift);
    assert(shift !== undefined, `Dwarf ${dwarf.name} has no Shift`);
    shift.begin(next.hours);
    if (next.beer !== undefined) {
      const drinker = dwarf.getComponent(Drinker);
      assert(drinker !== undefined, `Dwarf ${dwarf.name} has no Drinker`);
      drinker.pour(next.beer);
    }
    const ball = dwarf.getComponent(Ball);
    assert(ball !== undefined, `Dwarf ${dwarf.name} has no Ball`);
    const haul = this.getSibling(Haul);
    assert(haul !== undefined, `Launcher needs Haul on actor: ${this.actor.ID.description}`);
    ball.launch(aim.direction, AxiomMath.lerp(1, LAUNCHER.maxBoost, aim.power), this.tiles, haul);
    const center = this.actor.transform.getPosition();
    // teleport, so the render doesn't sweep from where it was last time
    dwarf.transform.teleport(center.x, center.y);
    this.scene.spawnActor(dwarf);
    this.roster.deploy(dwarf);
  }

  render(): void {
    if (this.aim) this.drawAim(this.actor.transform.getPosition(), this.aim);
  }

  private drawAim(center: Position2D, aim: LaunchAim) {
    const dots = LAUNCHER.aim;
    const z = SORT_ORDER.effects;
    const color = AxiomColor.lerpRGBA(dots.weak, dots.strong, aim.power);
    for (let distance = dots.gap; distance < dots.length; distance += dots.gap) {
      const alpha = AxiomMath.lerp(dots.alpha.near, dots.alpha.far, distance / dots.length);
      Draw.circle({
        position: {
          x: center.x + aim.direction.x * distance,
          y: center.y + aim.direction.y * distance,
          z: z,
        },
        radius: dots.dot,
        color: AxiomColor.withAlpha(color, alpha),
      });
    }
    Draw.circle({
      position: {
        x: center.x + aim.direction.x * dots.length,
        y: center.y + aim.direction.y * dots.length,
        z: z,
      },
      radius: dots.end,
      color: AxiomColor.withAlpha(color, dots.alpha.near),
    });
  }
}
