import { Camera } from "@engine/camera/camera";
import type { Vcam } from "@engine/camera/vcam";
import type Coroutine from "@engine/coroutines/coroutine";
import Time from "@engine/time";
import AxiomMath from "@axiom/math";
import Easing from "@axiom/easing";
import Grid from "@axiom/grid";
import Noise from "@axiom/noise";
import { assert } from "@axiom/utils";
import IntroDwarf from "../../actors/introDwarf";
import ShaftDigging from "../../components/shaftDigging";
import Tavern from "../../components/tavern";
import { HEADQUARTERS } from "../../components/headquarters";
import { DWARF_LOOK } from "../dwarfs";
import { BlocksID } from "../blocks";
import { BUILD_ELEMENTS, BuildElementID, BuildingsID, STRUCTURES } from "../structures";
import { SURFACE } from "../surface";
import { formatAmount, ResourcesID, type ResourceCost } from "../resources";
import { shaftColumns } from "../../world/shaftShape";
import { buildingSprite } from "../../world/buildingShape";
import { removeSpeech, speech } from "../../ui/elements/speech";
import type { UIWorldAnchor } from "../../ui/elements/world";
import { isAnyWindowOpen } from "../../ui/elements/window";
import type { StoryLetter } from "../../ui/story";
import type { BuildingPlace } from "../../systems/buildings";
import type { DwarfState } from "../../systems/roster";
import { VIEW } from "../../systems/gameMode";
import type StoryEvents from "../../systems/storyEvents";

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
  niche: { buildings: [BuildingsID.tavern, BuildingsID.smelter], rows: { min: 14, max: 48 }, margin: 4, jag: 0.8, bumps: 1.6 },
  descend: { zoom: 0.2, seconds: 2.5 },
  held: [BuildElementID.smelter],
  build: [
    { building: BuildingsID.tavern, element: BuildElementID.tavern, line: "Build a tavern (Buildings → Tavern)" },
  ],
};

type IntroBuild = (typeof INTRO.build)[number];

export function* playIntro(co: Coroutine, story: StoryEvents) {
  yield* new Intro(story).play(co);
}

// skipped, it runs to its end at once: what waits for the player is done for the player, the
// buildings stand in their niches and the first crew is hired; the clock starts at the end
class Intro {
  private vcam: Vcam | undefined;
  private dwarf: IntroDwarf | undefined;
  private bubble: UIWorldAnchor | undefined;
  private readonly niches = new Map<BuildingsID, BuildingPlace>();

  constructor(private readonly story: StoryEvents) {}

  public *play(co: Coroutine) {
    const ui = this.story.ui;
    co.take(this.story.hold({ stopClock: true, hideHud: true }));
    ui.openLetterbox();
    co.defer(() => this.finish());
    const middle = this.middle;
    const vcam = Camera.claim({ blend: 0 });
    this.vcam = vcam;
    vcam.moveTo({ x: middle.x, y: -SURFACE.ground - INTRO.look.overGround }, { duration: 0 });
    vcam.zoomTo(INTRO.look.zoom, { duration: 0 });
    yield co.waitFrames(1);
    yield ui.curtain.brighten(INTRO.curtain.dawn * 1000);

    yield* this.arrive(co);
    if (!co.isSkipping) {
      const signed = ui.showLetter(this.letter);
      yield signed;
      this.story.playerStats.name = signed.value;
    }
    this.grant();
    yield* this.line(co, INTRO.lines.signed, INTRO.pause.hold.signed);
    yield* this.offer(co, INTRO.buttons.setUpHeadquarters);
    yield ui.curtain.darken(INTRO.curtain.close * 1000);
    this.story.buildings.show(BuildingsID.headquarters, true);
    yield ui.curtain.brighten(INTRO.curtain.open * 1000);
    yield* this.enterHeadquarters(co, vcam);
    this.dismissDwarf();
    yield* this.offer(co, INTRO.buttons.digShaft);

    yield* this.digShaft(co);
    const descend = INTRO.descend;
    if (!co.isSkipping)
      yield co.all([
        vcam.moveTo(this.descendTarget, { duration: descend.seconds, easing: "easeInOutSine" }),
        vcam.zoomTo(descend.zoom, { duration: descend.seconds, easing: "easeInOutSine" }),
      ]);
    this.placeCamera();
    yield* this.teachBuilding(co);
    yield* this.teachTavern(co);
    yield* this.teachStation(co);
  }

