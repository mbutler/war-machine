import { createPanel } from "../../layout/panels";
import { showNotification } from "../../layout/notifications";
import type { WildernessHex, WildernessState } from "../../state/schema";
import {
  canRefillWater,
  exportWildernessData,
  forageCurrentHex,
  getWildernessState,
  importWildernessData,
  moveParty,
  refillWater,
  resetWilderness,
  setCameraOffset,
  setClimate,
  setPartySize,
  setRations,
  setStartTerrain,
  setWater,
  subscribeToWilderness,
} from "./state";

const HEX_SIZE = 25;
const DIR_LABELS = ["↖", "↑", "↗", "↙", "↓", "↘"];
const TERRAIN_COST_LABELS: Record<string, string> = {
  clear: "6 Miles",
  woods: "9 Miles",
  hills: "9 Miles",
  mountain: "12 Miles",
  swamp: "12 Miles",
  desert: "12 Miles",
  city: "4 Miles",
  river: "6 Miles",
  ocean: "12 Miles",
};

export function renderWildernessPanel(target: HTMLElement) {
  const { element, body } = createPanel(
    "The Royal Cartographer",
    "BECMI wilderness surveying with travel clocks, weather, and hex encounters.",
  );

  const grid = document.createElement("div");
  grid.className = "wilderness-grid";
  body.appendChild(grid);

  const controlsCard = document.createElement("section");
  controlsCard.className = "wilderness-card";
  grid.appendChild(controlsCard);

  const mapCard = document.createElement("section");
  mapCard.className = "wilderness-card wilderness-map-card";
  grid.appendChild(mapCard);

  const detailsCard = document.createElement("section");
  detailsCard.className = "wilderness-card";
  grid.appendChild(detailsCard);

  // Controls: Quartermaster
  const partyRow = document.createElement("div");
  partyRow.className = "stat-grid";

  const partySizeInput = createNumberInput("Party Size", 1, (value) => setPartySize(value));
  const rationsInput = createNumberInput("Rations (Days)", 0, (value) => setRations(value));
  const waterInput = createNumberInput("Water (Skins)", 0, (value) => setWater(value));

  partyRow.append(partySizeInput.wrapper, rationsInput.wrapper, waterInput.wrapper);
  controlsCard.appendChild(partyRow);

  const timeBand = document.createElement("div");
  timeBand.style.background = "rgba(255,255,255,0.04)";
  timeBand.style.border = "1px solid var(--panel-border)";
  timeBand.style.borderRadius = "0.4rem";
  timeBand.style.padding = "0.5rem";
  timeBand.style.textAlign = "center";
  timeBand.style.fontSize = "0.85rem";
  controlsCard.appendChild(timeBand);

  const travelBlock = document.createElement("div");
  travelBlock.style.borderTop = "1px solid var(--panel-border)";
  travelBlock.style.paddingTop = "0.75rem";
  travelBlock.style.marginTop = "0.75rem";
  controlsCard.appendChild(travelBlock);

  const travelTitle = document.createElement("div");
  travelTitle.className = "panel-heading";
  travelTitle.textContent = "Travel";
  travelBlock.appendChild(travelTitle);

  const dpad = document.createElement("div");
  dpad.className = "wilderness-dpad";
  travelBlock.appendChild(dpad);

  DIR_LABELS.forEach((label, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "button";
    button.textContent = label;
    button.addEventListener("click", () => moveParty(index));
    dpad.appendChild(button);
  });

  const actionRow = document.createElement("div");
  actionRow.className = "flex gap-sm";
  actionRow.style.flexWrap = "wrap";
  actionRow.style.marginTop = "0.5rem";

  const forageButton = document.createElement("button");
  forageButton.type = "button";
  forageButton.className = "button";
  forageButton.textContent = "Hunt / Forage";
  forageButton.style.flex = "1";
  forageButton.addEventListener("click", () => forageCurrentHex());

  const refillButton = document.createElement("button");
  refillButton.type = "button";
  refillButton.className = "button";
  refillButton.textContent = "Refill Water";
  refillButton.style.flex = "1";
  refillButton.addEventListener("click", () => refillWater());

  actionRow.append(forageButton, refillButton);
  travelBlock.appendChild(actionRow);

  const generatorBlock = document.createElement("div");
  generatorBlock.style.marginTop = "auto";
  generatorBlock.style.borderTop = "1px solid var(--panel-border)";
  generatorBlock.style.paddingTop = "0.75rem";
  controlsCard.appendChild(generatorBlock);

  const startSelect = document.createElement("select");
  startSelect.className = "input";
  [
    { value: "clear", label: "Start: Clear" },
    { value: "woods", label: "Start: Woods" },
    { value: "mountain", label: "Start: Mountain" },
    { value: "city", label: "Start: City" },
  ].forEach((option) => {
    const node = document.createElement("option");
    node.value = option.value;
    node.textContent = option.label;
    startSelect.appendChild(node);
  });
  startSelect.addEventListener("change", () => setStartTerrain(startSelect.value as any));

  const climateSelect = document.createElement("select");
  climateSelect.className = "input";
  [
    { value: "normal", label: "Climate: Temperate" },
    { value: "cold", label: "Climate: Cold" },
    { value: "tropic", label: "Climate: Tropical" },
    { value: "desert", label: "Climate: Arid" },
  ].forEach((option) => {
    const node = document.createElement("option");
    node.value = option.value;
    node.textContent = option.label;
    climateSelect.appendChild(node);
  });
  climateSelect.addEventListener("change", () => setClimate(climateSelect.value as any));

  generatorBlock.append(startSelect, climateSelect);

  const generatorButtons = document.createElement("div");
  generatorButtons.className = "flex gap-sm";
  generatorButtons.style.marginTop = "0.5rem";

  const newMapButton = document.createElement("button");
  newMapButton.type = "button";
  newMapButton.className = "button";
  newMapButton.textContent = "New Map";
  newMapButton.addEventListener("click", () => {
    resetWilderness({ startTerrain: startSelect.value as any, climate: climateSelect.value as any });
    showNotification({ title: "Wilderness reset", message: "New map generated.", variant: "success" });
  });

  const exportButton = document.createElement("button");
  exportButton.type = "button";
  exportButton.className = "button";
  exportButton.textContent = "Export Map";
  exportButton.addEventListener("click", () => {
    const payload = exportWildernessData();
    triggerDownload(`wilderness-map-day${Math.floor(getWildernessState().days)}.json`, payload);
  });

  generatorButtons.append(newMapButton, exportButton);
  generatorBlock.appendChild(generatorButtons);

  const importLabel = document.createElement("label");
  importLabel.className = "button";
  importLabel.style.marginTop = "0.5rem";
  importLabel.style.display = "inline-block";
  importLabel.style.textAlign = "center";
  importLabel.textContent = "Import Map (JSON)";

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
          importWildernessData(text);
          showNotification({ title: "Map imported", message: "Wilderness map loaded.", variant: "success" });
        } catch (error) {
          showNotification({ title: "Import failed", message: (error as Error).message, variant: "danger" });
        }
      })
      .finally(() => {
        importInput.value = "";
      });
  });
  importLabel.appendChild(importInput);
  generatorBlock.appendChild(importLabel);

  // Map column
  const mapWrapper = document.createElement("div");
  mapWrapper.className = "wilderness-map-wrapper";
  mapCard.appendChild(mapWrapper);

  const canvas = document.createElement("canvas");
  canvas.width = 640;
  canvas.height = 520;
  mapWrapper.appendChild(canvas);

  const coordsBadge = document.createElement("div");
  coordsBadge.className = "wilderness-map-meta";
  coordsBadge.textContent = "0, 0";
  mapWrapper.appendChild(coordsBadge);

  const recenterBtn = document.createElement("button");
  recenterBtn.type = "button";
  recenterBtn.className = "button wilderness-recenter";
  recenterBtn.textContent = "Center on Party";
  recenterBtn.addEventListener("click", () => setCameraOffset({ x: 0, y: 0 }));
  mapWrapper.appendChild(recenterBtn);

  // Details column
  const weatherBox = document.createElement("div");
  weatherBox.className = "wilderness-weather";
  detailsCard.appendChild(weatherBox);

  const weatherHeader = document.createElement("div");
  weatherHeader.className = "panel-heading";
  weatherHeader.textContent = "Daily Weather";
  weatherBox.prepend(weatherHeader);

  const tempRow = createWeatherRow("Temp");
  const windRow = createWeatherRow("Wind");
  const rainRow = createWeatherRow("Precip");
  weatherBox.append(tempRow.row, windRow.row, rainRow.row);

  const statGrid = document.createElement("div");
  statGrid.className = "wilderness-stat-grid";
  detailsCard.appendChild(statGrid);

  const terrainStat = createStatBlock("Terrain", "--");
  const costStat = createStatBlock("Travel Cost", "1 Day");
  statGrid.append(terrainStat.block, costStat.block);

  const resourcePanel = document.createElement("div");
  resourcePanel.className = "wilderness-resources";
  detailsCard.appendChild(resourcePanel);

  const resourceTitle = document.createElement("div");
  resourceTitle.className = "label";
  resourceTitle.textContent = "Dominion Resources";
  resourcePanel.appendChild(resourceTitle);

  const resourceList = document.createElement("div");
  resourcePanel.appendChild(resourceList);

  const logContainer = document.createElement("div");
  logContainer.className = "wilderness-log";
  detailsCard.appendChild(logContainer);

  const logHeading = document.createElement("div");
  logHeading.className = "panel-heading";
  logHeading.textContent = "Survey Log";
  logContainer.appendChild(logHeading);

  const logList = document.createElement("div");
  logContainer.appendChild(logList);

  let ctx: CanvasRenderingContext2D | null = null;
  try {
    ctx = canvas.getContext("2d");
  } catch {
    ctx = null;
  }

  let cameraOffset = { x: 0, y: 0 };
  let isDragging = false;
  let activePointerId: number | null = null;
  let lastPointer = { x: 0, y: 0 };

  canvas.addEventListener("pointerdown", (event) => {
    isDragging = true;
    activePointerId = event.pointerId;
    lastPointer = { x: event.clientX, y: event.clientY };
    canvas.setPointerCapture(event.pointerId);
    event.preventDefault();
  });

  const stopDragging = () => {
    if (activePointerId !== null) {
      try {
        canvas.releasePointerCapture(activePointerId);
      } catch {
        // ignore release failures
      }
    }
    activePointerId = null;
    isDragging = false;
  };

  canvas.addEventListener("pointermove", (event) => {
    if (!isDragging) return;
    const dx = event.clientX - lastPointer.x;
    const dy = event.clientY - lastPointer.y;
    lastPointer = { x: event.clientX, y: event.clientY };
    cameraOffset = {
      x: cameraOffset.x + dx,
      y: cameraOffset.y + dy,
    };
    setCameraOffset({ ...cameraOffset });
    event.preventDefault();
  });

  canvas.addEventListener("pointerup", stopDragging);
  canvas.addEventListener("pointerleave", stopDragging);
  canvas.addEventListener("pointercancel", stopDragging);

  function render(state: WildernessState) {
    partySizeInput.input.value = String(state.partySize);
    rationsInput.input.value = String(state.rations);
    waterInput.input.value = String(state.water);
    startSelect.value = state.startTerrain;
    climateSelect.value = state.climate;
    refillButton.disabled = !canRefillWater(state);

    const milesDisplay = `${state.days} days, ${Math.floor(state.movementPoints)}/${state.maxMovementPoints} Miles`;
    timeBand.textContent = milesDisplay;

    const position = Number.isFinite(state.currentPos?.q)
      ? (state.currentPos as { q: number; r: number })
      : { q: 0, r: 0 };
    const map = state.map ?? {};
    const currentHex = map[`${position.q},${position.r}`];
    coordsBadge.textContent = `${position.q}, ${position.r}`;
    if (currentHex) {
      terrainStat.value.textContent = currentHex.feature ?? getTerrainName(currentHex.type);
      terrainStat.value.style.color = getTerrainColor(currentHex);
      costStat.value.textContent = TERRAIN_COST_LABELS[currentHex.type] ?? `${getTerrainCost(currentHex.type)} Miles`;
      renderResources(currentHex, resourceList);
    } else {
      terrainStat.value.textContent = "--";
      terrainStat.value.style.color = "var(--text-primary)";
      costStat.value.textContent = "--";
    }

    const weather = state.weather ?? { temperature: "Moderate", wind: "Breeze", precipitation: "None" };
    tempRow.value.textContent = weather.temperature;
    windRow.value.textContent = weather.wind;
    rainRow.value.textContent = weather.precipitation;

    renderLog(state, logList);
    cameraOffset = state.camera ?? { x: 0, y: 0 };
    drawMap(ctx, { ...state, currentPos: position, map, weather, camera: cameraOffset }, canvas);
  }

  render(getWildernessState());
  const unsubscribe = subscribeToWilderness(render);
  target.appendChild(element);

  return () => {
    unsubscribe();
  };
}

