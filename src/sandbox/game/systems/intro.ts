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
import { BuildElementID, BuildingsID, STRUCTURES } from "../content/structures";
import { SURFACE } from "../content/surface";
import { shaftColumns } from "../world/shaftShape";
import IntroDwarf from "../actors/introDwarf";
import type Shaft from "../actors/shaft";
import ShaftDigging from "../components/shaftDigging";
import IntroUI from "../ui/intro";
import { removeSpeech, speech } from "../ui/elements/speech";
import { showHud } from "../ui/hud";
import Terrain from "./terrain";
import Discovery from "./discovery";
import Stations from "./stations";
import Buildings from "./buildings";
import BuildMode from "./buildMode";
import GameMode from "./gameMode";

// hover: pixels between the ground and the dwarf's bottom; look: the camera's spot over the ground
// and zoom; glide: pixels a second at the start, it brakes to a stop in the middle; lift: screen
// pixels from the dwarf up to its bubble; niche: rows its middle may land on, the tavern must end
// above the first segment's bottom; margin: tiles of extra room around it at most, the outline
// bites in by up to jag of it, bumps: how many times it goes in and out around; descend: the camera's ride down to the dug shaft
const INTRO = {
  hover: 30,
  look: { overGround: 250, zoom: 0.6 },
  glide: { speed: 900 },
  speech: { lift: 70 },
  pause: { beforeLine: 0.4, beforeButton: 1.2 },
  lines: {
    arrive: "Ooh, this is the spot!",
    openBuild: "Open build mode [Tab]",
    placeTavern: "Build a tavern (Buildings → Tavern)",
    closeBuild: "Close build mode [Tab]",
  },
  buttons: { digShaft: "Dig the shaft" },
  niche: { rows: { min: 14, max: 48 }, margin: 4, jag: 0.8, bumps: 1.6 },
  descend: { zoom: 0.2, seconds: 2.5 },
};

export default class Intro extends PragmaSystem {
  private readonly ui = new IntroUI();
  declare private terrain: Terrain;
  declare private discovery: Discovery;
  declare private stations: Stations;
  declare private buildings: Buildings;
  declare private buildMode: BuildMode;
  declare private gameMode: GameMode;

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
    this.gameMode.set("cutscene");
    showHud(false);
  }

  start(): void {
    const intro = this;
    this.startCoroutine(function* (co) {
      yield* intro.play(co);
    });
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
    vcam.moveTo({ x: middle.x, y: -SURFACE.ground - INTRO.look.overGround }, { duration: 0 });
    vcam.zoomTo(INTRO.look.zoom, { duration: 0 });
    yield co.waitFrames(1);

    const fromLeft = AxiomMath.randomBool();
    const view = Camera.getViewBounds;
    const from = { x: fromLeft ? view.min.x - DWARF_LOOK.cell : view.max.x + DWARF_LOOK.cell, y: middle.y };
    const dwarf = new IntroDwarf(from);
    this.scene.spawnActor(dwarf);
    yield* this.glide(dwarf, from, middle);

    yield co.waitSeconds(INTRO.pause.beforeLine);
    const bubble = speech(() => dwarf.transform.getRenderPosition(), INTRO.lines.arrive, INTRO.speech.lift);
    yield co.waitSeconds(INTRO.pause.beforeButton);
    let dug = false;
    this.ui.offer(INTRO.buttons.digShaft, () => (dug = true));
    yield co.waitUntil(() => dug);

    this.ui.hide();
    removeSpeech(bubble);
    this.scene.deleteActor(dwarf);
    yield* this.digShaft(co);

    const target = { x: middle.x, y: ((STRUCTURES.shaft.startDepth + 1) / 2) * this.terrain.tile };
    const descend = INTRO.descend;
    yield co.all([
      vcam.moveTo(target, { duration: descend.seconds, easing: "easeInOutSine" }),
      vcam.zoomTo(descend.zoom, { duration: descend.seconds, easing: "easeInOutSine" }),
    ]);
    // the game's camera waits where the ride ended, the release has nothing to glide back to
    Camera.setPosition(target);
    Camera.setZoom(descend.zoom);
    yield* this.teachBuilding(co, () => {
      vcam.release(0);
      this.ui.closeLetterbox();
    });
  }

  // the player takes over at the first Tab; leaving before the tavern stands asks for Tab again
  private *teachBuilding(co: Coroutine, takeOver: () => void) {
    const lines = INTRO.lines;
    const tavernBuilt = () => this.buildings.placeOf(BuildingsID.tavern) !== undefined;
    this.buildMode.free.add(BuildElementID.tavern);
    const building = () => this.gameMode.is("build");
    let controlled = false;
    while (!tavernBuilt()) {
      this.ui.hint(lines.openBuild);
      this.gameMode.allowInCutscene("toggleBuild");
      yield co.waitUntil(building);
      if (!controlled) takeOver();
      controlled = true;
      this.ui.hint(lines.placeTavern);
      yield co.waitUntil(() => tavernBuilt() || !building());
    }
    this.buildMode.free.delete(BuildElementID.tavern);
    if (building()) {
      this.ui.hint(lines.closeBuild);
      yield co.waitUntil(() => !building());
    }
    this.ui.hide();
    showHud(true);
  }

  private *digShaft(co: Coroutine) {
    this.scene.spawnActor(this.shaft);
    yield co.waitUntil(() => this.shaft.getAlive());
    const digging = this.shaft.getComponent(ShaftDigging);
    assert(digging !== undefined, "The shaft has no ShaftDigging");
    digging.open();
    this.stations.openShaftStation();
    this.buildings.buildMarket();
    this.digNiche();
  }

  // room for the tavern by a random wall of the shaft: the tavern's whole box, with a ragged cave
  // around it; the shaft's own tiles stay
  private digNiche() {
    const world = this.terrain.world;
    const niche = INTRO.niche;
    const columns = shaftColumns(world);
    const wall = AxiomMath.randomBool() ? columns.from - 1 : columns.to + 1;
    const base = this.buildings.placeAt(BuildingsID.tavern, { x: wall, y: AxiomMath.randomInt(niche.rows.min, niche.rows.max) }).base;
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
    const seconds = (Math.abs(to.x - from.x) * 3) / INTRO.glide.speed;
    let elapsed = 0;
    while (elapsed < seconds) {
      elapsed += Time.getDeltaTime();
      const progress = Easing.easeOutCubic(Math.min(elapsed / seconds, 1));
      dwarf.transform.setPosition(AxiomMath.lerp(from.x, to.x, progress), from.y);
      yield;
    }
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
