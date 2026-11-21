import PragmaSystem from "@pragma/system";
import Navi from "@navi/navi";
import UINode from "@navi/node";
import { Tweens, type Tween } from "@navi/tween";
import { auto } from "@navi/units";
import type { CoroutineWait } from "@engine/coroutines/coroutine";
import InputManager from "@engine/inputManager";
import { assert } from "@axiom/utils";
import type Condition from "../../conditions/condition";
import type { ActionName } from "../../content/actions";
import { UI_THEME } from "../../content/ui";
import { hudSlot } from "../../ui/hud";
import { badge } from "../../ui/elements/badge";
import { button, runClicked, UIButton } from "../../ui/elements/button";
import { panelStyle } from "../../ui/elements/panel";
import type { TextContent } from "../../ui/elements/text";
import { UIWindow, type WindowSlot } from "../../ui/elements/window";
import {
  createHighlight,
  hideNode,
  moveNode,
  showNode,
  UICallout,
  UISpotlight,
  waitTweens,
  type MoveOptions,
  type UIHandle,
  type UITransition,
} from "../../ui/effects";
import Conditions from "../core/conditions";
import GameMode from "../core/gameMode";
import { registerPanels } from "../../ui/panels/register";

const GAME_UI = {
  bottomWindowOffset: 54,
  pulse: { amount: 0.06, ms: 900 },
};

export type PanelBar = "top" | "bottomRight";

export interface PanelDef {
  id: string;
  title: string;
  label: string;
  bar: PanelBar;
  width: number;
  slot?: WindowSlot;
  action?: ActionName;
  requires?: Condition;
  badge?: () => number;
  build(content: UINode, window: UIWindow): void;
  update?(): void;
  onOpen?(): void;
  onClose?(): void;
}

interface RegisteredPanel {
  def: PanelDef;
  window: UIWindow;
  button: UIButton;
}

interface PulseTarget {
  tag: string;
  tweens: Map<UINode, Tween>;
}

interface HighlightTarget {
  tag: string;
  color: RGBA | undefined;
  frames: Map<UINode, UINode>;
}

interface HiddenTarget {
  tag: string;
  previous: Map<UINode, boolean>;
}

export default class GameUI extends PragmaSystem {
  private readonly panels = new Map<string, RegisteredPanel>();
  private readonly pulses = new Set<PulseTarget>();
  private readonly highlights = new Set<HighlightTarget>();
  private readonly hidden = new Set<HiddenTarget>();
  private readonly spotlights = new Set<UISpotlight>();
  private readonly callouts = new Set<UICallout>();
  private readonly stoppers: (() => void)[] = [];
  declare private conditions: Conditions;
  declare private gameMode: GameMode;
  declare private topBar: UINode;
  declare private bottomBar: UINode;

  awake(): void {
    this.conditions = this.scene.getSystem(Conditions);
    this.gameMode = this.scene.getSystem(GameMode);
    this.topBar = this.createBar(hudSlot("topRightBar"));
    this.bottomBar = this.createBar(hudSlot("bottomRight"));
    this.topBar.tags.add("hud:topBar");
    this.bottomBar.tags.add("hud:bottomBar");
    this.syncBars();
  }

  start(): void {
    registerPanels(this.scene, this);
  }

  update(): void {
    runClicked(this.topBar, this.bottomBar);
    if (this.gameMode.is("game")) {
      for (const panel of this.panels.values()) {
        const action = panel.def.action;
        if (action && InputManager.onActionPressed(action)) this.toggle(panel.def.id);
      }
    }
    for (const panel of this.panels.values()) {
      if (!panel.window.isOpen) continue;
      panel.def.update?.();
      panel.window.update();
    }
    for (const target of this.pulses) this.syncPulse(target);
    for (const target of this.highlights) this.syncHighlight(target);
    for (const target of this.hidden) this.syncHidden(target);
    for (const spotlight of this.spotlights) spotlight.sync();
    for (const callout of this.callouts) callout.sync();
  }

  destroy(): void {
    for (const target of this.pulses) {
      for (const [node, tween] of target.tweens) node.stopTween(tween);
      target.tweens.clear();
    }
    this.pulses.clear();
    for (const target of this.highlights) {
      for (const [node, frame] of target.frames) Navi.remove(frame, node);
      target.frames.clear();
    }
    this.highlights.clear();
    for (const target of this.hidden) {
      for (const [node, wasActive] of target.previous) node.setActive(wasActive);
      target.previous.clear();
    }
    this.hidden.clear();
    for (const spotlight of this.spotlights) spotlight.destroy();
    this.spotlights.clear();
    for (const callout of this.callouts) callout.destroy();
    this.callouts.clear();
    for (const stop of this.stoppers) stop();
    this.stoppers.length = 0;
    for (const panel of this.panels.values()) panel.window.close();
    this.panels.clear();
  }