function createNumberInput(
  label: string,
  min: number,
  setter: (value: number) => void,
): { wrapper: HTMLDivElement; input: HTMLInputElement } {
  const wrapper = document.createElement("div");
  wrapper.className = "flex flex-col gap-sm";
  const lbl = document.createElement("label");
  lbl.className = "label";
  lbl.textContent = label;
  const input = document.createElement("input");
  input.type = "number";
  input.min = String(min);
  input.className = "input";
  input.addEventListener("change", () => {
    const value = Number(input.value);
    if (Number.isNaN(value)) {
      setter(min);
      input.value = String(min);
    } else {
      setter(value);
    }
  });
  wrapper.append(lbl, input);
  return { wrapper, input };
}

function createWeatherRow(label: string) {
  const row = document.createElement("div");
  row.className = "wilderness-weather-row";
  const left = document.createElement("span");
  left.textContent = label;
  const value = document.createElement("span");
  value.style.color = "var(--text-primary)";
  row.append(left, value);
  return { row, value };
}

function createStatBlock(label: string, initial: string) {
  const block = document.createElement("div");
  block.className = "wilderness-stat";
  const lbl = document.createElement("div");
  lbl.className = "stat-label";
  lbl.textContent = label;
  const value = document.createElement("div");
  value.className = "stat-value";
  value.textContent = initial;
  block.append(lbl, value);
  return { block, value };
}

