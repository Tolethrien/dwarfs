import PragmaSystem from "@pragma/system";
import Time from "@engine/time";
import { Camera } from "@engine/camera/camera";
import AxiomMath from "@axiom/math";
import Easing from "@axiom/easing";
import Grid from "@axiom/grid";
import Noise from "@axiom/noise";
import { assert } from "@axiom/utils";
import type Coroutine from "@engine/coroutines/coroutine";
import { DWARF_LOOK } from "../content/dwarfs";
import { BlocksID } from "../content/blocks";
import { BUILD_ELEMENTS, BuildElementID, BuildingsID, STRUCTURES } from "../content/structures";
import { SURFACE } from "../content/surface";
import { shaftColumns } from "../world/shaftShape";
import { buildingSprite } from "../world/buildingShape";
import IntroDwarf from "../actors/introDwarf";
import type Shaft from "../actors/shaft";
import ShaftDigging from "../components/shaftDigging";
import IntroUI, { type IntroLetter } from "../ui/intro";
import { formatAmount, ResourcesID, type ResourceCost } from "../content/resources";
import { HEADQUARTERS } from "../components/headquarters";
import { removeSpeech, speech } from "../ui/elements/speech";
import type { UIWorldAnchor } from "../ui/elements/world";
import type { Vcam } from "@engine/camera/vcam";
import type { BuildingPlace } from "./buildings";
import { showHud } from "../ui/hud";
import Terrain from "./terrain";
import Discovery from "./discovery";
import Stations from "./stations";
import Buildings from "./buildings";
import BuildMode from "./buildMode";
import GameMode, { VIEW } from "./gameMode";
import Resources from "./resources";
import PlayerStats from "./playerStats";
import Roster, { type DwarfState } from "./roster";
import { isAnyWindowOpen } from "../ui/elements/window";
import Tavern from "../components/tavern";
import Calendar from "./calendar";

// hover: pixels between the ground and the dwarf's bottom; look: the camera's spot over the ground
// and zoom; glide: pixels a second at the start, it brakes to a stop in the middle; lift: screen
// pixels from the dwarf up to its bubble; niche: the buildings it's dug for, each on its own wall, rows its middle may land on, the tavern must end
// above the first segment's bottom; margin: tiles of extra room around it at most, the outline
// bites in by up to jag of it, bumps: how many times it goes in and out around; descend: the camera's ride down to the dug shaft;
// held: what the build menu keeps locked through the intro; build: the buildings the player puts up in the intro, in their niches; grant: what
// the signed letter gives
const INTRO = {
  grant: { [ResourcesID.beer]: 400, [ResourcesID.stone]: 50 } as ResourceCost,
  unsigned: "Comrade",
  hover: 30,
  // seconds of the fades from and into black
  curtain: { dawn: 1.5, close: 0.5, open: 0.5 },
  look: { overGround: 250, zoom: 0.6 },
  glide: { speed: 900 },
  speech: { lift: 70 },
  // hold: seconds each of the dwarf's lines stays up
  pause: { beforeLine: 0.4, beforeButton: 1.2, hold: { arrive: 2.4, letter: 5, signed: 5 } },
  lines: {
    arrive: "Ooh, this is the spot!",
    letter: "Now where did I put that blasted letter...",
    signed: "Well... that's me done for, then.",
    openBuild: "Open build mode [Tab]",
    closeBuild: "Close build mode [Tab]",
    clickTavern: "Click the tavern",
    hire: (hired: number, crew: number) => `Hire your first crew (${hired}/${crew})`,
    closeTavern: "Close the tavern",
    clickStation: "Click the station",
    order: "Order a dwarf to the station",
    ride: "Wait for your dwarf to arrive",
    shoot: "Press Shoot, then drag back and let go",
  },
  buttons: { setUpHeadquarters: "Set up headquarters", digShaft: "Dig the shaft", openTavern: "Go to the tavern", toStation: "Go to the station" },
  cameraGlide: { seconds: 1.2 },
  niche: { buildings: [BuildingsID.tavern, BuildingsID.smelter], rows: { min: 14, max: 48 }, margin: 4, jag: 0.8, bumps: 1.6 },
  descend: { zoom: 0.2, seconds: 2.5 },
  held: [BuildElementID.smelter],
  build: [
    { building: BuildingsID.tavern, element: BuildElementID.tavern, line: "Build a tavern (Buildings → Tavern)" },
  ],
};

