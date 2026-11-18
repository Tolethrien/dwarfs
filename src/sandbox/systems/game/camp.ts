import PragmaSystem from "@pragma/system";
import { Draw } from "@aurora/urp/draw/draw";
import { COLOR } from "@axiom/color";
import type { ByteReader, ByteWriter } from "@axiom/bytes";
import Time from "@engine/time";
import { Camera } from "@engine/camera/camera";
import { Building, Shaft, type BuildingClickedEvent, type BuildingKind } from "../../bActors/camp";
import { DWARF_BODY } from "../../bActors/dwarf";
import { DWARFS, DwarfsID } from "../../content/dwarfs";
import { BlocksID, getBlock } from "../../content/blocks";
import { GameResourcesID, RESOURCES, describeAmounts } from "../../content/resources";
import { MAP_GEN_CONFIG } from "../../mapGen/mapGenerator";
import { shaftTiles } from "../../mapGen/passes/crater";
import MenuPanel from "../../ui/menuPanel";
import { RENDER_ORDER } from "../../configs";
import type World from "../../world/world";
import PlayerResources, { type ResourceAmounts } from "./resources";
import Research, { NODES, type NodeID } from "./research";
import Contracts, { type BuildingBuiltEvent, type ContractCompletedEvent } from "./contracts";
import Launcher from "./launcher";
import Terrain from "./terrain";

// prototype numbers (plans/prototypEkonomii.md); sizes in tiles
const LAYOUT = {
  headframe: 3,
  building: { width: 4, height: 3 },
  gap: 2,
  fromShaft: 3,
  left: ["tavern", "market", "board", "carpenter"] as BuildingKind[],
  right: ["distillery", "alchemist", "treasury"] as BuildingKind[],
};
const COLORS: Record<BuildingKind, RGBA> = {
  tavern: COLOR.MAROON,
  market: COLOR.BROWN,
  board: COLOR.NAVY,
  treasury: COLOR.OLIVE,
  distillery: COLOR.TEAL,
  alchemist: COLOR.PURPLE,
  carpenter: COLOR.FOREST_GREEN,
  shaft: COLOR.CHOCOLATE,
};
const UNBUILT_COLOR = COLOR.CHARCOAL;
const NAMES: Record<BuildingKind, string> = {
  tavern: "Karczma",
  market: "Stragan",
  board: "Tablica zleceń",
  treasury: "Skarbiec (danina)",
  distillery: "Gorzelnia",
  alchemist: "Alchemik",
  carpenter: "Stolarz",
  shaft: "Szyb",
};
// what has to be built first; the rest stands from the start
const BUILD: Partial<Record<BuildingKind, ResourceAmounts>> = {
  distillery: [
    [GameResourcesID.wood, 15],
    [GameResourcesID.stone, 40],
  ],
  alchemist: [
    [GameResourcesID.wood, 10],
    [GameResourcesID.coal, 15],
  ],
  carpenter: [
    [GameResourcesID.wood, 8],
    [GameResourcesID.stone, 20],
  ],
};
// what the carpenter makes for the stock, build mode (Tab) puts it down
const CARPENTER: { item: GameResourcesID; name: string; batches: number[]; cost: ResourceAmounts }[] = [
  { item: GameResourcesID.palisade, name: "palisada", batches: [1, 5], cost: [[GameResourcesID.wood, 3]] },
  { item: GameResourcesID.track, name: "tor", batches: [1, 10], cost: [[GameResourcesID.wood, 1]] },
  {
    item: GameResourcesID.station,
    name: "stacja",
    batches: [1],
    cost: [
      [GameResourcesID.wood, 6],
      [GameResourcesID.stone, 15],
    ],
  },
];
// tracks run sideways from the shaft's platforms, a station (2 tiles wide) is a launch point at their
// end; both from the stock (the carpenter). World units: the rail on the bottom of its tile, the deck
const RAILS = {
  stock: { track: GameResourcesID.track, station: GameResourcesID.station },
  speed: 600,
  rail: { height: 10, color: COLOR.GRAY },
  deck: { height: 18, color: COLOR.TAN },
};

export type RailPiece = "track" | "station";