function renderResources(hex: WildernessHex, container: HTMLElement) {
  container.innerHTML = "";
  if (hex.feature) {
    const feature = document.createElement("div");
    feature.style.color = "#fbbf24";
    feature.style.fontWeight = "bold";
    feature.textContent = hex.feature;
    container.appendChild(feature);
    if (hex.details) {
      const details = document.createElement("div");
      details.className = "nav-meta";
      details.textContent = hex.details;
      container.appendChild(details);
    }
  } else {
    const empty = document.createElement("div");
    empty.className = "nav-meta";
    empty.textContent = "Wilderness hex";
    container.appendChild(empty);
  }

  if (hex.resources.length) {
    hex.resources.forEach((resource) => {
      const row = document.createElement("div");
      row.textContent = `• ${resource} resource`;
      container.appendChild(row);
    });
  } else {
    const none = document.createElement("div");
    none.textContent = "No resources.";
    container.appendChild(none);
  }
}

function renderLog(state: WildernessState, container: HTMLElement) {
  container.innerHTML = "";
  const entries = Array.isArray(state.log) ? state.log : [];
  if (!entries.length) {
    const empty = document.createElement("p");
    empty.className = "muted";
    empty.style.textAlign = "center";
    empty.textContent = "Survey log is empty...";
    container.appendChild(empty);
    return;
  }

  entries.forEach((entry) => {
    const item = document.createElement("div");
    item.className = "wilderness-log-entry";

    const meta = document.createElement("div");
    meta.className = "timestamp";
    meta.textContent = `Day ${entry.day.toFixed(1)} [${entry.position.q},${entry.position.r}]`;

    const summary = document.createElement("div");
    summary.style.color = "var(--text-primary)";
    summary.textContent = entry.summary;

    item.append(meta, summary);

    if (entry.notes) {
      const notes = document.createElement("div");
      notes.className = "nav-meta";
      notes.style.color = "#fca5a5";
      notes.textContent = entry.notes;
      item.appendChild(notes);
    }

    container.appendChild(item);
  });
}

