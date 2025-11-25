import { createPanel } from "../../layout/panels";
import { registerRoute } from "../../router";

registerRoute({
  id: "treasure",
  label: "Treasure Generator",
  description: "Hoard tables & valuables",
  section: "Logistics",
  order: 3,
  mount(target) {
    const { element, body } = createPanel("Treasure Operations");
    const paragraph = document.createElement("p");
    paragraph.textContent =
      "Type A–O hoards, gems, jewelry, and magic item rolls will be surfaced here.";
    body.appendChild(paragraph);
    target.appendChild(element);
  },
});

