export const AURORA_PAGES = {
  category: "aurora",
  order: {
    mood: 1,
    effects: 2,
    settings: 3,
    texturePreview: 4,
    urp: 5,
    catalog: 6,
  },
} as const;

export type AuroraPage = keyof typeof AURORA_PAGES.order;

export function auroraPage(page: AuroraPage) {
  return { category: AURORA_PAGES.category, order: AURORA_PAGES.order[page], command: false };
}
