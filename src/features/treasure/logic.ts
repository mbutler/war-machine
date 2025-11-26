import { createId } from "../../utils/id";
import type {
  CoinDenomination,
  TreasureCoinPile,
  TreasureGemEntry,
  TreasureHoard,
  TreasureMagicItem,
} from "../../state/schema";
import {
  GEM_TABLE,
  JEWELRY_TABLE,
  MAGIC_TABLES,
  TREASURE_TYPE_LIST,
  TREASURE_TYPES,
  type DiceExpression,
  type GemTier,
  type MagicCategory,
  type TreasureTypeDefinition,
  type TreasureTypeKey,
} from "./data";

const COIN_TO_GP: Record<CoinDenomination, number> = {
  cp: 0.01,
  sp: 0.1,
  ep: 0.5,
  gp: 1,
  pp: 5,
};

const META_MAGIC: MagicCategory[] = ["any", "weapon/armor", "no-weapon"];

export interface HoardSummary {
  totalValue: number;
  coins: TreasureCoinPile[];
  gems: TreasureGemEntry[];
  jewelry: TreasureGemEntry[];
  magic: TreasureMagicItem[];
}

export function listTreasureTypes(): TreasureTypeDefinition[] {
  return TREASURE_TYPE_LIST;
}

export function generateTreasureHoard(typeKey: TreasureTypeKey): TreasureHoard {
  const definition = TREASURE_TYPES[typeKey];
  if (!definition) {
    throw new Error(`Unknown treasure type: ${typeKey}`);
  }

  const { coins, gems, jewelry, magic, totalValue } = buildHoardContents(definition);

  return {
    id: createId(),
    type: definition.key,
    label: definition.label,
    totalValue,
    createdAt: Date.now(),
    coins,
    gems,
    jewelry,
    magic,
    notes: definition.description,
  };
}

function buildHoardContents(definition: TreasureTypeDefinition): HoardSummary {
  const coins: TreasureCoinPile[] = [];
  const gems: TreasureGemEntry[] = [];
  const jewelry: TreasureGemEntry[] = [];
  const magic: TreasureMagicItem[] = [];

  if (definition.coins) {
    (Object.entries(definition.coins) as Array<[CoinDenomination, any]>).forEach(([denomination, table]) => {
      if (!table) return;
      if (!passesPercent(table.pct)) return;
      const amount = rollDice(table.roll) * (table.mult ?? 1);
      if (amount <= 0) return;
      const gpValue = amount * COIN_TO_GP[denomination];
      coins.push({
        denomination,
        amount,
        gpValue,
      });
    });
  }

  if (definition.gems && passesPercent(definition.gems.pct)) {
    const count = rollDice(definition.gems.roll);
    for (let i = 0; i < count; i += 1) {
      gems.push(buildGemEntry("gem", GEM_TABLE));
    }
  }

  if (definition.jewelry && passesPercent(definition.jewelry.pct)) {
    const count = rollDice(definition.jewelry.roll) * (definition.jewelry.mult ?? 1);
    for (let i = 0; i < count; i += 1) {
      jewelry.push(buildGemEntry("jewelry", JEWELRY_TABLE));
    }
  }

  if (definition.magic && passesPercent(definition.magic.pct)) {
    if (definition.magic.extra) {
      definition.magic.extra.forEach((category) => {
        magic.push(buildMagicItem(category));
      });
    }
    for (let i = 0; i < definition.magic.count; i += 1) {
      magic.push(buildMagicItem(definition.magic.type));
    }
  }

  const totalValue =
    coins.reduce((sum, pile) => sum + pile.gpValue, 0) +
    gems.reduce((sum, item) => sum + item.value, 0) +
    jewelry.reduce((sum, item) => sum + item.value, 0);

  return {
    totalValue: Math.round(totalValue),
    coins,
    gems,
    jewelry,
    magic,
  };
}

function buildGemEntry(prefix: string, table: GemTier[]): TreasureGemEntry {
  const roll = randomRange(1, 100);
  const tier = table.find((tierEntry) => roll <= tierEntry.max) ?? table[table.length - 1];
  const variance = prefix === "gem" ? randomFloat(0.8, 1.2) : randomFloat(0.75, 1.25);
  const value = Math.max(1, Math.floor(tier.val * variance));
  return {
    id: createId(),
    name: tier.name,
    value,
  };
}

function buildMagicItem(category: MagicCategory): TreasureMagicItem {
  const result = rollMagicRecursive(category);
  return {
    id: createId(),
    category: result.category,
    name: result.name,
  };
}

function rollMagicRecursive(category: MagicCategory): { category: string; name: string } {
  const table = MAGIC_TABLES[category];
  if (!table || !table.length) {
    return { category, name: "Unknown item" };
  }

  const choice = table[randomRange(0, table.length - 1)];
  if ((META_MAGIC as string[]).includes(category)) {
    const nextCategory = choice as MagicCategory;
    return rollMagicRecursive(nextCategory);
  }
  return { category, name: choice };
}

export function formatHoardPlainText(hoard: TreasureHoard): string {
  const lines: string[] = [];
  lines.push(`${hoard.label} — ${new Date(hoard.createdAt).toLocaleString()}`);
  lines.push(`Total Value: ${formatGp(hoard.totalValue)}`);
  if (hoard.coins.length) {
    lines.push("Coins:");
    hoard.coins.forEach((coin) => {
      lines.push(`  • ${coin.amount.toLocaleString()} ${coin.denomination.toUpperCase()} (${formatGp(coin.gpValue)})`);
    });
  }
  if (hoard.gems.length) {
    lines.push("Gems:");
    hoard.gems.forEach((gem) => lines.push(`  • ${gem.name} (${formatGp(gem.value)})`));
  }
  if (hoard.jewelry.length) {
    lines.push("Jewelry:");
    hoard.jewelry.forEach((item) => lines.push(`  • ${item.name} (${formatGp(item.value)})`));
  }
  if (hoard.magic.length) {
    lines.push("Magic Items:");
    hoard.magic.forEach((item) => lines.push(`  • ${item.name} [${item.category}]`));
  }
  return lines.join("\n");
}

function passesPercent(pct: number): boolean {
  return randomRange(1, 100) <= pct;
}

function rollDice(expression: DiceExpression): number {
  const match = expression.match(/(\d+)d(\d+)/);
  if (!match) return 0;
  const count = Number(match[1]);
  const sides = Number(match[2]);
  let total = 0;
  for (let i = 0; i < count; i += 1) {
    total += randomRange(1, sides);
  }
  return total;
}

function randomRange(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomFloat(min: number, max: number): number {
  return Math.random() * (max - min) + min;
}

function formatGp(value: number): string {
  return `${Math.round(value).toLocaleString()} gp`;
}

