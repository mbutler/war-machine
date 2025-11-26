import { registerRoute } from "../../router";
import { renderStrongholdPanel } from "./view";
import "./stronghold.css";

registerRoute({
  id: "stronghold",
  label: "Stronghold Architect",
  description: "Construction estimates",
  section: "Logistics",
  order: 2,
  mount(target) {
    return renderStrongholdPanel(target);
  },
});

