import PragmaSystem from "@pragma/system";
import {
  GLOSSARY_BY_ID,
  GLOSSARY_ENTRIES,
  GLOSSARY_SUBCATEGORIES,
  type GlossaryCategoryID,
  type GlossaryEntryData,
  type GlossarySubcategoryID,
} from "../../content/glossary";
import { WORLD } from "../../sceneData";
import { toast } from "../../ui/elements/toast";
import type World from "../../world/world";
import GameEvents from "./gameEvents";

export default class Glossary extends PragmaSystem {
  private readonly unlocked = new Set<string>();
  private readonly unread = new Set<string>();
  private readonly world: World;
  public version = 0;

  constructor(internal: InternalPSProps) {
    super(internal);
    this.world = this.scene.sharedData.require(WORLD);
    for (const entry of GLOSSARY_ENTRIES) {
      if (entry.startsUnlocked) this.unlocked.add(entry.id);
    }
  }

  awake(): void {
    const events = this.scene.getSystem(GameEvents);
    this.connect(events.terrain.mined, (struck) => {
      for (const entry of GLOSSARY_ENTRIES) {
        if (entry.unlock?.kind === "mine" && entry.unlock.block === struck.type) this.unlock(entry.id);
      }
    });
    this.connect(events.terrain.deflected, (struck) => {
      for (const entry of GLOSSARY_ENTRIES) {
        if (entry.unlock?.kind === "deflect" && entry.unlock.block === struck.type) this.unlock(entry.id);
      }
    });
    this.connect(events.resources.changed, (change) => {
      if (change.delta <= 0) return;
      for (const entry of GLOSSARY_ENTRIES) {
        if (entry.unlock?.kind === "resource" && entry.unlock.resource === change.id) this.unlock(entry.id);
      }
    });
    this.connect(events.biomes.discovered, (discovered) => {
      const area = this.world.biomeAreas[discovered.area];
      if (!area) return;
      for (const entry of GLOSSARY_ENTRIES) {
        if (entry.unlock?.kind === "biome" && entry.unlock.biome === area.biome) this.unlock(entry.id);
      }
    });
    this.connect(events.player.unlocked, (plan) => {
      for (const entry of GLOSSARY_ENTRIES) {
        if (entry.unlock?.kind === "plan" && entry.unlock.plan === plan) this.unlock(entry.id);
      }
    });
  }

  public unlock(id: string) {
    const entry = GLOSSARY_BY_ID[id];
    if (!entry || this.unlocked.has(id)) return;
    this.unlocked.add(id);
    this.unread.add(id);
    this.version++;
    toast(`New glossary entry: ${entry.title}`, "info");
  }

  public markRead(id: string) {
    if (!this.unread.delete(id)) return;
    this.version++;
  }

  public isUnlocked(id: string) {
    return this.unlocked.has(id);
  }

  public isUnread(id: string) {
    return this.unread.has(id);
  }

  public get unreadCount() {
    return this.unread.size;
  }

  public get unlockedCount() {
    return this.unlocked.size;
  }

  public get totalCount() {
    return GLOSSARY_ENTRIES.length;
  }

  public entriesOf(subcategory: GlossarySubcategoryID): GlossaryEntryData[] {
    return GLOSSARY_ENTRIES.filter((entry) => entry.subcategory === subcategory);
  }

  public unreadInCategory(category: GlossaryCategoryID) {
    let count = 0;
    for (const sub of GLOSSARY_SUBCATEGORIES) {
      if (sub.category === category) count += this.unreadInSubcategory(sub.id);
    }
    return count;
  }

  public unreadInSubcategory(subcategory: GlossarySubcategoryID) {
    let count = 0;
    for (const entry of GLOSSARY_ENTRIES) {
      if (entry.subcategory === subcategory && this.unread.has(entry.id)) count++;
    }
    return count;
  }
}
