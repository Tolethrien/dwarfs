import { Camera } from "@engine/camera/camera";
import type { Vcam } from "@engine/camera/vcam";
import type Coroutine from "@engine/coroutines/coroutine";
import Time from "@engine/time";
import AxiomMath from "@axiom/math";
import Easing from "@axiom/easing";
import { assert } from "@axiom/utils";
import IntroDwarf from "../../actors/introDwarf";
import { DWARF_LOOK } from "../dwarfs";
import { BuildingsID } from "../structures";
import { SURFACE } from "../surface";
import { buildingSprite } from "../../world/buildingShape";
import { removeSpeech, speech } from "../../ui/elements/speech";
import type { UIWorldAnchor } from "../../ui/elements/world";
import { closeAllWindows } from "../../ui/elements/window";
import Buildings from "../../systems/mine/buildings";
import Terrain from "../../systems/world/terrain";
import type StoryEvents from "../../systems/core/storyEvents";

const AGH = {
  hover: 30,
  look: { overGround: 250, zoom: 0.6, blend: 0.8, release: 1 },
  glide: { speed: 750 },
  curtain: { close: 0.5, dark: 0.3, open: 0.5 },
  speech: { lift: 70, hqLift: 130, sideShift: 220 },
  pause: {
    beforeLine: 0.35,
    afterEnter: 0.4,
    beforeLeave: 0.4,
    afterBuild: 0.4,
    hold: { ask: 2.2, introduce: 3.6, agree: 2.2, comment: 2.8 },
  },
  lines: {
    ask: "Who are you?",
    introduce: "I'm a scientist sent by the Party to found the AGH here!",
    agree: "Well... alright then.",
    comment: "Should do for a start...",
  },
  introPopup: {
    title: "Someone is approaching!",
    lines: ["Wait... who's coming toward your headquarters on the surface?"],
  },
  popup: {
    title: "AGH unlocked!",
    lines: [
      "The AGH University of Mining has been founded on the surface, right next to your headquarters.",
      "This is where you'll research global upgrades for your mine, transport network and dwarfs.",
    ],
  },
};

export function* playAghOpens(co: Coroutine, story: StoryEvents) {
  yield* new AghEvent(story).play(co);
}

class AghEvent {
  private vcam: Vcam | undefined;
  private dwarf: IntroDwarf | undefined;
  private bubble: UIWorldAnchor | undefined;
  private readonly buildings: Buildings;
  private readonly terrain: Terrain;

  constructor(private readonly story: StoryEvents) {
    const scene = story.scene;
    this.buildings = scene.getSystem(Buildings);
    this.terrain = scene.getSystem(Terrain);
  }

  public *play(co: Coroutine) {
    yield* this.story.popup(co, AGH.introPopup);
    if (co.isSkipping) {
      this.story.buildAgh();
      return;
    }
    const ui = this.story.ui;
    closeAllWindows();
    const hold = co.take(
      this.story.hold({ pause: true, stopClock: true, hideHud: true, muteToasts: true, resetSpeed: true }),
    );
    ui.openLetterbox();
    co.defer(() => this.finish());

    const hqDoor = this.doorOf(BuildingsID.headquarters);
    const look = AGH.look;
    const vcam = Camera.claim({ blend: look.blend, release: look.release });
    this.vcam = vcam;
    vcam.moveTo({ x: hqDoor.x, y: -SURFACE.ground - look.overGround }, { duration: 0 });
    vcam.zoomTo(look.zoom, { duration: 0 });
    yield vcam.blendedIn;

    yield* this.arriveAtHq(co, hqDoor);
    yield* this.talkInHq(co, hqDoor);
    yield* this.foundAgh(co, vcam, hqDoor);

    if (!co.isSkipping) {
      vcam.release(look.release);
      this.vcam = undefined;
      ui.closeLetterbox();
      yield co.waitSeconds(look.release);
    }
    hold.release();

    if (!co.isSkipping) yield* this.story.popup(co, AGH.popup);
  }

  private *arriveAtHq(co: Coroutine, hqDoor: Position2D) {
    if (co.isSkipping) return;
    const view = Camera.getViewBounds;
    const y = this.groundY;
    const from = { x: view.min.x - DWARF_LOOK.cell, y: y };
    const to = { x: hqDoor.x, y: y };
    const dwarf = this.spawnScientist(from);
    yield* this.glide(co, dwarf, from, to);
    dwarf.setVisibility(false);
    yield co.waitSeconds(AGH.pause.afterEnter);
  }

  private *talkInHq(co: Coroutine, hqDoor: Position2D) {
    if (co.isSkipping) return;
    const y = -SURFACE.ground - AGH.look.overGround;
    const playerSpot = { x: hqDoor.x - AGH.speech.sideShift, y: y };
    const scientistSpot = { x: hqDoor.x + AGH.speech.sideShift, y: y };
    yield* this.sayAt(co, playerSpot, AGH.lines.ask, AGH.pause.hold.ask);
    yield* this.sayAt(co, scientistSpot, AGH.lines.introduce, AGH.pause.hold.introduce);
    yield* this.sayAt(co, playerSpot, AGH.lines.agree, AGH.pause.hold.agree);
    yield co.waitSeconds(AGH.pause.beforeLeave);
  }

