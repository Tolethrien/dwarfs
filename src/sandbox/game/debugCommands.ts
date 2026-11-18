import { debug } from "@debug";

type TweakPanel = Parameters<typeof debug.tweak.register>[1];
type GamePanel = Pick<TweakPanel, "title" | "sections" | "live">;

// every game command under one root, game.<group>.<command>, so the profiler's list stays short;
// editable, since a call through a key needs it
const GAME: Record<string, object> = {};
let exposed = false;
const GAME_PANELS = { group: "game", prefix: "game." };
let pages = 0;

export function gameCommands(group: string, commands: object) {
  if (!exposed) {
    debug.command.expose("game", () => GAME, {
      editable: true,
      hint: "game.dwarf, game.buff, game.workforce, game.time, game.res, game.station, game.rail, game.building, game.delivery",
    });
    exposed = true;
  }
  GAME[group] = commands;
}

export function gamePanel(name: string, panel: GamePanel, order = pages++) {
  debug.tweak.register(GAME_PANELS.prefix + name, {
    ...panel,
    group: GAME_PANELS.group,
    order: order,
    command: false,
    exportable: false,
    presets: false,
  });
}

interface GameSwitch {
  key: string;
  label: string;
  read: () => boolean;
  write: (on: boolean) => void;
}

const VIEW = { name: "view", title: "View", switches: [] as GameSwitch[], order: -1 };

export function gameSwitch(key: string, label: string, read: () => boolean, write: (on: boolean) => void) {
  VIEW.switches.push({ key: key, label: label, read: read, write: write });
  if (VIEW.order === -1) VIEW.order = pages++;
  gamePanel(
    VIEW.name,
    {
      title: VIEW.title,
      sections: [
        {
          title: VIEW.title,
          call: GAME_PANELS.prefix + VIEW.name,
          arg: "object",
          fields: VIEW.switches.map((entry) => ({ key: entry.key, label: entry.label, control: { kind: "toggle" } })),
          get: () => Object.fromEntries(VIEW.switches.map((entry) => [entry.key, entry.read()])),
          set: (values) => {
            for (const entry of VIEW.switches)
              if (typeof values[entry.key] === "boolean") entry.write(values[entry.key] === true);
          },
        },
      ],
    },
    VIEW.order,
  );
}
