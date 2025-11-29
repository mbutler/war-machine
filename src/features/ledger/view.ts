import type { LedgerState, LedgerTransaction, LedgerRecurringExpense } from "../../state/schema";
import { createPanel } from "../../layout/panels";
import { showNotification } from "../../layout/notifications";
import {
  getLedgerState,
  subscribeToLedger,
  recordManualAdjustment,
  recordEquipmentPurchase,
  recordEquipmentSale,
  removeRecurringExpense,
  toggleRecurringExpense,
  clearLedgerTransactions,
  canAfford,
  exportLedgerData,
  importLedgerData,
} from "./state";
import {
  ALL_EQUIPMENT,
  CATEGORY_LABELS,
  getEquipmentByCategory,
  getSaleValue,
  searchEquipment,
  type EquipmentCategory,
  type EquipmentItem,
} from "./equipment";

type TabId = "transactions" | "shop" | "recurring";

const CATEGORY_ORDER: EquipmentCategory[] = [
  "weapons_melee",
  "weapons_missile",
  "ammunition",
  "armor",
  "shields",
  "clothing",
  "containers",
  "provisions",
  "light_sources",
  "tools",
  "transport",
  "animals",
  "services",
  "lodging",
];

export function renderLedgerPanel(target: HTMLElement) {
  const { element, body } = createPanel(
    "Treasury Ledger",
    "Track all gold income and expenses, buy and sell equipment.",
  );
  element.classList.add("ledger-shell");

  const grid = document.createElement("div");
  grid.className = "ledger-grid";
  body.appendChild(grid);

  // Left Column - Balance & Controls
  const leftColumn = document.createElement("div");
  leftColumn.className = "ledger-column";
  grid.appendChild(leftColumn);

  // Balance Card
  const balanceCard = document.createElement("section");
  balanceCard.className = "panel compact ledger-balance-card";
  leftColumn.appendChild(balanceCard);

  const balanceLabel = document.createElement("div");
  balanceLabel.className = "ledger-balance-label";
  balanceLabel.textContent = "Treasury Balance";
  balanceCard.appendChild(balanceLabel);

  const balanceAmount = document.createElement("div");
  balanceAmount.className = "ledger-balance-amount";
  balanceCard.appendChild(balanceAmount);

  // Manual Adjustment Form
  const manualSection = document.createElement("div");
  manualSection.style.marginTop = "var(--space-lg)";

  const manualLabel = document.createElement("div");
  manualLabel.className = "ledger-balance-label";
  manualLabel.style.textAlign = "left";
  manualLabel.textContent = "Manual Adjustment";
  manualSection.appendChild(manualLabel);

  const manualForm = document.createElement("div");
  manualForm.className = "ledger-manual-form";

  const amountInput = document.createElement("input");
  amountInput.type = "number";
  amountInput.className = "input";
  amountInput.placeholder = "Amount (+/-)";

  const descInput = document.createElement("input");
  descInput.type = "text";
  descInput.className = "input";
  descInput.placeholder = "Description";

  const addBtn = document.createElement("button");
  addBtn.type = "button";
  addBtn.className = "button";
  addBtn.textContent = "Add";
  addBtn.addEventListener("click", () => {
    const amount = parseFloat(amountInput.value);
    const desc = descInput.value.trim();
    if (!Number.isFinite(amount) || amount === 0) {
      showNotification({ title: "Invalid amount", message: "Enter a non-zero number.", variant: "warning" });
      return;
    }
    if (!desc) {
      showNotification({ title: "Description required", message: "Enter a description.", variant: "warning" });
      return;
    }
    recordManualAdjustment(amount, desc);
    amountInput.value = "";
    descInput.value = "";
    showNotification({
      title: amount > 0 ? "Gold added" : "Gold deducted",
      message: `${Math.abs(amount)} gp: ${desc}`,
      variant: amount > 0 ? "success" : "warning",
    });
  });

  manualForm.append(amountInput, descInput, addBtn);
  manualSection.appendChild(manualForm);
  balanceCard.appendChild(manualSection);

  // Data Management
  const dataSection = document.createElement("div");
  dataSection.style.marginTop = "var(--space-lg)";

  const dataLabel = document.createElement("div");
  dataLabel.className = "ledger-balance-label";
  dataLabel.style.textAlign = "left";
  dataLabel.textContent = "Data Management";
  dataSection.appendChild(dataLabel);

  const dataRow = document.createElement("div");
  dataRow.className = "ledger-quick-actions";

  const exportBtn = document.createElement("button");
  exportBtn.type = "button";
  exportBtn.className = "button";
  exportBtn.textContent = "Export";
  exportBtn.addEventListener("click", () => {
    const data = exportLedgerData();
    const json = JSON.stringify(data, null, 2);
    triggerDownload(`ledger-${new Date().toISOString().slice(0, 10)}.json`, json);
  });

  const importBtn = document.createElement("button");
  importBtn.type = "button";
  importBtn.className = "button";
  importBtn.textContent = "Import";

  const importInput = document.createElement("input");
  importInput.type = "file";
  importInput.accept = "application/json";
  importInput.className = "visually-hidden";
  importInput.addEventListener("change", () => {
    const file = importInput.files?.[0];
    if (!file) return;
    file.text().then((text) => {
      try {
        importLedgerData(text);
        showNotification({ title: "Ledger imported", message: "Data loaded successfully.", variant: "success" });
      } catch (err) {
        showNotification({ title: "Import failed", message: (err as Error).message, variant: "danger" });
      }
    }).finally(() => {
      importInput.value = "";
    });
  });
  importBtn.addEventListener("click", () => importInput.click());

  const clearBtn = document.createElement("button");
  clearBtn.type = "button";
  clearBtn.className = "button danger";
  clearBtn.textContent = "Clear Log";
  clearBtn.addEventListener("click", () => {
    if (window.confirm("Clear all transaction history? Balance will remain unchanged.")) {
      clearLedgerTransactions();
    }
  });

  dataRow.append(exportBtn, importBtn, clearBtn, importInput);
  dataSection.appendChild(dataRow);
  balanceCard.appendChild(dataSection);

  // Right Column - Tabs & Content
  const rightColumn = document.createElement("div");
  rightColumn.className = "ledger-column";
  grid.appendChild(rightColumn);

  // Tabs
  const tabsContainer = document.createElement("div");
  tabsContainer.className = "ledger-tabs";
  rightColumn.appendChild(tabsContainer);

  const tabs: { id: TabId; label: string }[] = [
    { id: "transactions", label: "Transactions" },
    { id: "shop", label: "Equipment Shop" },
    { id: "recurring", label: "Recurring" },
  ];

  let activeTab: TabId = "transactions";
  const tabButtons = new Map<TabId, HTMLButtonElement>();

  tabs.forEach((tab) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "ledger-tab";
    btn.textContent = tab.label;
    btn.dataset.active = tab.id === activeTab ? "true" : "false";
    btn.addEventListener("click", () => {
      activeTab = tab.id;
      tabButtons.forEach((b, id) => {
        b.dataset.active = id === activeTab ? "true" : "false";
      });
      renderContent();
    });
    tabButtons.set(tab.id, btn);
    tabsContainer.appendChild(btn);
  });

  // Content Area
  const contentArea = document.createElement("div");
  rightColumn.appendChild(contentArea);

  // Shop State
  let shopCategory: EquipmentCategory | "all" = "all";
  let shopSearch = "";

  function renderContent() {
    contentArea.innerHTML = "";
    const state = getLedgerState();

    switch (activeTab) {
      case "transactions":
        renderTransactionsTab(contentArea, state);
        break;
      case "shop":
        renderShopTab(contentArea, state);
        break;
      case "recurring":
        renderRecurringTab(contentArea, state);
        break;
    }
  }

  function renderTransactionsTab(container: HTMLElement, state: LedgerState) {
    const panel = document.createElement("section");
    panel.className = "panel compact";
    container.appendChild(panel);

    const heading = document.createElement("div");
    heading.className = "panel-heading";
    heading.textContent = "Transaction History";
    panel.appendChild(heading);

    // Stats
    const statsRow = document.createElement("div");
    statsRow.className = "ledger-stats";
    panel.appendChild(statsRow);

    const totalIncome = state.transactions.filter((t) => t.amount > 0).reduce((sum, t) => sum + t.amount, 0);
    const totalExpenses = Math.abs(state.transactions.filter((t) => t.amount < 0).reduce((sum, t) => sum + t.amount, 0));

    const incomeStat = document.createElement("div");
    incomeStat.className = "ledger-stat";
    incomeStat.innerHTML = `
      <div class="ledger-stat-value income">${formatGold(totalIncome)}</div>
      <div class="ledger-stat-label">Total Income</div>
    `;
    statsRow.appendChild(incomeStat);

    const expenseStat = document.createElement("div");
    expenseStat.className = "ledger-stat";
    expenseStat.innerHTML = `
      <div class="ledger-stat-value expense">${formatGold(totalExpenses)}</div>
      <div class="ledger-stat-label">Total Expenses</div>
    `;
    statsRow.appendChild(expenseStat);

    // Transaction List
    const list = document.createElement("div");
    list.className = "ledger-transactions";
    panel.appendChild(list);

    if (!state.transactions.length) {
      const empty = document.createElement("div");
      empty.className = "ledger-empty";
      empty.innerHTML = `
        <div class="ledger-empty-icon">📜</div>
        <p>No transactions yet</p>
      `;
      list.appendChild(empty);
      return;
    }

    state.transactions.slice(0, 100).forEach((tx) => {
      list.appendChild(createTransactionRow(tx));
    });
  }

  function renderShopTab(container: HTMLElement, state: LedgerState) {
    const panel = document.createElement("section");
    panel.className = "panel compact ledger-shop";
    container.appendChild(panel);

    const heading = document.createElement("div");
    heading.className = "panel-heading";
    heading.textContent = "Equipment Shop";
    panel.appendChild(heading);

    // Filters
    const filterRow = document.createElement("div");
    filterRow.className = "ledger-shop-header";
    panel.appendChild(filterRow);

    const searchInput = document.createElement("input");
    searchInput.type = "text";
    searchInput.className = "input ledger-shop-search";
    searchInput.placeholder = "Search equipment...";
    searchInput.value = shopSearch;
    searchInput.addEventListener("input", () => {
      shopSearch = searchInput.value;
      renderShopItems();
    });
    filterRow.appendChild(searchInput);

    const categorySelect = document.createElement("select");
    categorySelect.className = "input ledger-shop-category";
    const allOption = document.createElement("option");
    allOption.value = "all";
    allOption.textContent = "All Categories";
    categorySelect.appendChild(allOption);

    CATEGORY_ORDER.forEach((cat) => {
      const option = document.createElement("option");
      option.value = cat;
      option.textContent = CATEGORY_LABELS[cat];
      categorySelect.appendChild(option);
    });

    categorySelect.value = shopCategory;
    categorySelect.addEventListener("change", () => {
      shopCategory = categorySelect.value as EquipmentCategory | "all";
      renderShopItems();
    });
    filterRow.appendChild(categorySelect);

    // Items Grid
    const itemsGrid = document.createElement("div");
    itemsGrid.className = "ledger-shop-items";
    panel.appendChild(itemsGrid);

    function renderShopItems() {
      itemsGrid.innerHTML = "";

      let items: EquipmentItem[];
      if (shopSearch) {
        items = searchEquipment(shopSearch);
      } else if (shopCategory === "all") {
        items = ALL_EQUIPMENT;
      } else {
        items = getEquipmentByCategory(shopCategory);
      }

      if (!items.length) {
        const empty = document.createElement("div");
        empty.className = "ledger-empty";
        empty.textContent = "No items found";
        itemsGrid.appendChild(empty);
        return;
      }

      items.forEach((item) => {
        itemsGrid.appendChild(createShopItemCard(item, state.balance));
      });
    }

    renderShopItems();
  }

  function renderRecurringTab(container: HTMLElement, state: LedgerState) {
    const panel = document.createElement("section");
    panel.className = "panel compact";
    container.appendChild(panel);

    const heading = document.createElement("div");
    heading.className = "panel-heading";
    heading.textContent = "Recurring Expenses";
    panel.appendChild(heading);

    const list = document.createElement("div");
    list.className = "ledger-recurring";
    panel.appendChild(list);

    if (!state.recurringExpenses.length) {
      const empty = document.createElement("div");
      empty.className = "ledger-empty";
      empty.innerHTML = `
        <div class="ledger-empty-icon">🔄</div>
        <p>No recurring expenses</p>
        <p style="font-size: 0.875rem; margin-top: 0.5rem;">
          Retainer wages and other recurring costs will appear here when added.
        </p>
      `;
      list.appendChild(empty);
      return;
    }

    state.recurringExpenses.forEach((expense) => {
      list.appendChild(createRecurringExpenseRow(expense));
    });
  }

  function createTransactionRow(tx: LedgerTransaction): HTMLElement {
    const row = document.createElement("div");
    row.className = `ledger-transaction ${tx.amount >= 0 ? "income" : "expense"}`;

    const icon = document.createElement("div");
    icon.className = "ledger-transaction-icon";
    icon.textContent = tx.amount >= 0 ? "+" : "−";
    row.appendChild(icon);

    const info = document.createElement("div");
    info.className = "ledger-transaction-info";

    const desc = document.createElement("div");
    desc.className = "ledger-transaction-description";
    desc.textContent = tx.description;
    info.appendChild(desc);

    const meta = document.createElement("div");
    meta.className = "ledger-transaction-meta";

    const catBadge = document.createElement("span");
    catBadge.className = `ledger-category-badge ${tx.category}`;
    catBadge.textContent = tx.category;
    meta.appendChild(catBadge);

    const date = document.createElement("span");
    date.textContent = `Day ${tx.calendarDay}, Month ${tx.calendarMonth + 1}, Year ${tx.calendarYear}`;
    meta.appendChild(date);

    info.appendChild(meta);
    row.appendChild(info);

    const amount = document.createElement("div");
    amount.className = "ledger-transaction-amount";
    amount.textContent = formatGold(Math.abs(tx.amount));
    row.appendChild(amount);

    return row;
  }

  function createShopItemCard(item: EquipmentItem, balance: number): HTMLElement {
    const card = document.createElement("div");
    card.className = "ledger-shop-item";

    const header = document.createElement("div");
    header.className = "ledger-shop-item-header";

    const name = document.createElement("div");
    name.className = "ledger-shop-item-name";
    name.textContent = item.name;
    header.appendChild(name);

    const price = document.createElement("div");
    price.className = "ledger-shop-item-price";
    price.textContent = formatGold(item.cost);
    header.appendChild(price);

    card.appendChild(header);

    const details = document.createElement("div");
    details.className = "ledger-shop-item-details";
    const detailParts: string[] = [];
    if (item.damage) detailParts.push(`Damage: ${item.damage}`);
    if (item.range) detailParts.push(`Range: ${item.range}`);
    if (item.ac !== undefined) detailParts.push(`AC: ${item.ac}`);
    if (item.weight) detailParts.push(`Weight: ${item.weight} cn`);
    if (item.notes) detailParts.push(item.notes);
    details.textContent = detailParts.join(" • ") || CATEGORY_LABELS[item.category];
    card.appendChild(details);

    const actions = document.createElement("div");
    actions.className = "ledger-shop-item-actions";

    const qtyInput = document.createElement("input");
    qtyInput.type = "number";
    qtyInput.className = "input ledger-shop-item-qty";
    qtyInput.value = "1";
    qtyInput.min = "1";
    actions.appendChild(qtyInput);

    const buyBtn = document.createElement("button");
    buyBtn.type = "button";
    buyBtn.className = "button";
    buyBtn.textContent = "Buy";
    const canBuy = balance >= item.cost;
    if (!canBuy) {
      buyBtn.disabled = true;
      buyBtn.title = "Not enough gold";
    }
    buyBtn.addEventListener("click", () => {
      const qty = Math.max(1, parseInt(qtyInput.value) || 1);
      const totalCost = item.cost * qty;
      if (!canAfford(totalCost)) {
        showNotification({ title: "Not enough gold", message: `Need ${formatGold(totalCost)} gp`, variant: "warning" });
        return;
      }
      recordEquipmentPurchase(totalCost, item.name, qty);
      showNotification({
        title: "Purchased",
        message: qty > 1 ? `${qty}x ${item.name}` : item.name,
        variant: "success",
      });
    });
    actions.appendChild(buyBtn);

    const sellBtn = document.createElement("button");
    sellBtn.type = "button";
    sellBtn.className = "button";
    sellBtn.textContent = "Sell";
    sellBtn.addEventListener("click", () => {
      const qty = Math.max(1, parseInt(qtyInput.value) || 1);
      const saleValue = getSaleValue(item) * qty;
      recordEquipmentSale(saleValue, item.name, qty);
      showNotification({
        title: "Sold",
        message: `${qty > 1 ? `${qty}x ` : ""}${item.name} for ${formatGold(saleValue)} gp`,
        variant: "success",
      });
    });
    actions.appendChild(sellBtn);

    card.appendChild(actions);
    return card;
  }

  function createRecurringExpenseRow(expense: LedgerRecurringExpense): HTMLElement {
    const row = document.createElement("div");
    row.className = "ledger-recurring-item";

    const info = document.createElement("div");
    info.className = "ledger-recurring-info";

    const name = document.createElement("div");
    name.className = "ledger-recurring-name";
    name.textContent = expense.name;
    info.appendChild(name);

    const meta = document.createElement("div");
    meta.className = "ledger-recurring-meta";
    meta.textContent = `${expense.frequency} • Next due: Day ${expense.nextDueDay}, Month ${expense.nextDueMonth + 1}`;
    info.appendChild(meta);

    row.appendChild(info);

    const amount = document.createElement("span");
    amount.className = "ledger-recurring-amount";
    amount.textContent = `${formatGold(expense.amount)} gp`;
    row.appendChild(amount);

    const toggleBtn = document.createElement("button");
    toggleBtn.type = "button";
    toggleBtn.className = "button";
    toggleBtn.textContent = expense.active ? "Pause" : "Resume";
    toggleBtn.addEventListener("click", () => {
      toggleRecurringExpense(expense.id, !expense.active);
    });
    row.appendChild(toggleBtn);

    const removeBtn = document.createElement("button");
    removeBtn.type = "button";
    removeBtn.className = "button danger";
    removeBtn.textContent = "Remove";
    removeBtn.addEventListener("click", () => {
      if (window.confirm(`Remove recurring expense "${expense.name}"?`)) {
        removeRecurringExpense(expense.id);
      }
    });
    row.appendChild(removeBtn);

    return row;
  }

  function render(state: LedgerState) {
    balanceAmount.textContent = formatGold(state.balance);
    renderContent();
  }

  render(getLedgerState());
  const unsubscribe = subscribeToLedger(render);
  target.appendChild(element);

  return () => {
    unsubscribe();
  };
}

function formatGold(amount: number): string {
  if (amount >= 1000) {
    return amount.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  }
  if (Number.isInteger(amount)) {
    return amount.toString();
  }
  return amount.toFixed(2);
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





