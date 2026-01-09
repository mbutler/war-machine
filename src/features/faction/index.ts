import { registerRoute } from "../../router";
import { renderFactionPanel } from "./view";
import "./faction.css";

registerRoute({
  id: "faction",
  label: "Factions",
  description: "Political powers & relationships",
  section: "3. Domain & War",
  order: 2,
  mount(target) {
    return renderFactionPanel(target);
  },
});
