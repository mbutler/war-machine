/**
 * BECMI Equipment Database
 * Prices and weights from Rules Cyclopedia
 */

export type EquipmentCategory =
  | "weapons_melee"
  | "weapons_missile"
  | "ammunition"
  | "armor"
  | "shields"
  | "clothing"
  | "containers"
  | "provisions"
  | "light_sources"
  | "tools"
  | "transport"
  | "animals"
  | "services"
  | "lodging";

export interface EquipmentItem {
  id: string;
  name: string;
  category: EquipmentCategory;
  cost: number;           // Cost in gold pieces
  weight: number;         // Weight in coins (10 coins = 1 pound)
  description?: string;
  damage?: string;        // For weapons
  range?: string;         // For missile weapons
  ac?: number;            // For armor/shields
  notes?: string;
}

// ============================================================================
// WEAPONS - MELEE
// ============================================================================

export const MELEE_WEAPONS: EquipmentItem[] = [
  { id: "battle_axe", name: "Battle Axe", category: "weapons_melee", cost: 7, weight: 60, damage: "1d8", notes: "Two-handed" },
  { id: "hand_axe", name: "Hand Axe", category: "weapons_melee", cost: 4, weight: 30, damage: "1d6", notes: "Can be thrown" },
  { id: "blackjack", name: "Blackjack", category: "weapons_melee", cost: 5, weight: 5, damage: "1d2", notes: "Can knockout" },
  { id: "club", name: "Club", category: "weapons_melee", cost: 3, weight: 50, damage: "1d4" },
  { id: "dagger", name: "Dagger", category: "weapons_melee", cost: 3, weight: 10, damage: "1d4", notes: "Can be thrown" },
  { id: "silver_dagger", name: "Silver Dagger", category: "weapons_melee", cost: 30, weight: 10, damage: "1d4", notes: "Effective vs lycanthropes" },
  { id: "throwing_hammer", name: "Throwing Hammer", category: "weapons_melee", cost: 4, weight: 25, damage: "1d4", notes: "Can be thrown" },
  { id: "war_hammer", name: "War Hammer", category: "weapons_melee", cost: 5, weight: 50, damage: "1d6" },
  { id: "halberd", name: "Halberd", category: "weapons_melee", cost: 7, weight: 150, damage: "1d10", notes: "Two-handed" },
  { id: "javelin", name: "Javelin", category: "weapons_melee", cost: 1, weight: 20, damage: "1d6", notes: "Primarily thrown" },
  { id: "lance", name: "Lance", category: "weapons_melee", cost: 10, weight: 180, damage: "1d10", notes: "Mounted use, double damage on charge" },
  { id: "mace", name: "Mace", category: "weapons_melee", cost: 5, weight: 30, damage: "1d6" },
  { id: "pike", name: "Pike", category: "weapons_melee", cost: 3, weight: 80, damage: "1d10", notes: "Two-handed, set vs charge" },
  { id: "polearm", name: "Polearm", category: "weapons_melee", cost: 7, weight: 150, damage: "1d10", notes: "Two-handed" },
  { id: "poleaxe", name: "Poleaxe", category: "weapons_melee", cost: 5, weight: 120, damage: "1d10", notes: "Two-handed" },
  { id: "spear", name: "Spear", category: "weapons_melee", cost: 3, weight: 30, damage: "1d6", notes: "Can be thrown or set vs charge" },
  { id: "staff", name: "Staff", category: "weapons_melee", cost: 5, weight: 40, damage: "1d6", notes: "Two-handed" },
  { id: "trident", name: "Trident", category: "weapons_melee", cost: 5, weight: 25, damage: "1d6", notes: "Can be thrown" },
  { id: "short_sword", name: "Short Sword", category: "weapons_melee", cost: 7, weight: 30, damage: "1d6" },
  { id: "sword", name: "Sword (Normal)", category: "weapons_melee", cost: 10, weight: 60, damage: "1d8" },
  { id: "bastard_sword", name: "Bastard Sword", category: "weapons_melee", cost: 15, weight: 80, damage: "1d6+1/1d8+1", notes: "One or two-handed" },
  { id: "two_handed_sword", name: "Two-Handed Sword", category: "weapons_melee", cost: 15, weight: 100, damage: "1d10", notes: "Two-handed" },
  { id: "cestus", name: "Cestus", category: "weapons_melee", cost: 5, weight: 10, damage: "1d3" },
  { id: "bola", name: "Bola", category: "weapons_melee", cost: 5, weight: 5, damage: "1d2", notes: "Can entangle, thrown" },
  { id: "whip", name: "Whip (10')", category: "weapons_melee", cost: 10, weight: 100, damage: "1d2", notes: "Can entangle" },
];

