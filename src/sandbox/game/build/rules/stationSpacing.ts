import AABB from "@axiom/AABB";
import AxiomMath from "@axiom/math";
import Stations from "../../systems/mine/stations";
import type { BuildRule, Placement } from "../build";

export interface StationPlacement extends Placement {
  readonly body: Box;
}

export function stationSpacing(spacing: number): BuildRule<StationPlacement> {
  return {
    check(placement, ctx) {
      const stations = ctx.scene.getSystem(Stations);
      const middle = AABB.getCenter(placement.body);
      const near = stations.stations.some(
        (station) => AxiomMath.distance2d(AABB.getCenter(stations.launcherOf(station).tiles), middle) < spacing,
      );
      if (near) return { reason: `Stations stand at least ${spacing} tiles apart`, tiles: [] };
      return undefined;
    },
  };
}