  private *arrive(co: Coroutine) {
    if (co.isSkipping) return;
    const middle = this.middle;
    const fromLeft = AxiomMath.randomBool();
    const view = Camera.getViewBounds;
    const from = { x: fromLeft ? view.min.x - DWARF_LOOK.cell : view.max.x + DWARF_LOOK.cell, y: middle.y };
    const dwarf = new IntroDwarf(from);
    this.dwarf = dwarf;
    this.story.scene.spawnActor(dwarf);
    yield* this.glide(co, dwarf, from, middle);
    yield co.waitSeconds(INTRO.pause.beforeLine);
    if (!co.isSkipping) this.say(INTRO.lines.arrive);
    yield co.waitSeconds(INTRO.pause.hold.arrive);
    if (!co.isSkipping) this.say(INTRO.lines.letter);
    yield co.waitSeconds(INTRO.pause.hold.letter);
    this.hush();
    yield co.waitSeconds(INTRO.pause.beforeLine);
  }

  private *line(co: Coroutine, line: string, hold: number) {
    if (co.isSkipping) return;
    yield co.waitSeconds(INTRO.pause.beforeLine);
    if (co.isSkipping) return;
    this.say(line);
    yield co.waitSeconds(hold);
    this.hush();
  }

  private *offer(co: Coroutine, label: string) {
    if (!co.isSkipping) yield co.waitSeconds(INTRO.pause.beforeButton);
    if (!co.isSkipping) yield this.story.ui.offer(label);
    this.story.ui.hide();
  }

  // the player takes over at the first Tab; leaving before everything stands asks for Tab again. The
  // camera already shows both niches, so it stays put, and no building opens its window yet
  private *teachBuilding(co: Coroutine) {
    const story = this.story;
    const lines = INTRO.lines;
    story.gameMode.block([...VIEW, "select"]);
    for (const element of INTRO.held) story.buildMode.held.add(element);
    const building = () => story.gameMode.is("build");
    while (!co.isSkipping && this.missing() !== undefined) {
      story.ui.hint(lines.openBuild);
      story.gameMode.allowInCutscene("toggleBuild");
      yield co.waitUntil(building, { skippable: true });
      if (co.isSkipping) break;
      this.takeOver();
      while (!co.isSkipping && building()) {
        const step = this.missing();
        if (step === undefined) break;
        story.ui.hint(step.line);
        yield co.waitUntil(() => this.missing() !== step || !building(), { skippable: true });
      }
    }
    if (!co.isSkipping && building()) {
      story.ui.hint(lines.closeBuild);
      yield co.waitUntil(() => !building(), { skippable: true });
    }
    if (co.isSkipping) this.buildForPlayer();
  }

  private buildForPlayer() {
    const story = this.story;
    if (story.gameMode.is("build")) story.buildMode.leave();
    for (const step of INTRO.build) {
      if (story.buildings.placeOf(step.building) !== undefined) continue;
      const niche = this.niches.get(step.building);
      assert(niche !== undefined, `The intro dug no niche for the ${BuildingsID[step.building]}`);
      const paid = story.buildings.store.pay(BUILD_ELEMENTS[step.element].cost);
      assert(paid, `The grant can't pay for the ${BuildingsID[step.building]}`);
      story.buildings.build(step.building, niche);
    }
  }

