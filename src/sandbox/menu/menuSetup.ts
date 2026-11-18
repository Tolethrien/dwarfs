import Pragma from "@pragma/pragma";
import MainMenu from "./systems/mainMenu";

const MENU_SCENE = "menu";

export function openMenu(newGame: (seed: number) => void) {
  Pragma.addScene(MENU_SCENE).addSystem(MainMenu, newGame);
}

export function closeMenu() {
  Pragma.deleteScene(MENU_SCENE);
}
