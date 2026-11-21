import Navi from "@navi/navi";
import type UINode from "@navi/node";
import { assert } from "@axiom/utils";
import Station, { STATION } from "../../actors/station";
import Storage from "../../components/common/storage";
import { UI_THEME } from "../../content/ui";
import type { PanelDef } from "../../systems/ui/gameUI";
import type Roster from "../../systems/dwarfs/roster";
import type Stations from "../../systems/mine/stations";
import { button } from "../elements/button";
import { table, tableWindowWidth, type TableColumn, type UITable } from "../elements/table";
import { text } from "../elements/text";

const STATIONS_UI = {
  listHeight: 340,
  columns: [
    { title: "Station", width: 140 },
    { title: "Link", width: 90 },
    { title: "Crew", width: 80, align: "center" },
    { title: "Waiting", width: 76, align: "center" },
    { title: "Storage", width: 210 },
    { title: "", width: 64, align: "end" },
  ] as TableColumn[],
};

function storageOf(station: Station) {
  const storage = station.getComponent(Storage);
  assert(storage !== undefined, `Station ${station.name} has no Storage`);
  return storage;
}

export function stationsPanel(stations: Stations, roster: Roster): PanelDef {
  let list: UITable | undefined;
  let empty: UINode | undefined;
  let lastCount = -1;
  let closePanel: (() => void) | undefined;

  function rebuildRows() {
    if (!list) return;
    const all = stations.stations;
    lastCount = all.length;
    Navi.clear(list.body);
    empty?.setActive(all.length === 0);
    for (const station of all) addStationRow(list, station);
  }

  function addStationRow(target: UITable, station: Station) {
    const launcher = stations.launcherOf(station);
    const storage = storageOf(station);
    target.row([
      () => station.name,
      {
        build: (cell) =>
          text(cell, () => (stations.isConnected(station) ? "Connected" : "Cut off"), {
            color: stations.isConnected(station) ? UI_THEME.colors.text : UI_THEME.colors.lacking,
          }),
      },
      () => `${roster.assignedTo(station).length} / ${STATION.manualLimit}`,
      () => `${launcher.queue.length}`,
      { build: (cell) => text(cell, () => storage.stock.text, { color: UI_THEME.colors.muted }) },
      {
        build: (cell) =>
          button(cell, "Go", () => {
            closePanel?.();
            stations.focusStation(station);
          }),
      },
    ]);
  }

  return {
    id: "stations",
    title: "Stations",
    label: "Stations",
    bar: "top",
    width: tableWindowWidth(STATIONS_UI.columns),
    badge: () => stations.waitingCount,
    onClose() {
      list = undefined;
      empty = undefined;
      lastCount = -1;
      closePanel = undefined;
    },
    build(content, window) {
      closePanel = () => window.close();
      text(
        content,
        () => `Stations: ${stations.stations.length} · Waiting to shoot: ${stations.waitingCount}`,
        { color: UI_THEME.colors.muted },
      );
      list = table(content, STATIONS_UI.columns, { height: STATIONS_UI.listHeight });
      empty = text(content, "No stations built yet", { color: UI_THEME.colors.muted });
      rebuildRows();
    },
    update() {
      if (list && stations.stations.length !== lastCount) rebuildRows();
    },
  };
}
