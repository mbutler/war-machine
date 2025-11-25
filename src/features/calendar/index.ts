import { registerRoute } from "../../router";
import { renderCalendarPanel } from "./view";
import "./calendar.css";

registerRoute({
  id: "calendar",
  label: "Master Chronometer",
  description: "Campaign calendar & events",
  section: "Timekeeping",
  order: 1,
  mount(target) {
    return renderCalendarPanel(target);
  },
});

