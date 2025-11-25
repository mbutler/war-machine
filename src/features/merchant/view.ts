import { createPanel } from "../../layout/panels";
import { showNotification } from "../../layout/notifications";
import type { MerchantJourney, MerchantState } from "../../state/schema";
import {
  getMerchantState,
  makeJourney,
  recomputePreview,
  resetTreasury,
  subscribeToMerchant,
  undoLedgerEntry,
  updateMerchantField,
} from "./state";
import { TRADE_GOODS } from "./constants";
import "./merchant.css";

export function renderMerchantPanel(target: HTMLElement) {
  const { element, body } = createPanel("Merchant of Darokin", "Darokin trade simulator");

  const grid = document.createElement("div");
  grid.className = "merchant-grid";
  body.appendChild(grid);

  const manifestCard = document.createElement("section");
  manifestCard.className = "merchant-card";
  grid.appendChild(manifestCard);

  const routeCard = document.createElement("section");
  routeCard.className = "merchant-card";
  grid.appendChild(routeCard);

  const ledgerCard = document.createElement("section");
  ledgerCard.className = "merchant-card merchant-ledger";
  grid.appendChild(ledgerCard);

  const houseInput = createTextInput("Merchant House", (value) => updateMerchantField("houseName", value));
  const treasuryInput = createNumberInput("Treasury (gp)", 0, (value) => updateMerchantField("treasury", value));

  manifestCard.append(houseInput.wrapper, treasuryInput.wrapper);

  const tradeSelect = createSelect("Trade Good", Object.entries(TRADE_GOODS).map(([value, good]) => ({
    value,
    label: good.name,
  })), (value) => updateMerchantField("tradeGood", value as any));

  const cargoInput = createNumberInput("Cargo Value (gp)", 0, (value) => updateMerchantField("cargoValue", value));
  manifestCard.append(tradeSelect.wrapper, cargoInput.wrapper);

  const manifestSummary = document.createElement("div");
  manifestSummary.className = "merchant-preview-panel";
  manifestCard.appendChild(manifestSummary);

  const resetButton = document.createElement("button");
  resetButton.type = "button";
  resetButton.className = "button";
  resetButton.textContent = "Reset Treasury (10,000 gp)";
  resetButton.addEventListener("click", () => {
    if (window.confirm("Reset treasury to 10,000 gp?")) {
      resetTreasury(10000);
      showNotification({ title: "Treasury reset", message: "Merchant treasury restored to 10,000 gp.", variant: "success" });
    }
  });
  manifestCard.appendChild(resetButton);

  const originSelect = createSelect("Origin Terrain", terrainOptions(), (value) => updateMerchantField("originTerrain", value as any));
  const destinationSelect = createSelect("Destination Terrain", terrainOptions(), (value) => updateMerchantField("destinationTerrain", value as any));

  const distanceInput = createNumberInput("Distance (miles)", 0, (value) => updateMerchantField("distance", value));
  const transportSelect = createSelect("Transport", transportOptions(), (value) => updateMerchantField("transport", value as any));
  const guardSelect = createSelect("Guards", guardOptions(), (value) => updateMerchantField("guardLevel", value as any));
  const guildSelect = createSelect("Guild Status", guildOptions(), (value) => updateMerchantField("guildStatus", value as any));
  const borderSelect = createSelect("Border Crossings", borderOptions(), (value) => updateMerchantField("borderCrossings", Number(value)));
  const marketSelect = createSelect("Market Conditions", marketOptions(), (value) => updateMerchantField("marketCondition", value as any));

  routeCard.append(originSelect.wrapper, destinationSelect.wrapper, distanceInput.wrapper, transportSelect.wrapper, guardSelect.wrapper, guildSelect.wrapper, borderSelect.wrapper, marketSelect.wrapper);

  const marginBand = document.createElement("div");
  marginBand.className = "merchant-stat-band";
  const marginLabel = document.createElement("div");
  marginLabel.className = "stat-label";
  marginLabel.textContent = "Projected Margin";
  const marginValue = document.createElement("div");
  marginValue.className = "merchant-stat-value";
  marginValue.id = "merchant-margin";
  marginBand.append(marginLabel, marginValue);

  const marginDescription = document.createElement("div");
  marginDescription.className = "nav-meta";
  marginDescription.id = "merchant-margin-desc";
  marginBand.appendChild(marginDescription);

  routeCard.appendChild(marginBand);

  const makeJourneyButton = document.createElement("button");
  makeJourneyButton.type = "button";
  makeJourneyButton.className = "button";
  makeJourneyButton.textContent = "Make the Journey";
  makeJourneyButton.addEventListener("click", () => {
    try {
      const result = makeJourney();
      if (result) {
        showNotification({
          title: result.netProfit >= 0 ? "Profitable Voyage" : "Loss Recorded",
          message: `${result.eventSummary} (${result.marketSummary})`,
          variant: result.netProfit >= 0 ? "success" : "warning",
        });
      }
    } catch (error) {
      showNotification({ title: "Journey aborted", message: (error as Error).message, variant: "danger" });
    }
  });
  routeCard.appendChild(makeJourneyButton);

  const ledgerHeader = document.createElement("div");
  ledgerHeader.className = "panel-heading";
  ledgerHeader.textContent = "Trading Ledger";
  ledgerCard.appendChild(ledgerHeader);

  const ledgerList = document.createElement("div");
  ledgerList.className = "merchant-log";
  ledgerCard.appendChild(ledgerList);

  const state = getMerchantState();
  const bindings = bindForm(state, {
    houseInput,
    treasuryInput,
    tradeSelect,
    cargoInput,
    manifestSummary,
    originSelect,
    destinationSelect,
    distanceInput,
    transportSelect,
    guardSelect,
    guildSelect,
    borderSelect,
    marketSelect,
    marginValue,
    marginDescription,
  });
  renderLedger(state.ledger, ledgerList);

  const unsubscribe = subscribeToMerchant((merchant) => {
    syncForm(bindings, merchant);
    renderLedger(merchant.ledger, ledgerList);
  });

  target.appendChild(element);
  return () => unsubscribe();
}

