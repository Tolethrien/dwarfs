import Pragma from "@pragma/pragma";
import MainMenu from "../systems/menu/mainMenu";

const SCENE = "menu";

export default class MenuScene {
  public static open() {
    const scene = Pragma.addScene(SCENE);
    scene.addSystem(MainMenu);
  }

  public static close() {
    if (Pragma.getScene(SCENE)) Pragma.deleteScene(SCENE);
  }
}