  public register(def: PanelDef) {
    assert(!this.panels.has(def.id), `Panel "${def.id}" is already registered`);
    const slot = def.slot ?? (def.bar === "bottomRight" ? "bottomRight" : "center");
    const window = new UIWindow({
      kind: "docked",
      width: def.width,
      title: def.title,
      slot: slot,
      offsetY: slot === "bottomRight" ? GAME_UI.bottomWindowOffset : 0,
      tag: `window:${def.id}`,
      onClose: () => def.onClose?.(),
    });
    const host = def.bar === "top" ? this.topBar : this.bottomBar;
    const node = button(host, def.label, () => this.toggle(def.id), {
      selected: () => window.isOpen,
      tag: `panel:${def.id}`,
    });
    if (def.badge) badge(node, def.badge);
    if (def.requires) {
      node.setActive(this.conditions.isMet(def.requires));
      this.stoppers.push(
        this.conditions.watch(def.requires, (met) => {
          node.setActive(met);
          if (!met && window.isOpen) window.close();
          this.syncBars();
        }),
      );
    }
    this.panels.set(def.id, { def: def, window: window, button: node });
    this.syncBars();
  }

  public open(id: string) {
    const panel = this.panelOf(id);
    if (panel.window.isOpen) return;
    if (panel.def.requires && !this.conditions.isMet(panel.def.requires)) return;
    const content = panel.window.open();
    panel.def.build(content, panel.window);
    panel.def.onOpen?.();
  }

  public close(id: string) {
    this.panelOf(id).window.close();
  }

  public toggle(id: string) {
    const panel = this.panelOf(id);
    if (panel.window.isOpen) panel.window.close();
    else this.open(id);
  }

  public isOpen(id: string) {
    return this.panels.get(id)?.window.isOpen ?? false;
  }

  public play(tag: string, makeTween: () => Tween): CoroutineWait {
    const tweens = Navi.find(tag).map((node) => node.play(makeTween()));
    return waitTweens(tweens, `play "${tag}"`);
  }

  public shake(tag: string): CoroutineWait {
    return this.play(tag, () => Tweens.shake());
  }

  public hop(tag: string): CoroutineWait {
    return this.play(tag, () => Tweens.hop());
  }

  public show(tag: string, transition?: UITransition): CoroutineWait {
    const tweens = Navi.find(tag)
      .map((node) => showNode(node, transition))
      .filter((tween): tween is Tween => tween !== undefined);
    return waitTweens(tweens, `show "${tag}"`);
  }

  public hide(tag: string, transition?: UITransition): CoroutineWait {
    const tweens = Navi.find(tag)
      .map((node) => hideNode(node, transition))
      .filter((tween): tween is Tween => tween !== undefined);
    return waitTweens(tweens, `hide "${tag}"`);
  }

  public move(tag: string, to: Position2D, options?: MoveOptions): CoroutineWait {
    const tweens = Navi.find(tag).map((node) => moveNode(node, to, options));
    return waitTweens(tweens, `move "${tag}"`);
  }

  public pulse(tag: string): UIHandle {
    const target: PulseTarget = { tag: tag, tweens: new Map() };
    this.pulses.add(target);
    this.syncPulse(target);
    return {
      release: () => {
        if (!this.pulses.delete(target)) return;
        for (const [node, tween] of target.tweens) node.stopTween(tween);
        target.tweens.clear();
      },
    };
  }

  public highlight(tag: string, color?: RGBA): UIHandle {
    const target: HighlightTarget = { tag: tag, color: color, frames: new Map() };
    this.highlights.add(target);
    this.syncHighlight(target);
    return {
      release: () => {
        if (!this.highlights.delete(target)) return;
        for (const [node, frame] of target.frames) Navi.remove(frame, node);
        target.frames.clear();
      },
    };
  }

  public spotlight(tag: string, options?: { blockRest?: boolean }): UIHandle {
    const spotlight = new UISpotlight(tag, options?.blockRest ?? true);
    this.spotlights.add(spotlight);
    spotlight.sync();
    return {
      release: () => {
        if (!this.spotlights.delete(spotlight)) return;
        spotlight.destroy();
      },
    };
  }

