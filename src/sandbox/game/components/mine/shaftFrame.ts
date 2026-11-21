import PragmaComponent from "@pragma/component";
import { Draw, Light } from "@aurora/urp/draw/draw";
import AxiomMath from "@axiom/math";
import { STRUCTURES } from "../../content/structures";
import { RENDER_SHEET, SORT_ORDER } from "../../content/render";
import StructurePlan from "../../gpu/structurePlan";
import Discovery from "../../systems/world/discovery";
import Terrain from "../../systems/world/terrain";
import GameEvents from "../../systems/core/gameEvents";
import { glowMaterial, glowParams, shine } from "../common/lamp";

interface ShaftLamp {
  position: Position2D;
  phase: number;
}

export default class ShaftFrame extends PragmaComponent {
  private lamps: ShaftLamp[] = [];
  declare private terrain: Terrain;
  declare private discovery: Discovery;

  awake(): void {
    this.terrain = this.scene.getSystem(Terrain);
    this.discovery = this.scene.getSystem(Discovery);
    const events = this.scene.getSystem(GameEvents);
    this.connect(events.shaft.deepened, () => this.hangLamps());
  }

  start(): void {
    this.hangLamps();
  }

  render(): void {
    const plan = StructurePlan.flat(STRUCTURES.plan.line * this.terrain.tile);
    const look = STRUCTURES.shaft.look;
    const tile = this.terrain.tile;
    const corner = this.actor.transform.getPosition();
    const size = this.size;
    const segment = look.segment;
    const halfWidth = size.width / look.halves;
    const height = (halfWidth * segment.height) / segment.width;
    for (let top = 0; top < size.height; top += height) {
      const shown = Math.min(height, size.height - top);
      for (let half = 0; half < look.halves; half++)
        Draw.sprite({
          position: { x: corner.x + half * halfWidth, y: corner.y + top, z: SORT_ORDER.shaft },
          size: { width: halfWidth, height: shown },
          texture: RENDER_SHEET.buildings,
          crop: { x: segment.x, y: segment.y, width: segment.width, height: (segment.height * shown) / height },
          material: StructurePlan.materialOf("plan"),
          params: StructurePlan.paramsOf("plan"),
        });
    }

    Light.rect({
      position: { x: corner.x, y: corner.y },
      size: size,
      color: look.glow.color,
      intensity: look.glow.intensity,
      softness: look.glow.softness * tile,
    });

    for (const lamp of this.lamps) {
      shine(look.lamps.light, lamp.position, lamp.phase);
      Draw.circle({
        ...plan,
        material: glowMaterial("flat"),
        params: glowParams(look.lamps.light, "flat"),
        position: {
          x: lamp.position.x,
          y: lamp.position.y,
          z: SORT_ORDER.shaftFront,
        },
        radius: look.lamps.radius * tile,
        color: look.lamps.color,
      });
    }
  }

  private hangLamps() {
    const positions = this.lampPositions(this.actor.transform.getPosition());
    for (const position of positions.slice(this.lamps.length)) {
      this.lamps.push({
        position: position,
        phase: AxiomMath.randomFloat(0, 1000),
      });
      this.discovery.revealAround(position, STRUCTURES.shaft.look.lamps.reveal);
    }
  }

  private lampPositions(corner: Position2D) {
    const look = STRUCTURES.shaft.look;
    const tile = this.terrain.tile;
    const post = look.post.width * tile;
    const positions: Position2D[] = [];
    for (
      let row = look.lamps.from;
      row <= this.terrain.world.shaftDepth;
      row += look.lamps.every
    )
      for (const x of [
        corner.x + post / 2,
        corner.x + this.size.width - post / 2,
      ])
        positions.push({ x: x, y: corner.y + row * tile });
    return positions;
  }

  private get size(): Size2D {
    const tile = this.terrain.tile;
    return {
      width: STRUCTURES.shaft.width * tile,
      height: (this.terrain.world.shaftDepth + 1) * tile,
    };
  }
}
