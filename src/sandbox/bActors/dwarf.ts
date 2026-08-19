import Vec2 from "@/core/axiom/vec2";
import PragmaActor from "@/core/pragma/actor";
import Physics from "../components/physics";
import Stats from "../components/stats";
import Sprite from "../components/sprite";
interface DwarfProps {
  position: Position2D;
  velocity: Vec2;
  launchSpeed: number;
}
export default class Dwarf extends PragmaActor {
  constructor(props: DwarfProps) {
    super();
    this.transform.setPosition(props.position.x, props.position.y);
    this.tags.add("dwarf");
    this.tags.add("friendly");

    this.addComponent(Physics, {
      type: "rigid",
      velocity: props.velocity.scale(props.launchSpeed),
      body: { type: "circle", radius: 110 / 2 },
      baseSpeed: 400,
    });
    this.addComponent(Stats, {
      kind: "dwarf",
      baseDmg: 10,
      baseSpeed: 0,
      beerLeft: 10,
      beerPerMinute: 10,
    });
    this.addComponent(Sprite, {
      crop: { x: 0, y: 0, width: 110, height: 110 },
      sprite: "chars",
    });
  }
}