// where a dwarf can be sent: a platform in the shaft or a station; level = the shaft platform it
// leaves the lift at
export interface LaunchSite {
  name: string;
  level: number;
  point: Position2D;
}

interface Station {
  // its left tile, the right one is gx + 1
  gx: number;
  gy: number;
}
const DISTILLERY = {
  // seconds per beer at each level
  seconds: [30, 20, 12],
  // the cost of going to level 2, 3
  upgrades: [
    [
      [GameResourcesID.wood, 20],
      [GameResourcesID.coal, 20],
    ],
    [
      [GameResourcesID.wood, 30],
      [GameResourcesID.copper, 15],
    ],
  ] as ResourceAmounts[],
  premium: [[GameResourcesID.hops, 3]] as ResourceAmounts,
  happyHour: { seconds: 60, multiplier: 1.5 },
};
// the levy: beer piles up to cap over fillSeconds, a click takes it
const TREASURY = { cap: 4, fillSeconds: 180 };
const MARKET = { woodPrice: 2 };
const SHAFT = {
  // tiles a bomb deepens the shaft by, and the chamber it blows out at the new bottom
  step: 22,
  chamber: { x: 11, y: 7 },
  // the plank of each platform across the shaft, under the dwarf; world units
  plank: { height: 18, color: COLOR.TAN },
  bomb: [
    [GameResourcesID.stone, 40],
    [GameResourcesID.coal, 6],
    [GameResourcesID.wood, 6],
  ] as ResourceAmounts,
  platform: [
    [GameResourcesID.wood, 10],
    [GameResourcesID.stone, 30],
  ] as ResourceAmounts,
  shake: 0.7,
};
// beer a dwarf costs, the mug research adds on top for free
const CREW: Partial<Record<DwarfsID, number>> = {
  [DwarfsID.scout]: 1, // TEST: back to 4
  [DwarfsID.miner]: 1, // TEST: back to 8
};
// bits in the save: only ever append
const SAVED_BUILT: BuildingKind[] = ["distillery", "alchemist", "carpenter"];

// the camp: its buildings, their menus and timers, the shaft's depth. Prototype: rects and one
// MenuPanel at a time, rebuilt after every action
export default class Camp extends PragmaSystem {
  private built = new Set<BuildingKind>(["tavern", "market", "board", "treasury", "shaft"]);
  private distilleryLevel = 1;
  private bombs = 0;
  private platforms = 0;
  // full at the start: the first time you run dry, the levy is there
  private treasury = TREASURY.cap;
  private brewing = 0;
  private happyHour = 0;
  private buildings = new Map<BuildingKind, Building>();
  // tile indexes (World.tileIndex)
  private tracks = new Set<number>();
  private stations: Station[] = [];
  declare private shaftActor: Shaft;
  private menu: MenuPanel | null = null;
  private menuKind: BuildingKind | null = null;
  private message = "";
  private geometry = {
    tile: { width: 0, height: 0 },
    column: { x: 0, top: 0, bottom: 0, half: 0 },
    centerX: 0,
    ground: 0,
    shaftWidth: 0,
  };
  declare private world: World;
  declare private resources: PlayerResources;
  declare private research: Research;
  declare private contracts: Contracts;

  constructor(internal: InternalPSProps) {
    super(internal);
  }

  start(): void {
    this.world = this.scene.getSystem(Terrain).world;
    this.resources = this.scene.getSystem(PlayerResources);
    this.research = this.scene.getSystem(Research);
    this.contracts = this.scene.getSystem(Contracts);
    this.measure();
    this.spawnBuildings();
    this.onSceneEvent<BuildingClickedEvent>("buildingClicked", (event) => this.clicked(event.kind));
    this.onSceneEvent<ContractCompletedEvent>("contractCompleted", (event) =>
      this.buildings.get("board")?.notice.show(event.text),
    );
  }

  destroy(): void {
    this.closeMenu();
  }

  // ---- geometry, read by Launcher ----

