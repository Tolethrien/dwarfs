import PragmaSystem from "@pragma/system";
import Cello from "@cello/cello";
import { SPARKS } from "../../game/vfx/sparks";
import { DEBRIS } from "../../game/vfx/debris";
import { SPOTLIGHT } from "../../game/vfx/spotlight";
import { SOUNDS } from "../../game/systems/world/sounds";
import { SPATIAL } from "../../game/audio/spatial";
import { control, page, tune, values } from "../pages";

const VFX = {
  volume: { max: 1, step: 0.01 },
  // particle pools and culling: sizes of buffers, nothing to tune by eye
  pools: ["capacity", "viewMargin"],
};

export default class VfxDebug extends PragmaSystem {
  awake(): void {
    page("vfx", "sound", "Volume", "Volume of each sound category.", () => [
      values(
        "Volume",
        "Cello.setCategoryVolume",
        [...Cello.getCategoryNames()].map((name) => ({
          key: name,
          control: control.slider(0, VFX.volume.max, VFX.volume.step),
          get: () => Cello.getCategoryVolumeValue(name) ?? 0,
          set: (volume) => Cello.setCategoryVolume(name, Number(volume)),
        })),
      ),
    ]);
    tune("vfx", "SOUNDS", SOUNDS, {
      title: "Mine sounds",
      description: "The sounds of a ball hitting and breaking blocks and the mine's ambience; volumes 0–1.",
      hints: {
        zoom: "Volume by camera zoom: full when close, quiet when far, never under floor",
        rate: "Playback speed range, a faster ball plays faster",
        pitch: "Random pitch spread of each hit",
        deflected: "Volume of a hit that does nothing to the block",
        wound: "Volume of a hit that hurts the block, from a weak to a strong one",
        concurrent: "Most of these sounds playing at once",
        gap: "Least seconds between two of them",
        pause: "Seconds of silence between ambience loops",
      },
    });
    tune("vfx", "SPATIAL", SPATIAL, {
      title: "Spatial sound",
      description: "How a sound fades and pans with its distance from the camera's middle, in pixels.",
      hints: {
        near: "Full volume closer than this",
        far: "Silent past this",
        pan: "How far to the left or right ear a sound at the screen's edge goes, 1 = all the way",
      },
    });
    tune("vfx", "SPARKS", SPARKS, {
      title: "Sparks",
      description:
        "Sparks of a hit that didn't break its block. They fly out of the block's face, streak, cool from hot to cool and go out; a weak hit makes fewer.",
      skip: VFX.pools,
      hints: {
        deflected: "Strength of a hit that does nothing to the block, 0–1",
        wound: "Strength of a hit that hurts the block, by how much of it it took",
        mined: "Strength of the hit that breaks the block",
        count: "Sparks of the weakest and the strongest hit",
        speed: "Pixels a second, from to",
        spread: "How wide around the face's direction they fly",
        life: "Seconds a spark lives",
        streak: "Seconds of flight a spark trails behind it",
        width: "Thickness at its head and its tail",
        flash: "The short light of a hit",
      },
    });
    tune("vfx", "DEBRIS", DEBRIS, {
      title: "Debris",
      description:
        "Pieces of a broken block. A barely broken block crumbles out of its face; one broken with force throws pieces along the ball's flight.",
      skip: VFX.pools,
      hints: {
        fullForce: "Damage of this many times the block's strength counts as a full-force break",
        count: "Pieces of a weak and of a full-force break",
        spread: "How wide pieces fly out of the face and along the flight",
        bounce: "Speed kept on hitting rock, 0–1",
        friction: "Speed kept sliding along rock, 0–1",
        settleSpeed: "Slower than this a piece stops",
        restSeconds: "Seconds a stopped piece stays",
        hitbox: "Part of a piece's size it collides with",
      },
    });
    tune("vfx", "SPOTLIGHT", SPOTLIGHT, {
      title: "Spotlight",
      description:
        "The story's spotlight: the screen dims and blurs everywhere but around a point. Intensity is the vignette's reach: higher is a smaller clear window.",
      hints: {
        seconds: "Seconds to fade in and out",
        home: "Where the clear window sits when it points at nothing (0–1 of the screen)",
        breath: "The window slowly growing and shrinking",
      },
    });
  }
}
