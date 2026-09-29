import { EnginePhase } from "./pragma";
import PragmaComponent from "./component";
import type PragmaActor from "./actor";
import type PragmaScene from "./scene";
import type PragmaSystem from "./system";
declare global {
  type PragmaPhase = keyof typeof EnginePhase;
  interface InternalPCProps {
    actor: PragmaActor;
  }
  type PragmaComponentClass<T extends PragmaComponent = PragmaComponent> = new (
    props: InternalPCProps,
    ...args: any[]
  ) => T;
  interface InternalPSProps {
    scene: PragmaScene;
  }
  type PragmaSystemClass<T extends PragmaSystem = PragmaSystem> = new (
    props: InternalPSProps,
    ...args: any[]
  ) => T;
  type DropFirst<T extends any[]> = T extends [any, ...infer Rest] ? Rest : [];
  type IteratedPragmaPhases = Exclude<
    PragmaPhase,
    "none" | "awake" | "destroy" | "start"
  >;
  type PragmaPhaseRegistry = Record<IteratedPragmaPhases, Set<PragmaComponent>>;
  type PragmaIndexRegistry = Record<IteratedPragmaPhases, Map<symbol, number>>;
}
