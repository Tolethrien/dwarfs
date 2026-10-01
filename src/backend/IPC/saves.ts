import { ipcMain } from "electron";
import fs from "fs/promises";
import path from "path";
import { GAME_DATA, GAME_DATA_EXTENSION } from "../gameData";

// ids and file names come from the renderer and end up in a path: only these shapes pass
const SAVE = {
  gameId: /^[a-zA-Z0-9_-]+$/,
  file: new RegExp(
    `^(auto|manual)_(\\d{8}-\\d{6}(?:\\d{3})?)(?:_([a-z0-9-]+))?\\${GAME_DATA_EXTENSION.save}$`,
  ),
  nameLength: 40,
};

export function registerSavesIPC() {
  ipcMain.handle("saves:list", () => list());
  ipcMain.handle("saves:read", (_, gameId: string, file: string) =>
    read(gameId, file),
  );
  ipcMain.handle(
    "saves:write",
    (_, request: SaveWriteRequest, data: ArrayBuffer) => write(request, data),
  );
  ipcMain.handle("saves:delete", (_, gameId: string, file?: string) =>
    remove(gameId, file),
  );
}

async function list(): Promise<SaveGameInfo[]> {
  const entries = await fs
    .readdir(GAME_DATA.saves, { withFileTypes: true })
    .catch(() => []);
  const games: SaveGameInfo[] = [];

  for (const entry of entries) {
    if (!entry.isDirectory() || !SAVE.gameId.test(entry.name)) continue;
    const saves = await savePoints(entry.name);
    if (saves.length > 0) games.push({ gameId: entry.name, saves });
  }

  games.sort((a, b) => b.saves[0].time.localeCompare(a.saves[0].time));
  return games;
}

// newest first; the stamp sorts the same alphabetically and chronologically
async function savePoints(gameId: string): Promise<SavePoint[]> {
  const files = await fs.readdir(gameFolder(gameId)).catch(() => []);
  const saves: SavePoint[] = [];

  for (const file of files) {
    const match = SAVE.file.exec(file);
    if (!match) continue;
    saves.push({
      file,
      kind: match[1] as SaveKind,
      time: fromStamp(match[2]).toString(),
      name: match[3],
    });
  }

  return saves.sort((a, b) => b.time.localeCompare(a.time));
}

async function read(gameId: string, file: string): Promise<ArrayBuffer> {
  const bytes = await fs.readFile(savePath(gameId, file));
  return bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength,
  ) as ArrayBuffer;
}

async function write(
  request: SaveWriteRequest,
  data: ArrayBuffer,
): Promise<string> {
  const folder = gameFolder(request.gameId);
  const file = fileName(request);
  const target = path.join(folder, file);
  const temp = target + GAME_DATA_EXTENSION.temp;

  await fs.mkdir(folder, { recursive: true });
  await fs.writeFile(temp, new Uint8Array(data));
  await fs.rename(temp, target);

  if (request.kind === "auto")
    await pruneAutosaves(request.gameId, request.autosaveLimit);
  return file;
}

async function remove(gameId: string, file?: string) {
  if (file === undefined) {
    await fs.rm(gameFolder(gameId), { recursive: true, force: true });
    return;
  }
  await fs.rm(savePath(gameId, file), { force: true });
  // the last save point gone = the game is gone
  const left = await fs.readdir(gameFolder(gameId)).catch(() => []);
  if (left.length === 0)
    await fs.rm(gameFolder(gameId), { recursive: true, force: true });
}

async function pruneAutosaves(gameId: string, limit: number) {
  const autosaves = (await savePoints(gameId)).filter(
    (save) => save.kind === "auto",
  );
  for (const save of autosaves.slice(Math.max(1, limit)))
    await fs.rm(path.join(gameFolder(gameId), save.file), { force: true });
}

function fileName(request: SaveWriteRequest) {
  const stamp = toStamp(Temporal.Now.plainDateTimeISO());
  const name = request.kind === "manual" ? slug(request.name ?? "") : "";
  const suffix = name ? `_${name}` : "";
  return `${request.kind}_${stamp}${suffix}${GAME_DATA_EXTENSION.save}`;
}

function slug(text: string) {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/ł/g, "l")
    .replace(/Ł/g, "L")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, SAVE.nameLength);
}

// 2026-09-30T14:25:01.123 <-> 20260930-142501123; older saves have no milliseconds
function toStamp(time: Temporal.PlainDateTime) {
  return time
    .toString({ smallestUnit: "millisecond" })
    .replace(/[-:.]/g, "")
    .replace("T", "-");
}

function fromStamp(stamp: string) {
  return Temporal.PlainDateTime.from({
    year: Number(stamp.slice(0, 4)),
    month: Number(stamp.slice(4, 6)),
    day: Number(stamp.slice(6, 8)),
    hour: Number(stamp.slice(9, 11)),
    minute: Number(stamp.slice(11, 13)),
    second: Number(stamp.slice(13, 15)),
    millisecond: Number(stamp.slice(15, 18) || 0),
  });
}

function gameFolder(gameId: string) {
  if (!SAVE.gameId.test(gameId)) throw new Error(`invalid game id: "${gameId}"`);
  return path.join(GAME_DATA.saves, gameId);
}

function savePath(gameId: string, file: string) {
  if (!SAVE.file.test(file)) throw new Error(`invalid save file: "${file}"`);
  return path.join(gameFolder(gameId), file);
}