  public callout(tag: string, message: TextContent): UIHandle {
    const callout = new UICallout(tag, message);
    this.callouts.add(callout);
    callout.sync();
    return {
      release: () => {
        if (!this.callouts.delete(callout)) return;
        callout.destroy();
      },
    };
  }

  public keepHidden(tag: string): UIHandle {
    const target: HiddenTarget = { tag: tag, previous: new Map() };
    this.hidden.add(target);
    this.syncHidden(target);
    return {
      release: () => {
        if (!this.hidden.delete(target)) return;
        for (const [node, wasActive] of target.previous) node.setActive(wasActive);
        target.previous.clear();
        Navi.markLayoutDirty();
      },
    };
  }

  public waitClick(tag: string, options?: { skippable?: boolean }): CoroutineWait {
    let skipped = false;
    const skippable = options?.skippable ?? true;
    return {
      tick: () => skipped || isTaggedClick(tag),
      skip: () => {
        if (skippable) skipped = true;
      },
      describe: () => `click "${tag}"`,
    };
  }

  public waitHover(tag: string, options?: { skippable?: boolean }): CoroutineWait {
    let skipped = false;
    const skippable = options?.skippable ?? true;
    return {
      tick: () => skipped || isTaggedNode(Navi.getHovered, tag),
      skip: () => {
        if (skippable) skipped = true;
      },
      describe: () => `hover "${tag}"`,
    };
  }

  public waitOpen(id: string, options?: { skippable?: boolean }): CoroutineWait {
    return this.waitState(id, true, options?.skippable ?? true);
  }

  public waitClose(id: string, options?: { skippable?: boolean }): CoroutineWait {
    return this.waitState(id, false, options?.skippable ?? true);
  }

  private waitState(id: string, open: boolean, skippable: boolean): CoroutineWait {
    const panel = this.panelOf(id);
    let skipped = false;
    return {
      tick: () => skipped || panel.window.isOpen === open,
      skip: () => {
        if (skippable) skipped = true;
      },
      describe: () => `${open ? "open" : "close"} panel "${id}"`,
    };
  }

  private syncPulse(target: PulseTarget) {
    const nodes = Navi.find(target.tag);
    for (const [node, tween] of target.tweens) {
      if (nodes.includes(node)) continue;
      node.stopTween(tween);
      target.tweens.delete(node);
    }
    for (const node of nodes) {
      if (target.tweens.has(node)) continue;
      target.tweens.set(node, node.play(Tweens.pulse(GAME_UI.pulse.amount, GAME_UI.pulse.ms)));
    }
  }

  private syncHighlight(target: HighlightTarget) {
    const nodes = Navi.find(target.tag);
    for (const [node, frame] of target.frames) {
      if (nodes.includes(node)) continue;
      Navi.remove(frame, node);
      target.frames.delete(node);
    }
    for (const node of nodes) {
      if (target.frames.has(node)) continue;
      target.frames.set(node, createHighlight(node, target.color));
    }
  }

  private syncHidden(target: HiddenTarget) {
    let changed = false;
    for (const node of Navi.find(target.tag)) {
      if (!target.previous.has(node)) target.previous.set(node, node.active);
      if (!node.active) continue;
      node.setActive(false);
      changed = true;
    }
    if (changed) Navi.markLayoutDirty();
  }

  private panelOf(id: string) {
    const panel = this.panels.get(id);
    assert(panel !== undefined, `Unknown UI panel "${id}"`);
    return panel;
  }

  private createBar(parent: UINode) {
    return Navi.append(
      new UINode({
        size: { width: auto(), height: auto() },
        style: {
          ...panelStyle("hud"),
          layout: "stack",
          direction: "row",
          alignCross: "center",
          gap: UI_THEME.spacing.gap,
        },
      }),
      parent,
    );
  }

  private syncBars() {
    let topVisible = false;
    let bottomVisible = false;
    for (const panel of this.panels.values()) {
      if (!panel.button.active) continue;
      if (panel.def.bar === "top") topVisible = true;
      else bottomVisible = true;
    }
    hudSlot("topRightBar").setActive(topVisible);
    hudSlot("bottomRight").setActive(bottomVisible);
    Navi.markLayoutDirty();
  }
}

function isTaggedClick(tag: string) {
  const node = Navi.getClicked;
  if (node instanceof UIButton && node.isDisabled) return false;
  return isTaggedNode(node, tag);
}

function isTaggedNode(node: UINode | undefined, tag: string) {
  let walk = node;
  while (walk !== undefined) {
    if (walk.tags.has(tag)) return true;
    walk = walk.parent;
  }
  return false;
}
