import PragmaActor from "@pragma/actor";
import type { ByteReader, ByteWriter } from "@axiom/bytes";
import { COLOR } from "@axiom/color";
import Physics from "../components/physics";
import Shape from "../components/shape";
import { OBJECTS, ObjectsID } from "../content/objects";
import { RENDER_ORDER } from "../configs";

interface PalisadeProps {
  position: Position2D;
  rotation: number;
}

// built by the player: a wall the balls bounce off
export default class Palisade extends PragmaActor {
  constructor(props: PalisadeProps) {
    super();
    this.transform.setPosition(props.position.x, props.position.y);
    this.transform.setRotation(props.rotation);
    const shape = OBJECTS[ObjectsID.palisade].shape;
    this.addComponent(Shape, {
      size: { width: shape.w, height: shape.h },
      color: COLOR.BROWN,
      zIndex: RENDER_ORDER.main,
    });
    this.addComponent(Physics, { type: "static", body: shape });
  }

  public save(writer: ByteWriter) {
    const position = this.transform.getPosition();
    writer.f64(position.x);
    writer.f64(position.y);
    writer.f32(this.transform.getWorldRotation());
    return true;
  }

  public static load(reader: ByteReader) {
    return new Palisade({
      position: { x: reader.f64(), y: reader.f64() },
      rotation: reader.f32(),
    });
  }
}