  private measure() {
    const tile = this.world.meta.tileInPixels;
    const column = shaftTiles(MAP_GEN_CONFIG.crater, this.world.meta);
    this.geometry = {
      tile,
      column,
      centerX: this.world.tileCenterToWorld({ x: column.x, y: column.top }).x,
      ground: this.world.tileToWorld({ x: column.x, y: column.top }).y,
      shaftWidth: (column.half * 2 + 1) * tile.width,
    };
  }

  private get shaftBottomTile() {
    return this.geometry.column.bottom + this.platforms * SHAFT.step;
  }

  public get shaft() {
    return this.shaftActor;
  }

  // level 0 = the first platform, at the shaft's first bottom; every platform sits in the chamber
  // its bomb blew out: open space to both sides
  public launchPointAt(level: number): Position2D {
    const bottomTile = this.geometry.column.bottom + level * SHAFT.step;
    const bottom = this.world.tileToWorld({ x: 0, y: bottomTile + 1 }).y;
    return { x: this.geometry.centerX, y: bottom - DWARF_BODY.radius };
  }

  public get levels() {
    return this.platforms + 1;
  }

  public get railSpeed() {
    return RAILS.speed;
  }

  public launchSites(): LaunchSite[] {
    const sites: LaunchSite[] = [];
    for (let level = 0; level < this.levels; level++)
      sites.push({ name: `poziom ${level + 1}`, level, point: this.launchPointAt(level) });
    this.stations.forEach((station, index) => {
      // cut off by the eraser: not a place to go until the gap is laid again
      if (!this.isConnected(station)) return;
      const level = this.levelOfRow(station.gy);
      const right = this.world.tileToWorld({ x: station.gx + 1, y: station.gy + 1 });
      sites.push({
        name: `stacja ${index + 1} (poz. ${level + 1})`,
        level,
        point: { x: right.x, y: right.y - DWARF_BODY.radius },
      });
    });
    return sites;
  }

  // ---- rails ----

  // the shaft platform in this row, -1 = none
  private levelOfRow(gy: number) {
    const below = gy - this.geometry.column.bottom;
    if (below < 0 || below % SHAFT.step !== 0) return -1;
    const level = below / SHAFT.step;
    return level < this.levels ? level : -1;
  }

  private inShaft(gx: number) {
    return Math.abs(gx - this.geometry.column.x) <= this.geometry.column.half;
  }

  private isStation(gx: number, gy: number) {
    return this.stations.some((station) => station.gy === gy && (gx === station.gx || gx === station.gx + 1));
  }

  private isFree(gx: number, gy: number) {
    if (!this.world.inside(gx, gy) || this.world.getType(gx, gy) !== BlocksID.air) return false;
    return !this.inShaft(gx) && !this.tracks.has(this.world.tileIndex(gx, gy)) && !this.isStation(gx, gy);
  }

  // what a track or a station can hook onto at its side: a track, a station or a shaft platform
  private isLink(gx: number, gy: number) {
    if (!this.world.inside(gx, gy)) return false;
    if (this.tracks.has(this.world.tileIndex(gx, gy)) || this.isStation(gx, gy)) return true;
    return this.inShaft(gx) && this.levelOfRow(gy) >= 0;
  }

  public canPlace(piece: RailPiece, gx: number, gy: number) {
    if (piece === "track") return this.isFree(gx, gy) && (this.isLink(gx - 1, gy) || this.isLink(gx + 1, gy));
    return (
      this.isFree(gx, gy) &&
      this.isFree(gx + 1, gy) &&
      (this.isLink(gx - 1, gy) || this.isLink(gx + 2, gy))
    );
  }

  public inStock(piece: RailPiece) {
    return this.resources.amountOf(RAILS.stock[piece]) > 0;
  }

  public place(piece: RailPiece, gx: number, gy: number) {
    if (!this.canPlace(piece, gx, gy) || !this.resources.pay([[RAILS.stock[piece], 1]])) return false;
    if (piece === "track") this.tracks.add(this.world.tileIndex(gx, gy));
    else this.stations.push({ gx, gy });
    return true;
  }

