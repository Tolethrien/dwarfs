import Pragma from "@pragma/pragma";
import { Camera } from "@engine/camera/camera";
import GameMode from "../systems/game/gameMode";
import PhysBall from "../systems/game/physBall";
import Terrain from "../systems/game/terrain";
import ChunkView from "../systems/game/chunkView";
import DecoView from "../systems/game/decoView";
import MapEffects from "../systems/game/mapEffects";
import Discovery from "../systems/game/discovery";
import MapBuilder from "../systems/game/mapBuilder";
import CameraController from "../systems/game/cameraController";
import PlayerInput from "../systems/game/playerInput";
import PlayerResources from "../systems/game/resources";
import InteractiveElements from "../systems/game/interactiveElements";
import PauseMenu from "../systems/game/pauseMenu";
import TileMask from "../shaders/tileMask";
import type World from "../world/world";
import type { ActorSave, GameState } from "../world/saveCodec";
import Dwarf from "../bActors/dwarf";
import Chest from "../bActors/chest";
import Palisade from "../bActors/palisade";
import type PragmaActor from "@pragma/actor";
import { ByteReader, ByteWriter } from "@axiom/bytes";
import { assert } from "@axiom/utils";
import { debug } from "@debug";
const GAME = {
  scene: "game",
  // camera room above the map
  skyMargin: 300,
};

// save: false = nothing to keep (e.g. only finishing an animation)
interface SavedActor extends PragmaActor {
  save(writer: ByteWriter): boolean;
}
interface SavedActorClass {
  new (...args: never[]): SavedActor;
  load(reader: ByteReader): SavedActor;
}

// every actor of these classes goes into the save; the number is written into saves: never change or reuse one
const SAVED_ACTORS: Record<number, SavedActorClass> = {
  1: Dwarf,
  2: Chest,
  3: Palisade,
};
const SAVED_KIND = new Map(
  Object.entries(SAVED_ACTORS).map(([kind, actorClass]) => [actorClass, Number(kind)]),
);

export default class GameScene {
  // any time: a fresh scene for this world, the previous game scene is destroyed by addScene
  public static start(world: World, state?: GameState) {
    TileMask.bind(world);
    new GameScene(world);
    if (state) GameScene.restore(state);
  }

  public static get world() {
    const scene = Pragma.getScene(GAME.scene);
    assert(scene !== undefined, "GameScene.world: no game running");
    return scene.getSystem(Terrain).world;
  }

  public static capture(): GameState {
    const scene = Pragma.getScene(GAME.scene);
    assert(scene !== undefined, "GameScene.capture: no game running");
    const actors: ActorSave[] = [];
    for (const actor of scene.getAllActors) {
      const kind = SAVED_KIND.get(actor.constructor as SavedActorClass);
      if (kind === undefined) continue;
      const writer = new ByteWriter(64);
      if ((actor as SavedActor).save(writer)) actors.push({ kind, data: writer.finish() });
    }
    return { resources: scene.getSystem(PlayerResources).snapshot(), actors };
  }

  private static restore(state: GameState) {
    const scene = Pragma.getScene(GAME.scene)!;
    scene.getSystem(PlayerResources).restore(state.resources);
    for (const saved of state.actors) {
      const actorClass = SAVED_ACTORS[saved.kind];
      if (!actorClass) {
        debug.log.warn("GameScene: unknown actor kind in the save, skipped", saved.kind);
        continue;
      }
      scene.spawnActor(actorClass.load(new ByteReader(saved.data)));
    }
  }

  public static showAllChunks(show: boolean) {
    const scene = Pragma.getScene(GAME.scene);
    assert(scene !== undefined, "GameScene.showAllChunks: no game running");
    scene.getSystem(ChunkView).setShowAll(show);
  }

  public static close() {
    if (Pragma.getScene(GAME.scene)) Pragma.deleteScene(GAME.scene);
  }

  constructor(map: World) {
    const world = Pragma.addScene(GAME.scene);
    // added order = run order in every phase
    world.addSystem(Terrain, map);
    world.addSystem(ChunkView);
    world.addSystem(DecoView);
    world.addSystem(MapEffects);
    world.addSystem(GameMode);
    world.addSystem(PhysBall);
    world.addSystem(Discovery);
    world.addSystem(MapBuilder);
    world.addSystem(CameraController);
    world.addSystem(PlayerInput);
    world.addSystem(PlayerResources);
    world.addSystem(InteractiveElements);
    world.addSystem(PauseMenu);
    GameScene.setupCamera(map);
  }
  private static setupCamera(map: World) {
    const bounds = map.bounds;
    Camera.setOrigin("center");
    Camera.setMode("free");
    Camera.setFree({ speed: 500, acceleration: 33, deceleration: 11 });
    Camera.setZoomLimits(0.05, 4);
    // only zooms where a tile is whole pixels, the grid never goes uneven at rest
    Camera.setZoomLevels({ grid: map.meta.tileInPixels.width });
    Camera.setZoomSmoothing(8);
    Camera.setWheelZoom({ enabled: true, at: "cursor", step: 0.2, pull: 0 });
    Camera.setBounds({
      min: { x: bounds.x, y: bounds.y - GAME.skyMargin },
      max: { x: bounds.x + bounds.w, y: bounds.y + bounds.h },
    });
    Camera.setZoom(0.5);
    Camera.teleport({ x: 9216, y: 1500 });
  }
}
