import PragmaComponent from "@pragma/component";
import type BuildSpace from "../../build/space";
import type { BuildLayer, Removable, SpaceEntry, SpaceShape } from "../../build/space";
import { BUILD_SPACE } from "../../sceneData";

export interface BuildFootprintProps {
  layer?: BuildLayer;
  shape: SpaceShape;
  hitShape?: SpaceShape;
  showReserve?: Box;
  removable?: Removable;
}

export default class BuildFootprint extends PragmaComponent {
  private readonly entry: SpaceEntry;
  private space: BuildSpace | undefined;
  private attached = false;

  constructor(internal: InternalPCProps, props: BuildFootprintProps) {
    super(internal);
    this.entry = {
      id: this.actor.ID,
      layer: props.layer ?? "main",
      shape: props.shape,
      hitShape: props.hitShape,
      showReserve: props.showReserve,
      removable: props.removable,
    };
  }

  awake(): void {
    this.space = this.scene.sharedData.require(BUILD_SPACE);
    this.onActorEvent("broken", () => this.detach());
    this.attached = true;
    this.space.add(this.entry);
  }

  destroy(): void {
    this.detach();
  }

  public detach() {
    if (!this.attached) return;
    this.attached = false;
    this.space?.remove(this.entry.id);
  }

  public updateShape(shape: SpaceShape, hitShape?: SpaceShape, showReserve?: Box) {
    this.entry.shape = shape;
    this.entry.hitShape = hitShape;
    this.entry.showReserve = showReserve;
    if (this.attached) this.space?.move(this.entry.id, shape, hitShape, showReserve);
  }
}
