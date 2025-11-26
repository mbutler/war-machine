import { registerRoute } from "../../router";
import { renderLabPanel } from "./view";
import "./lab.css";

registerRoute({
  id: "lab",
  label: "Artificer's Lab",
  description: "Research & crafting",
  section: "Arcana",
  order: 1,
  mount(target) {
    return renderLabPanel(target);
  },
});