  // a track or a station on this tile goes back to the stock; false = nothing of the player's here
  public erase(gx: number, gy: number) {
    if (!this.world.inside(gx, gy)) return false;
    const index = this.world.tileIndex(gx, gy);
    if (this.tracks.delete(index)) {
      this.resources.addResource(GameResourcesID.track, 1);
      return true;
    }
    const station = this.stations.findIndex(
      (candidate) => candidate.gy === gy && (gx === candidate.gx || gx === candidate.gx + 1),
    );
    if (station === -1) return false;
    this.stations.splice(station, 1);
    this.resources.addResource(GameResourcesID.station, 1);
    return true;
  }

  // nothing missing between it and the shaft: every tile there a track or another station
  private isConnected(station: Station) {
    const column = this.geometry.column;
    const right = station.gx > column.x;
    const from = right ? station.gx - 1 : station.gx + 2;
    const to = right ? column.x + column.half + 1 : column.x - column.half - 1;
    const step = right ? -1 : 1;
    for (let gx = from; gx !== to + step; gx += step) {
      const linked = this.tracks.has(this.world.tileIndex(gx, station.gy)) || this.isStation(gx, station.gy);
      if (!linked) return false;
    }
    return this.levelOfRow(station.gy) >= 0;
  }

  // the shaft column at ground level, the dwarf's centre
  public get shaftTop(): Position2D {
    return { x: this.geometry.centerX, y: this.geometry.ground - DWARF_BODY.radius };
  }

  // the tavern's side towards the shaft
  public get door(): Position2D {
    const tavernRight =
      this.geometry.centerX -
      this.geometry.shaftWidth / 2 -
      LAYOUT.fromShaft * this.geometry.tile.width;
    return { x: tavernRight, y: this.geometry.ground - DWARF_BODY.radius };
  }

  // ---- buildings ----

  private spawnBuildings() {
    const tile = this.geometry.tile;
    const size = {
      width: LAYOUT.building.width * tile.width,
      height: LAYOUT.building.height * tile.height,
    };
    const step = size.width + LAYOUT.gap * tile.width;
    const edge = this.geometry.shaftWidth / 2 + LAYOUT.fromShaft * tile.width + size.width / 2;
    const y = this.geometry.ground - size.height / 2;
    LAYOUT.left.forEach((kind, index) =>
      this.spawnBuilding(kind, { x: this.geometry.centerX - edge - index * step, y }, size),
    );
    LAYOUT.right.forEach((kind, index) =>
      this.spawnBuilding(kind, { x: this.geometry.centerX + edge + index * step, y }, size),
    );
    this.spawnShaft();
  }

  private spawnBuilding(kind: BuildingKind, position: Position2D, size: Size2D) {
    const building = new Building({
      kind,
      position,
      size,
      color: this.built.has(kind) ? COLORS[kind] : UNBUILT_COLOR,
      title: () => this.title(kind),
    });
    this.buildings.set(kind, building);
    this.scene.spawnActor(building);
  }

  private spawnShaft() {
    const top = this.geometry.ground - LAYOUT.headframe * this.geometry.tile.height;
    const bottom = this.world.tileToWorld({ x: 0, y: this.shaftBottomTile + 1 }).y;
    this.shaftActor = new Shaft({
      position: { x: this.geometry.centerX, y: (top + bottom) / 2 },
      size: { width: this.geometry.shaftWidth, height: bottom - top },
      title: () => this.title("shaft"),
    });
    this.buildings.set("shaft", this.shaftActor);
    this.scene.spawnActor(this.shaftActor);
  }

  private title(kind: BuildingKind) {
    const name = NAMES[kind];
    if (!this.built.has(kind)) return `${name}\n(do zbudowania)`;
    switch (kind) {
      case "tavern":
        return `${name}\nkulka: ${CREW[DwarfsID.scout]} piwa, poziomy: ${this.levels}`;
      case "board":
        return `${name}\n${this.contracts.text}`;
      case "treasury":
        return `${name}\n${Math.floor(this.treasury)}/${TREASURY.cap} piwa`;
      case "distillery": {
        const happy = this.happyHour > 0 ? `\nhappy hour: ${Math.ceil(this.happyHour)} s` : "";
        return `${name} poz. ${this.distilleryLevel}\n1 piwo / ${DISTILLERY.seconds[this.distilleryLevel - 1]} s${happy}`;
      }
      case "alchemist":
        return `${name}\n${this.orderText()}`;
      case "shaft":
        return `${name}\n${this.shaftState()}`;
      default:
        return name;
    }
  }

