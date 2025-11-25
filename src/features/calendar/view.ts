import type { CalendarState, CalendarTracker } from "../../state/schema";
import { createPanel } from "../../layout/panels";
import { showNotification } from "../../layout/notifications";
import {
  addCalendarTracker,
  advanceCalendar,
  clearCalendarLog,
  exportCalendarData,
  formatCalendarDate,
  formatCalendarTime,
  formatDuration,
  getCalendarMoonPhase,
  getCalendarSeason,
  getCalendarState,
  importCalendarData,
  manualSetCalendar,
  removeCalendarTracker,
  subscribeToCalendar,
  type CalendarAdvanceUnit,
  type CalendarTrackerUnit,
  CALENDAR_MONTHS,
} from "./state";

interface ControlAction {
  label: string;
  unit: CalendarAdvanceUnit;
  amount: number;
}

interface ControlGroup {
  label: string;
  actions: ControlAction[];
}

const CONTROL_GROUPS: ControlGroup[] = [
  {
    label: "Dungeon Scale",
    actions: [
      { label: "+1 Round (10s)", unit: "round", amount: 1 },
      { label: "+1 Turn (10m)", unit: "turn", amount: 1 },
    ],
  },
  {
    label: "Adventure Scale",
    actions: [
      { label: "+1 Hour", unit: "hour", amount: 1 },
      { label: "+1 Watch (4h)", unit: "watch", amount: 1 },
    ],
  },
  {
    label: "Campaign Scale",
    actions: [
      { label: "+1 Day", unit: "day", amount: 1 },
      { label: "+1 Week", unit: "week", amount: 1 },
      { label: "+1 Month", unit: "month", amount: 1 },
      { label: "+1 Season", unit: "season", amount: 1 },
    ],
  },
];

