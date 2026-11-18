import type Effect from "../effects/effect";

export enum SpecialBeerID {}

export interface SpecialBeerData {
  name: string;
  description: string;
  effects: Effect[];
}

export const SPECIAL_BEERS: Record<SpecialBeerID, SpecialBeerData> = {};