// ============================================================================
// WEAPONS - MISSILE
// ============================================================================

export const MISSILE_WEAPONS: EquipmentItem[] = [
  { id: "shortbow", name: "Short Bow", category: "weapons_missile", cost: 25, weight: 20, damage: "1d6", range: "50/100/150" },
  { id: "longbow", name: "Long Bow", category: "weapons_missile", cost: 40, weight: 30, damage: "1d6", range: "70/140/210" },
  { id: "crossbow_light", name: "Light Crossbow", category: "weapons_missile", cost: 30, weight: 50, damage: "1d6", range: "60/120/180", notes: "Slow loading" },
  { id: "crossbow_heavy", name: "Heavy Crossbow", category: "weapons_missile", cost: 50, weight: 80, damage: "2d4", range: "80/160/240", notes: "Fires every other round" },
  { id: "sling", name: "Sling", category: "weapons_missile", cost: 2, weight: 20, damage: "1d4", range: "40/80/160" },
  { id: "blowgun_short", name: "Blowgun (Short)", category: "weapons_missile", cost: 3, weight: 6, damage: "1", range: "10/20/30", notes: "Often used with poison" },
  { id: "blowgun_long", name: "Blowgun (Long)", category: "weapons_missile", cost: 6, weight: 15, damage: "1", range: "20/25/30", notes: "Two-handed, often used with poison" },
  { id: "net", name: "Net (6x6)", category: "weapons_missile", cost: 3.6, weight: 36, range: "10/20/30", notes: "Entangles target" },
];

// ============================================================================
// AMMUNITION
// ============================================================================

export const AMMUNITION: EquipmentItem[] = [
  { id: "arrows_20", name: "Arrows (20)", category: "ammunition", cost: 5, weight: 10 },
  { id: "arrow_silver", name: "Silver-Tipped Arrow (1)", category: "ammunition", cost: 5, weight: 1 },
  { id: "quarrels_30", name: "Crossbow Quarrels (30)", category: "ammunition", cost: 10, weight: 10 },
  { id: "quarrel_silver", name: "Silver-Tipped Quarrel (1)", category: "ammunition", cost: 5, weight: 1 },
  { id: "sling_stones_30", name: "Sling Stones (30)", category: "ammunition", cost: 1, weight: 6 },
  { id: "sling_pellet_silver", name: "Silver Sling Pellet (1)", category: "ammunition", cost: 5, weight: 1 },
  { id: "blowgun_darts_5", name: "Blowgun Darts (5)", category: "ammunition", cost: 1, weight: 1 },
  { id: "quiver", name: "Quiver/Bolt Case", category: "ammunition", cost: 1, weight: 5 },
];

// ============================================================================
// ARMOR
// ============================================================================

export const ARMOR: EquipmentItem[] = [
  { id: "leather_armor", name: "Leather Armor", category: "armor", cost: 20, weight: 200, ac: 7 },
  { id: "scale_mail", name: "Scale Mail", category: "armor", cost: 30, weight: 400, ac: 6 },
  { id: "chain_mail", name: "Chain Mail", category: "armor", cost: 40, weight: 400, ac: 5 },
  { id: "banded_mail", name: "Banded Mail", category: "armor", cost: 50, weight: 450, ac: 4 },
  { id: "plate_mail", name: "Plate Mail", category: "armor", cost: 60, weight: 500, ac: 3 },
  { id: "suit_armor", name: "Suit Armor (Full Plate)", category: "armor", cost: 250, weight: 750, ac: 0, notes: "Requires assistance to don" },
  { id: "barding_leather", name: "Horse Barding (Leather)", category: "armor", cost: 40, weight: 400, ac: 7, notes: "Horse armor" },
  { id: "barding_chain", name: "Horse Barding (Chain)", category: "armor", cost: 100, weight: 600, ac: 5, notes: "Horse armor" },
  { id: "barding_plate", name: "Horse Barding (Plate)", category: "armor", cost: 250, weight: 1200, ac: 3, notes: "Horse armor" },
];