export function renderCalendarPanel(target: HTMLElement) {
  const { element, body } = createPanel(
    "Master Chronometer",
    "Coordinate dungeon turns, wilderness days, and dominion seasons from a single console.",
  );
  element.classList.add("calendar-shell");

  const grid = document.createElement("div");
  grid.className = "calendar-grid";
  body.appendChild(grid);

  const controlsColumn = document.createElement("div");
  controlsColumn.className = "calendar-column";
  grid.appendChild(controlsColumn);

  const statusCard = document.createElement("section");
  statusCard.className = "panel compact calendar-card";
  controlsColumn.appendChild(statusCard);

  const timeDisplay = document.createElement("div");
  timeDisplay.className = "calendar-time-display";

  const dateEl = document.createElement("div");
  dateEl.className = "calendar-date";
  timeDisplay.appendChild(dateEl);

  const timeEl = document.createElement("div");
  timeEl.className = "calendar-time";
  timeDisplay.appendChild(timeEl);

  const badges = document.createElement("div");
  badges.className = "flex gap-sm";

  const seasonBadge = document.createElement("div");
  seasonBadge.className = "calendar-badge";
  badges.appendChild(seasonBadge);

  const moonBadge = document.createElement("div");
  moonBadge.className = "calendar-badge";
  badges.appendChild(moonBadge);

  timeDisplay.appendChild(badges);
  statusCard.appendChild(timeDisplay);

  CONTROL_GROUPS.forEach((group) => {
    const wrapper = document.createElement("div");
    wrapper.className = "calendar-divider";

    const label = document.createElement("div");
    label.className = "calendar-section-label";
    label.textContent = group.label;
    wrapper.appendChild(label);

    const gridControls = document.createElement("div");
    gridControls.className = "calendar-controls-grid";

    group.actions.forEach((action) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "button";
      btn.textContent = action.label;
      btn.addEventListener("click", () => handleAdvance(action.unit, action.amount));
      gridControls.appendChild(btn);
    });

    wrapper.appendChild(gridControls);
    statusCard.appendChild(wrapper);
  });

  const manualSection = document.createElement("div");
  manualSection.className = "calendar-divider";
  const manualLabel = document.createElement("div");
  manualLabel.className = "calendar-section-label";
  manualLabel.textContent = "Manual Date Set";
  manualSection.appendChild(manualLabel);

  const manualRow = document.createElement("div");
  manualRow.className = "flex gap-sm";

  const yearInput = document.createElement("input");
  yearInput.type = "number";
  yearInput.className = "input";
  yearInput.placeholder = "Year";

  const monthSelect = document.createElement("select");
  monthSelect.className = "input";
  CALENDAR_MONTHS.forEach((month, index) => {
    const option = document.createElement("option");
    option.value = String(index);
    option.textContent = month;
    monthSelect.appendChild(option);
  });

  const dayInput = document.createElement("input");
  dayInput.type = "number";
  dayInput.className = "input";
  dayInput.min = "1";
  dayInput.max = "28";

  manualRow.append(yearInput, monthSelect, dayInput);
  manualSection.appendChild(manualRow);

  const manualBtn = document.createElement("button");
  manualBtn.type = "button";
  manualBtn.className = "button";
  manualBtn.textContent = "Update Date";
  manualBtn.addEventListener("click", () => {
    const year = Number(yearInput.value);
    const month = Number(monthSelect.value);
    const day = Number(dayInput.value);
    if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) {
      showNotification({
        title: "Invalid date",
        message: "Enter a valid date before updating.",
        variant: "warning",
      });
      return;
    }
    manualSetCalendar({ year, month, day });
  });

  manualSection.appendChild(manualBtn);
  statusCard.appendChild(manualSection);

  const dataSection = document.createElement("div");
  dataSection.className = "calendar-divider";
  const dataLabel = document.createElement("div");
  dataLabel.className = "calendar-section-label";
  dataLabel.textContent = "Data Management";
  dataSection.appendChild(dataLabel);

  const dataRow = document.createElement("div");
  dataRow.className = "flex gap-sm";

  const exportBtn = document.createElement("button");
  exportBtn.type = "button";
  exportBtn.className = "button";
  exportBtn.textContent = "Export JSON";
  exportBtn.addEventListener("click", () => {
    const payload = exportCalendarData();
    const json = JSON.stringify(payload, null, 2);
    const monthIndex = Math.max(0, Math.min(CALENDAR_MONTHS.length - 1, payload.clock.month));
    triggerDownload(`calendar-log-${payload.clock.year}-${CALENDAR_MONTHS[monthIndex]}.json`, json);
  });

  const importBtn = document.createElement("button");
  importBtn.type = "button";
  importBtn.className = "button";
  importBtn.textContent = "Import JSON";

  const importInput = document.createElement("input");
  importInput.type = "file";
  importInput.accept = "application/json";
  importInput.className = "visually-hidden";
  importInput.addEventListener("change", () => {
    const file = importInput.files?.[0];
    if (!file) return;
    file
      .text()
      .then((text) => {
          try {
            importCalendarData(text);
            showNotification({
              title: "Calendar import",
              message: "Calendar data imported.",
              variant: "success",
            });
          } catch (error) {
            showNotification({
              title: "Import failed",
              message: (error as Error).message,
              variant: "danger",
            });
          }
      })
      .finally(() => {
        importInput.value = "";
      });
  });

  importBtn.addEventListener("click", () => importInput.click());

  dataRow.append(exportBtn, importBtn, importInput);
  dataSection.appendChild(dataRow);
  statusCard.appendChild(dataSection);

  const trackersColumn = document.createElement("div");
  trackersColumn.className = "calendar-column";
  grid.appendChild(trackersColumn);

  const trackerPanel = document.createElement("section");
  trackerPanel.className = "panel compact calendar-card";

  const trackerHeading = document.createElement("div");
  trackerHeading.className = "panel-heading";
  trackerHeading.textContent = "Active Timers";
  trackerPanel.appendChild(trackerHeading);

  const trackerForm = document.createElement("div");
  trackerForm.className = "flex gap-sm";

  const trackerName = document.createElement("input");
  trackerName.type = "text";
  trackerName.placeholder = "Torch, spell, project...";
  trackerName.className = "input";

  const trackerDuration = document.createElement("input");
  trackerDuration.type = "number";
  trackerDuration.className = "input";
  trackerDuration.placeholder = "Duration";
  trackerDuration.min = "1";

  const trackerUnit = document.createElement("select");
  trackerUnit.className = "input";
  [
    { value: "turn", label: "Turns" },
    { value: "hour", label: "Hours" },
    { value: "day", label: "Days" },
    { value: "week", label: "Weeks" },
  ].forEach((entry) => {
    const option = document.createElement("option");
    option.value = entry.value;
    option.textContent = entry.label;
    trackerUnit.appendChild(option);
  });

  const trackerAddBtn = document.createElement("button");
  trackerAddBtn.type = "button";
  trackerAddBtn.className = "button";
  trackerAddBtn.textContent = "Add";
  trackerAddBtn.addEventListener("click", () => {
    if (!trackerName.value.trim()) {
      showNotification({
        title: "Tracker name required",
        message: "Enter a tracker name before adding.",
        variant: "warning",
      });
      return;
    }
    const duration = Number(trackerDuration.value);
    if (!Number.isFinite(duration) || duration <= 0) {
      showNotification({
        title: "Tracker duration required",
        message: "Enter a duration greater than zero.",
        variant: "warning",
      });
      return;
    }
    addCalendarTracker(trackerName.value, duration, trackerUnit.value as CalendarTrackerUnit);
    trackerName.value = "";
    trackerDuration.value = "";
  });

  trackerForm.append(trackerName, trackerDuration, trackerUnit, trackerAddBtn);
  trackerPanel.appendChild(trackerForm);

  const trackerList = document.createElement("div");
  trackerList.className = "calendar-trackers";
  trackerPanel.appendChild(trackerList);

  trackersColumn.appendChild(trackerPanel);

  const logPanel = document.createElement("section");
  logPanel.className = "panel compact calendar-card";

  const logHeading = document.createElement("div");
  logHeading.className = "panel-heading";
  logHeading.textContent = "Chronicle";
  logPanel.appendChild(logHeading);

  const logContainer = document.createElement("div");
  logContainer.className = "calendar-log";
  logPanel.appendChild(logContainer);

  const logActions = document.createElement("div");
  logActions.className = "flex gap-sm";
  const clearLogBtn = document.createElement("button");
  clearLogBtn.type = "button";
  clearLogBtn.className = "button danger";
  clearLogBtn.textContent = "Clear Log";
  clearLogBtn.addEventListener("click", () => {
    if (window.confirm("Clear all calendar log entries?")) {
      clearCalendarLog();
    }
  });
  logActions.appendChild(clearLogBtn);
  logPanel.appendChild(logActions);

  trackersColumn.appendChild(logPanel);

  function render(state: CalendarState) {
    dateEl.textContent = formatCalendarDate(state.clock);
    timeEl.textContent = formatCalendarTime(state.clock);
    seasonBadge.textContent = getCalendarSeason(state.clock);
    moonBadge.textContent = getCalendarMoonPhase(state.clock);
    yearInput.value = String(state.clock.year);
    monthSelect.value = String(state.clock.month);
    dayInput.value = String(state.clock.day);
    renderTrackers(trackerList, state.trackers);
    renderLog(logContainer, state);
  }

  render(getCalendarState());

  const unsubscribe = subscribeToCalendar(render);
  target.appendChild(element);

  return () => {
    unsubscribe();
  };
}

