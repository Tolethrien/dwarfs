import PragmaComponent from "@pragma/component";
import { Draw } from "@aurora/urp/draw/draw";
import type { BuildingsID } from "../content/structures";
import { RENDER_SHEET, SORT_ORDER } from "../content/render";
import StructurePlan from "../gpu/structurePlan";
import type { BuildingPlace } from "../systems/buildings";
import Terrain from "../systems/terrain";
import { buildingSprite, type BuildingSprite } from "../world/buildingShape";

interface BuildingLookProps {
  id: BuildingsID;
  place: BuildingPlace;
}

export default class BuildingLook extends PragmaComponent {
  declare private sprite: BuildingSprite;

  constructor(
    internal: InternalPCProps,
    private readonly props: BuildingLookProps,
  ) {
    super(internal);
  }

  awake(): void {
    const terrain = this.scene.getSystem(Terrain);
    this.sprite = buildingSprite(this.props.id, this.props.place, terrain.tile);
  }

  render(): void {
    const box = this.sprite.box;
    Draw.sprite({
      position: { x: box.x, y: box.y, z: SORT_ORDER.camp },
      size: { width: box.w, height: box.h },
      texture: RENDER_SHEET.buildings,
      crop: this.sprite.crop,
      flipX: this.sprite.flip,
      material: StructurePlan.materialOf("plan"),
      params: StructurePlan.paramsOf("plan"),
    });
  }
}
