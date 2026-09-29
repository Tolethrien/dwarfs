import Cello from "@cello/cello";
import { Camera } from "@engine/camera/camera";

export function registerSoundEffects() {
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

        const cameraPos = Camera.getCenter;
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
}
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
