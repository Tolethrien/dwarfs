import PragmaActor from "@pragma/actor";
import { rectShape, type BuildLayer } from "../build/space";
import BuildFootprint from "../components/structures/buildFootprint";
import Durability from "../components/structures/durability";
import RectLook, { type RectLookStyle } from "../components/structures/rectLook";
import SolidBody from "../components/structures/solidBody";

export interface StructureProps {
  name: string;
  rect: Rect;
  layer?: BuildLayer;
  solid?: boolean;
  hp?: number;
  look?: RectLookStyle;
  removable?: boolean;
}

export default class Structure extends PragmaActor {
  public readonly name: string;

  constructor(props: StructureProps) {
    super();
    this.name = props.name;
    this.transform.teleport(props.rect.x, props.rect.y);
    this.addComponent(BuildFootprint, {
      layer: props.layer ?? "main",
      shape: rectShape({ ...props.rect }),
      removable:
        props.removable === false
          ? undefined
          : {
              label: () => this.name,
              remove: () => {
                this.events.emit("broken", undefined);
                this.selfDestroy();
              },
            },
    });
    if (props.solid) this.addComponent(SolidBody, { rect: props.rect });
    if (props.hp !== undefined) this.addComponent(Durability, { maxHp: props.hp });
    if (props.look !== undefined) this.addComponent(RectLook, { rect: props.rect, look: props.look });
  }
}
