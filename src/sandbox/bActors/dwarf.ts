import Vec2 from "@axiom/vec2";
import PragmaActor from "@pragma/actor";
import type { ByteReader, ByteWriter } from "@axiom/bytes";
import Physics from "../components/physics";
import Stats from "../components/stats";
import Sprite from "../components/sprite";
import { DWARFS, DwarfsID } from "../content/dwarfs";
import { SPRITES } from "../content/sprites";
import { RENDER_ORDER } from "../configs";
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
    this.physics = this.addComponent(Physics, {
      type: "rigid",
      velocity: props.velocity.scale(props.launchSpeed),
      body: { type: "circle", radius: 110 / 2 },
      baseSpeed: data.baseSpeed,
    });
    this.stats = this.addComponent(Stats, {
      kind: "dwarf",
      baseDmg: data.baseDmg,
      baseSpeed: 0,
      beerLeft: props.beerLeft ?? 10,
      beerPerMinute: data.bpm,
    });
    this.addComponent(Sprite, {
      crop: data.crop,
      sprite: SPRITES.dwarfs,
      zIndex: RENDER_ORDER.main,
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
