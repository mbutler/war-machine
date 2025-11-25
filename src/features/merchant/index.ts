import { registerRoute } from "../../router";
import { renderMerchantPanel } from "./view";

registerRoute({
  id: "merchant",
  label: "Merchant of Darokin",
  description: "Trade, tariffs, caravans",
  section: "Logistics",
  order: 1,
  mount(target) {
    return renderMerchantPanel(target);
  },
});

