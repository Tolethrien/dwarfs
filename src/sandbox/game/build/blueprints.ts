import Grid from "@axiom/grid";
import { assert } from "@axiom/utils";
import { STATION } from "../actors/station";
import Structure from "../actors/structure";
import type { RectLookStyle } from "../components/structures/rectLook";
import ShaftDigging from "../components/mine/shaftDigging";
import type { ResourceCost } from "../content/resources";
import { STRUCTURES, type BuildingsID } from "../content/structures";
import { CAMP_BUILDINGS, MINE_SHAFT } from "../sceneData";
import Rails from "../systems/mine/rails";
import Stations from "../systems/mine/stations";
import { buildingPlaceAt, type BuildingPlace } from "../world/buildingShape";
import { RAILS, drawRail, jointAt, railEnd, railTiles, railToward } from "../world/railShape";
import { stationBodyAt, stationFootprint } from "../world/stationShape";
import type { BuildRule, BuildTool, Placement } from "./build";
import { BUILD_LOOK } from "./look";
import { aboveShaftBottom } from "./rules/aboveShaftBottom";
import { clearSpace } from "./rules/clearSpace";
import { discovered } from "./rules/discovered";
import { dugOut } from "./rules/dugOut";
import { insideMap } from "./rules/insideMap";
import { jointSpacing, type JointPlacement } from "./rules/jointSpacing";
import { maxDepth } from "./rules/maxDepth";
import { railAnchored, railBranching, railClearance, type RailPlacement } from "./rules/railRules";
import { shaftFitsMap, shaftLimit } from "./rules/shaftRules";
import { stationSpacing, type StationPlacement } from "./rules/stationSpacing";
import { uniqueBuilding } from "./rules/uniqueBuilding";
import { boxShape, rectShape, tilesOfShape, type BuildLayer } from "./space";
import { drag } from "./tools/drag";
import { fixed } from "./tools/fixed";
import { removeTool } from "./tools/remove";
import { stamp } from "./tools/stamp";

const BLUEPRINTS = {
  railReach: 1.5,
};

interface BuildingPlacement extends Placement {
  readonly place: BuildingPlace;
}

interface StructurePlacement extends Placement {
  readonly rect: Rect;
}

export interface StructureBlueprintConfig {
  readonly name: string;
  readonly cost: ResourceCost;
  readonly size: Size2D;
  readonly layer?: BuildLayer;
  readonly rotatable?: boolean;
  readonly solid?: boolean;
  readonly hp?: number;
  readonly look?: RectLookStyle;
  readonly rules?: readonly BuildRule<StructurePlacement>[];
}

export function shaftSegmentTool(segment: number, title: string, cost: ResourceCost): BuildTool {
  return fixed({
    title: title,
    cost: cost,
    locate(ctx) {
      const digging = ctx.scene.sharedData.require(MINE_SHAFT).getComponent(ShaftDigging);
      assert(digging !== undefined, "The shaft has no ShaftDigging");
      return { base: digging.outline(segment), tiles: [] };
    },
    pickRules: [shaftLimit(segment), shaftFitsMap(segment)],
    build(_placement, ctx) {
      const digging = ctx.scene.sharedData.require(MINE_SHAFT).getComponent(ShaftDigging);
      assert(digging !== undefined, "The shaft has no ShaftDigging");
      digging.deepen(segment);
    },
  });
}

export function buildingTool(id: BuildingsID, title: string, cost: ResourceCost): BuildTool {
  return stamp<BuildingPlacement>({
    title: title,
    cost: cost,
    locate(anchor, _rotation, ctx) {
      const place = buildingPlaceAt(ctx.world, id, anchor);
      return {
        place: place,
        base: place.base,
        reserve: place.reserve,
        tiles: Grid.tilesIn(place.base),
        spaceShape: boxShape(place.reserve),
      };
    },
    rules: [
      uniqueBuilding(id),
      insideMap(),
      maxDepth(STRUCTURES.buildings.maxDepth, `Buildings stand only down to ${STRUCTURES.buildings.maxDepth} tiles`),
      aboveShaftBottom({ reason: "It goes only by the shaft, not under it" }),
      discovered(),
      clearSpace({ reason: "Something else keeps this room" }),
      dugOut(),
    ],
    build(placement, ctx) {
      ctx.scene.sharedData.require(CAMP_BUILDINGS).build(id, placement.place);
    },
  });
}

