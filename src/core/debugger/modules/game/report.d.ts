export interface GameDwarfRow {
  name: string;
  rank: string;
  class: string;
  state: string;
  station: string | null;
  shiftHoursLeft: number | null;
  beer: string | null;
  speed: number;
  power: number;
  bph: number;
  traits: string[];
  gear: string[];
}

export interface GameDwarfsReport {
  counts: Record<string, number>;
  rows: GameDwarfRow[];
}

export interface GameGearRow {
  name: string;
  level: number;
  max: number;
  classes: string[];
}

export interface GameResearchRow {
  name: string;
  description: string;
  researched: boolean;
}

export interface GameWorkforceReport {
  gear: GameGearRow[];
  research: GameResearchRow[];
}

export interface GameBuffRow {
  name: string;
  description: string;
  hours: number;
  hoursLeft: number | null;
}

export interface GameRailsReport {
  segments: number;
  tiles: number;
  joints: number;
  damaged: number;
  broken: number;
}

export interface GameStationRow {
  name: string;
  position: string;
  atShaft: boolean;
  connected: boolean;
  priority: number;
  queue: number;
  ordered: number;
  manualLimit: number;
}

export interface GameBuildingRow {
  name: string;
  side: string;
  base: string;
  reserve: string;
}

export interface GameBuildingsReport {
  shaftDepth: number;
  rows: GameBuildingRow[];
}

export interface GameTavernReport {
  applications: number;
  limit: number;
  perDay: number;
  arrivalHour: number;
  hireCost: string;
}

export interface GameResourceRow {
  name: string;
  amount: string;
}

export interface GameMinedRow {
  block: string;
  count: number;
}

export interface GamePlayerReport {
  name: string;
  minedTotal: number;
  mined: GameMinedRow[];
}

export interface GameReport {
  dwarfs: GameDwarfsReport;
  workforce: GameWorkforceReport;
  buffs: GameBuffRow[];
  rails: GameRailsReport;
  stations: GameStationRow[];
  buildings: GameBuildingsReport;
  tavern: GameTavernReport | undefined;
  resources: GameResourceRow[];
  date: string;
  player: GamePlayerReport;
}
