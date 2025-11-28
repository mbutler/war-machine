/**
 * BECMI Equipment Prices
 * 
 * This module re-exports equipment data from the canonical source
 * in src/features/ledger/equipment.ts
 * 
 * For detailed equipment info (weights, damage, notes), import from:
 *   import { ALL_EQUIPMENT, getEquipmentById } from "../../features/ledger/equipment";
 * 
 * For simple price lookups, use EQUIPMENT_PRICES below.
 */

import { ALL_EQUIPMENT, type EquipmentItem } from "../../features/ledger/equipment";

// Re-export the detailed types and data
export {
  ALL_EQUIPMENT,
  MELEE_WEAPONS,
  MISSILE_WEAPONS,
  AMMUNITION,
  ARMOR,
  SHIELDS,
  CLOTHING,
  CONTAINERS,
  PROVISIONS,
  LIGHT_SOURCES,
  TOOLS,
  TRANSPORT,
  ANIMALS,
  SERVICES,
  LODGING,
  getEquipmentById,
  getEquipmentByCategory,
  searchEquipment,
  getSaleValue,
  CATEGORY_LABELS,
  type EquipmentItem,
  type EquipmentCategory,
} from "../../features/ledger/equipment";

// ============================================================================
// SIMPLE PRICE MAP (for backward compatibility)
// ============================================================================

export interface EquipmentPriceMap {
  [item: string]: number;
}

/**
 * Simple name → price lookup derived from ALL_EQUIPMENT.
 * Use this for quick price checks when you don't need other details.
 */
export const EQUIPMENT_PRICES: EquipmentPriceMap = ALL_EQUIPMENT.reduce(
  (map, item) => {
    map[item.name] = item.cost;
    return map;
  },
  {} as EquipmentPriceMap
);

/**
 * Get the price of an item by name (case-insensitive search)
 */
export function getItemPrice(itemName: string): number | undefined {
  // Exact match first
  if (EQUIPMENT_PRICES[itemName] !== undefined) {
    return EQUIPMENT_PRICES[itemName];
  }

  // Case-insensitive search
  const lowerName = itemName.toLowerCase();
  for (const [key, value] of Object.entries(EQUIPMENT_PRICES)) {
    if (key.toLowerCase() === lowerName) {
      return value;
    }
  }

  return undefined;
}

/**
 * Format price for display (handles fractional gold pieces)
 */
export function formatPrice(gp: number): string {
  if (gp >= 1) {
    return gp % 1 === 0 ? `${gp} gp` : `${gp.toFixed(1)} gp`;
  }
  if (gp >= 0.1) {
    const sp = Math.round(gp * 10);
    return `${sp} sp`;
  }
  const cp = Math.round(gp * 100);
  return `${cp} cp`;
}
