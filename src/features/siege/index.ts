import { createPanel } from "../../layout/panels";
import { registerRoute } from "../../router";

registerRoute({
  id: "siege",
  label: "War Machine Combat",
  description: "Battle ratings & siege ops",
  section: "Siege",
  order: 1,
  mount(target) {
    const { element, body } = createPanel("Siege Console");
    const paragraph = document.createElement("p");
    paragraph.textContent =
      "Battle force calculations, siege weapon logic, and engagement logging will transition here.";
    body.appendChild(paragraph);
    target.appendChild(element);
  },
});

