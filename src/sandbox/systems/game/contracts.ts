import PragmaSystem from "@pragma/system";
import AxiomMath from "@axiom/math";
import type { ByteReader, ByteWriter } from "@axiom/bytes";
import { GameResourcesID, RESOURCES, describeAmounts } from "../../content/resources";
import type { ResourceAddedEvent, ResourceAmounts } from "./resources";
import PlayerResources from "./resources";
import Research, { readAmounts, writeAmounts, type ResearchGainedEvent } from "./research";
import type { BuildingKind } from "../../bActors/camp";
import Camp from "./camp";

// mine: dig out count of res; the rest count scene events
type ContractKind = "mine" | "chest" | "build" | "research" | "bomb" | "platform";

interface Contract {
  kind: ContractKind;
  count: number;
  res?: GameResourcesID;
  building?: BuildingKind;
  reward: ResourceAmounts;
}

export interface BuildingBuiltEvent {
  kind: BuildingKind;
}
export interface ContractCompletedEvent {
  text: string;
}

// prototype numbers (plans/prototypEkonomii.md): the scripted start, then random "mine N of X"
const SCRIPTED: Contract[] = [
  { kind: "mine", res: GameResourcesID.stone, count: 30, reward: [[GameResourcesID.wood, 5]] },
  {
    kind: "chest",
    count: 1,
    reward: [
      [GameResourcesID.wood, 3],
      [GameResourcesID.hops, 1],
    ],
  },
  { kind: "mine", res: GameResourcesID.coal, count: 8, reward: [[GameResourcesID.wood, 6]] },
  { kind: "build", building: "distillery", count: 1, reward: [[GameResourcesID.beer, 4]] },
  { kind: "build", building: "alchemist", count: 1, reward: [[GameResourcesID.hops, 2]] },
  { kind: "research", count: 3, reward: [[GameResourcesID.wood, 5]] },
  { kind: "bomb", count: 1, reward: [[GameResourcesID.wood, 8]] },
  { kind: "platform", count: 1, reward: [[GameResourcesID.hops, 3]] },
];
// a random contract asks for beer × growth^n worth of one found resource
const RANDOM = {
  beer: 6,
  growth: 1.15,
  rewards: [
    { res: GameResourcesID.wood, min: 4, max: 8 },
    { res: GameResourcesID.hops, min: 1, max: 2 },
    { res: GameResourcesID.beer, min: 4, max: 6 },
  ],
};
const BUILDING_NAMES: Partial<Record<BuildingKind, string>> = {
  distillery: "gorzelnię",
  alchemist: "alchemika",
};

// the board: one contract at a time, progress from scene events, the reward paid at once
export default class Contracts extends PragmaSystem {
  private done = 0;
  private progress = 0;
  private current: Contract = SCRIPTED[0];
  declare private resources: PlayerResources;

  constructor(internal: InternalPSProps) {
    super(internal);
  }

  start(): void {
    this.resources = this.scene.getSystem(PlayerResources);
    this.onSceneEvent<ResourceAddedEvent>("resourceAdded", (event) => {
      if (event.fromMine && this.current.kind === "mine" && this.current.res === event.res)
        this.advance(event.amount);
    });
    this.onSceneEvent("chestOpened", () => this.count("chest", 1));
    this.onSceneEvent<BuildingBuiltEvent>("buildingBuilt", (event) => {
      if (this.current.kind === "build" && this.current.building === event.kind) this.advance(1);
    });
    this.onSceneEvent<ResearchGainedEvent>("researchGained", (event) =>
      this.count("research", event.points),
    );
    this.onSceneEvent("bombDropped", () => this.count("bomb", 1));
    this.onSceneEvent("platformBuilt", () => this.count("platform", 1));
  }

  public get text() {
    return `${describe(this.current)} (${Math.min(this.progress, this.current.count)}/${this.current.count})`;
  }

  public get rewardText() {
    return describeAmounts(this.current.reward);
  }

  private count(kind: ContractKind, amount: number) {
    if (this.current.kind === kind) this.advance(amount);
  }

  private advance(amount: number) {
    this.progress += amount;
    if (this.progress < this.current.count) return;
    const finished = this.current;
    this.resources.give(finished.reward);
    this.done++;
    this.progress = 0;
    this.current = this.done < SCRIPTED.length ? SCRIPTED[this.done] : this.randomContract();
    this.emitSceneEvent<ContractCompletedEvent>("contractCompleted", {
      text: `Zlecenie wykonane: +${describeAmounts(finished.reward)}`,
    });
    // built before its contract came up: done at once
    const building = this.current.building;
    if (building && this.scene.getSystem(Camp).isBuilt(building)) this.advance(1);
  }

  private randomContract(): Contract {
    const found = this.scene.getSystem(Research).foundResources;
    const res = found.length > 0 ? found[AxiomMath.randomInt(0, found.length - 1)] : GameResourcesID.stone;
    const sell = RESOURCES[res].sell!;
    const worth = RANDOM.beer * RANDOM.growth ** (this.done - SCRIPTED.length);
    const reward = RANDOM.rewards[AxiomMath.randomInt(0, RANDOM.rewards.length - 1)];
    return {
      kind: "mine",
      res,
      count: Math.ceil((worth * sell.amount) / sell.beer),
      reward: [[reward.res, AxiomMath.randomInt(reward.min, reward.max)]],
    };
  }

  public save(writer: ByteWriter) {
    writer.u16(this.done);
    writer.u32(this.progress);
    writer.u16(this.current.res ?? 0);
    writer.u32(this.current.count);
    writeAmounts(writer, this.current.reward);
  }

  // only a random contract needs what was written, a scripted one comes from the list
  public load(reader: ByteReader) {
    this.done = reader.u16();
    this.progress = reader.u32();
    const res = reader.u16();
    const count = reader.u32();
    const reward = readAmounts(reader);
    this.current =
      this.done < SCRIPTED.length ? SCRIPTED[this.done] : { kind: "mine", res, count, reward };
  }
}

function describe(contract: Contract) {
  switch (contract.kind) {
    case "mine":
      return `Wykop: ${RESOURCES[contract.res!].label}`;
    case "chest":
      return "Otwórz skrzynię";
    case "build":
      return `Zbuduj ${BUILDING_NAMES[contract.building!] ?? contract.building}`;
    case "research":
      return "Zdobądź punkty badań";
    case "bomb":
      return "Zrzuć bombę";
    case "platform":
      return "Zbuduj platformę";
  }
}