function renderTrackers(container: HTMLElement, trackers: CalendarTracker[]) {
  container.innerHTML = "";
  if (!trackers.length) {
    const empty = document.createElement("p");
    empty.className = "muted";
    empty.style.textAlign = "center";
    empty.textContent = "No active timers.";
    container.appendChild(empty);
    return;
  }

  trackers.forEach((tracker) => {
    const row = document.createElement("div");
    row.className = `calendar-tracker${tracker.remainingMinutes <= 0 ? " expired" : ""}`;

    const info = document.createElement("div");
    info.className = "calendar-tracker-info";

    const name = document.createElement("strong");
    name.textContent = tracker.name;
    info.appendChild(name);

    const remaining = document.createElement("span");
    remaining.className = "nav-meta";
    remaining.textContent =
      tracker.remainingMinutes <= 0 ? "Expired" : `${formatDuration(tracker.remainingMinutes)} remaining`;
    info.appendChild(remaining);

    const total = document.createElement("span");
    total.className = "nav-meta";
    total.textContent = `Duration ${formatDuration(tracker.initialMinutes)}`;
    info.appendChild(total);

    const removeBtn = document.createElement("button");
    removeBtn.type = "button";
    removeBtn.className = "button";
    removeBtn.textContent = "Dismiss";
    removeBtn.addEventListener("click", () => removeCalendarTracker(tracker.id));

    row.append(info, removeBtn);
    container.appendChild(row);
  });
}

function renderLog(container: HTMLElement, state: CalendarState) {
  container.innerHTML = "";
  if (!state.log.length) {
    const empty = document.createElement("p");
    empty.className = "muted";
    empty.style.textAlign = "center";
    empty.textContent = "Time stands still...";
    container.appendChild(empty);
    return;
  }

  state.log.forEach((entry) => {
    const item = document.createElement("div");
    item.className = "calendar-log-entry";

    const title = document.createElement("div");
    title.style.fontWeight = "600";
    title.textContent = entry.action;
    item.appendChild(title);

    if (entry.detail) {
      const detail = document.createElement("div");
      detail.className = "nav-meta";
      detail.textContent = entry.detail;
      item.appendChild(detail);
    }

    const timestamp = document.createElement("div");
    timestamp.className = "timestamp";
    timestamp.textContent = new Date(entry.timestamp).toLocaleString();
    item.appendChild(timestamp);

    container.appendChild(item);
  });
}

function handleAdvance(unit: CalendarAdvanceUnit, amount: number) {
  advanceCalendar(unit, amount);
}

function triggerDownload(filename: string, contents: string) {
  const blob = new Blob([contents], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

