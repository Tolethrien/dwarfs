import Material from "@aurora/material";
import tileBurnShader from "./tileBurn.wgsl?raw";
import particlesShader from "./particles.wgsl?raw";

interface ParticleStyle {
  count: number;
  spread: number;
  speed: [number, number];
  gravity: number;
  lifeMin: number;
  grain: number;
  sizeSteps: number;
  // linear rgb: glowing from A (fresh) to B (dying), solid one of the two per particle
  colors: [RGB, RGB];
  brightness: number;
  // share that ignores the light map (materialGlow)
  selfLit: number;
  glows: boolean;
}
type RGB = [number, number, number];

const PARTICLES = {
  // a pick on stone: a few white sparks, over 1 for the bloom
  sparks: {
    count: 7,
    spread: 0.9,
    speed: [220, 520],
    gravity: 900,
    lifeMin: 0.4,
    grain: 3,
    sizeSteps: 1,
    colors: [[1, 0.95, 0.8], [1, 0.6, 0.25]],
    brightness: 5,
    selfLit: 1,
    glows: true,
  },
  // stone bits knocked off, partly lit by themselves: in the dark mine they would vanish
  chips: {
    count: 16,
    spread: 1.1,
    speed: [120, 340],
    gravity: 1000,
    lifeMin: 0.6,
    grain: 3,
    sizeSteps: 3,
    colors: [[0.4, 0.3, 0.2], [0.19, 0.14, 0.1]],
    brightness: 1,
    selfLit: 0.6,
    glows: false,
  },
  // a hit too weak to do anything: a puff of pale dust, slow and nearly floating, no stone bits
  dust: {
    count: 9,
    spread: 1.3,
    speed: [40, 130],
    gravity: 120,
    lifeMin: 0.6,
    grain: 3,
    sizeSteps: 2,
    colors: [[0.36, 0.34, 0.31], [0.2, 0.19, 0.18]],
    brightness: 1,
    selfLit: 0.5,
    glows: false,
  },
  // what is left of a mined tile besides its shards
  rubble: {
    count: 24,
    spread: 1.4,
    speed: [100, 320],
    gravity: 1100,
    lifeMin: 0.5,
    grain: 3,
    sizeSteps: 3,
    colors: [[0.4, 0.3, 0.2], [0.19, 0.14, 0.1]],
    brightness: 1,
    selfLit: 0.6,
    glows: false,
  },
} satisfies Record<string, ParticleStyle>;

// materials of the game, created once at start (before the render graph is built)
export default class Materials {
  declare public static tileBurn: Material;
  declare public static sparks: Material;
  declare public static chips: Material;
  declare public static rubble: Material;
  declare public static dust: Material;

  public static register() {
    this.tileBurn = Material.create({
      name: "tileBurn",
      fragment: tileBurnShader,
      gui: false,
      params: { deathTime: -1000, duration: 1, startX: 0.5, startY: 0.5 },
    });
    this.sparks = Material.create({
      name: "sparks",
      fragment: particleShader(PARTICLES.sparks),
      blend: "additive",
      emissive: true,
      gui: false,
      params: { bornAt: -1000, duration: 1, seed: 0, angle: -Math.PI / 2 },
    });
    this.chips = Material.create({
      name: "chips",
      fragment: particleShader(PARTICLES.chips),
      transparent: true,
      gui: false,
      params: { bornAt: -1000, duration: 1, seed: 0, angle: -Math.PI / 2 },
    });
    this.rubble = Material.create({
      name: "rubble",
      fragment: particleShader(PARTICLES.rubble),
      transparent: true,
      gui: false,
      params: { bornAt: -1000, duration: 1, seed: 0, angle: -Math.PI / 2 },
    });
    this.dust = Material.create({
      name: "dust",
      fragment: particleShader(PARTICLES.dust),
      transparent: true,
      gui: false,
      params: { bornAt: -1000, duration: 1, seed: 0, angle: -Math.PI / 2 },
    });
  }
}

function particleShader(style: ParticleStyle) {
  const float = (value: number) => value.toFixed(4);
  const vec3 = (color: RGB) => `vec3f(${color.map(float).join(", ")})`;
  const constants = [
    `const PARTICLE_COUNT: i32 = ${style.count};`,
    `const PARTICLE_SPREAD: f32 = ${float(style.spread)};`,
    `const PARTICLE_SPEED_MIN: f32 = ${float(style.speed[0])};`,
    `const PARTICLE_SPEED_MAX: f32 = ${float(style.speed[1])};`,
    `const PARTICLE_GRAVITY: f32 = ${float(style.gravity)};`,
    `const PARTICLE_LIFE_MIN: f32 = ${float(style.lifeMin)};`,
    `const PARTICLE_GRAIN: f32 = ${float(style.grain)};`,
    `const PARTICLE_SIZE_STEPS: f32 = ${float(style.sizeSteps)};`,
    `const PARTICLE_COLOR_A: vec3f = ${vec3(style.colors[0])};`,
    `const PARTICLE_COLOR_B: vec3f = ${vec3(style.colors[1])};`,
    `const PARTICLE_BRIGHTNESS: f32 = ${float(style.brightness)};`,
    `const PARTICLE_SELF_LIT: f32 = ${float(style.selfLit)};`,
    `const PARTICLE_GLOWS: bool = ${style.glows};`,
  ].join("\n");
  return particlesShader.replace("// PARTICLE_STYLE", constants);
}
