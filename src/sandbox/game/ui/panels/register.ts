import type PragmaScene from "@pragma/scene";
import Glossary from "../../systems/core/glossary";
import PlayerStats from "../../systems/core/playerStats";
import type GameUI from "../../systems/ui/gameUI";
import Inbox from "../../systems/ui/inbox";
import Roster from "../../systems/dwarfs/roster";
import Stations from "../../systems/mine/stations";
import Workforce from "../../systems/dwarfs/workforce";
import { crewPanel } from "./crew";
import { glossaryPanel } from "./glossary";
import { inboxPanel } from "./inbox";
import { stationsPanel } from "./stations";

export function registerPanels(scene: PragmaScene, gameUI: GameUI) {
  const roster = scene.getSystem(Roster);
  const workforce = scene.getSystem(Workforce);
  const stations = scene.getSystem(Stations);
  const inbox = scene.getSystem(Inbox);
  const glossary = scene.getSystem(Glossary);
  const stats = scene.getSystem(PlayerStats);
  gameUI.register(crewPanel(roster, workforce, gameUI));
  gameUI.register(stationsPanel(stations, roster));
  gameUI.register(glossaryPanel(glossary, stats));
  gameUI.register(inboxPanel(inbox));
}
