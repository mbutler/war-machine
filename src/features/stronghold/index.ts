import { createPanel } from "../../layout/panels";
import { registerRoute } from "../../router";

registerRoute({
  id: "stronghold",
  label: "Stronghold Architect",
  description: "Construction estimates",
  section: "Logistics",
  order: 2,
  mount(target) {
    const { element, body } = createPanel("Stronghold Planning");
    const paragraph = document.createElement("p");
    paragraph.textContent =
      "Structure templates, cost calculators, and project timelines will move into this panel.";
    body.appendChild(paragraph);
    target.appendChild(element);
  },
});

