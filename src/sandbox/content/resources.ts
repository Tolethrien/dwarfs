// written into saves (resources section): never renumber, a new resource takes the next number
export enum GameResourcesID {
  none = 0,
  stone = 1,
  bones = 2,
  coal = 3,
  copper = 4,
  silver = 5,
  gold = 6,
  sapphire = 7,
  diamonds = 8,
  wood = 9,
  cloth = 10,
  beer = 11,
  hops = 12,
  water = 13,
}
export interface ResourceData {
  crop: Crop;
  name: keyof typeof GameResourcesID;
}

export const RESOURCES: Record<GameResourcesID, ResourceData> = {
  [GameResourcesID.none]: {
    crop: { x: 0, y: 0, width: 0, height: 0 },
    name: "none",
  },
  [GameResourcesID.stone]: {
    crop: { x: 125, y: 0, width: 125, height: 125 },
    name: "stone",
  },
  [GameResourcesID.bones]: {
    crop: { x: 0, y: 0, width: 125, height: 125 },
    name: "bones",
  },
  [GameResourcesID.coal]: {
    crop: { x: 875, y: 0, width: 125, height: 125 },
    name: "coal",
  },
  [GameResourcesID.copper]: {
    crop: { x: 750, y: 0, width: 125, height: 125 },
    name: "copper",
  },
  [GameResourcesID.silver]: {
    crop: { x: 500, y: 0, width: 125, height: 125 },
    name: "silver",
  },
  [GameResourcesID.gold]: {
    crop: { x: 250, y: 0, width: 125, height: 125 },
    name: "gold",
  },
  [GameResourcesID.sapphire]: {
    crop: { x: 625, y: 0, width: 125, height: 125 },
    name: "sapphire",
  },
  [GameResourcesID.diamonds]: {
    crop: { x: 375, y: 0, width: 125, height: 125 },
    name: "diamonds",
  },
  [GameResourcesID.wood]: {
    crop: { x: 1000, y: 0, width: 125, height: 125 },
    name: "wood",
  },
  [GameResourcesID.cloth]: {
    crop: { x: 1000, y: 0, width: 125, height: 125 },
    name: "cloth",
  },
  [GameResourcesID.beer]: {
    crop: { x: 1000, y: 0, width: 125, height: 125 },
    name: "beer",
  },
  [GameResourcesID.hops]: {
    crop: { x: 1000, y: 0, width: 125, height: 125 },
    name: "hops",
  },
  [GameResourcesID.water]: {
    crop: { x: 1000, y: 0, width: 125, height: 125 },
    name: "water",
  },
};
