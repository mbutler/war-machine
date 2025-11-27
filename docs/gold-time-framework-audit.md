## BECMI Simulation Engine - Gold & Time Framework Audit

### Executive Summary

Your framework has a **solid f## BECMI Simulation Engine - Gold & Time.mdoundation** for tracking gold and time. The `CalendarState` with trackers and the distributed gold tracking across modules is well-designed. However, there are several gaps and inconsistencies that need addressing to achieve full BECMI compliance for time/gold tracking.

---

### ✅ **Strengths of Current Framework**

#### 1. **Centralized Time Tracking System**
Your `CalendarState` with trackers is excellent:

```12:43:src/features/calendar/state.ts
export type CalendarAdvanceUnit =
  | "round"
  | "turn"
  | "hour"
  | "watch"
  | "day"
  | "week"
  | "month"
  | "season";

// ... time conversion
const MINUTES_PER_UNIT: Record<CalendarAdvanceUnit, number> = {
  round: 10 / 60,
  turn: 10,
  hour: 60,
  watch: 240,
  day: 1440,
  week: 10080,
  month: 40320,
  season: 120960,
};
```

This correctly implements BECMI time units (10-minute turns, combat rounds).

#### 2. **Multi-Subsystem Gold Tracking**
Gold is tracked in multiple appropriate places:
- `PartyResources.bankedGold` & `loot` - adventuring wealth
- `DominionState.treasury` - dominion management
- `MerchantState.treasury` - merchant house funds
- `LabState.resources.gold` - magic item creation budget
- `DungeonState.loot` & `bankedGold` - dungeon exploration

#### 3. **Timed Actions with Calendar Integration**
The `CalendarTracker` system properly links timed activities:

```257:265:src/state/schema.ts
export interface CalendarTracker {
  id: string;
  name: string;
  remainingMinutes: number;
  initialMinutes: number;
  kind: CalendarTrackerKind;
  blocking: boolean;
  startedAt: number;
}
```

#### 4. **Dungeon Turn Tracking**
Properly advances time and handles torch consumption per BECMI rules:

```464:487:src/features/dungeon/state.ts
function advanceTurn(dungeon: typeof DEFAULT_STATE.dungeon, turns = 1): number {
  // ...
  const TORCH_DURATION_TURNS = 6;
  // Torch burns for 6 turns (1 hour) - correct BECMI rule
  // Wandering monster check every 2 turns - correct
}
```

---

### ⚠️ **Issues & Missing Components**

#### 1. **No Global Gold Ledger/Transaction System**

**Problem:** Gold flows between subsystems without a unified transaction log. You can't audit where gold went or reconstruct financial history.

**Recommendation:** Add a `GoldTransaction` interface:

```typescript
interface GoldTransaction {
  id: string;
  timestamp: number;
  calendarTime: CalendarClock;
  source: "party" | "dominion" | "merchant" | "lab" | "stronghold" | "dungeon";
  type: "income" | "expense" | "transfer";
  amount: number;
  description: string;
  linkedEntityId?: string; // project, journey, etc.
}
```

#### 2. **Retainer Wages Not Automatically Tracked**

**Problem:** Your `Retainer` interface has a `wage` field but there's no automated monthly/weekly wage deduction system.

```66:76:src/state/schema.ts
export interface Retainer {
  id: string;
  name: string;
  // ...
  wage: number;  // This exists but is never automatically deducted
  // ...
}
```

**Per BECMI rules:** Retainers must be paid regularly (usually monthly). Missing payments affect morale.

**Recommendation:** Add a recurring wage tracker that integrates with the calendar system.

#### 3. **Stronghold Construction Missing Time-Calendar Integration**

**Problem:** `StrongholdProject` has `buildDays` but doesn't automatically create calendar trackers for construction time.

```46:47:src/features/stronghold/logic.ts
  const buildDays = totalCost > 0 ? Math.ceil(totalCost / 500) : 0;
  // 500gp per day - this formula needs verification against BECMI
```

**Per BECMI rules:** Construction rate is 500 gp worth of work per day per engineer, with terrain multipliers.

**Recommendation:** When a project starts, automatically create a `CalendarTracker` for the build time.

#### 4. **Lab Magic Item Creation Costs Need Verification**

Your current lab costs:

```26:37:src/features/lab/logic.ts
  if (mode === "formula") {
    timeWeeks = Math.max(1, spellLevel);
    cost = timeWeeks * 1000;  // 1000gp/week for research
  } else if (itemType === "scroll") {
    timeWeeks = Math.max(1, spellLevel);
    cost = Math.max(1, spellLevel) * 500;  // 500gp per spell level
  } else if (itemType === "potion") {
    timeWeeks = 1;
    cost = 500;  // Fixed 500gp
  }
```

**Per BECMI rules cyclopedia:**
- Spell book reconstruction: 1,000 gp and 1 week per spell level
- Your scroll cost (500gp/level) appears reasonable but should be verified

#### 5. **Missing Starting Gold Verification**

Your generator correctly uses:

