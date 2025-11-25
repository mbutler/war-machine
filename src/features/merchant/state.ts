import { createId } from "../../utils/id";
import type {
  GuildStatus,
  GuardLevel,
  MarketCondition,
  MerchantJourney,
  MerchantLogisticsPreview,
  MerchantState,
  TerrainKey,
  TradeGoodKey,
  TransportType,
} from "../../state/schema";
import { getState, subscribe, updateState } from "../../state/store";
import { TRADE_GOODS, TRANSPORT_CAPACITY, GUARD_COSTS, GUILD_REDUCTION } from "./constants";

export type MerchantListener = (state: MerchantState) => void;

const BASE_BORDER_TAX = 0.1;

export function getMerchantState(): MerchantState {
  return sanitizeMerchantState(getState().merchant);
}

export function subscribeToMerchant(listener: MerchantListener): () => void {
  return subscribe((state) => listener(sanitizeMerchantState(state.merchant)));
}

export function updateMerchantField<T extends keyof MerchantState["form"]>(
  field: T,
  value: MerchantState["form"][T],
) {
  updateState((state) => {
    state.merchant.form[field] = value;
  });
  recomputePreview();
}

export function recomputePreview() {
  updateState((state) => {
    state.merchant.preview = calculatePreview(state.merchant.form);
  });
}

export function resetTreasury(amount = 10000) {
  updateState((state) => {
    state.merchant.form.treasury = amount;
    state.merchant.ledger = [];
  });
  recomputePreview();
}

export function undoLedgerEntry(entryId: string) {
  updateState((state) => {
    const entry = state.merchant.ledger.find((journey) => journey.id === entryId);
    if (!entry) return;
    state.merchant.ledger = state.merchant.ledger.filter((journey) => journey.id !== entryId);
    state.merchant.form.treasury -= entry.netProfit;
  });
}

export function makeJourney(): MerchantJourney | null {
  let journey: MerchantJourney | null = null;

  updateState((state) => {
    const merchant = sanitizeMerchantState(state.merchant);
    state.merchant = merchant;
    const { form } = merchant;
    if (form.cargoValue <= 0 || form.cargoValue > form.treasury) {
      throw new Error("Insufficient treasury for this cargo value.");
    }

    const preview = calculatePreview(form);
    if (!preview.valid) {
      throw new Error("Unable to compute logistics; check inputs.");
    }

    const eventOutcome = simulateJourney(form, preview);
    const netProfit = eventOutcome.netProfit;
    state.merchant.form.treasury += netProfit;

    journey = {
      id: createId(),
      timestamp: Date.now(),
      tradeGood: form.tradeGood,
      cargoValue: form.cargoValue,
      salePrice: eventOutcome.finalSalePrice,
      totalCosts: eventOutcome.totalExpenses,
      netProfit,
      eventSummary: eventOutcome.eventMsg,
      marketSummary: eventOutcome.marketMsg,
      details: eventOutcome.detailMsg,
    };

    state.merchant.ledger.unshift(journey);
    state.merchant.preview = calculatePreview(form);
  });

  return journey;
}

function calculatePreview(form: MerchantState["form"]): MerchantLogisticsPreview {
  if (!form || form.cargoValue <= 0) {
    return invalidPreview("Enter cargo value > 0.");
  }
  const good = TRADE_GOODS[form.tradeGood];
  if (!good) {
    return invalidPreview("Unknown trade good.");
  }

  const capacity = TRANSPORT_CAPACITY[form.transport];
  if (!capacity) {
    return invalidPreview("Unknown transport type.");
  }

  const baselineUnits = Math.ceil(form.cargoValue / good.baseValue);
  const vehicles = Math.max(1, Math.ceil((baselineUnits * 10) / capacity));
  const transportCost = vehicles * (form.transport === "wagon" ? 100 : form.transport === "ship" ? 500 : 50);
  const guardCost = form.cargoValue * (GUARD_COSTS[form.guardLevel] ?? 0);

  const taxRate = BASE_BORDER_TAX * (1 - (GUILD_REDUCTION[form.guildStatus] ?? 0));
  const borderTax = form.cargoValue * taxRate * Math.max(0, form.borderCrossings);

  const originMod = good.demandMod[form.originTerrain] ?? 1;
  const destinationMod = good.demandMod[form.destinationTerrain] ?? 1;
  let demandModifier = destinationMod / originMod;

  if (form.marketCondition === "festival") demandModifier *= 1.2;
  else if (form.marketCondition === "siege") demandModifier *= 1.5;
  else if (form.marketCondition === "oversupply") demandModifier *= 0.7;

  const distanceBonus = Math.max(0, (form.distance - 50) / 1000);
  demandModifier += distanceBonus;

  const salePrice = Math.floor(form.cargoValue * demandModifier);
  const totalCosts = transportCost + guardCost + borderTax;
  const profit = salePrice - form.cargoValue - totalCosts;
  const margin = form.cargoValue > 0 ? Math.round((profit / form.cargoValue) * 100) : 0;

  return {
    valid: true,
    units: baselineUnits,
    vehicles,
    transportCost: Math.round(transportCost),
    guardCost: Math.round(guardCost),
    borderTax: Math.round(borderTax),
    demandModifier,
    salePrice,
    profitMargin: margin,
    profitGp: profit,
    description: `${form.destinationTerrain} demand ${(demandModifier * 100).toFixed(0)}%`,
  };
}

