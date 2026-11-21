import PragmaSystem from "@pragma/system";
import AxiomMath from "@axiom/math";
import { assert } from "@axiom/utils";
import Cello from "@cello/cello";
import { Camera } from "@engine/camera/camera";
import Time from "@engine/time";
import { BlocksID, isNatural } from "../../content/blocks";
import { WORLD } from "../../sceneData";
import GameEvents from "../core/gameEvents";

const SOUNDS = {
  zoom: { full: 1, quiet: 0.125, floor: 0 },
  rate: { min: 0.5, max: 3.2 },
  pitch: 0.12,
  hit: {
    name: "blockDamage",
    category: "mineEffects",
    deflected: 0.35,
    wound: { weak: 0.5, strong: 1 },
    concurrent: 6,
    gap: 0.04,
  },
  mined: {
    name: "blockDestroy",
    category: "mineEffects",
    volume: 1,
    hit: 1,
    concurrent: 4,
    gap: 0.06,
  },
  ambient: { name: "mineAmbient", category: "ambient", volume: 0.4, pause: 2 },
};

type HitSound = typeof SOUNDS.hit | typeof SOUNDS.mined;

export default class Sounds extends PragmaSystem {
  private readonly lastPlayed = new Map<string, number>();
  private readonly position = { x: 0, y: 0 };
  private readonly tile: number;
  private zoomVolume = 1;
  declare private zoomGain: GainNode;

  constructor(internal: InternalPSProps) {
    super(internal);
    this.tile = this.scene.sharedData.require(WORLD).meta.tileInPixels;
  }

  awake(): void {
    const zoomGain = Cello.getEffectNode("zoomVolume")?.input;
    assert(
      zoomGain instanceof GainNode,
      "Sounds: the zoomVolume effect isn't registered",
    );
    this.zoomGain = zoomGain;
    const events = this.scene.getSystem(GameEvents);
    this.connect(events.terrain.deflected, (tile) =>
      this.hit(SOUNDS.hit, tile, SOUNDS.hit.deflected),
    );
    this.connect(events.terrain.damaged, (tile) => {
      const dealt = AxiomMath.clamp((tile.ratio - 0.5) / 0.5, 0, 1);
      this.hit(
        SOUNDS.hit,
        tile,
        AxiomMath.lerp(SOUNDS.hit.wound.weak, SOUNDS.hit.wound.strong, dealt),
      );
    });
    this.connect(events.terrain.mined, (tile) => {
      this.hit(SOUNDS.hit, tile, SOUNDS.mined.hit);
      this.hit(SOUNDS.mined, tile, SOUNDS.mined.volume);
    });
  }

  start(): void {
    const ambient = SOUNDS.ambient;
    // real time: a sped-up game would cut the pause short
    this.startCoroutine(
      function* loop(co) {
        while (true) {
          const sound = Cello.play(ambient.name, {
            volume: ambient.volume,
            categories: [ambient.category],
          });
          assert(sound !== undefined, `Sounds: no sound ${ambient.name}`);
          yield co.waitPromise(
            new Promise((resolve) =>
              sound.sourceNode.addEventListener("ended", resolve),
            ),
          );
          yield co.waitSeconds(ambient.pause);
        }
      },
      { key: "ambient", time: "real" },
    );
  }

  update(): void {
    const zoom = SOUNDS.zoom;
    const octaves = AxiomMath.inverseLerp(
      Math.log2(zoom.quiet),
      Math.log2(zoom.full),
      Math.log2(Camera.getZoom),
    );
    const volume = AxiomMath.lerp(
      zoom.floor,
      1,
      AxiomMath.clamp(octaves, 0, 1),
    );
    if (volume === this.zoomVolume) return;
    this.zoomVolume = volume;
    this.zoomGain.gain.value = volume;
  }

  private hit(
    sound: HitSound,
    tile: { gx: number; gy: number; type: BlocksID },
    volume: number,
  ) {
    if (!isNatural(tile.type)) return;
    const now = Cello.ctx.currentTime;
    if (now - (this.lastPlayed.get(sound.name) ?? -Infinity) < sound.gap)
      return;
    this.lastPlayed.set(sound.name, now);
    this.position.x = (tile.gx + 0.5) * this.tile;
    this.position.y = (tile.gy + 0.5) * this.tile;
    // a sped-up game hits more often: each hit quieter and faster
    const pace = Math.sqrt(Time.getSpeed());
    Cello.play(sound.name, {
      volume: volume / Math.max(pace, 1),
      randomPitch: SOUNDS.pitch,
      rate: AxiomMath.clamp(pace, SOUNDS.rate.min, SOUNDS.rate.max),
      position: this.position,
      maxConcurrent: sound.concurrent,
      effects: ["spatial", "zoomVolume"],
      categories: [sound.category],
    });
  }
}