// ============================================================================
// SHIELDS
// ============================================================================

export const SHIELDS: EquipmentItem[] = [
  { id: "shield", name: "Shield", category: "shields", cost: 10, weight: 100, ac: -1, notes: "-1 to AC" },
  { id: "horned_shield", name: "Horned Shield", category: "shields", cost: 15, weight: 20, ac: -1, notes: "Can be used as weapon (1d2)" },
  { id: "knife_shield", name: "Knife Shield", category: "shields", cost: 65, weight: 70, ac: -1, notes: "Built-in blade (1d4+1)" },
  { id: "sword_shield", name: "Sword Shield", category: "shields", cost: 200, weight: 185, ac: -1, notes: "Built-in sword (1d4+2)" },
  { id: "tusked_shield", name: "Tusked Shield", category: "shields", cost: 200, weight: 275, ac: -1, notes: "Two-handed (1d4+1)" },
];

// ============================================================================
// CLOTHING & PERSONAL ITEMS
// ============================================================================

export const CLOTHING: EquipmentItem[] = [
  { id: "belt", name: "Belt", category: "clothing", cost: 0.2, weight: 5 },
  { id: "boots_plain", name: "Boots (Plain)", category: "clothing", cost: 1, weight: 10 },
  { id: "boots_riding", name: "Boots (Riding)", category: "clothing", cost: 5, weight: 15 },
  { id: "cloak_short", name: "Cloak (Short)", category: "clothing", cost: 5, weight: 10 },
  { id: "cloak_long", name: "Cloak (Long)", category: "clothing", cost: 5, weight: 15 },
  { id: "clothes_plain", name: "Clothing (Plain)", category: "clothing", cost: 1, weight: 20 },
  { id: "clothes_middle", name: "Clothing (Middle-Class)", category: "clothing", cost: 0.5, weight: 20 },
  { id: "clothes_fine", name: "Clothing (Fine)", category: "clothing", cost: 5, weight: 20 },
  { id: "clothes_extravagant", name: "Clothing (Extravagant)", category: "clothing", cost: 20, weight: 20 },
  { id: "hat", name: "Hat or Cap", category: "clothing", cost: 2, weight: 3 },
  { id: "shoes", name: "Shoes", category: "clothing", cost: 0.5, weight: 10 },
  { id: "holy_symbol", name: "Holy Symbol", category: "clothing", cost: 25, weight: 3 },
  { id: "thieves_tools", name: "Thieves' Tools", category: "clothing", cost: 25, weight: 10 },
  { id: "mirror_small_steel", name: "Mirror (Small, Steel)", category: "clothing", cost: 5, weight: 5 },
];

// ============================================================================
// CONTAINERS
// ============================================================================

export const CONTAINERS: EquipmentItem[] = [
  { id: "backpack", name: "Backpack", category: "containers", cost: 5, weight: 20, notes: "Holds 400 coins" },
  { id: "belt_pouch", name: "Belt Pouch", category: "containers", cost: 0.5, weight: 2, notes: "Holds 50 coins" },
  { id: "sack_small", name: "Sack (Small)", category: "containers", cost: 1, weight: 1, notes: "Holds 200 coins" },
  { id: "sack_large", name: "Sack (Large)", category: "containers", cost: 2, weight: 8, notes: "Holds 600 coins" },
  { id: "saddle_bags", name: "Saddle Bags", category: "containers", cost: 5, weight: 100, notes: "Holds 800 coins" },
  { id: "barrel", name: "Barrel", category: "containers", cost: 2, weight: 80, notes: "Holds 360 coins" },
  { id: "chest_small", name: "Chest (Small)", category: "containers", cost: 5, weight: 20, notes: "Holds 200 coins" },
  { id: "chest_large", name: "Chest (Large)", category: "containers", cost: 10, weight: 100, notes: "Holds 500 coins" },
];

// ============================================================================
// PROVISIONS
// ============================================================================