  public isBuilt(kind: BuildingKind) {
    return this.built.has(kind);
  }

  private build(kind: BuildingKind) {
    const cost = BUILD[kind];
    if (!cost || this.built.has(kind) || !this.pay(cost)) return;
    this.built.add(kind);
    this.buildings.get(kind)?.setColor(COLORS[kind]);
    this.emitSceneEvent<BuildingBuiltEvent>("buildingBuilt", { kind });
    this.message = `Zbudowano: ${NAMES[kind]}`;
  }

  // ---- clicks and menus ----

  private clicked(kind: BuildingKind) {
    if (kind === "treasury") {
      this.collectLevy();
      return;
    }
    // one place and one kind of dwarf: nothing to choose
    const sites = this.launchSites();
    if (kind === "tavern" && sites.length === 1 && this.research.level("training") === 0) {
      this.sendDwarf(DwarfsID.scout, sites[0]);
      return;
    }
    this.openMenu(kind);
  }

  private openMenu(kind: BuildingKind) {
    this.closeMenu();
    this.menuKind = kind;
    const panel = new MenuPanel({ blur: 4 });
    this.menu = panel;
    panel.title(NAMES[kind]);
    if (!this.built.has(kind)) {
      const cost = BUILD[kind]!;
      panel.note(`Koszt: ${describeAmounts(cost)}`);
      panel.button("Zbuduj", () => this.act(() => this.build(kind)));
    } else this.fillMenu(kind, panel);
    panel.note(() => this.message);
    panel.button("Zamknij", () => this.closeMenu());
  }

  private fillMenu(kind: BuildingKind, panel: MenuPanel) {
    switch (kind) {
      case "tavern":
        panel.note("Skąd strzela?");
        for (const [id, beer] of Object.entries(CREW)) {
          const dwarfID = Number(id) as DwarfsID;
          if (dwarfID === DwarfsID.miner && this.research.level("training") === 0) continue;
          const sites = this.launchSites().map(
            (site): [string, () => void] => [site.name, () => this.sendDwarf(dwarfID, site)],
          );
          panel.row(`${DWARFS[dwarfID].name} (${beer} piwa)`, sites);
          panel.note(DWARFS[dwarfID].description);
        }
        break;
      case "market":
        this.fillMarket(panel);
        break;
      case "board":
        panel.note(() => this.contracts.text);
        panel.note(() => `Nagroda: ${this.contracts.rewardText}`);
        break;
      case "distillery":
        this.fillDistillery(panel);
        break;
      case "alchemist":
        this.fillAlchemist(panel);
        break;
      case "shaft":
        this.fillShaft(panel);
        break;
      case "carpenter":
        this.fillCarpenter(panel);
        break;
    }
  }

  private fillCarpenter(panel: MenuPanel) {
    for (const recipe of CARPENTER) {
      const buttons = recipe.batches.map((count): [string, () => void] => {
        const cost: ResourceAmounts = recipe.cost.map(([res, amount]) => [res, amount * count]);
        return [
          `${count}× (${describeAmounts(cost)})`,
          () =>
            this.act(() => {
              if (!this.pay(cost)) return;
              this.resources.addResource(recipe.item, count);
              this.message = `+${count} ${recipe.name}`;
            }),
        ];
      });
      panel.row(`${recipe.name}: masz ${this.resources.amountOf(recipe.item)}`, buttons);
    }
    panel.note("Stawiasz w trybie budowy: Tab.");
  }

