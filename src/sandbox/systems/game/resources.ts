import { GameResourcesID, RESOURCES } from "../../content/resources";
import PragmaSystem from "@pragma/system";
import type { TileMinedEvent } from "./terrain";
import { BLOCKS } from "../../content/blocks";
import { SPRITES } from "../../content/sprites";
import Navi from "@navi/navi";
import UINode from "@navi/node";
import { auto, px } from "@navi/units";
import UIText from "@navi/elements/text";
import type { Tween } from "@navi/tween";
import AxiomColor from "@axiom/color";
import { DrawGui } from "@aurora/urp/draw/draw";

const RESOURCE_COUNT =
  Object.keys(GameResourcesID).filter((k) => isNaN(Number(k))).length - 1; // no none - all class need to -1 index

// what the panel shows: what the mine gives, the rest has no source yet
const SHOWN: GameResourcesID[] = [
  GameResourcesID.stone,
  GameResourcesID.bones,
  GameResourcesID.coal,
  GameResourcesID.copper,
  GameResourcesID.silver,
  GameResourcesID.gold,
  GameResourcesID.sapphire,
  GameResourcesID.diamonds,
];

const LOOK = {
  plate: [22, 17, 14, 205] as RGBA,
  rim: [120, 88, 56, 220] as RGBA,
  number: [242, 228, 204, 255] as RGBA,
  shadow: AxiomColor.withAlpha([0, 0, 0, 255], 140),
  icon: 30,
  textSize: 19,
  // an empty slot stays faint
  emptyAlpha: 0.35,
  // a slot bumps up when it gains
  pop: { ms: 220, amount: 0.35 },
  // a precious one also flares gold behind its icon
  flare: { seconds: 0.7, color: [255, 200, 90, 255] as RGBA, radius: 20 },
};
const PRECIOUS: GameResourcesID[] = [
  GameResourcesID.silver,
  GameResourcesID.gold,
  GameResourcesID.sapphire,
  GameResourcesID.diamonds,
];

// one resource in the panel: icon and amount
class ResourceSlot extends UINode {
  // 1 right after a precious gain, down to 0
  private flare = 0;

  constructor(
    private readonly amount: () => number,
    private readonly precious: boolean,
  ) {
    super({
      size: { width: auto(), height: auto() },
      input: "absorb",
      style: {
        backgroundColor: [0, 0, 0, 0],
        layout: "stack",
        direction: "row",
        alignCross: "center",
        gap: 6,
        origin: { x: 0.5, y: 0.5 },
      },
    });
  }

  public tick(dt: number) {
    if (!this.isTweening) this.motion.alpha = this.amount() > 0 ? 1 : LOOK.emptyAlpha;
    this.flare = Math.max(0, this.flare - dt / LOOK.flare.seconds);
  }

  // the glow under the icon (the row's first child, as tall as the row)
  public draw(box: Box) {
    if (this.flare > 0) {
      const scale = Navi.getScale;
      const strength = this.flare * this.flare;
      DrawGui.circle({
        position: { x: box.x + box.h / 2, y: box.y + box.h / 2 },
        radius: LOOK.flare.radius * scale,
        color: AxiomColor.withAlpha(LOOK.flare.color, 120 * strength),
        shadow: { color: AxiomColor.withAlpha(LOOK.flare.color, 220 * strength), blur: 18 * scale },
      });
    }
    super.draw(box);
  }

  public pop() {
    if (this.precious) this.flare = 1;
    this.stopAllTweens();
    const pop: Tween = {
      ms: LOOK.pop.ms,
      loop: false,
      delay: 0,
      elapsed: 0,
      onDone: undefined,
      sample: (t) => {
        const scale = 1 + Math.sin(t * Math.PI) * LOOK.pop.amount;
        return { scaleX: scale, scaleY: scale };
      },
    };
    this.play(pop);
  }
}

export default class PlayerResources extends PragmaSystem {
  private panel!: UINode;
  // per resource id, undefined for the ones the panel does not show
  private slots: (ResourceSlot | undefined)[] = [];
  private resList: number[] = new Array(RESOURCE_COUNT).fill(0);

  constructor(internal: InternalPSProps) {
    super(internal);
  }
  awake(): void {
    this.onSceneEvent<TileMinedEvent>("tileMined", (event) =>
      this.blockMined(event),
    );
    this.buildPanel();
  }

  destroy(): void {
    Navi.remove(this.panel, Navi.root);
  }

  // [id, amount] of what the player has, for the save
  public snapshot(): [GameResourcesID, number][] {
    const pairs: [GameResourcesID, number][] = [];
    this.resList.forEach((amount, slot) => {
      if (amount > 0) pairs.push([slot + 1, amount]);
    });
    return pairs;
  }

  // ids this game does not know are skipped, the missing ones stay at 0
  public restore(pairs: readonly [number, number][]) {
    this.resList.fill(0);
    for (const [id, amount] of pairs) {
      const slot = id - 1;
      if (slot >= 0 && slot < this.resList.length) this.resList[slot] = amount;
    }
  }

  public addResource(res: GameResourcesID, value: number) {
    this.resList[res - 1] += value;
    this.slots[res]?.pop();
  }
  public removeResource(res: GameResourcesID, value: number) {
    const amount = this.resList[res - 1];
    if (amount < value) return;
    this.resList[res - 1] -= value;
  }
  public hasEnough(res: GameResourcesID, value: number) {
    return this.resList[res - 1] >= value;
  }
  public blockMined(event: TileMinedEvent) {
    const res = BLOCKS[event.type].resource;
    if (!res) return;
    this.addResource(res, 1);
  }

  private amount(res: GameResourcesID) {
    return this.resList[res - 1];
  }

  private buildPanel() {
    const panel = Navi.append(
      new UINode({
        position: { x: px(16), y: px(16) },
        size: { width: auto(), height: auto() },
        style: {
          anchorX: "end",
          backgroundColor: LOOK.plate,
          rounded: 12,
          outline: { width: 2, color: LOOK.rim },
          shadow: { color: LOOK.shadow, offset: { x: 0, y: 4 }, blur: 14 },
          layout: "stack",
          direction: "row",
          alignCross: "center",
          gap: 18,
          padding: { top: 8, right: 16, bottom: 8, left: 16 },
        },
      }),
    );
    this.panel = panel;
    for (const res of SHOWN) {
      const slot = Navi.append(
        new ResourceSlot(() => this.amount(res), PRECIOUS.includes(res)),
        panel,
      ) as ResourceSlot;
      this.slots[res] = slot;

      Navi.append(
        new UINode({
          size: { width: px(LOOK.icon), height: px(LOOK.icon) },
          input: "none",
          style: {
            backgroundImage: SPRITES.icons,
            backgroundImageCrop: RESOURCES[res].crop,
          },
        }),
        slot,
      );
      Navi.append(
        new UIText(() => String(this.amount(res)), {
          size: { width: auto(), height: auto() },
          input: "none",
          style: {
            textColor: LOOK.number,
            textSize: LOOK.textSize,
            textShadow: { color: LOOK.shadow, offset: { x: 0, y: 1 }, blur: 2 },
          },
        }),
        slot,
      );
    }
  }
}