type IntroBuild = (typeof INTRO.build)[number];

export default class Intro extends PragmaSystem {
  private readonly ui = new IntroUI(() => this.skip());
  private vcam: Vcam | undefined;
  private dwarf: IntroDwarf | undefined;
  private bubble: UIWorldAnchor | undefined;
  public isDone = false;
  private shaftSpawned = false;
  private granted = false;
  private readonly niches = new Map<BuildingsID, BuildingPlace>();
  declare private terrain: Terrain;
  declare private discovery: Discovery;
  declare private stations: Stations;
  declare private buildings: Buildings;
  declare private buildMode: BuildMode;
  declare private gameMode: GameMode;
  declare private resources: Resources;
  declare private playerStats: PlayerStats;
  declare private roster: Roster;
  declare private calendar: Calendar;

  constructor(
    internal: InternalPSProps,
    private readonly shaft: Shaft,
  ) {
    super(internal);
  }

  awake(): void {
    this.terrain = this.scene.getSystem(Terrain);
    this.discovery = this.scene.getSystem(Discovery);
    this.stations = this.scene.getSystem(Stations);
    this.buildings = this.scene.getSystem(Buildings);
    this.buildMode = this.scene.getSystem(BuildMode);
    this.gameMode = this.scene.getSystem(GameMode);
    this.resources = this.scene.getSystem(Resources);
    this.playerStats = this.scene.getSystem(PlayerStats);
    this.roster = this.scene.getSystem(Roster);
    this.calendar = this.scene.getSystem(Calendar);
    this.calendar.isRunning = false;
    this.gameMode.set("cutscene");
    showHud(false);
  }

  start(): void {
    const intro = this;
    this.startCoroutine(
      function* (co) {
        yield* intro.play(co);
      },
      { key: "intro" },
    );
  }

  update(): void {
    this.ui.update();
  }

  destroy(): void {
    this.ui.destroy();
  }

  private *play(co: Coroutine) {
    const middle = this.middle;
    const vcam = Camera.claim({ blend: 0 });
    this.vcam = vcam;
    vcam.moveTo({ x: middle.x, y: -SURFACE.ground - INTRO.look.overGround }, { duration: 0 });
    vcam.zoomTo(INTRO.look.zoom, { duration: 0 });
    yield co.waitFrames(1);
    yield co.waitPromise(this.ui.curtain.brighten(INTRO.curtain.dawn * 1000));

    const fromLeft = AxiomMath.randomBool();
    const view = Camera.getViewBounds;
    const from = { x: fromLeft ? view.min.x - DWARF_LOOK.cell : view.max.x + DWARF_LOOK.cell, y: middle.y };
    const dwarf = new IntroDwarf(from);
    this.dwarf = dwarf;
    this.scene.spawnActor(dwarf);
    yield* this.glide(dwarf, from, middle);

    yield co.waitSeconds(INTRO.pause.beforeLine);
    this.say(INTRO.lines.arrive);
    yield co.waitSeconds(INTRO.pause.hold.arrive);
    this.say(INTRO.lines.letter);
    yield co.waitSeconds(INTRO.pause.hold.letter);
    this.hush();
    yield co.waitSeconds(INTRO.pause.beforeLine);
    this.playerStats.name = yield* co.join(this.ui.showLetter(this.letter));
    this.grant();
    yield co.waitSeconds(INTRO.pause.beforeLine);
    this.say(INTRO.lines.signed);
    yield co.waitSeconds(INTRO.pause.hold.signed);
    this.hush();
    yield co.waitSeconds(INTRO.pause.beforeButton);
    yield co.waitPromise(this.ui.offer(INTRO.buttons.setUpHeadquarters));
    this.ui.hide();
    yield co.waitPromise(this.ui.curtain.darken(INTRO.curtain.close * 1000));
    this.raiseHeadquarters();
    yield co.waitPromise(this.ui.curtain.brighten(INTRO.curtain.open * 1000));
    yield* this.enterHeadquarters(vcam);
    this.dismissDwarf();
    yield co.waitSeconds(INTRO.pause.beforeButton);
    yield co.waitPromise(this.ui.offer(INTRO.buttons.digShaft));

    this.ui.hide();
    yield* this.digShaft(co);

    const descend = INTRO.descend;
    yield co.all([
      vcam.moveTo(this.descendTarget, { duration: descend.seconds, easing: "easeInOutSine" }),
      vcam.zoomTo(descend.zoom, { duration: descend.seconds, easing: "easeInOutSine" }),
    ]);
    this.placeCamera();
    yield* this.teachBuilding(co);
    yield* this.teachTavern(co);
    yield* this.teachStation(co);
    this.ui.hideSkip();
    this.finish();
  }

