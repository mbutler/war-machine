import { createPanel } from "../../layout/panels";
import { registerRoute } from "../../router";

registerRoute({
  id: "lab",
  label: "Artificer's Lab",
  description: "Research & crafting",
  section: "Arcana",
  order: 1,
  mount(target) {
    const { element, body } = createPanel("Laboratory");
    const paragraph = document.createElement("p");
    paragraph.textContent =
      "Spell research, potion brewing, and enchantment projects will appear here.";
    body.appendChild(paragraph);
    target.appendChild(element);
  },
});

