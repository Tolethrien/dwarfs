type SaveKind = "auto" | "manual";
// time: ISO PlainDateTime string, Temporal objects do not pass IPC
interface SavePoint {
  file: string;
  kind: SaveKind;
  time: string;
  name?: string;
}
interface SaveGameInfo {
  gameId: string;
  saves: SavePoint[];
}
interface SaveWriteRequest {
  gameId: string;
  kind: SaveKind;
  name?: string;
  autosaveLimit: number;
}
