import type { MerchantState } from "./schema";

export const INITIAL_MERCHANT_STATE: MerchantState = {
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
  preview: {
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
    description: "",
  },
  ledger: [],
};