export const PROVISIONS: EquipmentItem[] = [
  { id: "rations_standard_7", name: "Rations (Standard, 1 week)", category: "provisions", cost: 5, weight: 200, notes: "Spoils in dungeon" },
  { id: "rations_iron_7", name: "Rations (Iron, 1 week)", category: "provisions", cost: 15, weight: 70, notes: "Preserved, lasts 2 months" },
  { id: "waterskin", name: "Waterskin", category: "provisions", cost: 1, weight: 5, notes: "1 quart capacity, 30cn when full" },
  { id: "wine_quart", name: "Wine (Quart)", category: "provisions", cost: 1, weight: 30 },
  { id: "ale_pint", name: "Ale (Pint)", category: "provisions", cost: 0.05, weight: 10 },
  { id: "mead_pint", name: "Mead (Pint)", category: "provisions", cost: 0.5, weight: 10 },
  { id: "grain_horse_1_day", name: "Grain (Horse, 1 day)", category: "provisions", cost: 0.1, weight: 100 },
];

// ============================================================================
// LIGHT SOURCES
// ============================================================================

export const LIGHT_SOURCES: EquipmentItem[] = [
  { id: "torch_1", name: "Torch (1)", category: "light_sources", cost: 0.2, weight: 20, notes: "Burns 1 hour (6 turns), 30' radius" },
  { id: "torch_6", name: "Torches (6)", category: "light_sources", cost: 1, weight: 120 },
  { id: "lantern", name: "Lantern", category: "light_sources", cost: 10, weight: 30, notes: "30' radius, burns 4 hours (24 turns) per flask oil" },
  { id: "oil_flask", name: "Oil (Flask)", category: "light_sources", cost: 2, weight: 10, notes: "4 hours lantern fuel, or thrown weapon (1d8)" },
  { id: "candles_12", name: "Candles (12)", category: "light_sources", cost: 1, weight: 10, notes: "5' radius each" },
  { id: "tinderbox", name: "Tinderbox", category: "light_sources", cost: 3, weight: 5, notes: "Flint, steel, kindling" },
];

// ============================================================================
// TOOLS & EQUIPMENT
// ============================================================================

export const TOOLS: EquipmentItem[] = [
  { id: "grappling_hook", name: "Grappling Hook", category: "tools", cost: 5, weight: 80 },
  { id: "hammer_small", name: "Hammer (Small)", category: "tools", cost: 2, weight: 10 },
  { id: "iron_spike_1", name: "Iron Spike (1)", category: "tools", cost: 0.1, weight: 5 },
  { id: "iron_spikes_12", name: "Iron Spikes (12)", category: "tools", cost: 1, weight: 60 },
  { id: "rope_50ft", name: "Rope (50')", category: "tools", cost: 1, weight: 50, notes: "Supports 3 loaded humans" },
  { id: "pole_10ft", name: "Pole (10')", category: "tools", cost: 1, weight: 100 },
  { id: "crowbar", name: "Crowbar", category: "tools", cost: 10, weight: 50, notes: "+1 to force doors" },
  { id: "chain_10ft", name: "Chain (10')", category: "tools", cost: 30, weight: 100 },
  { id: "manacles", name: "Manacles", category: "tools", cost: 15, weight: 40 },
  { id: "lock_simple", name: "Lock (Simple)", category: "tools", cost: 20, weight: 10 },
  { id: "lock_good", name: "Lock (Good)", category: "tools", cost: 40, weight: 10 },
  { id: "stakes_mallet", name: "Stakes (3) and Mallet", category: "tools", cost: 3, weight: 10, notes: "For dispatching vampires" },
  { id: "wolfsbane", name: "Wolfsbane (Sprig)", category: "tools", cost: 10, weight: 1, notes: "Repels lycanthropes" },
  { id: "garlic", name: "Garlic", category: "tools", cost: 50, weight: 1, notes: "Repels vampires (rare)" },
  { id: "holy_water_vial", name: "Holy Water (Vial)", category: "tools", cost: 25, weight: 1, notes: "1d8 vs undead" },
  { id: "spellbook_blank", name: "Spellbook (Blank)", category: "tools", cost: 100, weight: 200 },
  { id: "parchment_1", name: "Parchment (1 sheet)", category: "tools", cost: 0.1, weight: 0 },
  { id: "ink_quill", name: "Ink & Quill", category: "tools", cost: 2, weight: 0 },
  { id: "scroll_case", name: "Scroll Case", category: "tools", cost: 3, weight: 5 },
  { id: "musical_instrument", name: "Musical Instrument", category: "tools", cost: 25, weight: 30 },
];

// ============================================================================
// TRANSPORT
// ============================================================================

