import { registerRoute } from "../../router";
import { renderPartyPanel } from "./view";
import "./party.css";

registerRoute({
  id: "party",
  label: "Mustard Hall Registry",
  description: "Character generator & roster",
  section: "Characters",
  order: 1,
  mount(target) {
    return renderPartyPanel(target);
  },
});

