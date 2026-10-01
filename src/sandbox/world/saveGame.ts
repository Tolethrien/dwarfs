import { debug } from "@debug";
import GameScene from "../scenes/gameScene";
import MenuScene from "../scenes/menuScene";
import { SAVES } from "../configs";
import { BlocksID, tileNames } from "../content/blocks";
import { MAP_GEN_CONFIG } from "../mapGen/mapGenerator";
import { runWorker } from "@axiom/worker";
import {
  generateJob,
  worldFromResult,
  type GenerateRequest,
  type GenerateResult,
} from "../mapGen/generateJob";
import { decodeSave, encodeSave, type SaveData } from "./saveCodec";

// the game being played: saves go to gameData/saves/<gameId>/
const session = { gameId: "", name: "" };

export default class SaveGame {
  // a fresh world from the seed, generated on a worker thread, straight into the game;
  // the first save creates its folder
  public static async newGame(
    options: { seed?: number; name?: string; signal?: AbortSignal; mapInChunks?: Size2D } = {},
  ) {
    const seed = options.seed ?? Math.floor(Math.random() * 2 ** 31);
    const name = options.name ?? `Kopalnia ${seed}`;
    const panelConfig = debug.mapGen.config(MAP_GEN_CONFIG);
    const config = options.mapInChunks
      ? { ...panelConfig, mapInChunks: options.mapInChunks }
      : panelConfig;
    const result = await runWorker<GenerateRequest, GenerateResult>(
      {
        create: () =>
          new Worker(new URL("../mapGen/generatorWorker.ts", import.meta.url), { type: "module" }),
        inline: generateJob,
        onFallback: (reason) =>
          debug.log.warn("map generator: worker did not start, generating on the main thread", reason),
        signal: options.signal,
      },
      { seed, config },
    );
    const world = worldFromResult(result);
    debug.mapGen.connect({
      seed,
      config,
      defaults: MAP_GEN_CONFIG,
      world,
      tiles: tileNames(),
      known: { outside: BlocksID.void, air: BlocksID.air },
      timeMs: result.ms,
    });

    const stamp = Temporal.Now.plainDateTimeISO()
      .toString({ smallestUnit: "millisecond" })
      .replace(/[-:.]/g, "")
      .replace("T", "-");
    session.gameId = `g${stamp}`;
    session.name = name;
    GameScene.start(world);
  }

  // autosave first, the scene and its UI go only after it is on disk
  public static async exitToMenu() {
    await SaveGame.save("auto");
    GameScene.close();
    MenuScene.open();
  }

  // no arguments: the newest save point of the newest game
  public static async load(gameId?: string, file?: string) {
    let target = gameId && file ? { gameId, file } : undefined;
    if (!target) {
      const games = await window.API.SAVES.list();
      const game = gameId ? games.find((item) => item.gameId === gameId) : games[0];
      if (!game) return "no saves";
      target = { gameId: game.gameId, file: game.saves[0].file };
    }

    const loaded = decodeSave(await window.API.SAVES.read(target.gameId, target.file));
    session.gameId = target.gameId;
    session.name = loaded.info.name;
    GameScene.start(loaded.world, loaded.state);
    return `loaded ${target.gameId}/${target.file}`;
  }

  public static save(kind: SaveKind, name?: string) {
    return SaveGame.write(encodeSave(SaveGame.current()), kind, name);
  }

  private static current(): SaveData {
    return {
      world: GameScene.world,
      info: { name: session.name },
      state: GameScene.capture(),
    };
  }

  private static write(data: ArrayBuffer, kind: SaveKind, name?: string) {
    return window.API.SAVES.write(
      { gameId: session.gameId, kind, name, autosaveLimit: SAVES.autosaveLimit },
      data,
    );
  }

  public static registerCommands() {
    const commands = Object.freeze({
      save: (name?: string) => SaveGame.save("manual", name),
      saves: () => window.API.SAVES.list(),
      load: (gameId?: string, file?: string) => SaveGame.load(gameId, file),
      newGame: (seed?: number, chunksWide?: number, chunksHigh?: number) =>
        SaveGame.newGame({
          seed,
          mapInChunks:
            chunksWide && chunksHigh ? { width: chunksWide, height: chunksHigh } : undefined,
        }),
      check: () => SaveGame.check(),
      showAllChunks: (show = true) => GameScene.showAllChunks(show),
    });
    debug.command.expose("game", () => commands, {
      hint: "game.save(name?) | saves() | load(gameId?, file?) | newGame(seed?, chunksWide?, chunksHigh?) | check() | showAllChunks(show?)",
    });
  }

  // codec: encode + decode in the same frame, compared with the live game (it keeps running
  // while the disk works). Disk: the file read back must be the same bytes. The file is removed
  private static async check() {
    const started = performance.now();
    const original = SaveGame.current();
    const data = encodeSave(original);
    const differences = compare(original, decodeSave(data));

    const file = await SaveGame.write(data, "manual", "check");
    const fromDisk = new Uint8Array(await window.API.SAVES.read(session.gameId, file));
    await window.API.SAVES.delete(session.gameId, file);
    const written = new Uint8Array(data);
    const diskSame =
      fromDisk.length === written.length && fromDisk.every((byte, index) => byte === written[index]);
    if (!diskSame) differences.push("disk");

    return {
      ok: differences.length === 0,
      differences,
      bytes: data.byteLength,
      resources: original.state.resources.length,
      actors: original.state.actors.length,
      ms: Math.round(performance.now() - started),
    };
  }
}

function compare(original: SaveData, loaded: SaveData) {
  const differences: string[] = [];
  const same = (a: ArrayLike<number>, b: ArrayLike<number>) => {
    if (a.length !== b.length) return false;
    for (let index = 0; index < a.length; index++) if (a[index] !== b[index]) return false;
    return true;
  };
  if (original.info.name !== loaded.info.name) differences.push("name");
  if (JSON.stringify(original.world.meta) !== JSON.stringify(loaded.world.meta))
    differences.push("meta");
  if (!same(original.world.solid, loaded.world.solid)) differences.push("terrain");
  if (!same(original.world.discovered, loaded.world.discovered)) differences.push("discovered");
  if (!same(original.world.biomes, loaded.world.biomes)) differences.push("biomes");
  const damage = original.world.damage;
  const damageSame =
    damage.size === loaded.world.damage.size &&
    [...damage].every(([index, value]) => loaded.world.damage.get(index) === value);
  if (!damageSame) differences.push("damage");
  for (const layer of ["back", "front"] as const) {
    const decos = original.world.decos[layer];
    const decosSame =
      decos.size === loaded.world.decos[layer].size &&
      [...decos].every(([index, deco]) => loaded.world.decos[layer].get(index) === deco);
    if (!decosSame) differences.push(`decos ${layer}`);
  }
  if (JSON.stringify(original.state.resources) !== JSON.stringify(loaded.state.resources))
    differences.push("resources");
  const actors = original.state.actors;
  const actorsSame =
    actors.length === loaded.state.actors.length &&
    actors.every(
      (actor, index) =>
        actor.kind === loaded.state.actors[index].kind &&
        same(new Uint8Array(actor.data), new Uint8Array(loaded.state.actors[index].data)),
    );
  if (!actorsSame) differences.push("actors");
  return differences;
}
