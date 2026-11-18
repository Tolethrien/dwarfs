import InputManager from "@engine/inputManager";
import PragmaSystem from "@pragma/system";
import AxiomColor, { COLOR } from "@axiom/color";
import { Draw } from "@aurora/urp/draw/draw";
import { Camera } from "@engine/camera/camera";
import { ACTION } from "../../inputActions";
import Palisade from "../../bActors/palisade";
import { bodyContains } from "../../components/physics";
import { OBJECTS, ObjectsID } from "../../content/objects";
import { BlocksID, getBlock } from "../../content/blocks";
import { GameResourcesID } from "../../content/resources";
import { RENDER_ORDER } from "../../configs";
import MenuPanel from "../../ui/menuPanel";
import PlayerResources from "./resources";
import GameMode, { type GameModeChangedEvent } from "./gameMode";
import Terrain from "./terrain";
import Camp, { type RailPiece } from "./camp";

// eraser: the player's builds back to the stock; ground: (debug) mines any breakable block
export type BuildTool = "palisade" | RailPiece | "eraser" | "ground";

const PLACING = {
  valid: AxiomColor.withAlpha(COLOR.LIME, 140),
  invalid: AxiomColor.withAlpha(COLOR.RED, 140),
  erase: AxiomColor.withAlpha(COLOR.ORANGE, 140),
};
const TOOLS: { tool: BuildTool; action: string; label: string; stock?: GameResourcesID; tiles: number }[] = [
  { tool: "palisade", action: ACTION.toolPalisade, label: "Palisada", stock: GameResourcesID.palisade, tiles: 0 },
  { tool: "track", action: ACTION.toolTrack, label: "Tor", stock: GameResourcesID.track, tiles: 1 },
  { tool: "station", action: ACTION.toolStation, label: "Stacja", stock: GameResourcesID.station, tiles: 2 },
  { tool: "eraser", action: ACTION.toolEraser, label: "Gumka", tiles: 1 },
  { tool: "ground", action: ACTION.toolGround, label: "(debug) Usuń grunt", tiles: 1 },
];
const HINTS: Record<BuildTool, string> = {
  palisade: "Lewy: postaw. Prawy (trzymaj): obróć.",
  track: "Lewy: kafel toru, w bok od platformy w szybie, toru albo stacji.",
  station: "Lewy: stacja 2 kafle, tor zaraz obok.",
  eraser: "Lewy: zabierz palisadę, tor albo stację do zapasu.",
  ground: "Lewy: wykop blok (debug).",
};

// build mode (Tab): a tool box in the corner, the tools also on keys 1–5. Palisades turn with the
// right button held; tracks, stations, eraser and ground snap to tiles. Esc / Tab = back to the game
export default class MapBuilder extends PragmaSystem {
  private tool: BuildTool = "palisade";
  // where a palisade stays while it is being turned, null = it follows the cursor
  private pinned: Position2D | null = null;
  private rotation = 0;
  private panel: MenuPanel | null = null;

  constructor(internal: InternalPSProps) {
    super(internal);
  }

  start(): void {
    this.onSceneEvent<GameModeChangedEvent>("gameModeChanged", (event) => {
      if (event.mode === "build") this.openPanel();
      else this.closePanel();
    });
  }

  destroy(): void {
    this.closePanel();
  }

  public setTool(tool: BuildTool) {
    this.tool = tool;
    this.pinned = null;
  }

  public leave() {
    this.scene.getSystem(GameMode).set("game");
  }

  private openPanel() {
    this.closePanel();
    const panel = new MenuPanel({ blur: 0, docked: true });
    this.panel = panel;
    panel.title("Budowa");
    TOOLS.forEach((entry, index) =>
      panel.button(
        () => {
          const active = entry.tool === this.tool ? "▶ " : "";
          const stock = entry.stock === undefined ? "" : ` (${this.resources.amountOf(entry.stock)})`;
          return `${active}[${index + 1}] ${entry.label}${stock}`;
        },
        () => this.setTool(entry.tool),
      ),
    );
    panel.note(() => HINTS[this.tool]);
    panel.note("Esc / Tab: koniec");
  }

  private closePanel() {
    this.panel?.destroy();
    this.panel = null;
    this.pinned = null;
  }

  private get resources() {
    return this.scene.getSystem(PlayerResources);
  }

  private get world() {
    return this.scene.getSystem(Terrain).world;
  }

