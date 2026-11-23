import PragmaSystem from "@pragma/system";
import Navi from "@navi/navi";
import GameGlobals, { MAP_LOOK } from "../../game/gpu/gameGlobals";
import { LIGHT_FALLOFF, LIGHTS, LightsID, type LightData } from "../../game/content/lights";
import { STRUCTURES } from "../../game/content/structures";
import { FLICKER } from "../../game/components/common/lamp";
import { DWARF } from "../../game/actors/dwarf";
import { DISCOVERY } from "../../game/systems/world/discovery";
import { DIRECTOR } from "../../game/systems/core/director";
import MapView from "../../game/systems/world/mapView";
import Decos from "../../game/systems/world/decos";
import Discovery from "../../game/systems/world/discovery";
import { choice, control, idsOf, page, ref, tune, tunePage, tuned, values, words, type Ref } from "../pages";
import { BLOCKS, BlocksID, GLOW_STYLES, type BlockData, type GlowStyle } from "../../game/content/blocks";

// a block that starts glowing gets this, white and soft
const GLOW = { color: [255, 255, 255] as RGB, blend: 0.5, shine: 1 };

const STYLE = choice(GLOW_STYLES, (style) => style);

// a block's glow, also of a block without one: switching "glows" on gives it the default
function glowRefs(block: BlockData, path: string): Ref[] {
  const sparkle = () => block.glow?.sparkle ?? MAP_LOOK.glow.sparkle;
  const slot = {
    get glows() {
      return block.glow !== undefined;
    },
    set glows(on: boolean) {
      if (on && !block.glow) block.glow = { ...GLOW, color: [...GLOW.color] };
      if (!on) delete block.glow;
    },
    get color() {
      return [...(block.glow?.color ?? GLOW.color), 255];
    },
    set color(rgba: number[]) {
      if (block.glow) block.glow.color = [rgba[0], rgba[1], rgba[2]];
    },
    get blend() {
      return block.glow?.blend ?? 0;
    },
    set blend(value: number) {
      if (block.glow) block.glow.blend = value;
    },
    get shine() {
      return block.glow?.shine ?? 0;
    },
    set shine(value: number) {
      if (block.glow) block.glow.shine = value;
    },
    get style() {
      return block.glow?.style ?? GLOW_STYLES[0];
    },
    set style(style: GlowStyle) {
      if (block.glow) block.glow.style = style;
    },
    get sparkles() {
      return sparkle().density;
    },
    set sparkles(density: number) {
      if (block.glow) block.glow.sparkle = { ...sparkle(), density: density };
    },
    get sparkleSpeed() {
      return sparkle().speed;
    },
    set sparkleSpeed(speed: number) {
      if (block.glow) block.glow.sparkle = { ...sparkle(), speed: speed };
    },
  };
  const at = (key: string, label: string, hint: string, range?: Ref["range"]): Ref => ({
    owner: slot,
    key,
    path: `${path}.glow.${key}`,
    label,
    hint,
    range,
  });
  return [
    at("glows", "Glows", "Lit through on its own; the rest works once this is on"),
    at("color", "Color", "Color of its glow"),
    at("blend", "Blend", "How much of the block takes the glow's color", [0, 1, 0.01]),
    at("shine", "Shine", "How bright it glows", [0, 6, 0.05]),
    { ...at("style", "Style", "glow: lit through; glint: cold flashes on dark grains; embers: red smoulder in its cracks; sheen: a band of light sliding over the metal"), choice: STYLE },
    at("sparkles", "Sparkles", "Glints on it; without its own, the Map look's", [0, 0.5, 0.005]),
    at("sparkleSpeed", "Sparkle speed", "How fast the glints come and go", [0, 8, 0.05]),
  ];
}

// a lamp's light, also the parts it leaves to the defaults: no own glow is 1, no flicker is still
function lightRefs(light: LightData, path: string): Ref[] {
  const flicker = () => light.flicker ?? { amount: 0, speed: 0 };
  const slot = {
    get falloff() {
      return light.falloff ?? LIGHT_FALLOFF;
    },
    set falloff(value: number) {
      light.falloff = value;
    },
    get glow() {
      return light.glow ?? 1;
    },
    set glow(value: number) {
      light.glow = value;
    },
    get flickerAmount() {
      return flicker().amount;
    },
    set flickerAmount(amount: number) {
      light.flicker = { ...flicker(), amount: amount };
    },
    get flickerSpeed() {
      return flicker().speed;
    },
    set flickerSpeed(speed: number) {
      light.flicker = { ...flicker(), speed: speed };
    },
  };
  return [
    ref(light, "color", path, "Color"),
    ref(light, "radius", path, "Radius (px)", "How far the light reaches"),
    ref(light, "intensity", path, "Intensity", "How bright the light is", [0, 2, 0.01]),
    ref(slot, "falloff", path, "Falloff", `How the light fades toward its edge; default ${LIGHT_FALLOFF}`, [0.1, 8, 0.05]),
    ref(slot, "glow", path, "Lamp glow", "How bright the lamp itself is drawn, unlit; past 1 it blooms", [0, 15, 0.1]),
    ref(slot, "flickerAmount", path, "Flicker amount", "How much the light wavers, 0 = steady", [0, 0.5, 0.01]),
    ref(slot, "flickerSpeed", path, "Flicker speed", "How fast it wavers", [0, 3, 0.05]),
  ];
}

export default class LookDebug extends PragmaSystem {
  declare private mapView: MapView;
  declare private decos: Decos;
  declare private discovery: Discovery;