function simulateJourney(form: MerchantState["form"], preview: MerchantLogisticsPreview) {
  const cargoValue = form.cargoValue;
  let cargoMultiplier = 1;
  let eventMsg = "Uneventful journey.";
  let eventCost = 0;
  let detailMsg = "";

  let baseRisk = form.transport === "ship" ? 10 : form.transport === "camel" ? 20 : 15;
  if (form.guardLevel === "light") baseRisk -= 5;
  else if (form.guardLevel === "standard") baseRisk -= 10;
  else if (form.guardLevel === "heavy") baseRisk -= 20;
  baseRisk = Math.max(0, baseRisk);

  const eventRoll = randomRange(1, 100);
  if (eventRoll <= baseRisk) {
    const events = [
      { msg: "Bandits attacked! Lost some cargo.", loss: 0.2, cost: cargoValue * 0.1 },
      { msg: "Storm damaged goods.", loss: 0.15, cost: 0 },
      { msg: "Customs inspection. Bribe required.", loss: 0, cost: cargoValue * 0.05 },
      { msg: "Animals died. Transport delayed.", loss: 0.1, cost: preview.transportCost * 0.2 },
      { msg: "Cargo spoiled in heat/cold.", loss: 0.25, cost: 0 },
      { msg: "Major disaster! Heavy losses.", loss: 0.5, cost: cargoValue * 0.2 },
    ];
    const event = events[randomRange(0, events.length - 1)];
    eventMsg = event.msg;
    cargoMultiplier -= event.loss;
    eventCost += event.cost;

    if (form.guildStatus !== "none" && eventMsg.includes("Customs")) {
      eventCost *= form.guildStatus === "member" ? 0.5 : 0.2;
      eventMsg += " (Guild assistance)";
    }
  } else if (eventRoll >= 90) {
    eventMsg = "Excellent journey! Bonus profit.";
    cargoMultiplier += 0.1;
    eventCost -= preview.transportCost * 0.1;
  }

  const marketRoll = rollDice("2d6");
  let marketModifier = 1;
  let marketMsg = "Normal market conditions";
  if (marketRoll <= 4) {
    marketModifier = 0.7;
    marketMsg = "Poor market - low prices";
  } else if (marketRoll <= 6) {
    marketModifier = 0.85;
    marketMsg = "Slow market";
  } else if (marketRoll <= 9) {
    marketModifier = 1;
    marketMsg = "Normal market";
  } else if (marketRoll <= 11) {
    marketModifier = 1.2;
    marketMsg = "Good market";
  } else {
    marketModifier = 1.5;
    marketMsg = "Boom market! High demand";
  }

  if (form.marketCondition === "festival") {
    marketModifier *= 1.2;
    marketMsg += " (Festival bonus)";
  } else if (form.marketCondition === "siege") {
    marketModifier *= 1.5;
    marketMsg += " (Shortage bonus)";
  } else if (form.marketCondition === "oversupply") {
    marketModifier *= 0.7;
    marketMsg += " (Oversupply penalty)";
  }

  const finalCargo = Math.max(0, Math.floor(cargoValue * cargoMultiplier));
  const finalSalePrice = Math.max(0, Math.floor(preview.salePrice * marketModifier));
  const totalExpenses = preview.transportCost + preview.guardCost + preview.borderTax + eventCost;
  const netProfit = finalSalePrice - cargoValue - totalExpenses;

  detailMsg = `Cargo sold for ${finalSalePrice} gp. Expenses ${Math.round(totalExpenses)} gp.`;

  return {
    finalCargo,
    finalSalePrice,
    totalExpenses,
    netProfit,
    eventMsg,
    marketMsg,
    detailMsg,
  };
}

function invalidPreview(description: string): MerchantLogisticsPreview {
  return {
    valid: false,
    units: 0,
    vehicles: 0,
    transportCost: 0,
    guardCost: 0,
    borderTax: 0,
    demandModifier: 1,
    salePrice: 0,
    profitMargin: 0,
    profitGp: 0,
    description,
  };
}

function randomRange(min: number, max: number): number {
  if (max <= min) return min;
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function rollDice(input: string): number {
  const match = input.match(/(\d+)d(\d+)([+-]\d+)?/);
  if (!match) return parseInt(input, 10) || 1;
  const count = parseInt(match[1], 10);
  const sides = parseInt(match[2], 10);
  const mod = match[3] ? parseInt(match[3], 10) : 0;
  let total = 0;
  for (let i = 0; i < count; i += 1) {
    total += randomRange(1, sides);
  }
  return Math.max(1, total + mod);
}

function sanitizeMerchantState(state: MerchantState | undefined): MerchantState {
  if (
    !state ||
    !state.form ||
    typeof state.form.houseName !== "string" ||
    typeof state.form.treasury !== "number"
  ) {
    return {
      form: {
        houseName: "House Linton",
        treasury: 10000,
        tradeGood: "food",
        cargoValue: 2000,
        originTerrain: "plains",
        destinationTerrain: "mountains",
        distance: 100,
        transport: "wagon",
        guardLevel: "standard",
        guildStatus: "none",
        borderCrossings: 0,
        marketCondition: "normal",
      },
      preview: invalidPreview("Enter cargo value > 0."),
      ledger: [],
    };
  }

  return {
    form: {
      ...state.form,
    },
    preview: state.preview ?? invalidPreview("Enter cargo value > 0."),
    ledger: Array.isArray(state.ledger) ? state.ledger : [],
  };
}

