import { registerRoute } from "../../router";
import { renderWildernessPanel } from "./view";
import "./wilderness.css";

registerRoute({
  id: "wilderness",
  label: "Royal Cartographer",
  description: "Hex exploration & encounters",
  section: "Exploration",
  order: 1,
  mount(target) {
    return renderWildernessPanel(target);
  },
});