  // the camera glides to the tavern, which breathes light and alone takes clicks until the first
  // crew is hired; closing it early asks for the click again
  private *teachTavern(co: Coroutine) {
    const story = this.story;
    const lines = INTRO.lines;
    yield* this.offerGlide(co, INTRO.buttons.openTavern, this.tavernSpot());
    // a tavern built just now gets its applications in its first start
    const actor = story.buildings.actorOf(BuildingsID.tavern);
    yield co.waitUntil(() => actor === undefined || actor.getAlive());
    const tavern = this.tavern();
    if (co.isSkipping) {
      tavern.hireAll();
      return;
    }
    story.buildings.highlight(BuildingsID.tavern, true);
    story.buildings.clickOnly = BuildingsID.tavern;
    story.gameMode.unblock(["select"]);
    story.gameMode.block(["toggleBuild", "toggleDig"]);
    const crew = tavern.startCrew;
    const hired = () => story.roster.dwarfs.length;
    while (!co.isSkipping && hired() < crew) {
      story.ui.hint(lines.clickTavern);
      yield co.waitUntil(() => tavern.isOpen, { skippable: true });
      while (!co.isSkipping && tavern.isOpen && hired() < crew) {
        const count = hired();
        story.ui.hint(lines.hire(count, crew), "top");
        yield co.waitUntil(() => hired() !== count || !tavern.isOpen, { skippable: true });
      }
    }
    if (co.isSkipping) {
      tavern.hireAll();
      return;
    }
    story.buildings.highlight(BuildingsID.tavern, false);
    yield* this.hintUntil(co, lines.closeTavern, () => !tavern.isOpen);
  }

  // the first dwarf rides from the tavern to the shaft's station and is shot into the rock; the
  // intro ends with that shot
  private *teachStation(co: Coroutine) {
    const story = this.story;
    const lines = INTRO.lines;
    const station = story.stations.stations[0];
    assert(station !== undefined, "The intro has no station at the shaft");
    const launcher = story.stations.launcherOf(station);
    const tile = story.terrain.tile;
    const body = launcher.tiles;
    yield* this.offerGlide(co, INTRO.buttons.toStation, { x: (body.x + body.w / 2) * tile, y: (body.y + body.h / 2) * tile });
    story.buildings.clickOnly = "none";
    story.mapView.spotlight({ x: body.x * tile, y: body.y * tile, w: body.w * tile, h: body.h * tile });
    const anyIs = (state: DwarfState) => story.roster.dwarfs.some((dwarf) => story.roster.stateOf(dwarf) === state);
    const ordered = () => story.roster.dwarfs.some((dwarf) => story.roster.stateOf(dwarf) !== "tavern");
    while (!co.isSkipping && !ordered()) {
      story.ui.hint(lines.clickStation);
      yield co.waitUntil(() => story.stations.isMenuOpen, { skippable: true });
      story.ui.hint(lines.order, "top");
      yield co.waitUntil(() => ordered() || !story.stations.isMenuOpen, { skippable: true });
    }
    story.mapView.spotlight(undefined);
    yield* this.hintUntil(co, lines.ride, () => launcher.queue.length > 0 || anyIs("working"));
    yield* this.hintUntil(co, lines.shoot, () => anyIs("working"));
  }

  // over an open window the hint moves to the top, so it never covers it
  private *hintUntil(co: Coroutine, line: string, done: () => boolean) {
    while (!co.isSkipping && !done()) {
      const open = isAnyWindowOpen();
      this.story.ui.hint(line, open ? "top" : "bottom");
      yield co.waitUntil(() => done() || isAnyWindowOpen() !== open, { skippable: true });
    }
  }

  private *offerGlide(co: Coroutine, label: string, spot: Position2D) {
    if (co.isSkipping) return;
    yield this.story.ui.offer(label);
    this.story.ui.hide();
    yield* this.story.glideCamera(co, spot);
  }

  private tavernSpot() {
    const place = this.story.buildings.placeOf(BuildingsID.tavern);
    assert(place !== undefined, "The intro has no tavern to look at");
    const tile = this.story.terrain.tile;
    return { x: (place.base.x + place.base.w / 2) * tile, y: (place.base.y + place.base.h / 2) * tile };
  }

  private tavern() {
    const actor = this.story.buildings.actorOf(BuildingsID.tavern);
    assert(actor !== undefined, "The intro has no tavern");
    const tavern = actor.getComponent(Tavern);
    assert(tavern !== undefined, "The tavern has no Tavern");
    return tavern;
  }

  private missing(): IntroBuild | undefined {
    return INTRO.build.find((step) => this.story.buildings.placeOf(step.building) === undefined);
  }

  private takeOver() {
    if (this.vcam === undefined) return;
    this.vcam.release(0);
    this.vcam = undefined;
    this.story.ui.closeLetterbox();
  }