export function stationTool(title: string, cost: ResourceCost): BuildTool {
  return stamp<StationPlacement>({
    title: title,
    cost: cost,
    locate(anchor) {
      const body = stationBodyAt(anchor);
      const footprint = stationFootprint(body);
      return {
        body: body,
        base: footprint,
        tiles: Grid.tilesIn(footprint),
        spaceShape: boxShape(footprint),
      };
    },
    rules: [
      insideMap(),
      stationSpacing(STATION.spacing),
      discovered(),
      clearSpace({ reason: "Something else keeps this room" }),
      dugOut(),
    ],
    build(placement, ctx) {
      ctx.scene.getSystem(Stations).build(placement.body);
    },
  });
}

export function jointTool(title: string, cost: ResourceCost): BuildTool {
  return stamp<JointPlacement>({
    title: title,
    cost: cost,
    locate(anchor, _rotation, ctx) {
      const joint = jointAt(ctx.world, anchor);
      const tile = joint.tile;
      const base = { x: tile.x, y: tile.y, w: 1, h: 1 };
      return {
        joint: joint,
        base: base,
        tiles: [tile, { x: tile.x, y: tile.y - 1 }, { x: tile.x, y: tile.y + 1 }],
        spaceShape: boxShape(base),
      };
    },
    rules: [
      aboveShaftBottom({ minRow: 0, reason: "It goes only on the shaft's walls" }),
      insideMap(),
      jointSpacing(RAILS.jointSpacing),
      discovered(),
      clearSpace(),
      dugOut(),
    ],
    build(placement, ctx) {
      ctx.scene.getSystem(Rails).buildJoint(placement.joint);
    },
  });
}

export function railTool(cost: ResourceCost): BuildTool {
  return drag<RailPlacement>({
    cost: cost,
    hint: "Drag from a connector or rail",
    start(ctx) {
      const rails = ctx.scene.getSystem(Rails);
      const stations = ctx.scene.getSystem(Stations);
      const from = rails.nearestAnchor(ctx.mouseSpot(), stations.railAnchors, BLUEPRINTS.railReach);
      if (from === undefined) return { refusal: "Start at a station's connector or a rail" };
      return { from: from };
    },
    span(from, ctx) {
      const segment = railToward(from, ctx.mouseSpot());
      if (segment === undefined) return undefined;
      return { segment: segment, tiles: railTiles(segment) };
    },
    units(placement) {
      return placement.segment.length;
    },
    draw(placement, valid, ctx) {
      const color = valid ? BUILD_LOOK.outline.free.border : BUILD_LOOK.outline.refused.border;
      drawRail(placement.segment.from, railEnd(placement.segment), ctx.tile, color);
    },
    label(placement, costText) {
      return {
        position: railEnd(placement.segment),
        text: `${placement.segment.length} tiles · ${costText}`,
      };
    },
    rules: [
      insideMap(),
      railAnchored(),
      aboveShaftBottom({
        margin: RAILS.depthMargin,
        highlightTiles: true,
        reason: `Rails go only ${RAILS.depthMargin} tiles under the shaft's bottom`,
      }),
      discovered(),
      railClearance(),
      railBranching(),
    ],
    build(placement, ctx) {
      ctx.scene.getSystem(Rails).build(placement.segment);
    },
  });
}

export function structureTool(config: StructureBlueprintConfig): BuildTool {
  const layer = config.layer ?? "main";
  const rules: BuildRule<StructurePlacement>[] = [
    insideMap(),
    discovered(),
    clearSpace({ layer: layer }),
    dugOut(),
    ...(config.rules ?? []),
  ];
  return stamp<StructurePlacement>({
    title: config.name,
    cost: config.cost,
    rotatable: config.rotatable,
    locate(anchor, rotation, ctx) {
      const tile = ctx.tile;
      const rect: Rect = {
        x: (anchor.x + 0.5) * tile,
        y: (anchor.y + 0.5) * tile,
        w: config.size.width * tile,
        h: config.size.height * tile,
        rotation: config.rotatable ? rotation : 0,
      };
      const shape = rectShape(rect);
      return {
        rect: rect,
        tiles: tilesOfShape(shape, tile),
        spaceShape: shape,
      };
    },
    rules: rules,
    build(placement, ctx) {
      const actor = new Structure({
        name: config.name,
        rect: placement.rect,
        layer: layer,
        solid: config.solid,
        hp: config.hp,
        look: config.look,
      });
      ctx.scene.spawnActor(actor);
    },
  });
}

export function mineRemoveTool(): BuildTool {
  return removeTool({
    paintRemovers: [(tiles, ctx) => ctx.scene.getSystem(Rails).remove(tiles)],
  });
}