  // the player takes over at the first Tab; leaving before everything stands asks for Tab again. The
  // camera already shows both niches, so it stays put, and no building opens its window yet
  private *teachBuilding(co: Coroutine) {
    const lines = INTRO.lines;
    this.gameMode.block([...VIEW, "select"]);
    for (const element of INTRO.held) this.buildMode.held.add(element);
    const building = () => this.gameMode.is("build");
    while (this.missing() !== undefined) {
      this.ui.hint(lines.openBuild);
      this.gameMode.allowInCutscene("toggleBuild");
      yield co.waitUntil(building);
      this.takeOver();
      while (building()) {
        const step = this.missing();
        if (step === undefined) break;
        this.ui.hint(step.line);
        yield co.waitUntil(() => this.missing() !== step || !building());
      }
    }
    if (building()) {
      this.ui.hint(lines.closeBuild);
      yield co.waitUntil(() => !building());
    }
  }

  // the camera glides to the tavern, which breathes light and alone takes clicks until the first
  // crew is hired; closing it early asks for the click again
  private *teachTavern(co: Coroutine) {
    const lines = INTRO.lines;
    yield* this.offerGlide(co, INTRO.buttons.openTavern, this.tavernSpot());
    const tavern = this.tavern();
    this.buildings.highlight(BuildingsID.tavern, true);
    this.buildings.clickOnly = BuildingsID.tavern;
    this.gameMode.unblock(["select"]);
    this.gameMode.block(["toggleBuild", "toggleDig"]);
    const crew = tavern.startCrew;
    const hired = () => this.roster.dwarfs.length;
    while (hired() < crew) {
      this.ui.hint(lines.clickTavern);
      yield co.waitUntil(() => tavern.isOpen);
      while (tavern.isOpen && hired() < crew) {
        const count = hired();
        this.ui.hint(lines.hire(count, crew), "top");
        yield co.waitUntil(() => hired() !== count || !tavern.isOpen);
      }
    }
    this.buildings.highlight(BuildingsID.tavern, false);
    yield* this.hintUntil(co, lines.closeTavern, () => !tavern.isOpen);
  }