export const TRANSPORT: EquipmentItem[] = [
  // Land Transport
  { id: "saddle_tack", name: "Saddle & Tack", category: "transport", cost: 25, weight: 300, notes: "Includes bridle, bit, stirrups" },
  { id: "cart", name: "Cart (2-wheel)", category: "transport", cost: 100, weight: 0, notes: "4000/8000cn capacity (1/2 horses)" },
  { id: "wagon", name: "Wagon (4-wheel)", category: "transport", cost: 200, weight: 0, notes: "15000/25000cn capacity (1/2 horses)" },
  // Water Transport
  { id: "canoe", name: "Canoe", category: "transport", cost: 50, weight: 0, notes: "6000cn capacity" },
  { id: "raft", name: "Raft (per sq ft)", category: "transport", cost: 1, weight: 0, notes: "10000cn capacity professional" },
  { id: "lifeboat", name: "Lifeboat", category: "transport", cost: 1000, weight: 0, notes: "15000cn capacity" },
  { id: "boat_river", name: "Boat, River", category: "transport", cost: 4000, weight: 0, notes: "40000cn capacity, 8 rowers" },
  { id: "boat_sailing", name: "Boat, Sailing", category: "transport", cost: 2000, weight: 0, notes: "20000cn capacity" },
  { id: "galley_small", name: "Galley (Small)", category: "transport", cost: 10000, weight: 0, notes: "40000cn cargo, 60 rowers, 20 marines" },
  { id: "galley_large", name: "Galley (Large)", category: "transport", cost: 30000, weight: 0, notes: "60000cn cargo, 180 rowers, 50 marines" },
  { id: "galley_war", name: "Galley (War)", category: "transport", cost: 60000, weight: 0, notes: "80000cn cargo, 300 rowers, 75 marines" },
  { id: "longship", name: "Longship", category: "transport", cost: 15000, weight: 0, notes: "30000cn cargo, 75 crew" },
  { id: "sailing_ship_small", name: "Sailing Ship (Small)", category: "transport", cost: 5000, weight: 0, notes: "100000cn cargo" },
  { id: "sailing_ship_large", name: "Sailing Ship (Large)", category: "transport", cost: 20000, weight: 0, notes: "300000cn cargo" },
  { id: "troop_transport", name: "Troop Transport", category: "transport", cost: 30000, weight: 0, notes: "600000cn capacity, 100 marines" },
];

// ============================================================================
// ANIMALS
// ============================================================================

export const ANIMALS: EquipmentItem[] = [
  { id: "camel", name: "Camel", category: "animals", cost: 100, weight: 0, notes: "Desert adapted" },
  { id: "horse_draft", name: "Horse (Draft)", category: "animals", cost: 40, weight: 0, notes: "For pulling carts/wagons" },
  { id: "horse_riding", name: "Horse (Riding)", category: "animals", cost: 75, weight: 0, notes: "Fastest normal steed" },
  { id: "horse_war", name: "Horse (War)", category: "animals", cost: 250, weight: 0, notes: "Trained for combat, 2×1d6 hooves" },
  { id: "mule", name: "Mule", category: "animals", cost: 30, weight: 0, notes: "Durable and reliable" },
  { id: "pony", name: "Pony", category: "animals", cost: 35, weight: 0, notes: "Ideal for halflings and small characters" },
  { id: "dog_guard", name: "Dog (Guard)", category: "animals", cost: 25, weight: 0 },
  { id: "dog_hunting", name: "Dog (Hunting)", category: "animals", cost: 17, weight: 0 },
  { id: "dog_war", name: "Dog (War)", category: "animals", cost: 75, weight: 0 },
  { id: "ox", name: "Ox", category: "animals", cost: 25, weight: 0, notes: "Draft animal" },
  { id: "elephant", name: "Elephant", category: "animals", cost: 500, weight: 0, notes: "Carries 10000 coins" },
  { id: "carrier_pigeon", name: "Carrier Pigeon", category: "animals", cost: 100, weight: 0 },
  { id: "falcon", name: "Falcon (Trained)", category: "animals", cost: 1000, weight: 0 },
];

// ============================================================================
// SERVICES & LODGING
// ============================================================================

