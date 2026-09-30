import { app } from "electron";
import path from "path";

// packaged, the app folder is inside app.asar and read only
//TODO: przemyslec gdzie chce trzymac savy gry na prodzie
const root = path.join(
  app.isPackaged ? app.getPath("userData") : app.getAppPath(),
  "gameData",
);

export const GAME_DATA = {
  root,
  saves: path.join(root, "saves"),
  dumps: path.join(root, "dumps"),
};

export const GAME_DATA_EXTENSION = {
  save: ".sav",
  // a write in progress, renamed onto the real file once complete
  temp: ".tmp",
};