  private *foundAgh(co: Coroutine, vcam: Vcam, hqDoor: Position2D) {
    const aghPlace = this.buildings.aghPlace();
    const tile = this.terrain.tile;
    const spotX = (aghPlace.base.x + aghPlace.base.w / 2) * tile;
    const y = this.groundY;
    const from = { x: hqDoor.x, y: y };
    const to = { x: spotX, y: y };

    if (!co.isSkipping) {
      const dwarf = this.dwarf ?? this.spawnScientist(from);
      dwarf.transform.teleport(from.x, from.y);
      dwarf.setVisibility(true);
      const seconds = this.glideSeconds(from, to);
      vcam.moveTo({ x: spotX, y: -SURFACE.ground - AGH.look.overGround }, { duration: seconds, easing: "easeOutCubic" });
      yield* this.glide(co, dwarf, from, to);
    }

    const curtain = this.story.ui.curtain;
    if (!co.isSkipping) {
      yield curtain.darken(AGH.curtain.close * 1000);
      yield co.waitSeconds(AGH.curtain.dark / 2);
    }
    this.story.buildAgh();
    if (!co.isSkipping) {
      yield co.waitSeconds(AGH.curtain.dark / 2);
      yield curtain.brighten(AGH.curtain.open * 1000);
      yield co.waitSeconds(AGH.pause.afterBuild);
      yield* this.sayOnDwarf(co, AGH.lines.comment, AGH.pause.hold.comment);
    }

    if (!co.isSkipping && this.dwarf !== undefined) {
      const aghDoor = this.doorOf(BuildingsID.agh);
      const at = this.dwarf.transform.getPosition();
      yield* this.glide(co, this.dwarf, { x: at.x, y: at.y }, { x: aghDoor.x, y: y });
    }
    this.dismissDwarf();
  }

  private finish() {
    this.story.buildAgh();
    this.dismissDwarf();
    this.hush();
    if (this.vcam !== undefined) {
      this.vcam.release(0);
      this.vcam = undefined;
    }
    this.story.ui.closeLetterbox();
  }

  private spawnScientist(position: Position2D) {
    this.dismissDwarf();
    const dwarf = new IntroDwarf(position);
    this.dwarf = dwarf;
    this.story.scene.spawnActor(dwarf);
    return dwarf;
  }

  private dismissDwarf() {
    this.hush();
    if (this.dwarf !== undefined) this.story.scene.deleteActor(this.dwarf);
    this.dwarf = undefined;
  }

  private *sayAt(co: Coroutine, point: Position2D, line: string, hold: number) {
    if (co.isSkipping) return;
    yield co.waitSeconds(AGH.pause.beforeLine);
    if (co.isSkipping) return;
    this.hush();
    this.bubble = speech(() => point, line, AGH.speech.hqLift);
    yield co.waitSeconds(hold);
    this.hush();
  }

  private *sayOnDwarf(co: Coroutine, line: string, hold: number) {
    const dwarf = this.dwarf;
    if (co.isSkipping || dwarf === undefined) return;
    yield co.waitSeconds(AGH.pause.beforeLine);
    if (co.isSkipping) return;
    this.hush();
    this.bubble = speech(() => dwarf.transform.getRenderPosition(), line, AGH.speech.lift);
    yield co.waitSeconds(hold);
    this.hush();
  }

  private hush() {
    if (this.bubble !== undefined) removeSpeech(this.bubble);
    this.bubble = undefined;
  }

  private *glide(co: Coroutine, dwarf: IntroDwarf, from: Position2D, to: Position2D) {
    const seconds = this.glideSeconds(from, to);
    let elapsed = 0;
    while (!co.isSkipping && elapsed < seconds) {
      elapsed += Time.getRawDeltaTime();
      const progress = Easing.easeOutCubic(Math.min(elapsed / seconds, 1));
      dwarf.transform.teleport(AxiomMath.lerp(from.x, to.x, progress), from.y);
      yield;
    }
    if (!co.isSkipping) dwarf.transform.teleport(to.x, from.y);
  }

  private glideSeconds(from: Position2D, to: Position2D) {
    return Math.max((Math.abs(to.x - from.x) * 2.5) / AGH.glide.speed, 0.3);
  }

  private doorOf(id: BuildingsID) {
    const place = this.buildings.placeOf(id);
    assert(place !== undefined, `No ${BuildingsID[id]} built for the AGH event`);
    const door = buildingSprite(id, place, this.terrain.tile).door;
    assert(door !== undefined, `The ${BuildingsID[id]} has no door in its sprite`);
    return door;
  }

  private get groundY() {
    return -SURFACE.ground - AGH.hover - DWARF_LOOK.cell / 2;
  }
}
