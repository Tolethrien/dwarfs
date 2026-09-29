import { useLocalStorage } from "./hooks/useLocalStorage";

// switched in the options menu; a hidden tab keeps its layout and pins
const [hidden, setHidden] = useLocalStorage<string[]>("hiddenTabs", []);

export const tabVisibility = {
  isHidden: (id: string) => hidden().includes(id),
  toggle: (id: string) =>
    setHidden((ids) =>
      ids.includes(id) ? ids.filter((other) => other !== id) : [...ids, id],
    ),
};