```317:317:src/features/party/generator.ts
  let gold = rollDice(3, 6) * 10;
```

This matches BECMI: "Roll 3d6 and multiply by 10" ✅

#### 6. **Equipment Prices Incomplete**

Your equipment table is minimal:

```5:19:src/rules/tables/equipment.ts
export const EQUIPMENT_PRICES: EquipmentPriceMap = {
  "Sword": 10,
  "Mace": 5,
  "Dagger": 3,
  "Chain Mail": 40,
  "Leather": 20,
  "Shield": 10,
  // ... only ~12 items
};
```

**Missing critical items:**
- All weapon types (two-handed sword, pole arms, crossbows, etc.)
- All armor types (plate mail, banded mail)
- Standard adventuring gear (rope, lantern, oil, spikes, etc.)
- Horses and mounts (very expensive - 75-250 gp)
- Vehicles (cart, wagon, boat)

#### 7. **Dominion Income Formula Not Verified**

```106:108:src/rules/dominion.ts
  const population = Math.max(0, state.families);
  const resourceValue = sumResourceValue(state.resources);
  const grossIncome = population * (turn.taxRate + resourceValue);
```

**Question:** Is `population * taxRate` the correct BECMI formula? The rules cyclopedia references need verification. Tax rate should be in gp per family.

#### 8. **Wilderness Travel Time Not Perfectly Integrated**

Your wilderness system advances hours correctly:

```671:686:src/features/wilderness/state.ts
function spendMovementPoints(state: WildernessState, cost: number): number {
  // ...
  const hoursSpentTraveling = (cost / state.maxMovementPoints) * 8;
  // Returns hours for calendar advancement
}
```

However, daily supply consumption needs to also deduct gold for rations if purchased rather than foraged.

#### 9. **Missing XP-to-Gold Conversion (Treasure Tracking)**

BECMI awards 1 XP per 1 GP of treasure recovered. Your treasure system generates treasure but doesn't track:
- Treasure → Party Gold flow with XP attribution
- GP conversion rates for gems/jewelry (currently hardcoded: gems=50gp, jewelry=100gp)

```594:604:src/features/dungeon/state.ts
  if (table.gems && Math.random() * 100 < table.gems.pct) {
    const count = rollFormula(table.gems.roll);
    summary.push(`${count}x gems`);
    total += count * 50;  // Fixed 50gp per gem - should use random table
  }
```

**Per BECMI:** Gem values range from 10gp to 10,000gp based on a random roll.

#### 10. **Siege Costs Not Tracked**

Your siege system tracks battles but not:
- Troop wages during siege (per BECMI: dominion costs continue)
- Ammunition costs (mentioned in rules: "weekly costs")
- Siege engine maintenance

---

### 📋 **Recommended Schema Additions**

To make your time/gold tracking truly robust:

```typescript
// Add to schema.ts

export interface GoldLedgerEntry {
  id: string;
  timestamp: number;
  calendarClock: CalendarClock;
  category: "wage" | "construction" | "research" | "supplies" | "tax" | "trade" | "loot" | "misc";
  source: CalendarTrackerKind | "party";
  amount: number;
  balance: number;  // Running balance after this transaction
  description: string;
  linkedId?: string;
}

export interface RecurringExpense {
  id: string;
  name: string;
  amount: number;
  frequency: "daily" | "weekly" | "monthly" | "seasonal";
  nextDue: CalendarClock;
  source: CalendarTrackerKind;
  active: boolean;
}

// Extend PartyState
export interface PartyState {
  roster: Character[];
  preferences: PartyPreferences;
  partyResources: PartyResources;
  goldLedger: GoldLedgerEntry[];     // ADD
  recurringExpenses: RecurringExpense[];  // ADD (retainer wages, etc.)
}
```

---

### 📊 **Priority Recommendations**

| Priority | Item | Impact |
|----------|------|--------|
| **HIGH** | Add gold transaction logging | Auditability, debugging |
| **HIGH** | Implement retainer wage auto-deduction | Core BECMI rule |
| **HIGH** | Complete equipment price tables | Character generation accuracy |
| **MEDIUM** | Link stronghold projects to calendar trackers | Time tracking consistency |
| **MEDIUM** | Verify dominion income formula against BECMI | Economic accuracy |
| **MEDIUM** | Add gem/jewelry value randomization | Treasure accuracy |
| **LOW** | Add siege supply/ammunition costs | Advanced feature |
| **LOW** | Track daily ration gold costs when purchased | Realism |

---

### 🎯 **Conclusion**

Your framework is **fundamentally solid**. The calendar tracker system and distributed gold tracking provide a good foundation. The main gaps are:

1. **Transaction logging** - You track balances but not the flow
2. **Recurring expenses** - Wages, maintenance, etc. aren't automated
3. **Data completeness** - Equipment tables, gem values need expansion
4. **System integration** - Some subsystems (stronghold, siege) don't fully integrate with calendar/gold

The architecture is good - you just need to fill in the gaps and add the "accounting" layer that BECMI demands. Would you like me to help implement any of these specific improvements?