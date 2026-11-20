import PragmaComponent from "@pragma/component";
import { Draw } from "@aurora/urp/draw/draw";
import { EMISSIVE_MATERIAL } from "@aurora/urp/draw/materials";
import type { MaterialParams } from "@aurora/urp/draw/drawTypes";
import type Material from "@aurora/material";
import AxiomMath from "@axiom/math";
import Time from "@engine/time";
import type { BuildingsID } from "../content/structures";
import { RENDER_SHEET, SORT_ORDER } from "../content/render";
import StructurePlan from "../gpu/structurePlan";
import type { BuildingPlace } from "../systems/buildings";
import Terrain from "../systems/terrain";
import { buildingSprite, type BuildingSprite } from "../world/buildingShape";

// highlight: the sprite drawn again over itself, unlit and past 1 so it blooms, its opacity
// breathing from min to max (0..255); seconds: one breath
const BUILDING_LOOK = {
  highlight: { intensity: 1.8, opacity: { min: 0, max: 180 }, seconds: 1.4 },
};

interface BuildingLookProps {
  id: BuildingsID;
  place: BuildingPlace;
}

export default class BuildingLook extends PragmaComponent {
  public highlighted = false;
  declare private sprite: BuildingSprite;
  private glow: MaterialParams | undefined;

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

  public get box() {
    return this.sprite.box;
  }

  render(): void {
    this.drawSprite(StructurePlan.materialOf("plan"), StructurePlan.paramsOf("plan"));
    if (this.highlighted && StructurePlan.materialOf("plan") === undefined) this.shineHighlight();
  }

  private shineHighlight() {
    const look = BUILDING_LOOK.highlight;
    this.glow ??= EMISSIVE_MATERIAL.pack({ intensity: look.intensity });
    const breath = (Math.sin((Time.getTimeInSeconds() / look.seconds) * Math.PI * 2) + 1) / 2;
    const opacity = AxiomMath.lerp(look.opacity.min, look.opacity.max, breath);
    this.drawSprite(EMISSIVE_MATERIAL, this.glow, [255, 255, 255, opacity]);
  }

  private drawSprite(material: Material | undefined, params: MaterialParams | undefined, tint?: RGBA) {
    const box = this.sprite.box;
    Draw.sprite({
      position: { x: box.x, y: box.y, z: SORT_ORDER.camp },
      size: { width: box.w, height: box.h },
      texture: RENDER_SHEET.buildings,
      crop: this.sprite.crop,
      flipX: this.sprite.flip,
      tint: tint,
      material: material,
      params: params,
    });
  }
}
