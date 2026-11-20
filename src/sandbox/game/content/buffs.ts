import type Effect from "../effects/effect";

export enum BuffID {}

export interface BuffData {
  name: string;
  description: string;
  icon: Crop;
  hours: number;
  effects: Effect[];
}

export const BUFFS: Record<BuffID, BuffData> = {};
