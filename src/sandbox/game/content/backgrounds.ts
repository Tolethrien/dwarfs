export enum BackgroundsID {
  none,
  rock,
}

export interface BackgroundData {
  first: Crop;
  looks: number;
}

export const BACKGROUNDS: Record<Exclude<BackgroundsID, BackgroundsID.none>, BackgroundData> = {
  [BackgroundsID.rock]: { first: { x: 0, y: 0, width: 96, height: 96 }, looks: 2 },
};
