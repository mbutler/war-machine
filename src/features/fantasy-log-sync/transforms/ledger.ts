/**
 * Ledger Transform
 * 
 * Extracts gold transactions from fantasy-log events.
 */

import type { LogEntry, FantasyLogWorld } from '../types';
import type { LedgerState, LedgerTransaction, LedgerCategory, LedgerSource } from '../../../state/schema';
import { createId } from '../../../utils/id';
import { extractGoldFromEvent, isCombatEvent, isTradeEvent, isConstructionEvent } from '../parser';

/**
 * Determine ledger category from event
 */
function categorizeEvent(event: LogEntry): LedgerCategory {
  if (isCombatEvent(event)) return 'loot';
  if (isTradeEvent(event)) return 'trade';
  if (isConstructionEvent(event)) return 'construction';
  
  const text = `${event.summary} ${event.details ?? ''}`.toLowerCase();
  
  if (text.includes('tax') || text.includes('tithe')) return 'tax';
  if (text.includes('wage') || text.includes('pay') || text.includes('hire')) return 'wage';
  if (text.includes('equip') || text.includes('armor') || text.includes('weapon')) return 'equipment';
  if (text.includes('ration') || text.includes('supplie')) return 'supplies';
  
  return 'misc';
}

/**
 * Determine ledger source from event category
 */
function sourceFromCategory(event: LogEntry): LedgerSource {
  switch (event.category) {
    case 'dungeon': return 'dungeon';
    case 'road': return 'wilderness';
    case 'town': return 'party';
    case 'faction': return 'dominion';
    default: return 'manual';
  }
}

/**
 * Extract calendar info from world or event
 */
function getCalendarFromDate(dateStr: string, world: FantasyLogWorld): { year: number; month: number; day: number } {
  // Prefer world calendar if available
  if (world.calendar) {
    return {
      year: world.calendar.year,
      month: world.calendar.month,
      day: world.calendar.day,
    };
  }
  
  // Parse from ISO date
  const date = new Date(dateStr);
  return {
    year: date.getUTCFullYear(),
    month: date.getUTCMonth(),
    day: date.getUTCDate(),
  };
}

/**
 * Extract all gold transactions from events
 */
export function extractTransactions(events: LogEntry[], world: FantasyLogWorld): LedgerTransaction[] {
  const transactions: LedgerTransaction[] = [];
  let runningBalance = 0;
  
  for (const event of events) {
    const gold = extractGoldFromEvent(event);
    if (gold === null) continue;
    
    const calendar = getCalendarFromDate(event.worldTime, world);
    const category = categorizeEvent(event);
    const source = sourceFromCategory(event);
    
    // Determine if income or expense
    const text = `${event.summary} ${event.details ?? ''}`.toLowerCase();
    const isExpense = text.includes('spend') || text.includes('cost') || 
                      text.includes('pay') || text.includes('hire') ||
                      text.includes('build') || text.includes('purchase');
    
    const amount = isExpense ? -gold : gold;
    runningBalance += amount;
    
    transactions.push({
      id: createId(),
      timestamp: new Date(event.realTime).getTime(),
      calendarYear: calendar.year,
      calendarMonth: calendar.month,
      calendarDay: calendar.day,
      source,
      category,
      amount,
      balance: runningBalance,
      description: event.summary,
    });
  }
  
  return transactions;
}

/**
 * Transform events to LedgerState
 */
export function transformLedger(events: LogEntry[], world: FantasyLogWorld): LedgerState {
  const transactions = extractTransactions(events, world);
  
  // Calculate final balance
  const balance = transactions.reduce((sum, t) => sum + t.amount, 0);
  
  return {
    balance: Math.max(0, balance),
    transactions,
    recurringExpenses: [], // These would need to be inferred or manually set
  };
}

/**
 * Get a summary of gold flow from events
 */
export function getGoldSummary(events: LogEntry[]): {
  totalIncome: number;
  totalExpenses: number;
  netGold: number;
  transactions: number;
} {
  let totalIncome = 0;
  let totalExpenses = 0;
  let transactionCount = 0;
  
  for (const event of events) {
    const gold = extractGoldFromEvent(event);
    if (gold === null) continue;
    
    transactionCount++;
    const text = `${event.summary} ${event.details ?? ''}`.toLowerCase();
    const isExpense = text.includes('spend') || text.includes('cost') || 
                      text.includes('pay') || text.includes('hire');
    
    if (isExpense) {
      totalExpenses += gold;
    } else {
      totalIncome += gold;
    }
  }
  
  return {
    totalIncome,
    totalExpenses,
    netGold: totalIncome - totalExpenses,
    transactions: transactionCount,
  };
}