  // the first dwarf rides from the tavern to the shaft's station and is shot into the rock; the
  // intro ends with that shot
  private *teachStation(co: Coroutine) {
    const lines = INTRO.lines;
    const station = this.stations.stations[0];
    assert(station !== undefined, "The intro has no station at the shaft");
    const launcher = this.stations.launcherOf(station);
    const tile = this.terrain.tile;
    const body = launcher.tiles;
    yield* this.offerGlide(co, INTRO.buttons.toStation, { x: (body.x + body.w / 2) * tile, y: (body.y + body.h / 2) * tile });
    this.buildings.clickOnly = "none";
    const anyIs = (state: DwarfState) => this.roster.dwarfs.some((dwarf) => this.roster.stateOf(dwarf) === state);
    const ordered = () => this.roster.dwarfs.some((dwarf) => this.roster.stateOf(dwarf) !== "tavern");
    while (!ordered()) {
      this.ui.hint(lines.clickStation);
      yield co.waitUntil(() => this.stations.isMenuOpen);
      this.ui.hint(lines.order, "top");
      yield co.waitUntil(() => ordered() || !this.stations.isMenuOpen);
    }
    yield* this.hintUntil(co, lines.ride, () => launcher.queue.length > 0 || anyIs("working"));
    yield* this.hintUntil(co, lines.shoot, () => anyIs("working"));
  }

  // over an open window the hint moves to the top, so it never covers it
  private *hintUntil(co: Coroutine, line: string, done: () => boolean) {
    while (!done()) {
      const open = isAnyWindowOpen();
      this.ui.hint(line, open ? "top" : "bottom");
      yield co.waitUntil(() => done() || isAnyWindowOpen() !== open);
    }
  }

  // a button that glides the camera to the spot, the player's own camera stays locked meanwhile; the
  // game's camera waits at the spot, so the release has nothing to glide back to
  private *offerGlide(co: Coroutine, label: string, spot: Position2D) {
    yield co.waitPromise(this.ui.offer(label));
    this.ui.hide();
    yield co.start(function* (glide) {
      const vcam = glide.take(Camera.claim({ blend: 0, release: 0 }));
      yield vcam.moveTo(spot, { duration: INTRO.cameraGlide.seconds, easing: "easeInOutSine" });
      Camera.setPosition(spot);
    });
  }

  private tavernSpot() {
    const place = this.buildings.placeOf(BuildingsID.tavern);
    assert(place !== undefined, "The intro has no tavern to look at");
    const tile = this.terrain.tile;
    return { x: (place.base.x + place.base.w / 2) * tile, y: (place.base.y + place.base.h / 2) * tile };
  }

  private tavern() {
    const actor = this.buildings.actorOf(BuildingsID.tavern);
    assert(actor !== undefined, "The intro has no tavern");
    const tavern = actor.getComponent(Tavern);
    assert(tavern !== undefined, "The tavern has no Tavern");
    return tavern;
  }

  private missing(): IntroBuild | undefined {
    return INTRO.build.find((step) => this.buildings.placeOf(step.building) === undefined);
  }

  // finishes the intro for the player: the shaft and the buildings stand, the camera waits where the ride would end
  private skip() {
    this.ui.hideSkip();
    this.stopCoroutine("intro");
    const intro = this;
    this.startCoroutine(function* (co) {
      intro.ui.hide();
      intro.grant();
      intro.dismissDwarf();
      intro.raiseHeadquarters();
      yield* intro.digShaft(co);
      if (intro.gameMode.is("build")) intro.buildMode.leave();
      for (const step of INTRO.build) {
        if (intro.buildings.placeOf(step.building) !== undefined) continue;
        const niche = intro.niches.get(step.building);
        assert(niche !== undefined, `The intro dug no niche for the ${BuildingsID[step.building]}`);
        const paid = intro.resources.pay(BUILD_ELEMENTS[step.element].cost);
        assert(paid, `The grant can't pay for the ${BuildingsID[step.building]}`);
        intro.buildings.build(step.building, niche);
      }
      if (intro.vcam !== undefined) intro.placeCamera();
      intro.takeOver();
      intro.gameMode.set("game");
      // a tavern built just now gets its applications in its first start
      const actor = intro.buildings.actorOf(BuildingsID.tavern);
      yield co.waitUntil(() => actor === undefined || actor.getAlive());
      intro.tavern().hireAll();
      intro.finish();
    });
  }