  private fillMarket(panel: MenuPanel) {
    // only what is in stock; the menu is built again after every sale
    for (const [id, data] of Object.entries(RESOURCES)) {
      const res = Number(id) as GameResourcesID;
      const sell = data.sell;
      const amount = this.resources.amountOf(res);
      if (!sell || amount === 0) continue;
      panel.row(`${data.label} ${amount} (${sell.amount} → ${sell.beer} piwa)`, [
        ["1×", () => this.act(() => this.sell(res, 1))],
        ["5×", () => this.act(() => this.sell(res, 5))],
        ["wszystko", () => this.act(() => this.sell(res))],
      ]);
    }
    panel.button("Sprzedaj wszystkie surowce", () =>
      this.act(() => {
        let beer = 0;
        for (const id of Object.keys(RESOURCES)) beer += this.sell(Number(id) as GameResourcesID);
        this.message = beer > 0 ? `+${beer} piwa` : "Nie ma czego sprzedać";
      }),
    );
    panel.button(`Kup 1 drewno (${MARKET.woodPrice} piwa)`, () => this.act(() => this.buyWood(1)));
    panel.button(`Kup 5 drewna (${MARKET.woodPrice * 5} piwa)`, () =>
      this.act(() => this.buyWood(5)),
    );
  }

  // up to most full batches (default: the whole stock); the beer it gave
  private sell(res: GameResourcesID, most = Infinity) {
    const sell = RESOURCES[res].sell;
    if (!sell) return 0;
    const batches = Math.min(most, Math.floor(this.resources.amountOf(res) / sell.amount));
    if (batches === 0) {
      this.message = `Za mało: ${RESOURCES[res].label} (${sell.amount})`;
      return 0;
    }
    this.resources.removeResource(res, batches * sell.amount);
    this.resources.addResource(GameResourcesID.beer, batches * sell.beer);
    this.message = `+${batches * sell.beer} piwa`;
    return batches * sell.beer;
  }

  private buyWood(amount: number) {
    if (!this.pay([[GameResourcesID.beer, MARKET.woodPrice * amount]])) return;
    this.resources.addResource(GameResourcesID.wood, amount);
    this.message = `+${amount} drewna`;
  }

  private fillDistillery(panel: MenuPanel) {
    const next = DISTILLERY.upgrades[this.distilleryLevel - 1];
    if (next)
      panel.button(`Ulepsz do poz. ${this.distilleryLevel + 1} (${describeAmounts(next)})`, () =>
        this.act(() => {
          if (!this.pay(next)) return;
          this.distilleryLevel++;
          this.message = `Gorzelnia poz. ${this.distilleryLevel}`;
        }),
      );
    panel.button(`Uwarz premium (${describeAmounts(DISTILLERY.premium)})`, () =>
      this.act(() => {
        if (!this.pay(DISTILLERY.premium)) return;
        this.resources.addResource(GameResourcesID.premium, 1);
        this.message = "+1 premium";
      }),
    );
    const happy = DISTILLERY.happyHour;
    panel.button(`Happy hour: 1 premium → ${happy.seconds} s, ×${happy.multiplier} surowców`, () =>
      this.act(() => {
        if (!this.pay([[GameResourcesID.premium, 1]])) return;
        this.happyHour += happy.seconds;
        this.message = "Happy hour!";
      }),
    );
  }

  private orderText() {
    const order = this.research.currentOrder;
    if (order.length === 0) return "czeka, aż coś wykopiesz";
    return `${describeAmounts([...order])} → 1 pkt`;
  }

  private fillAlchemist(panel: MenuPanel) {
    panel.note(() => `Zamówienie: ${this.orderText()}`);
    panel.button("Oddaj zamówienie", () =>
      this.act(() => {
        if (this.research.fulfill()) this.message = "+1 punkt badań";
        else this.message = "Brakuje składników";
      }),
    );
    panel.button(`Inne zamówienie (${this.research.skipCost} piwa)`, () =>
      this.act(() => {
        if (this.research.skip()) this.message = "Nowe zamówienie";
        else this.message = `Za mało piwa (${this.research.skipCost})`;
      }),
    );
    panel.note(() => `Punkty badań: ${this.resources.amountOf(GameResourcesID.research)}`);
    for (const node of Object.keys(NODES) as NodeID[]) {
      const data = NODES[node];
      panel.button(
        () => {
          const level = `${this.research.level(node)}/${data.costs.length}`;
          const cost = this.research.isMaxed(node) ? "max" : `${this.research.nextCost(node)} pkt`;
          return `${data.name} ${level}: ${data.effect} (${cost})`;
        },
        () =>
          this.act(() => {
            if (this.research.upgrade(node)) this.message = `${data.name} poz. ${this.research.level(node)}`;
            else this.message = this.research.isMaxed(node) ? "Już na maksa" : "Za mało punktów";
          }),
      );
    }
  }

