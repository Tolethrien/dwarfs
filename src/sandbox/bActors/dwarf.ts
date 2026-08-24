import Vec2 from "@/core/axiom/vec2";
import PragmaActor from "@/core/pragma/actor";
import Physics from "../components/physics";
import Stats from "../components/stats";
import Sprite from "../components/sprite";
import EntitiesObject, { DwarfsID } from "../managers/entitiesObject";
import { RENDER_ORDER, SPRITES } from "../managers/generalData";
interface DwarfProps {
  position: Position2D;
  velocity: Vec2;
  launchSpeed: number;
  dwarfID: DwarfsID;
}
export default class Dwarf extends PragmaActor {
  constructor(props: DwarfProps) {
    super();
    this.transform.setPosition(props.position.x, props.position.y);
    this.tags.add("dwarf");
    this.tags.add("friendly");
    const data = EntitiesObject.dwarfs[props.dwarfID];
    // console.log("Dwarf", DwarfsID[props.dwarfID], "stats:", data);
    this.addComponent(Physics, {
      type: "rigid",
      velocity: props.velocity.scale(props.launchSpeed),
      body: { type: "circle", radius: 110 / 2 },
      baseSpeed: data.baseSpeed,
    });
    this.addComponent(Stats, {
      kind: "dwarf",
      baseDmg: data.baseDmg,
      baseSpeed: 0,
      beerLeft: 10,
      beerPerMinute: data.bpm,
    });
    this.addComponent(Sprite, {
      crop: data.crop,
      sprite: SPRITES.dwarfs,
      zIndex: RENDER_ORDER.main,
    });
  }
}
