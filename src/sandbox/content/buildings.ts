export enum BuildingsID {
  none,
  blacksmith,
  school,
  inn,
}

export interface BuildingData {
  crop: Crop;
}

export const BUILDINGS: Record<BuildingsID, BuildingData> = {
  [BuildingsID.none]: {
    crop: { x: 0, y: 0, width: 0, height: 0 },
  },
  [BuildingsID.blacksmith]: {
    crop: { x: 1, y: 1, width: 657, height: 427 },
  },
  [BuildingsID.school]: {
    crop: { x: 0, y: 431, width: 577, height: 464 },
  },
  [BuildingsID.inn]: {
    crop: { x: 2, y: 901, width: 705, height: 410 },
  },
};
