import Navi from "@navi/navi";
import UINode from "@navi/node";
import UIInput, { InputProps } from "@navi/elements/input";
import { pw, px } from "@navi/units";
import { UI_THEME } from "../../content/ui";

export interface InputOptions {
  value?: string;
  placeholder?: string;
  maxLength?: number;
  width?: number;
  // on Enter, run by UIWindow.update (Navi reads the keys mid-traversal)
  submit?: (value: string) => void;
}

const SUBMITTED: UIField[] = [];

export class UIField extends UIInput {
  private committed: string;

  constructor(
    public readonly submit: ((value: string) => void) | undefined,
    props: InputProps,
  ) {
    super(props);
    this.committed = this.value;
    this.onSubmit = () => {
      this.committed = this.value;
      SUBMITTED.push(this);
    };
  }

  // focusLost is set when the focus went away last frame, Enter commits before that
  public contentChanged() {
    if (this.focusLost) this.value = this.committed;
    return super.contentChanged();
  }
}

export function takeSubmitted(within: UINode) {
  const taken = SUBMITTED.filter((field) => field.isDescendantOf(within));
  const kept = SUBMITTED.filter(
    (field) => !taken.includes(field) && field.isDescendantOf(Navi.root),
  );
  SUBMITTED.length = 0;
  SUBMITTED.push(...kept);
  return taken;
}

export function input(parent: UINode, options: InputOptions = {}) {
  const colors = UI_THEME.colors;
  const node = new UIField(options.submit, {
    value: options.value,
    placeholder: options.placeholder,
    maxLength: options.maxLength,
    placeholderColor: colors.placeholder,
    caretColor: colors.caret,
    size: {
      width: options.width === undefined ? pw(100) : px(options.width),
      height: px(UI_THEME.input.height),
    },
    style: {
      backgroundColor: colors.inputBack,
      textColor: colors.text,
      textSize: UI_THEME.text.body,
      rounded: UI_THEME.radius.button,
      padding: UI_THEME.input.padding,
    },
    states: { focused: { backgroundColor: colors.inputFocus } },
  });
  Navi.append(node, parent);
  return node;
}
