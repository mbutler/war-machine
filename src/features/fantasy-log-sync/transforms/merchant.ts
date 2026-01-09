/**
 * Merchant Transform
 * 
 * Converts fantasy-log caravans and trade events to war-machine MerchantState.
 */

import type { Caravan, Good, FantasyLogWorld, LogEntry } from '../types';
import type { 
  MerchantState, 
  MerchantJourney, 
  TradeGoodKey,
  TerrainKey 
} from '../../../state/schema';
import { INITIAL_MERCHANT_STATE } from '../../../state/initialMerchant';
import { createId } from '../../../utils/id';
import { extractGoldFromEvent, isTradeEvent } from '../parser';

/**
 * Map fantasy-log goods to war-machine trade goods
 */
function mapGood(good: Good): TradeGoodKey {
  const mapping: Partial<Record<Good, TradeGoodKey>> = {
    'grain': 'food',
    'timber': 'wood',
    'ore': 'metal',
    'textiles': 'cloth',
    'salt': 'spice',
    'fish': 'food',
    'livestock': 'food',
    'spices': 'spice',
    'silk': 'cloth',
    'gems': 'gems',
    'wine': 'wine',
    'ivory': 'gems', // Close enough
    'dyes': 'cloth',
  };
  return mapping[good] ?? 'food';
}

/**
 * Estimate cargo value from goods
 */
function estimateCargoValue(goods: Good[]): number {
  const values: Record<Good, number> = {
    'grain': 50,
    'timber': 100,
    'ore': 150,
    'textiles': 200,
    'salt': 75,
    'fish': 40,
    'livestock': 120,
    'spices': 500,
    'silk': 400,
    'gems': 1000,
    'ivory': 800,
    'wine': 150,
    'dyes': 300,
  };
  
  return goods.reduce((sum, g) => sum + (values[g] ?? 100), 0);
}

/**
 * Transform a caravan to a merchant journey (in progress)
 */
function caravanToJourney(caravan: Caravan, world: FantasyLogWorld): MerchantJourney {
  const primaryGood = caravan.goods[0] ?? 'grain';
  const cargoValue = estimateCargoValue(caravan.goods);
  
  // Find settlement for origin/destination
  const origin = world.settlements.find(s => s.id === caravan.route[0]);
  const destination = world.settlements.find(s => s.id === caravan.route[1]);
  
  return {
    id: createId(),
    timestamp: Date.now(),
    tradeGood: mapGood(primaryGood),
    cargoValue,
    salePrice: Math.floor(cargoValue * 1.2), // Estimated
    totalCosts: Math.floor(cargoValue * 0.1),
    netProfit: Math.floor(cargoValue * 0.1),
    eventSummary: `${caravan.name} en route`,
    marketSummary: `${origin?.name ?? 'Unknown'} → ${destination?.name ?? 'Unknown'}`,
    status: 'pending',
    travelDays: Math.ceil((24 - caravan.progressHours) / 8),
  };
}

/**
 * Extract trade events from log as completed journeys
 */
function extractTradeJourneys(events: LogEntry[]): MerchantJourney[] {
  const journeys: MerchantJourney[] = [];
  
  const tradeEvents = events.filter(isTradeEvent);
  
  for (const event of tradeEvents) {
    const gold = extractGoldFromEvent(event);
    if (gold === null) continue;
    
    // Infer goods from event text
    let tradeGood: TradeGoodKey = 'food';
    const text = `${event.summary} ${event.details ?? ''}`.toLowerCase();
    if (text.includes('metal') || text.includes('ore')) tradeGood = 'metal';
    else if (text.includes('cloth') || text.includes('textile')) tradeGood = 'cloth';
    else if (text.includes('wood') || text.includes('timber')) tradeGood = 'wood';
    else if (text.includes('spice')) tradeGood = 'spice';
    else if (text.includes('wine')) tradeGood = 'wine';
    else if (text.includes('weapon')) tradeGood = 'weapons';
    else if (text.includes('gem')) tradeGood = 'gems';
    
    journeys.push({
      id: createId(),
      timestamp: new Date(event.worldTime).getTime(),
      tradeGood,
      cargoValue: Math.floor(gold * 0.8),
      salePrice: gold,
      totalCosts: Math.floor(gold * 0.1),
      netProfit: Math.floor(gold * 0.1),
      eventSummary: event.summary,
      marketSummary: event.location ?? 'Unknown',
      status: 'complete',
      deliveredAt: new Date(event.worldTime).getTime(),
    });
  }
  
  return journeys;
}

/**
 * Transform caravans and trade events to MerchantState
 */
export function transformMerchant(world: FantasyLogWorld, events: LogEntry[]): MerchantState {
  const state = { ...INITIAL_MERCHANT_STATE };
  
  // Convert active caravans to pending journeys
  const pendingJourneys = world.caravans.map(c => caravanToJourney(c, world));
  
  // Extract completed journeys from events
  const completedJourneys = extractTradeJourneys(events);
  
  state.ledger = [...completedJourneys, ...pendingJourneys];
  
  // Update form with most recent caravan info
  if (world.caravans.length > 0) {
    const recent = world.caravans[0];
    state.form = {
      ...state.form,
      houseName: recent.name.includes('Traders') || recent.name.includes('Wagons') 
        ? recent.name 
        : state.form.houseName,
      tradeGood: mapGood(recent.goods[0] ?? 'grain'),
      cargoValue: estimateCargoValue(recent.goods),
    };
  }
  
  return state;
}

/**
 * Get caravan summary for reference
 */
export function getCaravanSummary(world: FantasyLogWorld): Array<{
  name: string;
  route: string;
  goods: string[];
  progress: number;
}> {
  return world.caravans.map(c => ({
    name: c.name,
    route: `${c.route[0]} ↔ ${c.route[1]}`,
    goods: c.goods,
    progress: Math.floor((c.progressHours / 24) * 100),
  }));
}

