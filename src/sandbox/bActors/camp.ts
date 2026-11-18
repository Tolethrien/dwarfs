import PragmaActor from "@pragma/actor";
import { COLOR } from "@axiom/color";
import Physics from "../components/physics";
import Shape from "../components/shape";
import Interactive from "../components/interactive";
import Notice from "../components/notice";
import { RENDER_ORDER } from "../configs";

// camp buildings stand in as plain rects with their name on them until they get graphics; the Camp
// system builds them from its state every game, they keep nothing themselves

export type BuildingKind =
  | "tavern"
  | "market"
  | "board"
  | "treasury"
  | "distillery"
  | "alchemist"
  | "carpenter"
  | "shaft";

export interface BuildingClickedEvent {
  kind: BuildingKind;
}

interface BuildingProps {
  kind: BuildingKind;
  position: Position2D;
  size: Size2D;
  color: RGBA;
  title: () => string;
}

export class Building extends PragmaActor {
  public readonly kind: BuildingKind;
  public readonly notice: Notice;
  private readonly shape: Shape;

  constructor(props: BuildingProps) {
    super();
    this.kind = props.kind;
    this.transform.setPosition(props.position.x, props.position.y);
    this.shape = this.addComponent(Shape, {
      size: props.size,
      color: props.color,
      zIndex: RENDER_ORDER.decoBack,
    });
    this.addComponent(Interactive, {
      body: { type: "rect", w: props.size.width, h: props.size.height },
    });
    this.notice = this.addComponent(Notice, {
      offset: props.size.height / 2,
      title: props.title,
    });
    this.events.on("clicked", () =>
      this.scene.events.emit("buildingClicked", {
        kind: this.kind,
      } satisfies BuildingClickedEvent),
    );
  }

  public setColor(color: RGBA) {
    this.shape.color = color;
  }
}

// the mine shaft: balls bounce off it, the dwarf leaves it through passThrough; a click opens the
// bomb and platform menu
export class Shaft extends Building {
  public readonly physics: Physics;

  constructor(props: Omit<BuildingProps, "kind" | "color">) {
    super({ ...props, kind: "shaft", color: COLOR.CHOCOLATE });
    this.physics = this.addComponent(Physics, {
      type: "static",
      body: { type: "rect", w: props.size.width, h: props.size.height },
    });
  }
}
