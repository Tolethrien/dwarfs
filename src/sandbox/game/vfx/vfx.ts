import type { SignalListener } from "@axiom/events";
import { BLOCKS } from "../content/blocks";
import type GameEvents from "../systems/core/gameEvents";
import type World from "../world/world";

export interface FlashProps {
  readonly x: number;
  readonly y: number;
  readonly radius: number;
  readonly intensity: number;
  readonly seconds: number;
  readonly color: RGBA;
  readonly occluded?: boolean;
}

export type VfxConnect = <T>(signal: SignalListener<T>, cb: (data: T) => void) => void;

export interface VfxContext {
  readonly world: World;
  readonly tile: number;
  readonly events: GameEvents;
  inView(x: number, y: number, width: number, height: number, margin: number): boolean;
  flash(props: FlashProps): void;
}

export interface VfxLayer {
  attach?(ctx: VfxContext, connect: VfxConnect): void;
  update?(delta: number, rawDelta: number, ctx: VfxContext): void;
  render?(ctx: VfxContext): void;
  clear?(): void;
}

// inline instead of worldToTile: called per particle per frame, no object per call
export function solidAt(world: World, tile: number, x: number, y: number) {
  return BLOCKS[world.getType(Math.floor(x / tile), Math.floor(y / tile))].solid;
}
