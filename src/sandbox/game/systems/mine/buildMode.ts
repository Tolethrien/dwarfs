import PragmaSystem from "@pragma/system";
import InputManager from "@engine/inputManager";
import Time, { type TimeWarp } from "@engine/time";
import { Camera } from "@engine/camera/camera";
import { Draw } from "@aurora/urp/draw/draw";
import Navi from "@navi/navi";
import AxiomMath from "@axiom/math";
import Easing from "@axiom/easing";
import type { BuildContext, BuildTool, OutlineLook, Refusal } from "../../build/build";
import { mineRemoveTool } from "../../build/blueprints";
import { BUILD_LOOK } from "../../build/look";
import type BuildSpace from "../../build/space";
import {
  BUILD_ELEMENTS,
  BuildCategoryID,
  BuildElementID,
  categoriesOf,
  type BuildLayer,
} from "../../content/build";
import { formatAmount, RESOURCES, type ResourceCost } from "../../content/resources";
import { SORT_ORDER } from "../../content/render";
import { UI_THEME } from "../../content/ui";
import type { Stock } from "../../components/common/storage";
import { BUILD_SPACE, CAMP_STORE } from "../../sceneData";
import { closeAllWindows, type UIWindow } from "../../ui/elements/window";
import { confirm } from "../../ui/elements/confirm";
import { text } from "../../ui/elements/text";
import { cost, costEntries } from "../../ui/elements/cost";
import { popAt } from "../../ui/elements/pop";
import BuildMenu from "../../ui/build/menu";
import Conditions from "../core/conditions";
import GameEvents from "../core/gameEvents";
import GameMode from "../core/gameMode";
import MapView from "../world/mapView";
import Terrain from "../world/terrain";

const BUILD = {
  slowdown: 0.25,
  blend: 0.3,
  focus: { share: 0.8, seconds: 0.6 },
};

export default class BuildMode extends PragmaSystem {
  public layer: BuildLayer = "main";
  public category: BuildCategoryID | undefined = categoriesOf("main")[0];
  public selected: BuildElementID | undefined;
  public removing = false;
  // locked whatever the level, while a cutscene wants them out of reach
  public readonly held = new Set<BuildElementID>();
  private readonly remover: BuildTool = mineRemoveTool();
  private warp: TimeWarp | undefined;
  private dialog: UIWindow | undefined;
  declare private menu: BuildMenu;
  declare private mapView: MapView;
  declare private terrain: Terrain;
  declare private space: BuildSpace;
  declare private store: Stock;
  declare private conditions: Conditions;
  declare private gameMode: GameMode;
  declare private ctx: BuildContext;

  awake(): void {
    this.mapView = this.scene.getSystem(MapView);
    this.terrain = this.scene.getSystem(Terrain);
    this.space = this.scene.sharedData.require(BUILD_SPACE);
    this.store = this.scene.sharedData.require(CAMP_STORE);
    this.conditions = this.scene.getSystem(Conditions);
    this.gameMode = this.scene.getSystem(GameMode);
    this.ctx = this.createContext();
    this.menu = new BuildMenu(this, (price) => this.store.missing(price));
    const events = this.scene.getSystem(GameEvents);
    this.connect(events.resources.changed, () => {
      if (this.on) this.menu.showSelected();
    });
    this.connect(events.player.unlocked, () => {
      if (this.on) this.menu.showElements();
    });
  }

  update(): void {
    const wasAsking = this.asking;
    if (this.on) {
      this.menu.update();
      this.dialog?.update();
      if (!wasAsking) this.activeTool?.update(this.ctx);
    }
    if (InputManager.onActionPressed("cancelBuild") && !wasAsking && !this.asking) {
      if (this.removing) this.toggleRemoving();
      else if (this.selected !== undefined) this.pick(undefined);
      else this.leave();
    } else if (InputManager.onActionPressed("toggleBuild")) {
      if (this.on) this.leave();
      else this.enter();
    }
  }

