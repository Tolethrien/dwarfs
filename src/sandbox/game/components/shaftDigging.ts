import PragmaComponent from "@pragma/component";
import type { Signal } from "@axiom/events";
import Noise from "@axiom/noise";
import { BlocksID } from "../content/blocks";
import { STRUCTURES } from "../content/structures";
import Discovery from "../systems/discovery";
import Terrain from "../systems/terrain";
import GameEvents from "../systems/gameEvents";
import { SHAPE } from "../mapGen/shape";
import { shaftColumns, shaftHole, stationCrater, stationCraterBottom } from "../world/shaftShape";

// deepened: the shaft's new bottom, in tiles from the map's top (World.shaftDepth)
export interface ShaftSignals {
  deepened: Signal<number>;
}

interface ShaftDiggingProps {
  seed: number;
}

export default class ShaftDigging extends PragmaComponent {
  private readonly noise: Noise;
  declare private terrain: Terrain;
  declare private discovery: Discovery;
  declare private events: GameEvents;

  constructor(internal: InternalPCProps, props: ShaftDiggingProps) {
    super(internal);
    this.noise = new Noise(props.seed);
  }

  awake(): void {
    this.terrain = this.scene.getSystem(Terrain);
    this.discovery = this.scene.getSystem(Discovery);
    this.events = this.scene.getSystem(GameEvents);
  }

  public outline(segment: number): Box {
    const columns = shaftColumns(this.terrain.world);
    return {
      x: columns.from,
      y: this.terrain.world.shaftDepth + 1,
      w: columns.to - columns.from + 1,
      h: segment,
    };
  }

  public fits(segment: number) {
    const world = this.terrain.world;
    // the map's bottom frame at its widest
    const frame = SHAPE.margin.base + SHAPE.margin.wave;
    return stationCraterBottom(world, world.shaftDepth + segment) < world.mapInTiles.height - frame;
  }

  // the first segment, from the surface down
  public open() {
    this.dig(0, STRUCTURES.shaft.startDepth);
  }

  public deepen(segment: number) {
    const world = this.terrain.world;
    this.dig(world.shaftDepth + 1, world.shaftDepth + segment);
  }

  private dig(fromRow: number, bottom: number) {
    const world = this.terrain.world;
    const hole = shaftHole(world, this.noise, fromRow, bottom);
    for (const tile of hole.structure) this.terrain.place(tile.x, tile.y, BlocksID.structure);
    for (const tile of hole.open) this.terrain.place(tile.x, tile.y, BlocksID.air);
    const crater = stationCrater(world, this.noise, bottom);
    for (const tile of crater) this.terrain.clear(tile.x, tile.y);
    world.shaftDepth = bottom;
    this.discovery.revealTiles([...hole.structure, ...hole.open, ...crater]);
    this.discovery.revealCrater();
    this.events.shaft.deepened.emit(bottom);
  }
}
