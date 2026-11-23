import { render } from "solid-js/web";
import "./profiler.css";
import TitleBar from "./components/titleBar";
import BottomConsole from "./console/bottomConsole";
import { TabBar, TabContent } from "./tabs";
import { initTheme } from "./theme";
import TweakModal from "./tweak/modal";
import TweakCategoryWindow from "./tweak/categoryWindow";

function App() {
  initTheme();
  return (
    <>
      <TitleBar />
      <TabBar />
      <main class="min-h-0 flex-1 overflow-hidden">
        <TabContent />
      </main>
      <BottomConsole />
      <TweakModal />
      <TweakCategoryWindow />
    </>
  );
}

render(() => <App />, document.getElementById("app")!);
