import type UINode from "@navi/node";
import { UI_THEME } from "../../content/ui";
import { button } from "./button";
import { row } from "./row";
import { paragraph } from "./paragraph";
import { UIWindow } from "./window";

export interface ConfirmOptions {
  title?: string;
  yes?: string;
  no?: string;
  onNo?: () => void;
  required?: boolean;
  details?: (content: UINode) => void;
}

// a modal child of the window it's asked from: that window's update runs it; without an owner
// (asked from the map) the caller runs its update
export function confirm(
  owner: UIWindow | undefined,
  question: string,
  onYes: () => void,
  options: ConfirmOptions = {},
) {
  let answered = false;
  const dialog = new UIWindow({
    kind: "modal",
    width: UI_THEME.confirm.width,
    title: options.title ?? "Are you sure?",
    dim: true,
    blur: true,
    required: options.required,
    owner: owner,
    onClose: () => {
      if (!answered) options.onNo?.();
    },
  });
  const content = dialog.open();
  paragraph(content, question);
  options.details?.(content);
  const answers = row(content);
  button(
    answers,
    options.yes ?? "Yes",
    () => {
      answered = true;
      dialog.close();
      onYes();
    },
    { selected: true },
  );
  button(answers, options.no ?? "No", () => dialog.close());
  return dialog;
}