  // at the end, the stop or the skip; the hold (the clock, the HUD, the game mode) goes back after it
  private finish() {
    const story = this.story;
    if (this.vcam !== undefined) this.placeCamera();
    this.takeOver();
    this.dismissDwarf();
    for (const element of INTRO.held) story.buildMode.held.delete(element);
    story.gameMode.unblock();
    story.buildings.clickOnly = undefined;
    story.mapView.spotlight(undefined);
    story.ui.hide();
  }

  private get letter(): StoryLetter {
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

  // a skipped letter is signed for the player
  private grant() {
    const stats = this.story.playerStats;
    if (stats.name === "") stats.name = INTRO.unsigned;
    this.story.buildings.store.addAll(INTRO.grant);
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
    if (this.dwarf !== undefined) this.story.scene.deleteActor(this.dwarf);
    this.dwarf = undefined;
  }

  // the dwarf glides along the ground to the headquarters' door and goes in; the camera rides with
  // it, the dwarf keeps its spot on the screen
  private *enterHeadquarters(co: Coroutine, vcam: Vcam) {
    const dwarf = this.dwarf;
    if (co.isSkipping || dwarf === undefined) return;
    const place = this.story.buildings.placeOf(BuildingsID.headquarters);
    assert(place !== undefined, "No headquarters to go in");
    const door = buildingSprite(BuildingsID.headquarters, place, this.story.terrain.tile).door;
    assert(door !== undefined, "The headquarters has no door in its sprite");
    const at = dwarf.transform.getPosition();
    const from = { x: at.x, y: at.y };
    const to = { x: door.x, y: from.y };
    const center = vcam.view.center;
    const zoom = vcam.view.zoom;
    const offset = { x: (center.x - from.x) * zoom, y: (center.y - from.y) * zoom };
    vcam.zoomTo(zoom, { at: () => dwarf.transform.getRenderPosition(), offset: offset, duration: this.glideSeconds(from, to) });
    yield* this.glide(co, dwarf, from, to);
  }

  // the game's camera waits where the ride ended, the release has nothing to glide back to
  private placeCamera() {
    Camera.setPosition(this.descendTarget);
    Camera.setZoom(INTRO.descend.zoom);
  }

  private get descendTarget() {
    return { x: this.middle.x, y: ((STRUCTURES.shaft.startDepth + 1) / 2) * this.story.terrain.tile };
  }

  private *digShaft(co: Coroutine) {
    const story = this.story;
    story.scene.spawnActor(story.shaft);
    yield co.waitUntil(() => story.shaft.getAlive());
    const digging = story.shaft.getComponent(ShaftDigging);
    assert(digging !== undefined, "The shaft has no ShaftDigging");
    digging.open();
    story.stations.openShaftStation();
    const columns = shaftColumns(story.terrain.world);
    const walls = [columns.from - 1, columns.to + 1];
    if (AxiomMath.randomBool()) walls.reverse();
    INTRO.niche.buildings.forEach((id, index) => this.digNiche(id, walls[index]));
  }

  // room for a building by the given wall of the shaft: the building's whole box, with a ragged cave
  // around it; the shaft's own tiles stay
  private digNiche(id: BuildingsID, wall: number) {
    const story = this.story;
    const world = story.terrain.world;
    const niche = INTRO.niche;
    const place = story.buildings.placeAt(id, { x: wall, y: AxiomMath.randomInt(niche.rows.min, niche.rows.max) });
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
    for (const tile of tiles) story.terrain.place(tile.x, tile.y, BlocksID.air);
    story.discovery.revealTiles(tiles);
  }

  // the pace of an ease-out matching the glide's speed at its start, so it brakes into the stop
  private *glide(co: Coroutine, dwarf: IntroDwarf, from: Position2D, to: Position2D) {
    const seconds = this.glideSeconds(from, to);
    let elapsed = 0;
    while (!co.isSkipping && elapsed < seconds) {
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
    const columns = shaftColumns(this.story.terrain.world);
    const tile = this.story.terrain.tile;
    return {
      x: ((columns.from + columns.to + 1) / 2) * tile,
      y: -SURFACE.ground - INTRO.hover - DWARF_LOOK.cell / 2,
    };
  }
}
