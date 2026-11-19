import PragmaComponent from "@pragma/component";
import { Draw, Light } from "@aurora/urp/draw/draw";
import AxiomMath from "@axiom/math";
import Time from "@engine/time";
import type { BuildingsID } from "../content/structures";
import { RENDER_SHEET, SORT_ORDER } from "../content/render";
import StructurePlan from "../gpu/structurePlan";
import type { BuildingPlace } from "../systems/buildings";
import Terrain from "../systems/terrain";
import { buildingSprite, type BuildingSprite } from "../world/buildingShape";

// highlight: a light breathing over the whole building, to point the player at it; radius: of the
// sprite's longer side, seconds: one breath
const BUILDING_LOOK = {
  highlight: { color: [255, 220, 150, 255] as RGBA, intensity: { min: 0.2, max: 3 }, radius: 1, seconds: 1.4 },
};

interface BuildingLookProps {
  id: BuildingsID;
  place: BuildingPlace;
}

export default class BuildingLook extends PragmaComponent {
  public highlighted = false;
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
    if (this.highlighted) this.shineHighlight();
  }

  private shineHighlight() {
    const look = BUILDING_LOOK.highlight;
    const box = this.sprite.box;
    const breath = (Math.sin((Time.getTimeInSeconds() / look.seconds) * Math.PI * 2) + 1) / 2;
    Light.point({
      position: { x: box.x + box.w / 2, y: box.y + box.h / 2 },
      radius: Math.max(box.w, box.h) * look.radius,
      color: look.color,
      intensity: AxiomMath.lerp(look.intensity.min, look.intensity.max, breath),
    });
  }
}