  private takeOver() {
    if (this.vcam === undefined) return;
    this.vcam.release(0);
    this.vcam = undefined;
    this.ui.closeLetterbox();
  }

  // the clock starts with the first shot, or with the skip
  private finish() {
    this.isDone = true;
    this.calendar.isRunning = true;
    for (const element of INTRO.held) this.buildMode.held.delete(element);
    this.gameMode.unblock();
    this.buildings.clickOnly = undefined;
    if (this.buildings.placeOf(BuildingsID.tavern) !== undefined) this.buildings.highlight(BuildingsID.tavern, false);
    this.ui.hide();
    showHud(true);
  }

  private get letter(): IntroLetter {
    const grant = INTRO.grant;
    const beer = grant[ResourcesID.beer] ?? 0;
    const stone = grant[ResourcesID.stone] ?? 0;
    const subsidy = HEADQUARTERS.subsidy;
    return {
      title: "Directive of the Central Committee",
      lines: [
        "Comrade! By resolution of the Party, you are assigned to these mountains to found a new People's Mine and carry the Plan into the rock.",
        `For the first shift, the People's Treasury allots you ${formatAmount(ResourcesID.beer, beer)} of beer and ${formatAmount(ResourcesID.stone, stone)} of stone. Waste is sabotage.`,
        `Until your headquarters is raised to a Regional Headquarters, the Party will deliver ${formatAmount(ResourcesID.beer, subsidy.beer)} of beer every day at noon. The Plan allows you one week. The Plan is not late. Neither are you.`,
        "The Party trusts you, comrade. The Party is also watching. Glory to labour!",
      ],
      name: "Your name, comrade",
      sign: "Sign",
    };
  }

  // given once, whether the letter was signed or skipped; a skipped letter is signed for the player
  private grant() {
    if (this.playerStats.name === "") this.playerStats.name = INTRO.unsigned;
    if (this.granted) return;
    this.granted = true;
    this.resources.addAll(INTRO.grant);
  }

  private say(line: string) {
    const dwarf = this.dwarf;
    assert(dwarf !== undefined, "No intro dwarf to speak");
    this.hush();
    this.bubble = speech(() => dwarf.transform.getRenderPosition(), line, INTRO.speech.lift);
  }

  private hush() {
    if (this.bubble !== undefined) removeSpeech(this.bubble);
    this.bubble = undefined;
  }

  private dismissDwarf() {
    this.hush();
    if (this.dwarf !== undefined) this.scene.deleteActor(this.dwarf);
    this.dwarf = undefined;
  }

  private raiseHeadquarters() {
    if (this.buildings.placeOf(BuildingsID.headquarters) === undefined) this.buildings.buildHeadquarters();
  }

  // the dwarf glides along the ground to the headquarters' door and goes in; the camera rides with
  // it, the dwarf keeps its spot on the screen
  private *enterHeadquarters(vcam: Vcam) {
    const dwarf = this.dwarf;
    assert(dwarf !== undefined, "No intro dwarf to go in");
    const place = this.buildings.placeOf(BuildingsID.headquarters);
    assert(place !== undefined, "No headquarters to go in");
    const door = buildingSprite(BuildingsID.headquarters, place, this.terrain.tile).door;
    assert(door !== undefined, "The headquarters has no door in its sprite");
    const at = dwarf.transform.getPosition();
    const from = { x: at.x, y: at.y };
    const to = { x: door.x, y: from.y };
    const center = vcam.view.center;
    const zoom = vcam.view.zoom;
    const offset = { x: (center.x - from.x) * zoom, y: (center.y - from.y) * zoom };
    vcam.zoomTo(zoom, { at: () => dwarf.transform.getRenderPosition(), offset: offset, duration: this.glideSeconds(from, to) });
    yield* this.glide(dwarf, from, to);
  }