  awake(): void {
    this.mapView = this.scene.getSystem(MapView);
    this.decos = this.scene.getSystem(Decos);
    this.discovery = this.scene.getSystem(Discovery);
    this.viewPage();
    tunePage(
      "look",
      "fog",
      "Fog of war",
      "How much of the dark mine each thing uncovers around itself, in tiles. A radius counts for things made after the edit: a new dwarf, a new station.",
      () => [
        tuned("Uncovers around", [
          ref(DWARF, "reveal", "DWARF", "A flying dwarf", "Tiles around a dwarf's ball as it flies"),
          ref(STRUCTURES.station, "reveal", "STRUCTURES.station", "A station", "Tiles around a station when it is built"),
          ref(STRUCTURES.shaft.look.lamps, "reveal", "STRUCTURES.shaft.look.lamps", "A shaft lamp", "Tiles around each lamp down the shaft"),
        ]),
        tuned("Edge", [
          ref(DISCOVERY, "edge", "DISCOVERY", "Soft edge", "Share of the radius the uncovered circle fades out over", [0, 1, 0.05]),
          ref(DISCOVERY, "intoRock", "DISCOVERY", "Into rock (tiles)", "How far into solid rock the uncovering reaches, fading"),
        ]),
      ],
    );
    tunePage(
      "look",
      "blockGlow",
      "Block glow",
      "Blocks of the map that light up on their own, like ores. Every block can glow: switch it on, then set its color and shine.",
      () =>
        idsOf<BlocksID>(BLOCKS)
          .filter((id) => BLOCKS[id].sheet !== undefined)
          .map((id) => tuned(words(BlocksID[id]), glowRefs(BLOCKS[id], `BLOCKS[${BlocksID[id]}]`), () => GameGlobals.refreshMaterials())),
    );
    tune("look", "MAP_LOOK", MAP_LOOK, {
      title: "Map look",
      description: "How the map itself is drawn: rock shading, the fog in tunnels, the dust of breaks, the ores' glow and the build plan's blueprint.",
      applies: "the ores' glow at once; the rest of the map's shading with the next map",
      hints: {
        damagedShade: "How dark a damaged block is drawn at its weakest, 1 = not at all",
        lightIntoRock: "Pixels a lamp's light reaches into solid rock",
        "ambient.level": "Light everything has with no lamp near",
        "ao.width": "How far the shadow of the rock wall reaches onto the background, in tiles",
        "ao.strength": "How dark that shadow is",
        "background.shade": "How dark the cave background is next to the rock",
        "mist.around": "Tiles around open space the tunnel mist reaches",
        "mist.full": "Mist thickness in narrow tunnels",
        "mist.least": "Mist thickness in big caves",
        "mist.flow": "Seconds the mist takes to flow into a newly opened space",
        "mist.draft": "Tiles a second the mist drifts toward the shaft and up it",
        "dust.fade": "Seconds for a cloud of dust to thin to about a third",
        "dust.spread": "How fast dust evens out with its open neighbours, a second",
        "glow.sparkle": "Glints on every ore: how many and how fast",
        "glow.breathe": "The ores' glow slowly brightening and dimming",
      },
      onChange: () => GameGlobals.refreshGlowLook(),
    });
    tunePage(
      "look",
      "lights",
      "Lights",
      "Every kind of lamp in the mine. A lamp without its own falloff, glow or flicker uses the default; setting one gives it its own.",
      () =>
        idsOf<LightsID>(LIGHTS).map((id) =>
          tuned(words(LightsID[id]), lightRefs(LIGHTS[id], `LIGHTS[${LightsID[id]}]`), () => this.decos.refreshGlow()),
        ),
    );
    tune("look", "FLICKER", FLICKER, {
      title: "Lamp flicker",
      description: "The shape of every lamp's flicker; each lamp's own amount and speed are on the Lights page.",
      hints: {
        stretch: "Stretches the noise so a lamp swings its full amount; higher is a harsher flicker",
        radius: "Share of the swing that goes to the light's radius instead of its brightness",
      },
    });
    tune("look", "DIRECTOR", DIRECTOR, {
      title: "Camera",
      description: "The game camera's zoom: where it starts, how smoothly it follows the wheel, how far it goes.",
      hints: {
        startZoom: "Zoom of a new game",
        zoomSmoothing: "How fast the zoom catches up with the wheel",
        zoomLimits: "Farthest out and closest in",
      },
    });
  }

  private viewPage() {
    page("look", "view", "View", "What the map draws: switch layers off to look under them.", () => [
      values("Show", "game.view", [
        {
          key: "mist",
          label: "tunnel mist",
          control: control.toggle,
          get: () => this.mapView.mistShown,
          set: (on) => (this.mapView.mistShown = on === true),
        },
        { key: "ao", label: "background AO", control: control.toggle, get: () => this.mapView.aoShown, set: (on) => this.mapView.showAo(on === true) },
        { key: "fog", label: "fog of war", control: control.toggle, get: () => this.discovery.fogShown, set: (on) => this.discovery.showFog(on === true) },
        {
          key: "fullLight",
          label: "full light",
          control: control.toggle,
          get: () => this.discovery.fullLight,
          set: (on) => this.discovery.setFullLight(on === true),
        },
        { key: "hideUi", label: "hide ui", control: control.toggle, get: () => !Navi.root.active, set: (on) => Navi.root.setActive(on !== true) },
      ]),
    ], true);
  }
}