function bindForm(state: MerchantState, controls: any) {
  controls.houseInput.input.value = state.form.houseName;
  controls.treasuryInput.input.value = String(state.form.treasury);
  controls.tradeSelect.select.value = state.form.tradeGood;
  controls.cargoInput.input.value = String(state.form.cargoValue);
  controls.originSelect.select.value = state.form.originTerrain;
  controls.destinationSelect.select.value = state.form.destinationTerrain;
  controls.distanceInput.input.value = String(state.form.distance);
  controls.transportSelect.select.value = state.form.transport;
  controls.guardSelect.select.value = state.form.guardLevel;
  controls.guildSelect.select.value = state.form.guildStatus;
  controls.borderSelect.select.value = String(state.form.borderCrossings);
  controls.marketSelect.select.value = state.form.marketCondition;

  controls.houseInput.input.addEventListener("change", () => updateMerchantField("houseName", controls.houseInput.input.value));
  controls.treasuryInput.input.addEventListener("change", () => updateMerchantField("treasury", Number(controls.treasuryInput.input.value)));
  controls.tradeSelect.select.addEventListener("change", () => updateMerchantField("tradeGood", controls.tradeSelect.select.value as any));
  controls.cargoInput.input.addEventListener("change", () => updateMerchantField("cargoValue", Number(controls.cargoInput.input.value)));
  controls.originSelect.select.addEventListener("change", () => updateMerchantField("originTerrain", controls.originSelect.select.value as any));
  controls.destinationSelect.select.addEventListener("change", () => updateMerchantField("destinationTerrain", controls.destinationSelect.select.value as any));
  controls.distanceInput.input.addEventListener("change", () => updateMerchantField("distance", Number(controls.distanceInput.input.value)));
  controls.transportSelect.select.addEventListener("change", () => updateMerchantField("transport", controls.transportSelect.select.value as any));
  controls.guardSelect.select.addEventListener("change", () => updateMerchantField("guardLevel", controls.guardSelect.select.value as any));
  controls.guildSelect.select.addEventListener("change", () => updateMerchantField("guildStatus", controls.guildSelect.select.value as any));
  controls.borderSelect.select.addEventListener("change", () => updateMerchantField("borderCrossings", Number(controls.borderSelect.select.value)));
  controls.houseInput.input.addEventListener("change", () => updateMerchantField("houseName", controls.houseInput.input.value));
  controls.treasuryInput.input.addEventListener("change", () => updateMerchantField("treasury", Number(controls.treasuryInput.input.value)));
  controls.tradeSelect.select.addEventListener("change", () => updateMerchantField("tradeGood", controls.tradeSelect.select.value as any));
  controls.cargoInput.input.addEventListener("change", () => updateMerchantField("cargoValue", Number(controls.cargoInput.input.value)));
  controls.originSelect.select.addEventListener("change", () => updateMerchantField("originTerrain", controls.originSelect.select.value as any));
  controls.destinationSelect.select.addEventListener("change", () => updateMerchantField("destinationTerrain", controls.destinationSelect.select.value as any));
  controls.distanceInput.input.addEventListener("change", () => updateMerchantField("distance", Number(controls.distanceInput.input.value)));
  controls.transportSelect.select.addEventListener("change", () => updateMerchantField("transport", controls.transportSelect.select.value as any));
  controls.guardSelect.select.addEventListener("change", () => updateMerchantField("guardLevel", controls.guardSelect.select.value as any));
  controls.guildSelect.select.addEventListener("change", () => updateMerchantField("guildStatus", controls.guildSelect.select.value as any));
  controls.borderSelect.select.addEventListener("change", () => updateMerchantField("borderCrossings", Number(controls.borderSelect.select.value)));
  controls.marketSelect.select.addEventListener("change", () => updateMerchantField("marketCondition", controls.marketSelect.select.value as any));

  recomputePreview();
  syncPreview(controls, state.preview);

  return controls;
}

