import type PragmaScene from "@pragma/scene";
import type GameUI from "../../systems/ui/gameUI";
import Inbox from "../../systems/ui/inbox";
import Roster from "../../systems/dwarfs/roster";
import Stations from "../../systems/mine/stations";
import Workforce from "../../systems/dwarfs/workforce";
import { crewPanel } from "./crew";
import { inboxPanel } from "./inbox";
import { stationsPanel } from "./stations";

export function registerPanels(scene: PragmaScene, gameUI: GameUI) {
  const roster = scene.getSystem(Roster);
  const workforce = scene.getSystem(Workforce);
  const stations = scene.getSystem(Stations);
  const inbox = scene.getSystem(Inbox);
  gameUI.register(crewPanel(roster, workforce, gameUI));
  gameUI.register(stationsPanel(stations, roster));
  gameUI.register(inboxPanel(inbox));
}
