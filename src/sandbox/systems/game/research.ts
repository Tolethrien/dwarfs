import PragmaSystem from "@pragma/system";
import AxiomMath from "@axiom/math";
import type { ByteReader, ByteWriter } from "@axiom/bytes";
import { GameResourcesID, RESOURCES } from "../../content/resources";
import PlayerResources, { type ResourceAddedEvent, type ResourceAmounts } from "./resources";

// prototype numbers (plans/prototypEkonomii.md)
export type NodeID =
  | "pickaxe"
  | "mug"
  | "draw"
  | "scope"
  | "lift"
  | "charges"
  | "training"
  | "ghost";

interface NodeData {
  name: string;
  effect: string;
  // research points per level, its length = the top level
  costs: number[];
}

// the order is written into saves
export const NODES: Record<NodeID, NodeData> = {
  pickaxe: { name: "Kilof", effect: "+15% siły kulki", costs: [1, 2, 3] },
  mug: { name: "Kufel", effect: "+1 piwo na kulkę gratis", costs: [1, 2, 3] },
  draw: { name: "Naciąg", effect: "+500 maks. prędkości strzału", costs: [1, 2] },
  scope: { name: "Luneta", effect: "+50% linii celowania", costs: [1, 1] },
  lift: { name: "Winda", effect: "zjazd ×1.5 szybciej", costs: [1, 1] },
  charges: { name: "Ładunki", effect: "bomba o połowę tańsza", costs: [2] },
  training: { name: "Szkolenie górnicze", effect: "Miner w karczmie", costs: [3] },
  ghost: {
    name: "Omijanie",
    effect: "+1,5 s po strzale kulka przelatuje przez budowle gracza",
    costs: [1, 2, 2],
  },
};
const NODE_ORDER = Object.keys(NODES) as NodeID[];

// an order is worth beer × growth^done at market prices, split between two resources; from deepFrom
// on one of them is the most precious dug out so far, but only a small share (rare ores are scarce)
const ORDER = {
  beer: 4,
  growth: 1.3,
  split: 0.6,
  deepFrom: 3,
  preciousShare: 0.2,
  skipCost: 2,
  reward: 1,
};

export interface ResearchGainedEvent {
  points: number;
}

// the alchemist: orders of mined resources for research points, and the tree they are spent on
export default class Research extends PragmaSystem {
  private levels = new Map<NodeID, number>();
  private ordersDone = 0;
  private order: ResourceAmounts = [];
  // everything sellable ever dug out (not looted: a chest's silver is no promise there is more
  // around): what orders and contracts may ask for
  private found = new Set<GameResourcesID>();
  declare private resources: PlayerResources;

  constructor(internal: InternalPSProps) {
    super(internal);
  }

  start(): void {
    this.resources = this.scene.getSystem(PlayerResources);
    this.onSceneEvent<ResourceAddedEvent>("resourceAdded", (event) => {
      if (!event.fromMine || !RESOURCES[event.res].sell || this.found.has(event.res)) return;
      this.found.add(event.res);
      if (this.order.length === 0) this.rollOrder();
    });
  }

  public level(node: NodeID) {
    return this.levels.get(node) ?? 0;
  }

  public isMaxed(node: NodeID) {
    return this.level(node) >= NODES[node].costs.length;
  }

  public nextCost(node: NodeID) {
    return NODES[node].costs[this.level(node)];
  }

  public upgrade(node: NodeID) {
    if (this.isMaxed(node)) return false;
    if (!this.resources.pay([[GameResourcesID.research, this.nextCost(node)]])) return false;
    this.levels.set(node, this.level(node) + 1);
    return true;
  }

  public get currentOrder(): Readonly<ResourceAmounts> {
    return this.order;
  }

  public get foundResources(): readonly GameResourcesID[] {
    return [...this.found];
  }

  public fulfill() {
    if (this.order.length === 0 || !this.resources.pay(this.order)) return false;
    this.resources.addResource(GameResourcesID.research, ORDER.reward);
    this.emitSceneEvent<ResearchGainedEvent>("researchGained", { points: ORDER.reward });
    this.ordersDone++;
    this.rollOrder();
    return true;
  }

  public skip() {
    if (!this.resources.pay([[GameResourcesID.beer, ORDER.skipCost]])) return false;
    this.rollOrder();
    return true;
  }

  public get skipCost() {
    return ORDER.skipCost;
  }

  private rollOrder() {
    const found = [...this.found];
    this.order = [];
    if (found.length === 0) return;
    const worth = ORDER.beer * ORDER.growth ** this.ordersDone;
    const deep = this.ordersDone >= ORDER.deepFrom;
    const first = deep
      ? found.reduce((best, res) => (beerPerUnit(res) > beerPerUnit(best) ? res : best))
      : found[AxiomMath.randomInt(0, found.length - 1)];
    const split = deep ? ORDER.preciousShare : ORDER.split;
    const others = found.filter((res) => res !== first);
    if (others.length === 0) {
      this.order.push([first, Math.ceil(worth / beerPerUnit(first))]);
      return;
    }
    const second = others[AxiomMath.randomInt(0, others.length - 1)];
    this.order.push([first, Math.ceil((worth * split) / beerPerUnit(first))]);
    this.order.push([second, Math.ceil((worth * (1 - split)) / beerPerUnit(second))]);
  }

  public save(writer: ByteWriter) {
    writer.u8(NODE_ORDER.length);
    for (const node of NODE_ORDER) writer.u8(this.level(node));
    writer.u16(this.ordersDone);
    writeAmounts(writer, this.order);
    writer.u16(this.found.size);
    for (const res of this.found) writer.u16(res);
  }

  public load(reader: ByteReader) {
    const nodes = reader.u8();
    for (let index = 0; index < nodes; index++) {
      const level = reader.u8();
      if (index < NODE_ORDER.length) this.levels.set(NODE_ORDER[index], level);
    }
    this.ordersDone = reader.u16();
    this.order = readAmounts(reader);
    this.found.clear();
    const count = reader.u16();
    for (let index = 0; index < count; index++) this.found.add(reader.u16());
  }
}

function beerPerUnit(res: GameResourcesID) {
  const sell = RESOURCES[res].sell;
  return sell ? sell.beer / sell.amount : 0;
}

export function writeAmounts(writer: ByteWriter, list: ResourceAmounts) {
  writer.u16(list.length);
  for (const [res, amount] of list) {
    writer.u16(res);
    writer.u32(amount);
  }
}

export function readAmounts(reader: ByteReader): ResourceAmounts {
  const list: ResourceAmounts = [];
  const count = reader.u16();
  for (let index = 0; index < count; index++) list.push([reader.u16(), reader.u32()]);
  return list;
}
