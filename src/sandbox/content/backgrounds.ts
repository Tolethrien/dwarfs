export enum BackgroundsID {
  none,
  someOne,
  someTwo,
}

export interface BackgroundData {
  crop: Crop;
}

export const BACKGROUNDS: Record<BackgroundsID, BackgroundData> = {
  [BackgroundsID.none]: {
    crop: { x: 0, y: 0, width: 0, height: 0 },
  },
  [BackgroundsID.someOne]: {
    crop: { x: 0, y: 0, width: 96, height: 96 },
  },
  [BackgroundsID.someTwo]: {
    crop: { x: 96, y: 0, width: 96, height: 96 },
  },
};