  // the game's camera waits where the ride ended, the release has nothing to glide back to
  private placeCamera() {
    Camera.setPosition(this.descendTarget);
    Camera.setZoom(INTRO.descend.zoom);
  }

  private get descendTarget() {
    return { x: this.middle.x, y: ((STRUCTURES.shaft.startDepth + 1) / 2) * this.terrain.tile };
  }

  // a skip can cut in while the shaft is waiting to come alive, so the second call only waits and finishes
  private *digShaft(co: Coroutine) {
    if (!this.shaftSpawned) this.scene.spawnActor(this.shaft);
    this.shaftSpawned = true;
    yield co.waitUntil(() => this.shaft.getAlive());
    if (this.niches.size > 0) return;
    const digging = this.shaft.getComponent(ShaftDigging);
    assert(digging !== undefined, "The shaft has no ShaftDigging");
    digging.open();
    this.stations.openShaftStation();
    const columns = shaftColumns(this.terrain.world);
    const walls = [columns.from - 1, columns.to + 1];
    if (AxiomMath.randomBool()) walls.reverse();
    INTRO.niche.buildings.forEach((id, index) => this.digNiche(id, walls[index]));
  }

  // room for a building by the given wall of the shaft: the building's whole box, with a ragged cave
  // around it; the shaft's own tiles stay
  private digNiche(id: BuildingsID, wall: number) {
    const world = this.terrain.world;
    const niche = INTRO.niche;
    const place = this.buildings.placeAt(id, { x: wall, y: AxiomMath.randomInt(niche.rows.min, niche.rows.max) });
    this.niches.set(id, place);
    const base = place.base;
    const around = { x: base.x - niche.margin, y: base.y - niche.margin, w: base.w + niche.margin * 2, h: base.h + niche.margin * 2 };
    const noise = new Noise(AxiomMath.randomInt(1, 1_000_000));
    const middle = { x: base.x + base.w / 2, y: base.y + base.h / 2 };
    const tiles = Grid.tilesIn(around).filter((tile) => {
      const type = world.getType(tile.x, tile.y);
      if (type === BlocksID.structure || type === BlocksID.void || type === BlocksID.obsidian) return false;
      const x = tile.x + 0.5;
      const y = tile.y + 0.5;
      const out = Math.hypot(Math.max(base.x - x, 0, x - base.x - base.w), Math.max(base.y - y, 0, y - base.y - base.h));
      const angle = Math.atan2(y - middle.y, x - middle.x);
      const bite = AxiomMath.inverseLerp(-1, 1, noise.simplex2D(Math.cos(angle) * niche.bumps, Math.sin(angle) * niche.bumps));
      return out <= niche.margin * (1 - niche.jag * bite);
    });
    for (const tile of tiles) this.terrain.place(tile.x, tile.y, BlocksID.air);
    this.discovery.revealTiles(tiles);
  }

  // the pace of an ease-out matching the glide's speed at its start, so it brakes into the stop
  private *glide(dwarf: IntroDwarf, from: Position2D, to: Position2D) {
    const seconds = this.glideSeconds(from, to);
    let elapsed = 0;
    while (elapsed < seconds) {
      elapsed += Time.getDeltaTime();
      const progress = Easing.easeOutCubic(Math.min(elapsed / seconds, 1));
      dwarf.transform.setPosition(AxiomMath.lerp(from.x, to.x, progress), from.y);
      yield;
    }
  }

  private glideSeconds(from: Position2D, to: Position2D) {
    return (Math.abs(to.x - from.x) * 3) / INTRO.glide.speed;
  }

  private get middle() {
    const columns = shaftColumns(this.terrain.world);
    const tile = this.terrain.tile;
    return {
      x: ((columns.from + columns.to + 1) / 2) * tile,
      y: -SURFACE.ground - INTRO.hover - DWARF_LOOK.cell / 2,
    };
  }
}
