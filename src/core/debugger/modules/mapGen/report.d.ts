export interface MapGenTable {
  columns: string[];
  rows: string[][];
}

export interface MapGenItem {
  key: string;
  value: string;
}

export interface MapGenConfigSection {
  title: string;
  items?: MapGenItem[];
  table?: MapGenTable;
}

export interface MapGenReport {
  summary: MapGenItem[];
  ores: MapGenTable;
  config: MapGenConfigSection[];
}
