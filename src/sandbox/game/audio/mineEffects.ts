export const MINE_EFFECTS = {
  reverb: {
    duration: 1.4,
    decay: 3.2,
    preDelay: 0.022,
    tailFadeIn: 0.015,
    tailDamping: { start: 0.25, end: 0.85 },
    dry: 0.78,
    wet: 0.42,
    highpassHz: 180,
    lowpassHz: 2400,
    earlyReflections: [
      { time: 0.028, left: 0.55, right: 0.25 },
      { time: 0.047, left: 0.22, right: 0.48 },
      { time: 0.071, left: 0.36, right: 0.18 },
      { time: 0.104, left: 0.16, right: 0.3 },
    ],
  },
  echo: {
    delay: 0.23,
    feedback: 0.22,
    dry: 1,
    wet: 0.18,
    highpassHz: 250,
    lowpassHz: 1500,
  },
  rubble: {
    highpassHz: 140,
    lowshelfHz: 300,
    lowshelfDb: -10,
  },
};

export const CAVE_REVERB_EFFECT = {
  scope: "shared" as const,
  build: (ctx: AudioContext) => {
    const config = MINE_EFFECTS.reverb;
    const input = ctx.createGain();
    const output = ctx.createGain();
    const dryGain = ctx.createGain();
    const wetGain = ctx.createGain();
    const preDelay = ctx.createDelay(0.2);
    const convolver = ctx.createConvolver();
    const highpass = ctx.createBiquadFilter();
    const lowpass = ctx.createBiquadFilter();

    dryGain.gain.value = config.dry;
    wetGain.gain.value = config.wet;
    preDelay.delayTime.value = config.preDelay;

    convolver.buffer = createCaveImpulse(ctx);
    convolver.normalize = true;

    highpass.type = "highpass";
    highpass.frequency.value = config.highpassHz;
    lowpass.type = "lowpass";
    lowpass.frequency.value = config.lowpassHz;

    input.connect(dryGain);
    dryGain.connect(output);

    input.connect(preDelay);
    preDelay.connect(convolver);
    convolver.connect(highpass);
    highpass.connect(lowpass);
    lowpass.connect(wetGain);
    wetGain.connect(output);

    return { input, output };
  },
};

export const MINE_ECHO_EFFECT = {
  scope: "shared" as const,
  build: (ctx: AudioContext) => {
    const config = MINE_EFFECTS.echo;
    const input = ctx.createGain();
    const output = ctx.createGain();
    const dryGain = ctx.createGain();
    const wetGain = ctx.createGain();
    const delay = ctx.createDelay(1);
    const feedback = ctx.createGain();
    const highpass = ctx.createBiquadFilter();
    const lowpass = ctx.createBiquadFilter();

    dryGain.gain.value = config.dry;
    wetGain.gain.value = config.wet;
    delay.delayTime.value = config.delay;
    feedback.gain.value = config.feedback;

    highpass.type = "highpass";
    highpass.frequency.value = config.highpassHz;
    lowpass.type = "lowpass";
    lowpass.frequency.value = config.lowpassHz;

    input.connect(dryGain);
    dryGain.connect(output);

    // filters inside the feedback loop darken each repeat like sound travelling down a tunnel
    input.connect(delay);
    delay.connect(highpass);
    highpass.connect(lowpass);
    lowpass.connect(feedback);
    feedback.connect(delay);
    lowpass.connect(wetGain);
    wetGain.connect(output);

    return { input, output };
  },
};

export const RUBBLE_TONE_EFFECT = {
  scope: "shared" as const,
  build: (ctx: AudioContext) => {
    const config = MINE_EFFECTS.rubble;
    const highpass = ctx.createBiquadFilter();
    const lowshelf = ctx.createBiquadFilter();

    highpass.type = "highpass";
    highpass.frequency.value = config.highpassHz;

    lowshelf.type = "lowshelf";
    lowshelf.frequency.value = config.lowshelfHz;
    lowshelf.gain.value = config.lowshelfDb;

    highpass.connect(lowshelf);
    return { input: highpass, output: lowshelf };
  },
};

function createCaveImpulse(ctx: AudioContext): AudioBuffer {
  const config = MINE_EFFECTS.reverb;
  const sampleRate = ctx.sampleRate;
  const length = Math.floor(sampleRate * config.duration);
  const fadeSamples = Math.max(1, Math.floor(sampleRate * config.tailFadeIn));
  const impulse = ctx.createBuffer(2, length, sampleRate);

  for (let channel = 0; channel < 2; channel++) {
    const data = impulse.getChannelData(channel);
    let smoothed = 0;

    for (let index = 0; index < length; index++) {
      const progress = index / length;
      const envelope = Math.pow(1 - progress, config.decay);
      const fadeIn = index < fadeSamples ? index / fadeSamples : 1;
      const damping =
        config.tailDamping.start +
        (config.tailDamping.end - config.tailDamping.start) * progress;
      const noise = Math.random() * 2 - 1;
      smoothed = smoothed * damping + noise * (1 - damping);
      data[index] = smoothed * envelope * fadeIn;
    }

    for (const reflection of config.earlyReflections) {
      const tapIndex = Math.floor(reflection.time * sampleRate);
      if (tapIndex >= length) continue;
      const gain = channel === 0 ? reflection.left : reflection.right;
      data[tapIndex] += gain;
      if (tapIndex + 1 < length) data[tapIndex + 1] += gain * 0.5;
    }
  }

  return impulse;
}
