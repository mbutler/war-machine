import type { TradeGoodKey, TerrainKey } from "../../state/schema";

export const TRADE_GOODS: Record<
  TradeGoodKey,
  {
    name: string;
    baseValue: number;
    demandMod: Record<TerrainKey, number>;
  }
> = {
  food: {
    name: "Food (Grain/Livestock)",
    baseValue: 1,
    demandMod: {
      plains: 1,
      forest: 0.8,
      hills: 0.9,
      mountains: 1.2,
      desert: 1.5,
      swamp: 1.3,
      coast: 1,
    },
  },
  metal: {
    name: "Metal (Iron/Copper)",
    baseValue: 5,
    demandMod: {
      plains: 1,
      forest: 1.1,
      hills: 1.2,
      mountains: 1.4,
      desert: 0.8,
      swamp: 0.9,
      coast: 1.1,
    },
  },
  cloth: {
    name: "Cloth (Wool/Linen)",
    baseValue: 3,
    demandMod: {
      plains: 1,
      forest: 1.1,
      hills: 1,
      mountains: 0.9,
      desert: 0.8,
      swamp: 1.2,
      coast: 1,
    },
  },
  wood: {
    name: "Wood (Timber/Lumber)",
    baseValue: 2,
    demandMod: {
      plains: 1.2,
      forest: 0.7,
      hills: 1,
      mountains: 1.1,
      desert: 1.4,
      swamp: 0.8,
      coast: 1.3,
    },
  },
  spice: {
    name: "Spice (Pepper/Cinnamon)",
    baseValue: 10,
    demandMod: {
      plains: 1,
      forest: 0.9,
      hills: 1,
      mountains: 1.1,
      desert: 0.7,
      swamp: 1,
      coast: 1.2,
    },
  },
  wine: {
    name: "Wine (Local Vintage)",
    baseValue: 8,
    demandMod: {
      plains: 1,
      forest: 1.1,
      hills: 1.2,
      mountains: 1.3,
      desert: 0.8,
      swamp: 0.9,
      coast: 1.1,
    },
  },
  weapons: {
    name: "Weapons (Swords/Armor)",
    baseValue: 15,
    demandMod: {
      plains: 1,
      forest: 1.2,
      hills: 1.1,
      mountains: 1.3,
      desert: 1.2,
      swamp: 1.4,
      coast: 1.1,
    },
  },
  gems: {
    name: "Gems (Precious Stones)",
    baseValue: 50,
    demandMod: {
      plains: 1,
      forest: 1,
      hills: 1.1,
      mountains: 1.2,
      desert: 1.1,
      swamp: 0.9,
      coast: 1.1,
    },
  },
};

export const TRANSPORT_CAPACITY = {
  wagon: 5000,
  ship: 30000,
  camel: 3000,
};

export const GUARD_COSTS = {
  none: 0,
  light: 0.1,
  standard: 0.25,
  heavy: 0.5,
};

export const GUILD_REDUCTION = {
  none: 0,
  member: 0.2,
  master: 0.5,
};

export const MARKET_CONDITION_LABELS = {
  normal: "Normal Market",
  festival: "Festival (+20% demand)",
  siege: "Siege/Shortage (+50% demand)",
  oversupply: "Oversupply (-30% demand)",
};

