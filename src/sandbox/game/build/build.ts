import type PragmaScene from "@pragma/scene";
import type { ResourceCost } from "../content/resources";
import type { Stock } from "../components/common/storage";
import type Terrain from "../systems/world/terrain";
import type World from "../world/world";
import type BuildSpace from "./space";
import type { BuildLayer, SpaceShape } from "./space";

export interface Refusal {
  readonly reason: string;
  readonly tiles: Position2D[];
}

export interface OutlineLook {
  readonly fill: RGBA;
  readonly border: RGBA;
}

export interface Placement {
  readonly tiles: Position2D[];
  readonly spaceShape?: SpaceShape;
  readonly base?: Box;
  readonly rect?: Rect;
  readonly reserve?: Box;
}

export interface BuildRule<T extends Placement = Placement> {
  check(placement: T, ctx: BuildContext): Refusal | undefined;
}

export interface BuildTool {
  readonly hint?: string;
  onPick?(ctx: BuildContext): boolean;
  update(ctx: BuildContext): void;
  render(ctx: BuildContext): void;
  cancel?(): void;
}

export interface BuildContext {
  readonly scene: PragmaScene;
  readonly terrain: Terrain;
  readonly world: World;
  readonly tile: number;
  readonly space: BuildSpace;
  readonly store: Stock;
  readonly layer: BuildLayer;
  readonly asking: boolean;
  readonly hoveredUi: boolean;
  mouseWorld(): Position2D;
  mouseSpot(): Position2D;
  mouseTile(): Position2D;
  drawBox(box: Box, look: OutlineLook, border: number): void;
  drawRect(rect: Rect, look: OutlineLook, border: number): void;
  drawTiles(tiles: Position2D[], color?: RGBA): void;
  focus(box: Box): void;
  pop(message: string): void;
  hasMissing(cost: ResourceCost): boolean;
  confirmBuild(title: string, cost: ResourceCost, check: () => Refusal | undefined, build: () => void): void;
  confirmRemove(label: string, warning: string | undefined, check: () => string | undefined, remove: () => void): void;
  clearSelection(): void;
}

export function checkRules<T extends Placement>(
  rules: readonly BuildRule<T>[],
  placement: T,
  ctx: BuildContext,
): Refusal | undefined {
  for (const rule of rules) {
    const refusal = rule.check(placement, ctx);
    if (refusal !== undefined) return refusal;
  }
  return undefined;
}
