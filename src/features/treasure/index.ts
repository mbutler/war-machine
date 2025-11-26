import { registerRoute } from "../../router";
import { renderTreasurePanel } from "./view";
import "./treasure.css";

registerRoute({
  id: "treasure",
  label: "Treasure Generator",
  description: "Hoard tables & valuables",
  section: "Logistics",
  order: 3,
  mount(target) {
    return renderTreasurePanel(target);
  },
});

