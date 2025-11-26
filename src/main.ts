import "./styles/base.css";
import "./styles/layout.css";
import "./styles/components.css";
import "./styles/utilities.css";

import { renderAppShell } from "./layout/app-shell";
import { showNotification } from "./layout/notifications";
import { exportState, importState, resetState } from "./state/store";
import { getRoutes, startRouter } from "./router";

import "./features/party";
import "./features/dominion";
import "./features/wilderness";
import "./features/dungeon";
import "./features/merchant";
import "./features/stronghold";
import "./features/treasure";
import "./features/lab";
import "./features/siege";
import "./features/calendar";
import { onCalendarEvent } from "./features/calendar/state";

const root = document.getElementById("app");

if (!root) {
  throw new Error("Missing #app element");
}

function triggerDownload(filename: string, payload: string) {
  const blob = new Blob([payload], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

const shell = renderAppShell(root, {
  onSelectRoute(routeId) {
    window.location.hash = routeId;
  },
  onExport() {
    const payload = exportState();
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    triggerDownload(`war-machine-suite-${timestamp}.json`, payload);
  },
  onImport(payload) {
    try {
      importState(payload);
      showNotification({
        title: "Import complete",
        message: "Suite data imported successfully.",
        variant: "success",
      });
    } catch (error) {
      showNotification({
        title: "Import failed",
        message: (error as Error).message,
        variant: "danger",
      });
    }
  },
  onClear() {
    resetState();
    showNotification({
      title: "State cleared",
      message: "All suite data cleared.",
      variant: "warning",
    });
  },
});

onCalendarEvent((event) => {
  if (event.type === "timers-expired") {
    const names = event.trackers.map((tracker) => tracker.name);
    const label = names.length > 1 ? "Timers expired" : "Timer expired";
    showNotification({
      title: label,
      message: names.join(", "),
      variant: "warning",
    });
  }
});

const registeredRoutes = getRoutes();
shell.setRoutes(registeredRoutes);

startRouter({
  container: shell.contentRegion,
  onRouteChange(route) {
    shell.setActiveRoute(route.id);
  },
});

