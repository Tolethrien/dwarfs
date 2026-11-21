import { DataKey } from "@axiom/events";
import type World from "./world/world";
import type { Stock } from "./components/common/storage";
import type Buildings from "./systems/mine/buildings";
import type BuildSpace from "./build/space";
import type Shaft from "./actors/shaft";

export const WORLD = new DataKey<World>("world");
export const CAMP_STORE = new DataKey<Stock>("campStore");
export const CAMP_BUILDINGS = new DataKey<Buildings>("campBuildings");
export const BUILD_SPACE = new DataKey<BuildSpace>("buildSpace");
export const MINE_SHAFT = new DataKey<Shaft>("mineShaft");
