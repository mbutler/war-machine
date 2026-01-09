import "./styles/base.css";
import "./styles/layout.css";
import "./styles/components.css";
import "./styles/utilities.css";

import { renderAppShell } from "./layout/app-shell";
import { showNotification } from "./layout/notifications";
import { exportState, importState, resetState, getState, updateState } from "./state/store";
import { getRoutes, startRouter } from "./router";
import { syncFromFantasyLog, mergeIntoState } from "./features/fantasy-log-sync";

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
import "./features/ledger";
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
      const result = importState(payload);
      if (result.type === "campaign") {
        showNotification({
          title: "Campaign imported",
          message: "Full campaign data imported successfully.",
          variant: "success",
        });
      } else {
        showNotification({
          title: "Module imported",
          message: `${result.module} data imported successfully.`,
          variant: "success",
        });
      }
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
  onImportFromLog(worldJson, eventsJsonl) {
    console.log("[fantasy-log-sync] Import triggered");
    console.log("[fantasy-log-sync] worldJson:", worldJson ? `${worldJson.length} chars` : "null");
    console.log("[fantasy-log-sync] eventsJsonl:", eventsJsonl ? `${eventsJsonl.length} chars` : "null");
    
    try {
      const result = syncFromFantasyLog(worldJson, eventsJsonl);
      console.log("[fantasy-log-sync] Sync result:", result.summary);
      
      if (result.summary.warnings.some(w => w.type === 'error')) {
        const errors = result.summary.warnings.filter(w => w.type === 'error');
        showNotification({
          title: "Import failed",
          message: errors.map(e => e.message).join('; '),
          variant: "danger",
        });
        return;
      }
      
      // Merge into current state
      const current = getState();
      console.log("[fantasy-log-sync] Current party roster:", current.party.roster.length);
      console.log("[fantasy-log-sync] result.state keys:", Object.keys(result.state));
      console.log("[fantasy-log-sync] result.state.party:", result.state.party);
      
      let merged;
      try {
        merged = mergeIntoState(current, result.state);
        console.log("[fantasy-log-sync] Merged party roster:", merged.party.roster.length);
      } catch (mergeError) {
        console.error("[fantasy-log-sync] Merge error:", mergeError);
        throw mergeError;
      }
      
      try {
        updateState((draft) => {
          Object.assign(draft, merged);
        });
        console.log("[fantasy-log-sync] State updated");
      } catch (updateError) {
        console.error("[fantasy-log-sync] Update error:", updateError);
        throw updateError;
      }
      
      // Build summary message
      const parts: string[] = [];
      if (result.summary.characters > 0) parts.push(`${result.summary.characters} characters`);
      if (result.summary.settlements > 0) parts.push(`${result.summary.settlements} settlements`);
      if (result.summary.hexes > 0) parts.push(`${result.summary.hexes} hexes`);
      if (result.summary.armies > 0) parts.push(`${result.summary.armies} armies`);
      if (result.summary.goldTransactions > 0) parts.push(`${result.summary.goldTransactions} transactions`);
      
      showNotification({
        title: "Fantasy Log imported",
        message: parts.length > 0 ? `Imported: ${parts.join(', ')}` : "Import complete",
        variant: "success",
      });
      
      // Show warnings if any
      const warnings = result.summary.warnings.filter(w => w.type === 'warning');
      if (warnings.length > 0) {
        setTimeout(() => {
          showNotification({
            title: "Import warnings",
            message: warnings.slice(0, 3).map(w => w.message).join('; '),
            variant: "warning",
          });
        }, 2000);
      }
    } catch (error) {
      showNotification({
        title: "Import failed",
        message: (error as Error).message,
        variant: "danger",
      });
    }
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

