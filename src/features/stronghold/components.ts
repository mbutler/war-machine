export interface StrongholdComponentDefinition {
  id: string;
  name: string;
  cost: number;
  description: string;
}

export const STRONGHOLD_COMPONENTS: StrongholdComponentDefinition[] = [
  {
    id: "wall_stone",
    name: "Castle Wall (Stone)",
    cost: 5000,
    description: "100' long, 20' high, 10' thick. Includes battlements.",
  },
  {
    id: "wall_bl",
    name: "Battlement (Add-on)",
    cost: 500,
    description: "100' long. Add to existing walls or roofs.",
  },
  {
    id: "tower_sm",
    name: "Tower, Small Round",
    cost: 15000,
    description: "30' high, 20' diameter. Two levels.",
  },
  {
    id: "tower_md",
    name: "Tower, Round",
    cost: 22500,
    description: "40' high, 20' diameter. Three levels.",
  },
  {
    id: "tower_lg",
    name: "Tower, Large Round",
    cost: 30000,
    description: "50' high, 30' diameter. Four levels.",
  },
  {
    id: "tower_sq",
    name: "Tower, Square",
    cost: 30000,
    description: "40' high, 40' square base. Estimated from keep ratio.",
  },
  {
    id: "keep_sq",
    name: "Keep, Square",
    cost: 75000,
    description: "80' high, 60' square. The heart of the castle.",
  },
  {
    id: "gatehouse",
    name: "Gatehouse",
    cost: 6500,
    description: "20' high, 30' by 20' base. Portcullis included.",
  },
  {
    id: "barbican",
    name: "Barbican",
    cost: 38000,
    description: "Two small towers, gatehouse, and drawbridge complex.",
  },
  {
    id: "drawbridge",
    name: "Drawbridge",
    cost: 250,
    description: "10' wide wooden bridge. Requires gatehouse.",
  },
  {
    id: "moat_un",
    name: "Moat (Unfilled)",
    cost: 400,
    description: "100' long, 20' wide, 10' deep.",
  },
  {
    id: "moat_fill",
    name: "Moat (Filled)",
    cost: 800,
    description: "100' long, 20' wide, 10' deep. Water filled.",
  },
  {
    id: "bldg_wood",
    name: "Building (Wood)",
    cost: 1500,
    description: "30' by 30' (approx. 1,000 sq ft). 20' high.",
  },
  {
    id: "bldg_stone",
    name: "Building (Stone)",
    cost: 3000,
    description: "30' by 30' (approx. 1,000 sq ft). 20' high.",
  },
  {
    id: "palisade",
    name: "Palisade (Wood)",
    cost: 125,
    description: "100' long, 10' high. Simple defense.",
  },
  {
    id: "rampart",
    name: "Rampart (Earth)",
    cost: 2500,
    description: "100' long, 10' high.",
  },
  {
    id: "dungeon",
    name: "Dungeon Corridor",
    cost: 500,
    description: "10' by 10' by 10'. Hewn stone passage.",
  },
  {
    id: "civ_door_wood",
    name: "Door (Wood)",
    cost: 10,
    description: "Standard interior or exterior door.",
  },
  {
    id: "civ_door_rein",
    name: "Door (Reinforced)",
    cost: 20,
    description: "Iron-bound wooden door.",
  },
  {
    id: "civ_door_iron",
    name: "Door (Iron)",
    cost: 50,
    description: "Solid iron door.",
  },
  {
    id: "trap_door",
    name: "Trap Door (Secret)",
    cost: 100,
    description: "Hidden entrance or exit.",
  },
  {
    id: "arrow_slit",
    name: "Arrow Slit",
    cost: 10,
    description: "Murder hole for defense.",
  },
  {
    id: "window_bar",
    name: "Window (Barred)",
    cost: 10,
    description: "Window secured with iron bars.",
  },
  {
    id: "shutter",
    name: "Window (Shutter)",
    cost: 5,
    description: "Wooden shutter window.",
  },
];

const COMPONENT_LOOKUP = new Map(STRONGHOLD_COMPONENTS.map((component) => [component.id, component]));

export function getComponentById(id: string): StrongholdComponentDefinition | undefined {
  return COMPONENT_LOOKUP.get(id);
}

