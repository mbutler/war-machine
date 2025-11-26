import { registerRoute } from "../../router";
import { renderSiegePanel } from "./view";
import "./siege.css";

registerRoute({
  id: "siege",
  label: "War Machine Combat",
  description: "Battle ratings & siege ops",
  section: "Siege",
  order: 1,
  mount(target) {
    return renderSiegePanel(target);
  },
});

