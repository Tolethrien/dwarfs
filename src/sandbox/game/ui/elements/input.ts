import Navi from "@navi/navi";
import UINode from "@navi/node";
import UIInput, { InputProps } from "@navi/elements/input";
import { pw, px } from "@navi/units";
import { COLOR } from "@axiom/color";
import { UI_SHEET, UI_THEME } from "../../content/ui";

export interface InputOptions {
  value?: string;
  placeholder?: string;
  maxLength?: number;
  width?: number;
  paper?: boolean;
  // what's typed stays when the focus goes, not only on Enter (a form with its own button)
  keepOnBlur?: boolean;
  // on Enter, run by UIWindow.update (Navi reads the keys mid-traversal)
  submit?: (value: string) => void;
}

const SUBMITTED: UIField[] = [];

export class UIField extends UIInput {
  private committed: string;

  constructor(
    public readonly submit: ((value: string) => void) | undefined,
    private readonly keepOnBlur: boolean,
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
    if (this.focusLost && !this.keepOnBlur) this.value = this.committed;
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
  const sheet = UI_SHEET.input;
  const isPaper = options.paper ?? true;
  const style = isPaper
    ? {
        backgroundColor: COLOR.WHITE,
        backgroundImage: UI_SHEET.image,
        backgroundImageCrop: sheet.crop,
        backgroundImageSlice: sheet.slice,
        textColor: UI_THEME.paper.inkCream,
        textSize: UI_THEME.text.body,
        padding: UI_THEME.input.padding,
      }
    : {
        backgroundColor: colors.inputBack,
        textColor: colors.text,
        textSize: UI_THEME.text.body,
        rounded: UI_THEME.radius.button,
        padding: UI_THEME.input.padding,
      };
  const node = new UIField(options.submit, options.keepOnBlur ?? false, {
    value: options.value,
    placeholder: options.placeholder,
    maxLength: options.maxLength,
    placeholderColor: colors.placeholder,
    caretColor: colors.caret,
    size: {
      width: options.width === undefined ? pw(100) : px(options.width),
      height: px(UI_THEME.input.height),
    },
    style,
    states: {
      focused: { backgroundColor: isPaper ? UI_THEME.paper.hoverTint : colors.inputFocus },
    },
  });
  Navi.append(node, parent);
  return node;
}
