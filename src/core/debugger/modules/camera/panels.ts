import type { CameraDebugData, CameraDebugInfo, TweakPanel, TweakSection } from "../../interfaces";
import type { TweakField } from "../tweak/report";
import { formatLiteral } from "../command/parse";
import type { FreeCam } from "./freeCam";

export const CAMERA_PAGES = {
  group: "camera",
  order: { cameraState: 1, cameraControl: 2 },
} as const;

const DISPLAY = { decimals: 2 };
const ZOOM_STEP = { button: 0.5, slider: 0.05, range: 4 };

function page(name: keyof typeof CAMERA_PAGES.order) {
  return {
    group: CAMERA_PAGES.group,
    order: CAMERA_PAGES.order[name],
    command: false,
    exportable: false,
    presets: false,
  };
}

// plain rounded data: the tweak poll clones the values, a function or class would not survive it
function display(value: unknown): unknown {
  if (typeof value === "number") {
    const scale = 10 ** DISPLAY.decimals;
    const rounded = Math.round(value * scale) / scale;
    return Object.is(rounded, -0) ? 0 : rounded;
  }
  if (typeof value === "function") {
    try {
      return `fn → ${formatLiteral(display(value()))}`;
    } catch {
      return "fn";
    }
  }
  if (Array.isArray(value)) return value.map(display);
  if (typeof value === "object" && value !== null)
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, display(item)]));
  return value;
}

function infoSections(read: () => CameraDebugInfo, call: string): TweakSection[] {
  return Object.entries(read()).map(([title, values]) => ({
    title,
    call,
    arg: "object",
    fields: Object.keys(values).map((key): TweakField => ({ key, control: { kind: "info" } })),
    get: () => display(read()[title] ?? {}) as Record<string, unknown>,
    set: () => {},
  }));
}

export function statePanel(source: CameraDebugData): TweakPanel {
  return {
    title: "Camera",
    ...page("cameraState"),
    sections: [
      ...infoSections(() => source.state(), "Camera"),
      ...infoSections(() => source.settings(), "Camera"),
    ],
  };
}

export function controlPanel(
  source: CameraDebugData,
  freeCam: FreeCam,
  setHijacked: (on: boolean) => void,
): TweakPanel {
  const effect = { trauma: 0.5, kickStrength: 24, kickAngle: 0, punch: 0.15, tilt: 0.05 };
  // touching a control takes the camera
  const take = () => setHijacked(true);
  const zoomTo = (level: number) => {
    take();
    freeCam.setZoom(level);
  };
  return {
    title: "Free cam",
    ...page("cameraControl"),
    sections: [
      {
        title: "Hijack",
        call: "camera.hijack",
        arg: "object",
        fields: [
          { key: "hijacked", control: { kind: "toggle" } },
          { key: "resync", label: "", control: { kind: "button", text: "back to the game view" } },
          { key: "center", control: { kind: "info" } },
          { key: "zoom", control: { kind: "info" } },
          {
            key: "octaves",
            label: "zoom (octaves)",
            control: {
              kind: "slider",
              min: -ZOOM_STEP.range,
              max: ZOOM_STEP.range,
              step: ZOOM_STEP.slider,
            },
          },
          { key: "zoomOut", label: "", control: { kind: "button", text: "− ½ octave" } },
          { key: "zoomIn", label: "", control: { kind: "button", text: "+ ½ octave" } },
          { key: "zoomOne", label: "", control: { kind: "button", text: "zoom 1" } },
        ],
        get() {
          const { hijacked, view, zoomTarget } = freeCam;
          return display({
            hijacked,
            resync: false,
            center: hijacked ? view.center : "off",
            zoom: hijacked ? view.zoom : "off",
            octaves: Math.log2(zoomTarget),
            zoomOut: false,
            zoomIn: false,
            zoomOne: false,
          }) as Record<string, unknown>;
        },
        set(values) {
          if (values.hijacked !== undefined) setHijacked(values.hijacked as boolean);
          if (values.resync) {
            take();
            freeCam.resync();
          }
          if (values.octaves !== undefined) zoomTo(2 ** (values.octaves as number));
          if (values.zoomOut) zoomTo(freeCam.zoomTarget * 2 ** -ZOOM_STEP.button);
          if (values.zoomIn) zoomTo(freeCam.zoomTarget * 2 ** ZOOM_STEP.button);
          if (values.zoomOne) zoomTo(1);
        },
      },
      {
        title: "Move",
        call: "camera.hijack",
        arg: "object",
        fields: [
          { key: "move", control: { kind: "stick" } },
          { key: "speed", control: { kind: "slider", min: 50, max: 4000, step: 10 } },
          { key: "edgePan", label: "screen edges", control: { kind: "toggle" } },
          { key: "mouse", control: { kind: "info" } },
        ],
        get: () => ({
          move: { x: 0, y: 0 },
          speed: freeCam.speed,
          edgePan: freeCam.edgePan,
          mouse: "wheel = zoom at the cursor\nmiddle drag = pan\nedges = pan",
        }),
        set(values) {
          if (values.move !== undefined) {
            const move = values.move as Position2D;
            if (move.x !== 0 || move.y !== 0) take();
            freeCam.setStick(move);
          }
          if (values.speed !== undefined) freeCam.speed = values.speed as number;
          if (values.edgePan !== undefined) freeCam.edgePan = values.edgePan as boolean;
        },
      },
      {
        title: "Effects",
        call: "Camera",
        arg: "object",
        fields: [
          { key: "trauma", control: { kind: "slider", min: 0, max: 1, step: 0.05 } },
          { key: "shake", label: "", control: { kind: "button", text: "shake" } },
          { key: "kickStrength", label: "kick strength", control: { kind: "slider", min: 0, max: 100, step: 1 } },
          { key: "kickAngle", label: "kick direction", control: { kind: "angle" } },
          { key: "kick", label: "", control: { kind: "button", text: "kick" } },
          { key: "punch", label: "punch (octaves)", control: { kind: "slider", min: -1, max: 1, step: 0.05 } },
          { key: "zoomPunch", label: "", control: { kind: "button", text: "zoom punch" } },
          { key: "tilt", label: "tilt (rad)", control: { kind: "slider", min: -0.3, max: 0.3, step: 0.01 } },
          { key: "tiltNow", label: "", control: { kind: "button", text: "tilt" } },
          { key: "sway", control: { kind: "slider", min: 0, max: 1, step: 0.05 } },
          { key: "game time", control: { kind: "info" } },
        ],
        get: () => ({
          ...effect,
          shake: false,
          kick: false,
          zoomPunch: false,
          tiltNow: false,
          sway: source.sway(),
          "game time": "effects stop while the game is paused",
        }),
        set(values) {
          for (const key of ["trauma", "kickStrength", "kickAngle", "punch", "tilt"] as const)
            if (values[key] !== undefined) effect[key] = values[key] as number;
          if (values.shake) source.shake(effect.trauma);
          if (values.kick)
            source.kick(
              { x: Math.cos(effect.kickAngle), y: Math.sin(effect.kickAngle) },
              effect.kickStrength,
            );
          if (values.zoomPunch) source.zoomPunch(effect.punch);
          if (values.tiltNow) source.tilt(effect.tilt);
          if (values.sway !== undefined) source.setSway(values.sway as number);
        },
      },
    ],
  };
}