  render(): void {
    if (!this.on) return;
    for (const reserve of this.space.reserves())
      this.drawBox(reserve, BUILD_LOOK.reserve.built, BUILD_LOOK.reserve.width);
    this.activeTool?.render(this.ctx);
  }

  public pickLayer(layer: BuildLayer) {
    this.layer = layer;
    this.pickCategory(categoriesOf(layer)[0]);
  }

  public pickCategory(category: BuildCategoryID | undefined) {
    if (category !== this.category) this.pick(undefined);
    this.category = category;
  }

  public toggleRemoving() {
    const removing = !this.removing;
    this.pick(undefined);
    this.removing = removing;
    this.menu.showSelected();
  }

  public pick(element: BuildElementID | undefined) {
    this.activeTool?.cancel?.();
    if (element !== undefined) this.removing = false;
    this.selected = element;
    if (element !== undefined) {
      const tool = BUILD_ELEMENTS[element].tool;
      if (tool.onPick && !tool.onPick(this.ctx)) this.selected = undefined;
    }
    this.menu.showSelected();
  }

  public isLocked(element: BuildElementID) {
    return this.held.has(element) || this.missingFor(element).length > 0;
  }

  public missingFor(element: BuildElementID) {
    const requires = BUILD_ELEMENTS[element].requires;
    return requires ? this.conditions.missing(requires) : [];
  }

  public costOf(element: BuildElementID): ResourceCost {
    return BUILD_ELEMENTS[element].cost;
  }

  public leave() {
    if (this.on) this.gameMode.set("game");
  }

  private get activeTool(): BuildTool | undefined {
    if (this.removing) return this.remover;
    if (this.selected !== undefined) return BUILD_ELEMENTS[this.selected].tool;
    return undefined;
  }

  private get on() {
    return this.gameMode.is("build");
  }

  private get asking() {
    return this.dialog?.isOpen === true;
  }

  private enter() {
    closeAllWindows();
    this.gameMode.set("build", () => this.cleanup());
    this.warp = Time.warp(BUILD.slowdown, { blend: BUILD.blend });
    this.mapView.showBlueprint();
    this.pick(undefined);
    this.menu.show();
  }

  private cleanup() {
    this.activeTool?.cancel?.();
    this.warp?.release();
    this.warp = undefined;
    this.mapView.hideBlueprint();
    this.dialog?.close();
    this.dialog = undefined;
    this.selected = undefined;
    this.removing = false;
    this.stopCoroutine("glide");
    this.menu.hide();
  }

  private createContext(): BuildContext {
    const mode = this;
    return {
      scene: this.scene,
      terrain: this.terrain,
      world: this.terrain.world,
      tile: this.terrain.tile,
      space: this.space,
      store: this.store,
      get layer() {
        return mode.layer;
      },
      get asking() {
        return mode.asking;
      },
      get hoveredUi() {
        return Navi.getHovered !== undefined;
      },
      mouseWorld: () => Camera.screenToWorld(InputManager.getMousePos()),
      mouseSpot: () => {
        const world = Camera.screenToWorld(InputManager.getMousePos());
        return { x: world.x / this.terrain.tile, y: world.y / this.terrain.tile };
      },
      mouseTile: () => this.terrain.world.worldToTile(Camera.screenToWorld(InputManager.getMousePos())),
      drawBox: (box, look, border) => this.drawBox(box, look, border),
      drawRect: (rect, look, border) => this.drawRect(rect, look, border),
      drawTiles: (tiles, color) => this.drawTiles(tiles, color),
      focus: (box) => this.focus(box),
      pop: (message) => popAt(InputManager.getMousePos(), message, UI_THEME.colors.lacking),
      hasMissing: (price) => this.saysMissing(price),
      confirmBuild: (title, price, check, build) => this.confirmBuild(title, price, check, build),
      confirmRemove: (label, warning, check, remove) => this.confirmRemove(label, warning, check, remove),
      clearSelection: () => this.pick(undefined),
    };
  }

