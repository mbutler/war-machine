import { registerRoute } from "../../router";
import { renderDungeonPanel } from "./view";
import "./dungeon.css";

registerRoute({
  id: "dungeon",
  label: "Dungeon Delver",
  description: "Tactical combat + loot tracking",
  section: "Exploration",
  order: 2,
  mount(target) {
    return renderDungeonPanel(target);
  },
});

