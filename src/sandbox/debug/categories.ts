// buttons of the profiler's Game tab, in this order
export const DEBUG_CATEGORIES = {
  tools: { title: "Tools", icon: "🛠" },
  crew: { title: "Crew", icon: "👷" },
  camp: { title: "Camp", icon: "🏗" },
  network: { title: "Network", icon: "🚂" },
  story: { title: "Story", icon: "📜" },
  tune: { title: "Tune", icon: "🎚" },
  look: { title: "Look", icon: "🌍" },
  vfx: { title: "VFX & sound", icon: "✨" },
  mapGen: { title: "MapGen", icon: "🗺" },
} as const;

export type DebugCategoryID = keyof typeof DEBUG_CATEGORIES;