  // paid at the yes: the resources and the room may have gone while the question was open
  private confirmBuild(
    title: string,
    price: ResourceCost,
    check: () => Refusal | undefined,
    build: () => void,
  ) {
    this.dialog = confirm(
      undefined,
      `Build ${title}?`,
      () => {
        const refusal = check();
        if (refusal !== undefined) {
          popAt(InputManager.getMousePos(), refusal.reason, UI_THEME.colors.lacking);
          return;
        }
        if (!this.store.pay(price)) {
          popAt(InputManager.getMousePos(), "Not enough resources any more", UI_THEME.colors.lacking);
          return;
        }
        build();
        this.pick(undefined);
      },
      {
        details: (content) => cost(content, costEntries(price, [])),
      },
    );
  }

  // asked again at the yes: state may have changed while the question was open
  private confirmRemove(
    label: string,
    warning: string | undefined,
    check: () => string | undefined,
    remove: () => void,
  ) {
    this.dialog = confirm(
      undefined,
      `Remove ${label}?`,
      () => {
        const problem = check();
        if (problem !== undefined) {
          popAt(InputManager.getMousePos(), problem, UI_THEME.colors.lacking);
          return;
        }
        remove();
      },
      {
        details: (content) => {
          if (warning !== undefined) text(content, warning, { color: UI_THEME.colors.lacking });
          text(content, "Nothing comes back", { color: UI_THEME.colors.muted });
        },
      },
    );
  }

  private saysMissing(price: ResourceCost) {
    const missing = this.store.missing(price);
    if (missing.length === 0) return false;
    const list = missing.map(([id, amount]) => `${formatAmount(id, amount)} ${RESOURCES[id].name}`);
    popAt(InputManager.getMousePos(), `Missing: ${list.join(", ")}`, UI_THEME.colors.lacking);
    return true;
  }

  private drawTiles(tiles: Position2D[], color = BUILD_LOOK.outline.inTheWay) {
    const tile = this.terrain.tile;
    for (const pos of tiles)
      Draw.rect({
        position: { x: pos.x * tile, y: pos.y * tile, z: SORT_ORDER.effects },
        size: { width: tile, height: tile },
        color: color,
      });
  }

  private drawBox(box: Box, look: OutlineLook, border: number) {
    const tile = this.terrain.tile;
    Draw.rect({
      position: { x: box.x * tile, y: box.y * tile, z: SORT_ORDER.effects },
      size: { width: box.w * tile, height: box.h * tile },
      color: look.fill,
      outline: { width: border * tile, color: look.border },
    });
  }

  private drawRect(rect: Rect, look: OutlineLook, border: number) {
    Draw.rect({
      position: { x: rect.x - rect.w / 2, y: rect.y - rect.h / 2, z: SORT_ORDER.effects },
      size: { width: rect.w, height: rect.h },
      rotation: rect.rotation,
      color: look.fill,
      outline: { width: border * this.terrain.tile, color: look.border },
    });
  }

  private focus(outline: Box) {
    const tile = this.terrain.tile;
    const width = outline.w * tile;
    const height = outline.h * tile;
    const view = Camera.getViewBounds;
    const zoom = Camera.getZoom;
    const screen = { width: (view.max.x - view.min.x) * zoom, height: (view.max.y - view.min.y) * zoom };
    const fit = Math.min(screen.width / width, screen.height / height) * BUILD.focus.share;
    Camera.setZoom(Math.min(Camera.getZoomTarget, fit));
    const from = { x: Camera.getPosition.x, y: Camera.getPosition.y };
    const to = { x: outline.x * tile + width / 2, y: outline.y * tile + height / 2 };
    // on real time: the bullet time doesn't slow it; a new focus takes the key over
    this.startCoroutine(
      function* glide() {
        let elapsed = 0;
        while (elapsed < BUILD.focus.seconds) {
          elapsed += Time.getRawDeltaTime();
          const progress = Easing.easeOutCubic(Math.min(elapsed / BUILD.focus.seconds, 1));
          Camera.setPosition(AxiomMath.lerpPos2D(from, to, progress));
          yield;
        }
      },
      { key: "glide", time: "real" },
    );
  }
}
