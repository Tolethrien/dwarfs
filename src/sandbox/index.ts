import Aurora from "@aurora/core";
import URP from "@aurora/urp/urp";
import { COLOR } from "@axiom/color";
import Engine from "@engine/engine";
import chars from "@sandbox/assets/chars.png";
import stones from "@sandbox/assets/stones.png";
import blockDamage from "@sandbox/assets/blockDamage.mp3";
import blockDestroy from "@sandbox/assets/blockDestroy.mp3";
import mineAmbient from "@sandbox/assets/mineAmbient1.mp3";
import mineAmbientNew from "@sandbox/assets/mine_ambient_new.mp3";
import bg from "@sandbox/assets/bg.png";
import anims from "@sandbox/assets/anims.png";
import decos from "@sandbox/assets/deco.png";
import icons from "@sandbox/assets/icons.png";
import lato from "@sandbox/assets/fonts/Lato-Regular.ttf";
import TileMask from "./shaders/tileMask";
import Minimap from "./shaders/minimap";
import Materials from "./shaders/materials";
import { registerInputsBindings } from "./inputActions";
import Cello from "@cello/cello";
import { SOUND_CATEGORIES } from "./content/sounds";
import { registerSoundEffects } from "./audio/soundEffects";
import SaveGame from "./world/saveGame";
import MenuScene from "./scenes/menuScene";
import { debug } from "@debug";
import { Light, Post } from "@/core/aurora/urp/draw/draw";

const MAP_SEED = 1778679494;

async function preload() {
  await Aurora.config({
    userTextures: [
      { name: "chars", albedo: chars },
      { name: "stones", albedo: stones },
      { name: "bg", albedo: bg },
      { name: "anims", albedo: anims },
      { name: "decos", albedo: decos },
    ],
    userUI: [{ name: "icons", url: icons }],
    fonts: [{ name: "lato", type: "dynamic", url: lato }],
    rendering: {
      renderRes: "1080p",
      canvasColor: COLOR.BLACK,
    },
    camera: { viewHeight: 1080 },
  });
  await URP.init({
    sortMode: "layer",
    toneMapping: { mode: "none" },
    bloom: { enabled: true },
    lighting: { enabled: true },
    pixelSnap: "world",
  });
  TileMask.register();
  Minimap.register();
  Materials.register();

  await Cello.initialize({
    preloadSounds: [
      { name: "blockDamage", url: blockDamage },
      { name: "blockDestroy", url: blockDestroy },
      { name: "mineAmbient", url: mineAmbient },
      { name: "mineAmbientNew", url: mineAmbientNew },
    ],
    masterVolume: 1,
    categoryTree: SOUND_CATEGORIES,
  });
}
function setup() {
  registerInputsBindings();
  registerSoundEffects();
  SaveGame.registerCommands();
  // the mine's ambient: cool at the top of the screen, darker and violet toward the bottom
  Light.setAmbient({
    enabled: true,
    from: [200, 205, 230, 255],
    to: [150, 140, 180, 255],
    angle: Math.PI / 2,
    intensity: 0.35,
  });
  recordingLook();
  // the mapGen panel's Generate goes straight into the new map, a normal start opens the menu
  if (debug.mapGen.requested())
    void SaveGame.newGame({ seed: debug.mapGen.seed(MAP_SEED) });
  else MenuScene.open();
}
// temporary, for recording with a still camera; tuned live in the profiler (Aurora: Mood, Effects).
// Fog and dust are in the "world" stage, so the lights light them: the beams show in the air
function recordingLook() {
  Post.setEffects("world", [
    {
      effect: Materials.fog,
      params: Materials.fog.pack(),
      color: [170, 170, 180, 255],
    },
    {
      effect: Materials.motes,
      params: Materials.motes.pack(),
      color: [255, 255, 255, 255],
    },
  ]);
  // highlights roll off instead of clipping: beams and embers turn warm white, not flat blobs
  Post.setToneMapping("agx");
  Post.setBloom({
    enabled: true,
    threshold: 0.8,
    knee: 0.5,
    scatter: 0.7,
    passes: 8,
  });
  Post.setDiffusion({
    amount: 0.1,
    radius: 5,
    haze: 0.03,
    hazeColor: [255, 255, 255, 255],
  });
  Post.setVignette({
    intensity: 0.25,
    smoothness: 0.5,
    roundness: 1,
    center: { x: 0.5, y: 0.5 },
    color: [0, 0, 0, 255],
    blend: "multiply",
  });
  // tilt-shift: the edges go soft, the mine reads like a miniature
  Post.setBlur({
    sigma: 1.2,
    amount: 0.6,
    mask: "vignette",
    reach: 0.8,
    smoothness: 0.8,
    roundness: 0.3,
    center: { x: 0.5, y: 0.5 },
  });
  Post.setGrain({ intensity: 0.07, response: 0.8, size: 1.5 });
  applyLook("hdr");
  debug.command.expose(
    "look",
    () => ({ hdr: () => applyLook("hdr"), sdr: () => applyLook("sdr") }),
    {
      hint: "look.hdr() | look.sdr(): the recording look for an hdr or an sdr screen",
    },
  );
}

// what differs between screens. An sdr screen has no headroom over white: warm highlights clip into
// orange where hdr lets them bloom out toward white. So sdr takes the punch and warmth out of them:
// the neutral agx look (punchy adds saturation), less saturation, a touch cooler, a softer bloom
// (its warm halo stacks on the orange), a bit less gamma (it washes the darks out on sdr)
type LookName = "hdr" | "sdr";
const LOOKS: Record<
  LookName,
  {
    gamma: number;
    exposure: number;
    agxLook: "none" | "punchy" | "golden";
    color: { contrast: number; saturation: number; temperature: number };
    bloom: number;
  }
> = {
  hdr: {
    gamma: 1.5,
    exposure: 1.2,
    agxLook: "punchy",
    color: { contrast: 1, saturation: 0.9, temperature: 0 },
    bloom: 0.6,
  },
  sdr: {
    gamma: 1.5,
    exposure: 1.25,
    agxLook: "none",
    color: { contrast: 1.05, saturation: 0.82, temperature: -0.05 },
    bloom: 0.5,
  },
};

function applyLook(name: LookName) {
  const look = LOOKS[name];
  Aurora.setParameter({ rendering: { gamma: look.gamma } });
  Post.setExposure(look.exposure);
  Post.setAgxLook(look.agxLook);
  Post.setColor(look.color);
  Post.setBloom({ intensity: look.bloom });
}

Engine.initialize({ setup, preload });