  preUpdate(): void {
    this.panel?.update();
    for (const entry of TOOLS) if (InputManager.onActionPressed(entry.action)) this.setTool(entry.tool);
    const cursor = Camera.screenToWorld(InputManager.getMousePos());
    if (this.tool === "palisade") {
      this.updatePalisade(cursor);
      return;
    }
    if (!InputManager.onActionPressed(ACTION.placeBlock)) return;
    const tile = this.world.worldToTile(cursor);
    if (this.tool === "eraser") this.erase(cursor, tile);
    else if (this.tool === "ground") this.removeGround(tile);
    else this.scene.getSystem(Camp).place(this.tool, tile.x, tile.y);
  }

  private updatePalisade(cursor: Position2D) {
    if (InputManager.onActionPressed(ACTION.rotateBuild)) this.pinned = cursor;
    if (InputManager.onActionReleased(ACTION.rotateBuild)) this.pinned = null;
    if (this.pinned !== null) {
      // a little away from the pin, or it spins on every twitch
      if (Math.hypot(cursor.x - this.pinned.x, cursor.y - this.pinned.y) > 1)
        this.rotation = Math.atan2(cursor.y - this.pinned.y, cursor.x - this.pinned.x);
      return;
    }
    if (!InputManager.onActionPressed(ACTION.placeBlock)) return;
    if (this.canPlacePalisade(cursor) && this.resources.pay([[GameResourcesID.palisade, 1]]))
      this.scene.spawnActor(new Palisade({ position: cursor, rotation: this.rotation }));
  }

  // a palisade under the cursor first, then a track or station on the tile
  private erase(cursor: Position2D, tile: Position2D) {
    const palisade = this.palisadeAt(cursor);
    if (palisade) {
      palisade.selfDestroy();
      this.resources.addResource(GameResourcesID.palisade, 1);
      return;
    }
    this.scene.getSystem(Camp).erase(tile.x, tile.y);
  }

  private palisadeAt(point: Position2D) {
    const shape = OBJECTS[ObjectsID.palisade].shape;
    for (const actor of this.scene.getAllActors)
      if (actor instanceof Palisade && bodyContains(shape, actor.transform, point)) return actor;
    return null;
  }

  private removeGround(tile: Position2D) {
    if (!this.world.inside(tile.x, tile.y)) return;
    if (getBlock(this.world.getType(tile.x, tile.y)).unbreakable) return;
    this.scene.getSystem(Terrain).mine(tile.x, tile.y);
  }

  // its middle in open air inside the mine
  private canPlacePalisade(position: Position2D) {
    const tile = this.world.worldToTile(position);
    return this.world.inside(tile.x, tile.y) && this.world.getType(tile.x, tile.y) === BlocksID.air;
  }

  render(): void {
    const cursor = Camera.screenToWorld(InputManager.getMousePos());
    if (this.tool === "palisade") {
      this.drawPalisade(this.pinned ?? cursor);
      return;
    }
    const tile = this.world.worldToTile(cursor);
    const corner = this.world.tileToWorld(tile);
    const size = this.world.meta.tileInPixels;
    const tiles = TOOLS.find((entry) => entry.tool === this.tool)!.tiles;
    Draw.rect({
      position: { x: corner.x, y: corner.y, z: RENDER_ORDER.overlay },
      size: { width: size.width * tiles, height: size.height },
      color: this.tileColor(tile),
    });
  }

  private tileColor(tile: Position2D) {
    if (this.tool === "eraser" || this.tool === "ground") return PLACING.erase;
    const camp = this.scene.getSystem(Camp);
    const piece = this.tool as RailPiece;
    const valid = camp.canPlace(piece, tile.x, tile.y) && camp.inStock(piece);
    return valid ? PLACING.valid : PLACING.invalid;
  }

  private drawPalisade(position: Position2D) {
    const shape = OBJECTS[ObjectsID.palisade].shape;
    if (shape.type !== "rect") return;
    const valid = this.canPlacePalisade(position) && this.resources.amountOf(GameResourcesID.palisade) > 0;
    Draw.rect({
      position: { x: position.x - shape.w / 2, y: position.y - shape.h / 2, z: RENDER_ORDER.overlay },
      size: { width: shape.w, height: shape.h },
      rotation: this.rotation,
      color: valid ? PLACING.valid : PLACING.invalid,
    });
  }
}