function syncForm(controls: any, merchant: MerchantState) {
  controls.treasuryInput.input.value = String(merchant.form.treasury);
  syncPreview(controls, merchant.preview);
}

function renderPreviewDetails(preview: MerchantLogisticsPreview) {
  if (!preview.valid) {
    return `<div class="nav-meta">${preview.description}</div>`;
  }

  return `
    <div><strong>Units:</strong> ${preview.units} · <strong>Vehicles:</strong> ${preview.vehicles}</div>
    <div><strong>Transport:</strong> ${preview.transportCost} gp</div>
    <div><strong>Guards:</strong> ${preview.guardCost} gp</div>
    <div><strong>Border Tax:</strong> ${preview.borderTax} gp</div>
    <div><strong>Projected Sale:</strong> ${preview.salePrice} gp · Profit ${preview.profitGp} gp</div>
  `;
}

function syncPreview(controls: any, preview: MerchantLogisticsPreview) {
  controls.manifestSummary.innerHTML = renderPreviewDetails(preview);
  controls.marginValue.textContent = preview.valid ? `${preview.profitMargin > 0 ? "+" : ""}${preview.profitMargin}%` : "--";
  controls.marginValue.style.color = preview.valid && preview.profitMargin < 0 ? "#f87171" : "#4ade80";
  controls.marginDescription.textContent = preview.description;
}

function renderLedger(entries: MerchantJourney[], container: HTMLElement) {
  container.innerHTML = "";
  if (!entries.length) {
    const empty = document.createElement("p");
    empty.className = "muted";
    empty.textContent = "Transactions appear here...";
    empty.style.textAlign = "center";
    container.appendChild(empty);
    return;
  }

  entries.forEach((entry) => {
    const card = document.createElement("div");
    card.className = "merchant-log-entry";

    const header = document.createElement("div");
    header.style.display = "flex";
    header.style.justifyContent = "space-between";
    header.style.marginBottom = "0.35rem";
    const badge = document.createElement("span");
    badge.className = `merchant-badge ${entry.netProfit >= 0 ? "profit" : "loss"}`;
    badge.textContent = entry.netProfit >= 0 ? "Profit" : "Loss";
    const timestamp = document.createElement("span");
    timestamp.className = "timestamp";
    timestamp.textContent = new Date(entry.timestamp).toLocaleString();
    header.append(badge, timestamp);
    card.appendChild(header);

    const summary = document.createElement("div");
    summary.style.fontWeight = "600";
    summary.textContent = `${TRADE_GOODS[entry.tradeGood].name}`;
    card.appendChild(summary);

    const detail = document.createElement("div");
    detail.className = "nav-meta";
    detail.textContent = entry.eventSummary;
    card.appendChild(detail);

    const market = document.createElement("div");
    market.className = "nav-meta";
    market.style.color = entry.netProfit >= 0 ? "#4ade80" : "#fca5a5";
    market.textContent = entry.marketSummary;
    card.appendChild(market);

    const statRow = document.createElement("div");
    statRow.style.display = "grid";
    statRow.style.gridTemplateColumns = "1fr 1fr";
    statRow.style.gap = "0.4rem";
    statRow.style.marginTop = "0.35rem";

    statRow.appendChild(renderLedgerStat("Sale", `${entry.salePrice} gp`));
    statRow.appendChild(renderLedgerStat("Expenses", `${Math.round(entry.totalCosts)} gp`));
    card.appendChild(statRow);

    const net = document.createElement("div");
    net.style.textAlign = "right";
    net.style.marginTop = "0.4rem";
    net.style.fontWeight = "bold";
    net.style.color = entry.netProfit >= 0 ? "#4ade80" : "#f87171";
    net.textContent = `Net ${entry.netProfit >= 0 ? "+" : ""}${Math.round(entry.netProfit)} gp`;
    card.appendChild(net);

    const undo = document.createElement("button");
    undo.type = "button";
    undo.className = "button";
    undo.textContent = "Undo Transaction";
    undo.addEventListener("click", () => {
      undoLedgerEntry(entry.id);
      showNotification({ title: "Transaction reverted", message: "Treasury adjusted.", variant: "info" });
    });
    card.appendChild(undo);

    container.appendChild(card);
  });
}

