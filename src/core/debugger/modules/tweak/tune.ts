import type { TuneOptions, TweakFieldsSection, TweakPanel } from "../../interfaces";
import type { TweakControl, TweakField } from "./report";

const TUNE = {
  // content tables nest a few levels (BLOCKS → block → glow → sparkle), deeper is game state, not tuning
  maxDepth: 6,
  colorKey: /colou?r|tint|paper|line|dark|light|hatch|token|unknown/i,
  // a number field steps by about a tenth of its starting value, never finer than this
  minStep: 0.001,
  // an object of this many plain values or fewer ({ min, max }, { x, y }) joins its parent's section
  inlineFields: 4,
};

type Owner = Record<string, unknown>;

interface Ref {
  field: TweakField;
  owner: Owner;
  key: string;
  // for the export line
  path: string;
}

function isColor(key: string, value: unknown) {
  return (
    TUNE.colorKey.test(key) &&
    Array.isArray(value) &&
    (value.length === 3 || value.length === 4) &&
    value.every((channel) => Number.isInteger(channel) && channel >= 0 && channel <= 255)
  );
}

function isObject(value: unknown): value is Owner {
  return (
    typeof value === "object" &&
    value !== null &&
    !(value instanceof Map) &&
    !(value instanceof Set) &&
    !ArrayBuffer.isView(value)
  );
}

function isPlain(value: unknown) {
  return typeof value === "boolean" || (typeof value === "number" && Number.isFinite(value));
}

function isSmall(key: string, value: unknown): value is Owner {
  if (!isObject(value) || isColor(key, value)) return false;
  const values = Object.values(value);
  return values.length > 0 && values.length <= TUNE.inlineFields && values.every(isPlain);
}

// "fullPull" → "full pull"
function words(key: string) {
  if (/^\d+$/.test(key)) return String(Number(key) + 1);
  return key.replace(/([a-z0-9])([A-Z])/g, "$1 $2").toLowerCase();
}

// a pair of numbers is a range: [2, 15] reads as "from" and "to"
function innerLabel(owner: Owner, key: string) {
  if (Array.isArray(owner) && owner.length === 2) return key === "0" ? "from" : "to";
  return words(key);
}

function step(value: number) {
  if (Number.isInteger(value)) return 1;
  return Math.max(TUNE.minStep, 10 ** Math.floor(Math.log10(Math.abs(value) || 1) - 1));
}

class TuneBuilder {
  public readonly sections: TweakFieldsSection[] = [];
  private readonly seen = new WeakSet<object>();

  constructor(
    private readonly name: string,
    private readonly options: TuneOptions,
  ) {}

  // the path key first, then the bare key
  private option<Value>(table: Record<string, Value> | undefined, pattern: string, key: string) {
    return table?.[pattern] ?? table?.[key];
  }

  private skipped(pattern: string, key: string) {
    return this.options.skip?.includes(pattern) || this.options.skip?.includes(key);
  }

  private control(key: string, pattern: string, value: unknown): TweakControl | null {
    if (typeof value === "boolean") return { kind: "toggle" };
    if (isColor(key, value)) return { kind: "color" };
    if (typeof value !== "number" || !Number.isFinite(value)) return null;
    const range = this.option(this.options.ranges, pattern, key);
    if (range) return { kind: "slider", min: range[0], max: range[1], step: range[2] };
    return { kind: "number", step: step(value) };
  }

  private ref(owner: Owner, key: string, pattern: string, path: string, label: string): Ref | null {
    if (this.skipped(pattern, key)) return null;
    const control = this.control(key, pattern, owner[key]);
    if (!control) return null;
    return {
      field: {
        key: path,
        label: this.option(this.options.labels, pattern, key) ?? label,
        hint: this.option(this.options.hints, pattern, key),
        control,
      },
      owner,
      key,
      path: `${this.name}${path}`,
    };
  }

  private title(parent: string, value: Owner, key: string, ownerKey: string) {
    const named = this.options.nameOf?.(value, key) ?? value.name ?? value.title;
    if (typeof named === "string") return `${parent} · ${named}`;
    return /^\d+$/.test(key) ? `${parent} · ${words(ownerKey)} ${words(key)}` : `${parent} · ${words(key)}`;
  }

  public collect(owner: Owner, path: string, pattern: string, title: string, ownerKey: string, depth: number) {
    if (this.seen.has(owner) || depth > TUNE.maxDepth) return;
    this.seen.add(owner);
    const refs: Ref[] = [];
    const children: [string, Owner][] = [];
    for (const [key, value] of Object.entries(owner)) {
      const segment = Array.isArray(owner) ? `[${key}]` : `.${key}`;
      const childPattern = `${pattern}${Array.isArray(owner) ? "*" : key}`;
      if (this.skipped(childPattern, key)) continue;
      if (isSmall(key, value)) {
        for (const inner of Object.keys(value)) {
          const innerSegment = Array.isArray(value) ? `[${inner}]` : `.${inner}`;
          const innerPattern = `${childPattern}.${Array.isArray(value) ? "*" : inner}`;
          const ref = this.ref(value, inner, innerPattern, `${path}${segment}${innerSegment}`, `${words(key)} ${innerLabel(value, inner)}`);
          if (ref) refs.push(ref);
        }
        continue;
      }
      const ref = this.ref(owner, key, childPattern, `${path}${segment}`, words(key));
      if (ref) refs.push(ref);
      else if (isObject(value) && !isColor(key, value)) children.push([key, value]);
    }
    if (refs.length > 0) this.sections.push(this.section(title, refs));
    for (const [key, child] of children) {
      const segment = Array.isArray(owner) ? `[${key}]` : `.${key}`;
      const childPattern = `${pattern}${Array.isArray(owner) ? "*" : key}.`;
      this.collect(child, `${path}${segment}`, childPattern, this.title(title, child, key, ownerKey), key, depth + 1);
    }
  }

  private section(title: string, refs: Ref[]): TweakFieldsSection {
    const read = (ref: Ref) => {
      const value = ref.owner[ref.key];
      // the profiler's color is RGBA, a stored RGB gets its alpha only on the way out
      if (Array.isArray(value)) return value.length === 3 ? [...value, 255] : [...value];
      return value;
    };
    const pick = () => Object.fromEntries(refs.map((ref) => [ref.field.key, read(ref)]));
    return {
      title,
      call: this.name,
      arg: "object",
      fields: refs.map((ref) => ref.field),
      defaults: structuredClone(pick()),
      get: pick,
      set: (values) => {
        for (const ref of refs) if (ref.field.key in values) write(ref, values[ref.field.key]);
        this.options.onChange?.();
      },
      format: (values) =>
        refs
          .filter((ref) => ref.field.key in values)
          .map((ref) => `${ref.path} = ${JSON.stringify(values[ref.field.key])}`)
          .join("\n"),
    };
  }
}

function write(ref: Ref, value: unknown) {
  const current = ref.owner[ref.key];
  if (Array.isArray(current)) {
    if (!Array.isArray(value)) return;
    for (let channel = 0; channel < current.length; channel++) current[channel] = value[channel];
    return;
  }
  if (typeof value === typeof current) ref.owner[ref.key] = value;
}

export function tunePanel(name: string, target: object, options: TuneOptions): TweakPanel {
  const builder = new TuneBuilder(name, options);
  builder.collect(target as Owner, "", "", options.title, name, 0);
  const applies = options.applies ? ` Applies: ${options.applies}.` : "";
  return {
    title: options.title,
    description: `${options.description}${applies}`,
    category: options.category,
    order: options.order,
    command: false,
    sections: builder.sections,
  };
}