function drawMap(ctx: CanvasRenderingContext2D | null, state: WildernessState, canvas: HTMLCanvasElement) {
  if (!ctx) return;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const camera = state.camera ?? { x: 0, y: 0 };
  const center = axialToBase(state.currentPos.q, state.currentPos.r);
  const offsetX = canvas.width / 2 - center.x + camera.x;
  const offsetY = canvas.height / 2 - center.y + camera.y;

  const entries = state.map ? Object.entries(state.map) : [];
  entries.forEach(([key, hex]) => {
    const [q, r] = key.split(",").map(Number);
    const base = axialToBase(q, r);
    const x = base.x + offsetX;
    const y = base.y + offsetY;
    if (isOnScreen(x, y, canvas)) {
      drawHexagon(ctx, x, y, hex);
      if (hex.feature) {
        ctx.beginPath();
        ctx.arc(x, y + 10, 3, 0, Math.PI * 2);
        ctx.fillStyle = "#fff";
        ctx.fill();
      }
    }
  });

  const playerBase = axialToBase(state.currentPos.q, state.currentPos.r);
  const px = playerBase.x + offsetX;
  const py = playerBase.y + offsetY;
  ctx.beginPath();
  ctx.arc(px, py, 8, 0, Math.PI * 2);
  ctx.fillStyle = "#ef4444";
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = "#fff";
  ctx.stroke();
}