export const SERVICES: EquipmentItem[] = [
  { id: "hireling_porter", name: "Hireling (Porter, per day)", category: "services", cost: 1, weight: 0 },
  { id: "hireling_skilled", name: "Hireling (Skilled, per day)", category: "services", cost: 3, weight: 0 },
  { id: "mercenary_infantry", name: "Mercenary (Infantry, per month)", category: "services", cost: 2, weight: 0 },
  { id: "mercenary_archer", name: "Mercenary (Archer, per month)", category: "services", cost: 5, weight: 0 },
  { id: "mercenary_cavalry", name: "Mercenary (Cavalry, per month)", category: "services", cost: 10, weight: 0 },
  { id: "armorer", name: "Armorer (per month)", category: "services", cost: 100, weight: 0 },
  { id: "blacksmith", name: "Blacksmith (per month)", category: "services", cost: 25, weight: 0 },
  { id: "animal_trainer", name: "Animal Trainer (per month)", category: "services", cost: 500, weight: 0 },
  { id: "spy", name: "Spy (per month)", category: "services", cost: 500, weight: 0 },
  { id: "sage", name: "Sage (per question)", category: "services", cost: 1000, weight: 0 },
];

export const LODGING: EquipmentItem[] = [
  { id: "inn_poor", name: "Inn (Poor, per night)", category: "lodging", cost: 1, weight: 0 },
  { id: "inn_average", name: "Inn (Average, per night)", category: "lodging", cost: 5, weight: 0 },
  { id: "inn_good", name: "Inn (Good, per night)", category: "lodging", cost: 10, weight: 0 },
  { id: "inn_wealthy", name: "Inn (Wealthy, per night)", category: "lodging", cost: 40, weight: 0 },
  { id: "meal_poor", name: "Meal (Poor)", category: "lodging", cost: 0.1, weight: 0 },
  { id: "meal_average", name: "Meal (Average)", category: "lodging", cost: 0.5, weight: 0 },
  { id: "meal_good", name: "Meal (Good)", category: "lodging", cost: 1, weight: 0 },
  { id: "meal_feast", name: "Meal (Feast)", category: "lodging", cost: 5, weight: 0 },
  { id: "stabling", name: "Stabling (per night)", category: "lodging", cost: 0.5, weight: 0 },
];

// ============================================================================
// COMBINED LISTS & UTILITIES
// ============================================================================

export const ALL_EQUIPMENT: EquipmentItem[] = [
  ...MELEE_WEAPONS,
  ...MISSILE_WEAPONS,
  ...AMMUNITION,
  ...ARMOR,
  ...SHIELDS,
  ...CLOTHING,
  ...CONTAINERS,
  ...PROVISIONS,
  ...LIGHT_SOURCES,
  ...TOOLS,
  ...TRANSPORT,
  ...ANIMALS,
  ...SERVICES,
  ...LODGING,
];

const EQUIPMENT_MAP = new Map(ALL_EQUIPMENT.map((item) => [item.id, item]));

export function getEquipmentById(id: string): EquipmentItem | undefined {
  return EQUIPMENT_MAP.get(id);
}

export function getEquipmentByCategory(category: EquipmentCategory): EquipmentItem[] {
  return ALL_EQUIPMENT.filter((item) => item.category === category);
}

export function searchEquipment(query: string): EquipmentItem[] {
  const lowerQuery = query.toLowerCase();
  return ALL_EQUIPMENT.filter(
    (item) =>
      item.name.toLowerCase().includes(lowerQuery) ||
      item.category.toLowerCase().includes(lowerQuery) ||
      (item.description?.toLowerCase().includes(lowerQuery) ?? false),
  );
}

export const CATEGORY_LABELS: Record<EquipmentCategory, string> = {
  weapons_melee: "Melee Weapons",
  weapons_missile: "Missile Weapons",
  ammunition: "Ammunition",
  armor: "Armor",
  shields: "Shields",
  clothing: "Clothing & Personal",
  containers: "Containers",
  provisions: "Provisions",
  light_sources: "Light Sources",
  tools: "Tools & Equipment",
  transport: "Transport",
  animals: "Animals",
  services: "Services",
  lodging: "Lodging",
};

/**
 * Calculate sale value (typically 50% of purchase price)
 */
export function getSaleValue(item: EquipmentItem, condition: "good" | "fair" | "poor" = "good"): number {
  const multiplier = condition === "good" ? 0.5 : condition === "fair" ? 0.25 : 0.1;
  return Math.floor(item.cost * multiplier * 100) / 100; // Round to 2 decimal places
}