  // halved by the charges research
  private get bombCost(): ResourceAmounts {
    const share = this.research.level("charges") > 0 ? 0.5 : 1;
    return SHAFT.bomb.map(([res, amount]) => [res, Math.ceil(amount * share)]);
  }

  private shaftState() {
    if (this.bombs > this.platforms) return `klik: platforma (${describeAmounts(SHAFT.platform)})`;
    return `klik: bomba (${describeAmounts(this.bombCost)})`;
  }

  private fillShaft(panel: MenuPanel) {
    panel.note(`Platformy: ${this.platforms}`);
    if (this.bombs > this.platforms)
      panel.button(`Zbuduj platformę (${describeAmounts(SHAFT.platform)})`, () =>
        this.act(() => this.buildPlatform()),
      );
    else
      panel.button(`Zrzuć bombę (${describeAmounts(this.bombCost)})`, () =>
        this.act(() => this.dropBomb()),
      );
  }

  // an action, then the menu built again (its buttons may have changed)
  private act(action: () => void) {
    action();
    if (this.menuKind && this.menu) {
      const message = this.message;
      this.openMenu(this.menuKind);
      this.message = message;
    }
  }

  // false = it shuts the menu down only when there was one
  public closeMenu() {
    if (!this.menu) return false;
    this.menu.destroy();
    this.menu = null;
    this.menuKind = null;
    this.message = "";
    return true;
  }

  private pay(cost: ResourceAmounts) {
    if (this.resources.pay(cost)) return true;
    this.message = `Brakuje: ${describeAmounts(cost)}`;
    return false;
  }

  // ---- dwarfs, levy ----

  private sendDwarf(dwarfID: DwarfsID, site: LaunchSite) {
    const tavern = this.buildings.get("tavern")!;
    const launcher = this.scene.getSystem(Launcher);
    const cost = CREW[dwarfID]!;
    this.closeMenu();
    if (!launcher.isIdle) {
      tavern.notice.show("Krasnolud już w drodze");
      return;
    }
    if (!this.resources.pay([[GameResourcesID.beer, cost]])) {
      tavern.notice.show(`Za mało piwa (${cost})`);
      return;
    }
    launcher.sendToWork(dwarfID, cost, cost + this.research.level("mug"), site);
  }

  private collectLevy() {
    const treasury = this.buildings.get("treasury")!;
    const beer = Math.floor(this.treasury);
    if (beer === 0) {
      treasury.notice.show("Skarbiec pusty");
      return;
    }
    this.treasury -= beer;
    this.resources.addResource(GameResourcesID.beer, beer);
    treasury.notice.show(`Danina: +${beer} piwa`);
  }

  // ---- shaft ----

  private dropBomb() {
    if (!this.scene.getSystem(Launcher).isIdle) {
      this.message = "Poczekaj, aż krasnolud skończy";
      return;
    }
    if (!this.pay(this.bombCost)) return;
    this.bombs++;
    const terrain = this.scene.getSystem(Terrain);
    const column = this.geometry.column;
    const from = this.shaftBottomTile + 1;
    const bottom = column.bottom + this.bombs * SHAFT.step;
    const blast = (gx: number, gy: number) => {
      if (!this.world.inside(gx, gy) || getBlock(this.world.getType(gx, gy)).unbreakable) return;
      terrain.mine(gx, gy);
    };
    for (let gy = from; gy <= bottom; gy++)
      for (let dx = -column.half; dx <= column.half; dx++) blast(column.x + dx, gy);
    const chamber = SHAFT.chamber;
    for (let dy = -chamber.y; dy <= chamber.y; dy++)
      for (let dx = -chamber.x; dx <= chamber.x; dx++)
        if ((dx / chamber.x) ** 2 + (dy / chamber.y) ** 2 <= 1) blast(column.x + dx, bottom + dy);
    Camera.shake(SHAFT.shake);
    this.emitSceneEvent("bombDropped", {});
    this.message = "Bum! Teraz platforma";
  }

