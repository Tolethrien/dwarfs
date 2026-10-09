import Vec2 from "@axiom/vec2";
import PragmaActor from "@pragma/actor";
import type { ByteReader, ByteWriter } from "@axiom/bytes";
import Physics from "../components/physics";
import Stats from "../components/stats";
import Sprite from "../components/sprite";
import { DWARFS, DwarfsID, randomDwarfLook } from "../content/dwarfs";
import { SPRITES } from "../content/sprites";
import { RENDER_ORDER } from "../configs";
import Headlight from "../components/headlight";
import Facing from "../components/facing";
import Trail from "../components/trail";
import Interactive from "../components/interactive";

export interface DwarfClickedEvent {
  dwarf: Dwarf;
}

// the lamp on the helmet: a warm beam where the dwarf looks
const HEADLIGHT = {
  length: 700,
  spread: 0.45,
  color: [255, 225, 170, 255] as RGBA,
  intensity: 1.4,
  glow: { radius: 40, intensity: 3 },
};
const FACING = { turnRate: 10 };
// a faint warm streak behind the flight, under the dwarf
const TRAIL = {
  seconds: 0.2,
  width: 34,
  color: [255, 220, 170, 70] as RGBA,
  zIndex: RENDER_ORDER.decoBack,
};

interface DwarfProps {
  position: Position2D;
  velocity: Vec2;
  launchSpeed: number;
  dwarfID: DwarfsID;
  // from a save, a fresh dwarf gets the full amount
  beerLeft?: number;
}
export default class Dwarf extends PragmaActor {
  public readonly dwarfID: DwarfsID;
  private physics: Physics;
  private stats: Stats;

  constructor(props: DwarfProps) {
    super();
    this.dwarfID = props.dwarfID;
    this.transform.setPosition(props.position.x, props.position.y);
    this.tags.add("dwarf");
    this.tags.add("friendly");
    const data = DWARFS[props.dwarfID];
    const body = { type: "circle", radius: 110 / 2 } as const;
    this.physics = this.addComponent(Physics, {
      type: "rigid",
      velocity: props.velocity.scale(props.launchSpeed),
      body,
      baseSpeed: data.baseSpeed,
    });
    this.addComponent(Interactive, { body });
    this.events.on("clicked", () =>
      this.scene.events.emit("dwarfClicked", {
        dwarf: this,
      } satisfies DwarfClickedEvent),
    );
    this.stats = this.addComponent(Stats, {
      kind: "dwarf",
      baseDmg: data.baseDmg,
      baseSpeed: 0,
      beerLeft: props.beerLeft ?? 10,
      beerPerMinute: data.bpm,
    });
    // only a look, not saved: a loaded dwarf may come back in another
    const look = randomDwarfLook();
    this.addComponent(Sprite, {
      crop: look.crop,
      sprite: SPRITES.dwarfs,
      zIndex: RENDER_ORDER.main,
    });
    this.addComponent(Trail, TRAIL);
    this.addComponent(Facing, FACING);
    this.addComponent(Headlight, {
      ...HEADLIGHT,
      lamp: {
        x: look.lamp.x - look.crop.width / 2,
        y: look.lamp.y - look.crop.height / 2,
      },
    });
  }

  // the rest comes from DWARFS[type]; f64 so a save round trip is exact
  public save(writer: ByteWriter) {
    const position = this.transform.getPosition();
    writer.u8(this.dwarfID);
    writer.f64(position.x);
    writer.f64(position.y);
    writer.f64(this.physics.velocity.x);
    writer.f64(this.physics.velocity.y);
    writer.f64(this.stats.data.beerLeft);
    return true;
  }

  public static load(reader: ByteReader) {
    return new Dwarf({
      dwarfID: reader.u8(),
      position: { x: reader.f64(), y: reader.f64() },
      velocity: Vec2.create(reader.f64(), reader.f64()),
      launchSpeed: 1,
      beerLeft: reader.f64(),
    });
  }
}
