import auroraConfig from "@/core/aurora/renderer/config";
import Renderer from "@/core/aurora/renderer/renderer";
import Engine from "@/core/engine/engine";
import Pragma from "@/core/pragma/pragma";
import chars from "@sandbox/assets/chars.png";
import stones from "@sandbox/assets/stones.png";
import blockDamage from "@sandbox/assets/blockDamage.mp3";
import blockDestroy from "@sandbox/assets/blockDestroy.mp3";
import mineAmbient from "@sandbox/assets/mineAmbient1.mp3";
import bg from "@sandbox/assets/bg.png";
import anims from "@sandbox/assets/anims.png";
import icons from "@sandbox/assets/icons.png";
import MapObject from "./managers/mapObject";
import CameraObject from "./managers/cameraObject";
import { registerInputsBindings } from "./inputActions";
import Cello from "@/core/cello/cello";
import SoundBank, { SoundsID } from "./managers/soundbank";
import Player from "./bActors/player";
import WorldPhysics from "./bActors/worldPhysics";
import MineMap from "./bActors/mineMap";
import Chest from "./bActors/chest";

async function preload() {
  const aurora = auroraConfig({
    userTextures: [
      { name: "chars", url: chars },
      { name: "stones", url: stones },
      { name: "bg", url: bg },
      { name: "anims", url: anims },
      { name: "icons", url: icons },
    ],
    userFonts: [],
    feature: {
      bloom: false,
      lighting: false,
    },
    debugger: "none",
    camera: { builtInCameraInputs: false, speed: 0 },
    rendering: {
      sortOrder: "y+x+z",
      renderRes: "1920x1080", // must be in fullHD
      toneMapping: "none",
      drawOrigin: "center", // don't work - must be like this
      canvasColor: [0, 0, 0, 255],
    },
  });
  await Renderer.initialize(aurora);
  await MapObject.loadMap("test.dwb");

  await Cello.initialize({
    preloadSounds: [
      { name: "blockDamage", url: blockDamage },
      { name: "blockDestroy", url: blockDestroy },
      { name: "mineAmbient", url: mineAmbient },
    ],
    masterVolume: 1,
    categoryTree: SoundBank.categoryTree,
  });
}
function setup() {
  registerInputsBindings();
  Cello.registerEffect("zoomVolume", {
    scope: "shared",
    build: (ctx) => {
      const input = Cello.createNode("gain");
      input.gain.value = 1;
      return { input, output: input };
    },
  });
  Cello.registerEffect("distanceVolumeEffect", {
    scope: "perInstance",
    build: (ctx, runtimeArgs) => {
      const gain = ctx.createGain();
      const args = runtimeArgs as { position: Position2D } | undefined;

      if (args?.position) {
        const CLOSE_DISTANCE = 500; // od tego dystansu (i bliżej) — pełna głośność
        const FAR_DISTANCE = 3000; // od tego dystansu (i dalej) — cisza

        const cameraPos = CameraObject.getPosition;
        const dx = args.position.x - cameraPos.x;
        const dy = args.position.y - cameraPos.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        const raw =
          1 - (distance - CLOSE_DISTANCE) / (FAR_DISTANCE - CLOSE_DISTANCE);
        gain.gain.value = Math.min(1, Math.max(0, raw));
      } else {
        gain.gain.value = 1; // brak pozycji = brak przyciszania
      }

      return { input: gain, output: gain };
    },
  });
  Cello.registerEffect("caveReverbEffect", {
    scope: "shared",
    build: (ctx) => {
      const convolver = ctx.createConvolver();
      convolver.buffer = generateImpulseResponse(ctx, 1.2, 3);
      convolver.normalize = true;

      const dryGain = ctx.createGain();
      const wetGain = ctx.createGain();
      dryGain.gain.value = 0.6; // ile oryginalnego dźwięku
      wetGain.gain.value = 0.4; // ile pogłosu

      const inputGain = ctx.createGain(); // wspólny punkt wejścia, rozdziela sygnał na dwie ścieżki
      inputGain.connect(dryGain);
      inputGain.connect(convolver);
      convolver.connect(wetGain);

      const outputGain = ctx.createGain(); // wspólny punkt wyjścia, miksuje dry+wet z powrotem
      dryGain.connect(outputGain);
      wetGain.connect(outputGain);

      return { input: inputGain, output: outputGain };
    },
  });
  Cello.registerEffect("echoEffect", {
    scope: "shared",
    build: (ctx) => {
      const delay = ctx.createDelay(1); // max 1s opóźnienia między powtórzeniami
      const feedbackGain = ctx.createGain();
      const wetGain = ctx.createGain();
      const dryGain = ctx.createGain();

      delay.delayTime.value = 0.3; // odstęp między kolejnymi powtórzeniami
      feedbackGain.gain.value = 0.35; // im wyżej, tym dłużej echo "żyje" zanim zgaśnie
      wetGain.gain.value = 0.5; // ile echa dokładamy
      dryGain.gain.value = 0.8; // ile oryginalnego dźwięku

      delay.connect(feedbackGain);
      feedbackGain.connect(delay); // pętla sprzężenia zwrotnego — to daje wielokrotne, gasnące powtórzenia
      delay.connect(wetGain);

      const inputGain = ctx.createGain();
      inputGain.connect(dryGain);
      inputGain.connect(delay);

      const outputGain = ctx.createGain();
      dryGain.connect(outputGain);
      wetGain.connect(outputGain);

      return { input: inputGain, output: outputGain };
    },
  });

  // Renderer.setGlobalIllumination([25, 25, 80]);
  const world = Pragma.addScene("testSetup");
  world.spawnActor(new WorldPhysics());
  world.spawnActor(new MineMap());
  world.spawnActor(new Player());
  CameraObject.setZoom(0.05);
  CameraObject.setPosition(9216, 1500);
  // const ambientController = SoundBank.loopSound(SoundsID.ambientOne);
  // ambientController?.fadeOutAndStop(15);
}
Engine.initialize({ setup, preload });
function generateImpulseResponse(
  ctx: AudioContext,
  duration = 1.2,
  decay = 3,
): AudioBuffer {
  const rate = ctx.sampleRate;
  const length = rate * duration;
  const impulse = ctx.createBuffer(2, length, rate);
  for (let channel = 0; channel < 2; channel++) {
    const data = impulse.getChannelData(channel);
    for (let i = 0; i < length; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, decay);
    }
  }
  return impulse;
}
