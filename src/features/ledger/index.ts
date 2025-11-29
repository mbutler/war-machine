import { registerRoute } from "../../router";
import { renderLedgerPanel } from "./view";
import "./ledger.css";

registerRoute({
  id: "ledger",
  label: "Treasury Ledger",
  description: "Gold tracking & equipment shop",
  section: "Logistics",
  order: 1,
  mount(target) {
    return renderLedgerPanel(target);
  },
});

// Re-export state functions for use by other modules
export {
  getLedgerState,
  getLedgerBalance,
  subscribeToLedger,
  recordTransaction,
  recordIncome,
  recordExpense,
  recordLoot,
  recordTaxIncome,
  recordTradeProfit,
  recordEquipmentPurchase,
  recordEquipmentSale,
  recordConstructionPayment,
  recordResearchCost,
  recordWagePayment,
  recordSupplyPurchase,
  recordTithe,
  recordManualAdjustment,
  setLedgerBalance,
  canAfford,
  addRecurringExpense,
  removeRecurringExpense,
  toggleRecurringExpense,
  processRecurringExpenses,
  getTransactionsBySource,
  getTransactionsByCategory,
  getIncomeForPeriod,
  getExpensesForPeriod,
  exportLedgerData,
  importLedgerData,
  clearLedgerTransactions,
} from "./state";

// Re-export equipment functions
export {
  ALL_EQUIPMENT,
  CATEGORY_LABELS,
  getEquipmentById,
  getEquipmentByCategory,
  searchEquipment,
  getSaleValue,
  type EquipmentItem,
  type EquipmentCategory,
} from "./equipment";