  private buildPlatform() {
    if (!this.scene.getSystem(Launcher).isIdle) {
      this.message = "Poczekaj, aż krasnolud skończy";
      return;
    }
    if (this.bombs <= this.platforms || !this.pay(SHAFT.platform)) return;
    this.platforms++;
    this.shaftActor.selfDestroy();
    this.spawnShaft();
    this.emitSceneEvent("platformBuilt", {});
    this.message = `Platforma ${this.platforms} gotowa`;
  }

  render(): void {
    const plank = SHAFT.plank;
    for (let level = 0; level < this.levels; level++) {
      const point = this.launchPointAt(level);
      // over the shaft, under the dwarf
      Draw.rect({
        position: {
          x: point.x - this.geometry.shaftWidth / 2,
          y: point.y + DWARF_BODY.radius,
          z: RENDER_ORDER.solidTiles,
        },
        size: { width: this.geometry.shaftWidth, height: plank.height },
        color: plank.color,
      });
    }
    const tile = this.geometry.tile;
    const width = this.world.mapInTiles.width;
    for (const index of this.tracks) {
      const corner = this.world.tileToWorld({ x: index % width, y: Math.floor(index / width) + 1 });
      Draw.rect({
        position: { x: corner.x, y: corner.y - RAILS.rail.height, z: RENDER_ORDER.solidTiles },
        size: { width: tile.width, height: RAILS.rail.height },
        color: RAILS.rail.color,
      });
    }
    for (const station of this.stations) {
      const corner = this.world.tileToWorld({ x: station.gx, y: station.gy + 1 });
      Draw.rect({
        position: { x: corner.x, y: corner.y - RAILS.deck.height, z: RENDER_ORDER.solidTiles },
        size: { width: tile.width * 2, height: RAILS.deck.height },
        color: RAILS.deck.color,
      });
    }
  }

  // ---- timers ----

  preUpdate(): void {
    this.menu?.update();
  }

  update(): void {
    const delta = Time.getDeltaTime();
    this.treasury = Math.min(TREASURY.cap, this.treasury + (TREASURY.cap / TREASURY.fillSeconds) * delta);
    this.happyHour = Math.max(0, this.happyHour - delta);
    this.resources.mineMultiplier = this.happyHour > 0 ? DISTILLERY.happyHour.multiplier : 1;
    if (!this.built.has("distillery")) return;
    this.brewing += delta;
    const every = DISTILLERY.seconds[this.distilleryLevel - 1];
    if (this.brewing < every) return;
    this.brewing -= every;
    this.resources.addResource(GameResourcesID.beer, 1);
    this.buildings.get("distillery")?.notice.show("+1 piwo");
  }

  // ---- save ----

  public save(writer: ByteWriter) {
    let built = 0;
    SAVED_BUILT.forEach((kind, bit) => {
      if (this.built.has(kind)) built |= 1 << bit;
    });
    writer.u8(built);
    writer.u8(this.distilleryLevel);
    writer.u16(this.bombs);
    writer.u16(this.platforms);
    writer.f32(this.treasury);
    writer.f32(this.brewing);
    writer.f32(this.happyHour);
    writer.u32(this.tracks.size);
    for (const index of this.tracks) writer.u32(index);
    writer.u16(this.stations.length);
    for (const station of this.stations) {
      writer.u16(station.gx);
      writer.u16(station.gy);
    }
  }

  // before start: the buildings are spawned from this
  public load(reader: ByteReader) {
    const built = reader.u8();
    SAVED_BUILT.forEach((kind, bit) => {
      if (built & (1 << bit)) this.built.add(kind);
    });
    this.distilleryLevel = reader.u8();
    this.bombs = reader.u16();
    this.platforms = reader.u16();
    this.treasury = reader.f32();
    this.brewing = reader.f32();
    this.happyHour = reader.f32();
    // newer fields: a block from before them simply ends here
    if (reader.remaining === 0) return;
    const tracks = reader.u32();
    for (let index = 0; index < tracks; index++) this.tracks.add(reader.u32());
    const stations = reader.u16();
    for (let index = 0; index < stations; index++) this.stations.push({ gx: reader.u16(), gy: reader.u16() });
  }
}