function renderLedgerStat(label: string, value: string) {
  const wrapper = document.createElement("div");
  const lbl = document.createElement("div");
  lbl.className = "nav-meta";
  lbl.textContent = label;
  const val = document.createElement("div");
  val.textContent = value;
  wrapper.append(lbl, val);
  return wrapper;
}

function createTextInput(label: string, onChange: (value: string) => void) {
  const wrapper = document.createElement("div");
  wrapper.className = "input-group";
  const lbl = document.createElement("label");
  lbl.className = "label";
  lbl.textContent = label;
  const input = document.createElement("input");
  input.type = "text";
  input.className = "input";
  input.addEventListener("change", () => onChange(input.value));
  wrapper.append(lbl, input);
  return { wrapper, input };
}

function createNumberInput(label: string, min: number, setter: (value: number) => void) {
  const wrapper = document.createElement("div");
  wrapper.className = "input-group";
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
      return;
    }
    setter(value);
  });
  wrapper.append(lbl, input);
  return { wrapper, input };
}

function createSelect(
  label: string,
  options: Array<{ value: string | number; label: string }>,
  onChange: (value: string) => void,
) {
  const wrapper = document.createElement("div");
  wrapper.className = "input-group";
  const lbl = document.createElement("label");
  lbl.className = "label";
  lbl.textContent = label;
  const select = document.createElement("select");
  select.className = "input";
  options.forEach((option) => {
    const node = document.createElement("option");
    node.value = String(option.value);
    node.textContent = option.label;
    select.appendChild(node);
  });
  select.addEventListener("change", () => onChange(select.value));
  wrapper.append(lbl, select);
  return { wrapper, select };
}

function terrainOptions() {
  return [
    { value: "plains", label: "Plains" },
    { value: "forest", label: "Forest" },
    { value: "hills", label: "Hills" },
    { value: "mountains", label: "Mountains" },
    { value: "desert", label: "Desert" },
    { value: "swamp", label: "Swamp" },
    { value: "coast", label: "Coast" },
  ];
}

function transportOptions() {
  return [
    { value: "wagon", label: "Wagon Caravan" },
    { value: "ship", label: "Merchant Ship" },
    { value: "camel", label: "Camel Caravan" },
  ];
}

function guardOptions() {
  return [
    { value: "none", label: "No Guards" },
    { value: "light", label: "Light Guard (+10% cost)" },
    { value: "standard", label: "Standard (+25% cost)" },
    { value: "heavy", label: "Heavy Escort (+50% cost)" },
  ];
}

function guildOptions() {
  return [
    { value: "none", label: "Independent" },
    { value: "member", label: "Guild Member (-20% taxes)" },
    { value: "master", label: "Guild Master (-50% taxes)" },
  ];
}

function borderOptions() {
  return [
    { value: 0, label: "No Borders" },
    { value: 1, label: "1 Border" },
    { value: 2, label: "2 Borders" },
    { value: 3, label: "3+ Borders" },
  ];
}

function marketOptions() {
  return [
    { value: "normal", label: "Normal Market" },
    { value: "festival", label: "Festival (+20% demand)" },
    { value: "siege", label: "Siege/Shortage (+50% demand)" },
    { value: "oversupply", label: "Oversupply (-30% demand)" },
  ];
}

