import PragmaSystem from "@pragma/system";
import { Camera } from "@engine/camera/camera";
import type { Signal } from "@axiom/events";
import { debug } from "@debug";
import { BIOMES } from "../../content/biomes";
import type Ball from "../../components/dwarfs/ball";
import { toast } from "../../ui/elements/toast";
import { WORLD } from "../../sceneData";
import type World from "../../world/world";
import BallPhysics from "./ballPhysics";
import GameEvents from "../core/gameEvents";

export interface BallEnteredBiome {
  ball: Ball;
  area: number;
  from: number;
}
export interface BiomeDiscovered {
  area: number;
  name: string;
}
export interface CameraEnteredBiome {
  area: number;
  from: number;
}
export interface BiomesSignals {
  ballEntered: Signal<BallEnteredBiome>;
  discovered: Signal<BiomeDiscovered>;
  cameraEntered: Signal<CameraEnteredBiome>;
}

export default class Biomes extends PragmaSystem {
  public readonly discovered = new Set<number>();
  public cameraArea = 0;
  private readonly world: World;
  declare private physics: BallPhysics;
  declare private events: GameEvents;

  constructor(internal: InternalPSProps) {
    super(internal);
    this.world = this.scene.sharedData.require(WORLD);
  }

  awake(): void {
    this.physics = this.scene.getSystem(BallPhysics);
    this.events = this.scene.getSystem(GameEvents);
    this.connect(this.events.biomes.discovered, (found) => toast(`Discovered: ${found.name}`));
    this.connect(this.events.biomes.ballEntered, (entry) =>
      debug.log.log(`Ball entered ${this.areaName(entry.area)} from ${this.areaName(entry.from)}`),
    );
    this.connect(this.events.biomes.cameraEntered, (entry) =>
      debug.log.log(`Camera entered ${this.areaName(entry.area)} from ${this.areaName(entry.from)}`),
    );
  }

  update(): void {
    for (const ball of this.physics.all) this.trackBall(ball);
    const area = this.areaAt(Camera.getPosition);
    if (area === this.cameraArea) return;
    const from = this.cameraArea;
    this.cameraArea = area;
    this.events.biomes.cameraEntered.emit({ area: area, from: from });
  }

  public areaName(area: number) {
    const entry = this.world.biomeAreas[area];
    return entry.name ?? BIOMES[entry.biome]?.name ?? "plain rock";
  }

  private trackBall(ball: Ball) {
    const area = this.areaAt(ball.actor.transform.getPosition());
    if (area === ball.biomeArea) return;
    const from = ball.biomeArea;
    ball.biomeArea = area;
    this.events.biomes.ballEntered.emit({ ball: ball, area: area, from: from });
    if (area === 0 || this.discovered.has(area)) return;
    this.discovered.add(area);
    this.events.biomes.discovered.emit({ area: area, name: this.areaName(area) });
  }

  private areaAt(position: Position2D) {
    const tile = this.world.worldToTile(position);
    return this.world.getBiomeArea(tile.x, tile.y);
  }
}
