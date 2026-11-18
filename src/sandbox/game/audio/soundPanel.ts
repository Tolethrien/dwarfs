import Cello from "@cello/cello";
import { gamePanel } from "../debugCommands";

export function soundPanel() {
  const categories = [...Cello.getCategoryNames()];
  gamePanel("sound", {
    title: "Sound",
    sections: [
      {
        title: "Volume",
        call: "Cello.setCategoryVolume",
        arg: "object",
        fields: categories.map((name) => ({ key: name, control: { kind: "slider" as const, min: 0, max: 1, step: 0.01 } })),
        get: () => Object.fromEntries(categories.map((name) => [name, Cello.getCategoryVolumeValue(name) ?? 0])),
        set: (values) => {
          for (const name of categories) {
            const volume = values[name];
            if (typeof volume === "number") Cello.setCategoryVolume(name, volume);
          }
        },
      },
    ],
  });
}