function axialToBase(q: number, r: number) {
  const x = HEX_SIZE * 1.5 * q;
  const y = HEX_SIZE * Math.sqrt(3) * (r + 0.5 * (Math.abs(q) % 2));
  return { x, y };
}

function drawHexagon(ctx: CanvasRenderingContext2D, x: number, y: number, hex: WildernessHex) {
  ctx.beginPath();
  for (let i = 0; i < 6; i += 1) {
    const angle = (Math.PI / 3) * i;
    const x_i = x + HEX_SIZE * Math.cos(angle);
    const y_i = y + HEX_SIZE * Math.sin(angle);
    if (i === 0) ctx.moveTo(x_i, y_i);
    else ctx.lineTo(x_i, y_i);
  }
  ctx.closePath();
  ctx.fillStyle = getTerrainColor(hex);
  ctx.fill();
  ctx.strokeStyle = "#1e293b";
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.fillStyle = "rgba(0,0,0,0.25)";
  ctx.font = "9px monospace";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(hex.visited ? "" : "?", x, y);
}

function isOnScreen(x: number, y: number, canvas: HTMLCanvasElement) {
  return x > -80 && x < canvas.width + 80 && y > -80 && y < canvas.height + 80;
}

const terrainColors: Record<WildernessHex["type"], string> = {
  clear: "#86efac",
  woods: "#15803d",
  hills: "#a1a1aa",
  mountain: "#52525b",
  swamp: "#047857",
  desert: "#fdba74",
  city: "#fcd34d",
  river: "#3b82f6",
  ocean: "#1e3a8a",
};

const terrainNames: Record<WildernessHex["type"], string> = {
  clear: "Clear",
  woods: "Woods",
  hills: "Hills",
  mountain: "Mountain",
  swamp: "Swamp",
  desert: "Desert",
  city: "Settlement",
  river: "River",
  ocean: "Ocean",
};

const terrainCosts: Record<WildernessHex["type"], number> = {
  clear: 6,
  woods: 9,
  hills: 9,
  mountain: 12,
  swamp: 12,
  desert: 12,
  city: 4,
  river: 6,
  ocean: 12,
};

function normalizeTerrainType(type?: string | null): WildernessHex["type"] | null {
  if (!type) return null;
  const key = type.toLowerCase() as WildernessHex["type"];
  return key in terrainColors ? key : null;
}

function getTerrainColor(hex: WildernessHex) {
  const normalized = normalizeTerrainType(hex?.type);
  if (normalized) {
    return terrainColors[normalized];
  }
  if (hex?.color) {
    return hex.color;
  }
  return "#86efac";
}

function getTerrainName(type: WildernessHex["type"]) {
  const normalized = normalizeTerrainType(type);
  return normalized ? terrainNames[normalized] : "Wilderness";
}

function getTerrainCost(type: WildernessHex["type"]) {
  const normalized = normalizeTerrainType(type);
  return normalized ? terrainCosts[normalized] : 6;
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

