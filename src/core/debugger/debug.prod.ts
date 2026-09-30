import { IDebug } from "./interfaces";
import { prodAurora } from "./modules/aurora/aurora";
import { prodLogger } from "./modules/log/log";
import { prodPerformance } from "./modules/performance";
import { prodWatch } from "./modules/watch/watch";
import { prodCommand } from "./modules/command/command";
import { prodTweak } from "./modules/tweak/tweak";
import { prodCamera } from "./modules/camera/camera";
import { prodCoroutines } from "./modules/coroutines/coroutines";
import { prodMapGen } from "./modules/mapGen/mapGen";
export const debug: IDebug = {
  performance: prodPerformance,
  aurora: prodAurora,
  log: prodLogger,
  watch: prodWatch,
  command: prodCommand,
  tweak: prodTweak,
  camera: prodCamera,
  coroutines: prodCoroutines,
  mapGen: prodMapGen,
};
