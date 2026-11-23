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
import ShaftDigging from "../../components/mine/shaftDigging";
import Tavern from "../../components/buildings/tavern";
import { HEADQUARTERS } from "../../components/buildings/headquarters";
import { DWARF_LOOK } from "../dwarfs";
import { BlocksID } from "../blocks";
import { BUILD_ELEMENTS, BuildCategoryID, BuildElementID } from "../build";
import { BuildingsID, STRUCTURES } from "../structures";
import { SURFACE } from "../surface";
import { formatAmount, ResourcesID, type ResourceCost } from "../resources";
import { MAIN_TRAITS, MainTraitsID } from "../traits";
import { shaftColumns } from "../../world/shaftShape";
import { buildingPlaceAt, buildingSprite, type BuildingPlace } from "../../world/buildingShape";
import { removeSpeech, speech } from "../../ui/elements/speech";
import type { UIWorldAnchor } from "../../ui/elements/world";
import { isAnyWindowOpen, type UIWindow } from "../../ui/elements/window";
import type { StoryLetter, StoryPopup } from "../../ui/story";
import { showHud } from "../../ui/hud";
import type { UIHandle } from "../../ui/effects";
import Buildings from "../../systems/mine/buildings";
import BuildMode from "../../systems/mine/buildMode";
import Discovery from "../../systems/world/discovery";
import GameMode, { VIEW } from "../../systems/core/gameMode";
import GameUI from "../../systems/ui/gameUI";
import PlayerStats from "../../systems/core/playerStats";
import Roster, { type DwarfState } from "../../systems/dwarfs/roster";
import Stations from "../../systems/mine/stations";
import Terrain from "../../systems/world/terrain";
import Vfx from "../../systems/world/vfx";
import type StoryEvents from "../../systems/core/storyEvents";

