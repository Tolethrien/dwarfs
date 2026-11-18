import PragmaComponent from "@pragma/component";
import { Draw } from "@aurora/urp/draw/draw";
import { assert } from "@axiom/utils";
import { STRUCTURES } from "../content/structures";
import { SORT_ORDER } from "../content/render";
import StructurePlan from "../gpu/structurePlan";
import Terrain from "../systems/terrain";
import { stationConnectors } from "../world/stationShape";
import { drawRail } from "../world/railShape";
import Launcher from "./launcher";

interface StationLookProps {
  name: () => string;
}

export default class StationLook extends PragmaComponent {
  declare private terrain: Terrain;

  constructor(
    internal: InternalPCProps,
    private readonly props: StationLookProps,
  ) {
    super(internal);
  }

  awake(): void {
    this.terrain = this.scene.getSystem(Terrain);
  }

  render(): void {
    const plan = StructurePlan.flat(STRUCTURES.plan.line * this.terrain.tile);
    const tile = this.terrain.tile;
    const look = STRUCTURES.station.look;
    const center = this.actor.transform.getPosition();
    const top = center.y - (look.body.height * tile) / 2;
    const bottom = center.y + (look.body.height * tile) / 2;
    Draw.rect({
      ...plan,
      position: { x: center.x - (look.body.width * tile) / 2, y: top, z: SORT_ORDER.buildings },
      size: { width: look.body.width * tile, height: look.body.height * tile },
      color: look.body.color,
    });
    Draw.rect({
      ...plan,
      position: {
        x: center.x - (look.deck.width * tile) / 2,
        y: bottom - look.deck.height * tile,
        z: SORT_ORDER.buildings,
      },
      size: { width: look.deck.width * tile, height: look.deck.height * tile },
      color: look.deck.color,
    });
    const launcher = this.getSibling(Launcher);
    assert(launcher !== undefined, `StationLook needs Launcher on actor: ${this.actor.ID.description}`);
    for (const at of stationConnectors(launcher.tiles))
      drawRail({ x: at.x, y: at.y + 1 }, { x: at.x + 1, y: at.y + 1 }, tile);
    const text = look.text;
    Draw.text({
      position: {
        x: center.x - (look.body.width * tile) / 2,
        y: top - (text.size + text.gap) * tile,
        z: SORT_ORDER.buildings,
      },
      text: `${this.props.name()} · waiting ${launcher.queue.length}`,
      size: text.size * tile,
      color: text.color,
    });
  }
}