// hover: pixels between the ground and the dwarf's bottom; look: the camera's spot over the ground
// and zoom; glide: pixels a second at the start, it brakes to a stop in the middle; lift: screen
// pixels from the dwarf up to its bubble; niche: the buildings it's dug for, each on its own wall, rows its middle may land on, the tavern must end
// above the first segment's bottom; margin: tiles of extra room around it at most, the outline
// bites in by up to jag of it, bumps: how many times it goes in and out around; descend: the camera's ride down to the dug shaft;
// held: what the build menu keeps locked through the intro; build: the buildings the player puts up in the intro, in their niches; grant: what
// the signed letter gives
const INTRO = {
  grant: { [ResourcesID.beer]: 400, [ResourcesID.stone]: 50, [ResourcesID.wood]: 50 } as ResourceCost,
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
    pickCategory: "Open Buildings",
    pickTavern: "Pick the tavern",
    closeBuild: "Close build mode [Tab]",
    clickTavern: "Click the tavern",
    hire: "Hire the intern!",
    closeTavern: "Close the tavern",
    clickStation: "Click the station",
    shift: "Set shift length to 4h",
    wage: "Watch how beer cost grows with shift hours!",
    order: "Order your intern to the station",
    ride: "Wait for your dwarf to arrive",
    pressShoot: "Press Shoot",
    aim: "Drag back and let go to shoot",
  },
  popups: {
    applications: {
      title: "Applications",
      lines: [
        "This is your Applications window.",
        "Every day at 12:00 new dwarfs will leave their applications here.",
      ],
    },
    mining: {
      title: "Off to work!",
      lines: [
        "Your dwarfs smash through the rock blocks of the mine as they fly.",
        "Everything they mine is stored in the station they launched from, and transported to your main warehouse every hour.",
      ],
    },
    goodLuck: {
      title: "Good luck!",
      lines: [
        "The mine is yours, comrade. Remember the Party's deadline — good luck!",
      ],
    },
  },
  buttons: { setUpHeadquarters: "Set up headquarters", digShaft: "Dig the shaft", openTavern: "Go to the tavern", toStation: "Go to the station" },
  niche: { buildings: [BuildingsID.tavern, BuildingsID.smelter], rows: { min: 14, max: 48 }, margin: 4, jag: 0.8, bumps: 1.6 },
  descend: { zoom: 0.2, seconds: 2.5 },
  follow: { zoom: 0.55, zoomIn: 0.9, hold: 2.6, zoomOut: 1.4, hudFadeMs: 700 },
  shiftHours: 4,
  held: [BuildElementID.smelter],
  build: [
    {
      building: BuildingsID.tavern,
      category: BuildCategoryID.buildings,
      element: BuildElementID.tavern,
      line: "Place the tavern in the cave by the shaft",
    },
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
  private readonly buildings: Buildings;
  private readonly buildMode: BuildMode;
  private readonly discovery: Discovery;
  private readonly gameMode: GameMode;
  private readonly gameUI: GameUI;
  private readonly playerStats: PlayerStats;
  private readonly roster: Roster;
  private readonly stations: Stations;
  private readonly terrain: Terrain;
  private readonly vfx: Vfx;

  constructor(private readonly story: StoryEvents) {
    const scene = story.scene;
    this.buildings = scene.getSystem(Buildings);
    this.buildMode = scene.getSystem(BuildMode);
    this.discovery = scene.getSystem(Discovery);
    this.gameMode = scene.getSystem(GameMode);
    this.gameUI = scene.getSystem(GameUI);
    this.playerStats = scene.getSystem(PlayerStats);
    this.roster = scene.getSystem(Roster);
    this.stations = scene.getSystem(Stations);
    this.terrain = scene.getSystem(Terrain);
    this.vfx = scene.getSystem(Vfx);
  }

  public *play(co: Coroutine) {
    const ui = this.story.ui;
    co.take(this.story.hold({ stopClock: true, hideHud: true, muteToasts: true, resetSpeed: true }));
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
      this.playerStats.name = signed.value;
    }
    this.grant();
    yield* this.line(co, INTRO.lines.signed, INTRO.pause.hold.signed);
    yield* this.offer(co, INTRO.buttons.setUpHeadquarters);
    yield ui.curtain.darken(INTRO.curtain.close * 1000);
    this.buildings.show(BuildingsID.headquarters, true);
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
    yield* this.watchFirstShot(co);
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

  private *teachBuilding(co: Coroutine) {
    const ui = this.story.ui;
    const lines = INTRO.lines;
    this.gameMode.block([...VIEW, "select"]);
    for (const element of INTRO.held) this.buildMode.held.add(element);
    const building = () => this.gameMode.is("build");
    while (!co.isSkipping && this.missing() !== undefined) {
      ui.hint(lines.openBuild);
      this.gameMode.allowInCutscene("toggleBuild");
      yield co.waitUntil(building, { skippable: true });
      if (co.isSkipping) break;
      this.takeOver();
      while (!co.isSkipping && building()) {
        const step = this.missing();
        if (step === undefined) break;
        if (this.buildMode.category !== step.category) {
          ui.hide();
          const tag = `build:category:${BuildCategoryID[step.category]}`;
          const guide = this.guide(co, tag, lines.pickCategory);
          yield co.waitUntil(() => this.buildMode.category === step.category || this.missing() !== step || !building(), {
            skippable: true,
          });
          guide.release();
        } else if (this.buildMode.selected !== step.element) {
          ui.hide();
          const tag = `build:element:${BuildElementID[step.element]}`;
          const guide = this.guide(co, tag, lines.pickTavern);
          yield co.waitUntil(
            () =>
              this.buildMode.selected === step.element ||
              this.buildMode.category !== step.category ||
              this.missing() !== step ||
              !building(),
            { skippable: true },
          );
          guide.release();
        } else {
          ui.hint(step.line);
          yield co.waitUntil(() => this.missing() !== step || this.buildMode.selected !== step.element || !building(), {
            skippable: true,
          });
        }
      }
    }
    if (!co.isSkipping && building()) {
      ui.hint(lines.closeBuild);
      yield co.waitUntil(() => !building(), { skippable: true });
    }
    if (co.isSkipping) this.buildForPlayer();
  }

  private buildForPlayer() {
    if (this.gameMode.is("build")) this.buildMode.leave();
    for (const step of INTRO.build) {
      if (this.buildings.placeOf(step.building) !== undefined) continue;
      const niche = this.niches.get(step.building);
      assert(niche !== undefined, `The intro dug no niche for the ${BuildingsID[step.building]}`);
      const paid = this.buildings.store.pay(BUILD_ELEMENTS[step.element].cost);
      assert(paid, `The grant can't pay for the ${BuildingsID[step.building]}`);
      this.buildings.build(step.building, niche);
    }
  }

  private *teachTavern(co: Coroutine) {
    const ui = this.story.ui;
    const lines = INTRO.lines;
    yield* this.offerGlide(co, INTRO.buttons.openTavern, this.tavernSpot());
    // a tavern built just now gets its applications in its first start
    const actor = this.buildings.actorOf(BuildingsID.tavern);
    yield co.waitUntil(() => actor === undefined || actor.getAlive());
    const tavern = this.tavern();
    if (co.isSkipping) {
      tavern.hireAll();
      return;
    }
    this.buildings.highlight(BuildingsID.tavern, true);
    this.buildings.clickOnly = BuildingsID.tavern;
    this.gameMode.unblock(["select"]);
    this.gameMode.block(["toggleBuild"]);
    const crew = tavern.startCrew;
    const hired = () => this.roster.dwarfs.length;
    let introduced = false;
    while (!co.isSkipping && hired() < crew) {
      ui.hint(lines.clickTavern);
      yield co.waitUntil(() => tavern.isOpen, { skippable: true });
      if (co.isSkipping) break;
      if (!introduced) {
        ui.hide();
        yield* this.popup(co, INTRO.popups.applications, tavern.uiWindow);
        yield* this.popup(co, this.internPopup, tavern.uiWindow);
        introduced = true;
      }
      if (!co.isSkipping && tavern.isOpen && hired() < crew) {
        ui.hide();
        const guide = this.guide(co, "tavern:hire", lines.hire, { spotlight: true });
        yield co.waitUntil(() => hired() >= crew || !tavern.isOpen, { skippable: true });
        guide.release();
      }
    }
    if (co.isSkipping) {
      tavern.hireAll();
      return;
    }
    this.buildings.highlight(BuildingsID.tavern, false);
    yield* this.hintUntil(co, lines.closeTavern, () => !tavern.isOpen);
  }

  private *teachStation(co: Coroutine) {
    const ui = this.story.ui;
    const lines = INTRO.lines;
    const station = this.stations.stations[0];
    assert(station !== undefined, "The intro has no station at the shaft");
    const launcher = this.stations.launcherOf(station);
    const tile = this.terrain.tile;
    const body = launcher.tiles;
    yield* this.offerGlide(co, INTRO.buttons.toStation, { x: (body.x + body.w / 2) * tile, y: (body.y + body.h / 2) * tile });
    this.buildings.clickOnly = "none";
    this.vfx.spotlight({ x: body.x * tile, y: body.y * tile, w: body.w * tile, h: body.h * tile });
    const anyIs = (state: DwarfState) => this.roster.dwarfs.some((dwarf) => this.roster.stateOf(dwarf) === state);
    const ordered = () => this.roster.dwarfs.some((dwarf) => this.roster.stateOf(dwarf) !== "tavern");
    while (!co.isSkipping && !ordered()) {
      if (!this.stations.isMenuOpen) {
        ui.hint(lines.clickStation);
        yield co.waitUntil(() => this.stations.isMenuOpen, { skippable: true });
        continue;
      }
      ui.hide();
      if (this.stations.selectedHours < INTRO.shiftHours) {
        const shiftGuide = this.guide(co, "station:shiftPlus", lines.shift);
        const wageGuide = this.guide(co, "station:wage", lines.wage, { pulse: false });
        yield co.waitUntil(
          () => this.stations.selectedHours >= INTRO.shiftHours || ordered() || !this.stations.isMenuOpen,
          { skippable: true },
        );
        shiftGuide.release();
        wageGuide.release();
      } else {
        const orderGuide = this.guide(co, "station:order", lines.order);
        yield co.waitUntil(
          () => ordered() || !this.stations.isMenuOpen || this.stations.selectedHours < INTRO.shiftHours,
          { skippable: true },
        );
        orderGuide.release();
      }
    }
    this.vfx.spotlight(undefined);
    yield* this.hintUntil(co, lines.ride, () => launcher.queue.length > 0 || anyIs("working"));
    while (!co.isSkipping && !anyIs("working")) {
      if (this.gameMode.is("shoot")) {
        ui.hint(lines.aim);
        yield co.waitUntil(() => !this.gameMode.is("shoot") || anyIs("working"), { skippable: true });
      } else if (this.stations.isMenuOpen) {
        ui.hide();
        const guide = this.guide(co, "station:shoot", lines.pressShoot);
        yield co.waitUntil(() => !this.stations.isMenuOpen || this.gameMode.is("shoot") || anyIs("working"), {
          skippable: true,
        });
        guide.release();
      } else {
        ui.hint(lines.clickStation);
        yield co.waitUntil(() => this.stations.isMenuOpen || this.gameMode.is("shoot") || anyIs("working"), {
          skippable: true,
        });
      }
    }
    ui.hide();
  }

  private *watchFirstShot(co: Coroutine) {
    if (co.isSkipping) return;
    const dwarf = this.roster.dwarfs.find((item) => this.roster.stateOf(item) === "working");
    if (dwarf === undefined) return;
    const follow = INTRO.follow;
    const vcam = co.take(Camera.claim({ blend: 0.35, release: 0 }));
    const target = () => dwarf.transform.getRenderPosition();
    yield vcam.zoomTo(follow.zoom, { at: target, duration: follow.zoomIn, easing: "easeOutCubic" });
    yield vcam.zoomTo(follow.zoom, { at: target, duration: follow.hold, easing: "linear" });
    yield* this.popup(co, INTRO.popups.mining);
    if (co.isSkipping) return;
    const hudFade = showHud(true, follow.hudFadeMs);
    yield co.all([
      vcam.moveTo(this.descendTarget, { duration: follow.zoomOut, easing: "easeInOutSine" }),
      vcam.zoomTo(INTRO.descend.zoom, { duration: follow.zoomOut, easing: "easeInOutSine" }),
      ...(hudFade ? [hudFade] : []),
    ]);
    this.placeCamera();
    vcam.release(0);
    yield* this.popup(co, INTRO.popups.goodLuck);
  }

  private *popup(co: Coroutine, content: StoryPopup, over?: UIWindow) {
    if (co.isSkipping) return;
    const paused = Time.getPaused();
    const restore = co.take({ release: () => Time.setPaused(paused) });
    Time.setPaused(true);
    yield this.story.ui.popup(content, over);
    restore.release();
  }

  private guide(
    co: Coroutine,
    tag: string,
    message: string,
    options?: { spotlight?: boolean; pulse?: boolean },
  ): UIHandle {
    const handles: UIHandle[] = [
      options?.spotlight ? this.gameUI.spotlight(tag) : this.gameUI.highlight(tag),
      this.gameUI.callout(tag, message),
    ];
    if (options?.pulse ?? true) handles.push(this.gameUI.pulse(tag));
    let active = true;
    return co.take({
      release: () => {
        if (!active) return;
        active = false;
        for (const handle of handles) handle.release();
      },
    });
  }

  private get internPopup(): StoryPopup {
    const intern = MAIN_TRAITS[MainTraitsID.intern];
    return {
      title: `Applicant: ${intern.name}`,
      lines: [
        `Right now you have an application from an ${intern.name}.`,
        intern.description,
        `Speed ${intern.speed} · Power ${intern.power} · Drinks ${intern.bph} beer an hour`,
      ],
    };
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

  private takeOver() {
    if (this.vcam === undefined) return;
    this.vcam.release(0);
    this.vcam = undefined;
    this.story.ui.closeLetterbox();
  }

  // at the end, the stop or the skip; the hold (the clock, the HUD, the game mode) goes back after it
  private finish() {
    if (this.vcam !== undefined) this.placeCamera();
    this.takeOver();
    this.dismissDwarf();
    for (const element of INTRO.held) this.buildMode.held.delete(element);
    this.gameMode.unblock();
    this.buildings.clickOnly = undefined;
    this.vfx.spotlight(undefined);
    this.story.ui.hide();
    this.buildings.actorOf(BuildingsID.tavern)?.getComponent(Tavern)?.addApplication(MainTraitsID.intern);
  }

  private get letter(): StoryLetter {
    const grant = INTRO.grant;
    const beer = grant[ResourcesID.beer] ?? 0;
    const stone = grant[ResourcesID.stone] ?? 0;
    const wood = grant[ResourcesID.wood] ?? 0;
    const subsidy = HEADQUARTERS.subsidy;
    return {
      title: "Directive of the Central Committee",
      lines: [
        "Comrade! By resolution of the Party, you are assigned to these mountains to found a new People's Mine and carry the Plan into the rock.",
        `For the first shift, the People's Treasury allots you ${formatAmount(ResourcesID.beer, beer)} of beer, ${formatAmount(ResourcesID.stone, stone)} of stone and ${formatAmount(ResourcesID.wood, wood)} of wood. Waste is sabotage.`,
        `Until your headquarters is raised to a Regional Headquarters, the Party will deliver ${formatAmount(ResourcesID.beer, subsidy.beer)} of beer every day at noon. The Plan allows you one week. The Plan is not late. Neither are you.`,
        "The Party trusts you, comrade. The Party is also watching. Glory to labour!",
      ],
      name: "Your name, comrade",
      sign: "Sign",
    };
  }

  // a skipped letter is signed for the player
  private grant() {
    if (this.playerStats.name === "") this.playerStats.name = INTRO.unsigned;
    this.buildings.store.addAll(INTRO.grant);
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
    yield* this.glide(co, dwarf, from, to);
  }

  // the game's camera waits where the ride ended, the release has nothing to glide back to
  private placeCamera() {
    Camera.setPosition(this.descendTarget);
    Camera.setZoom(INTRO.descend.zoom);
  }

  private get descendTarget() {
    return { x: this.middle.x, y: ((STRUCTURES.shaft.startDepth + 1) / 2) * this.terrain.tile };
  }

  private *digShaft(co: Coroutine) {
    const story = this.story;
    story.scene.spawnActor(story.shaft);
    yield co.waitUntil(() => story.shaft.getAlive());
    const digging = story.shaft.getComponent(ShaftDigging);
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
    const place = buildingPlaceAt(world, id, { x: wall, y: AxiomMath.randomInt(niche.rows.min, niche.rows.max) });
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
    const columns = shaftColumns(this.terrain.world);
    const tile = this.terrain.tile;
    return {
      x: ((columns.from + columns.to + 1) / 2) * tile,
      y: -SURFACE.ground - INTRO.hover - DWARF_LOOK.cell / 2,
    };
  }
}
