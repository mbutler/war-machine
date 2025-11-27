# BECMI D&D Rules Compliance Audit

This document audits the current JavaScript implementation against the official BECMI Rules Cyclopedia to identify discrepancies, missing features, incorrect implementations, and areas requiring compliance fixes. The goal is 100% compliance with official rules.

## Key Findings Summary

### Major Missing Components:
- **Experience Point System** - Completely missing; characters have levels but no XP tracking or progression tables
- **Demihuman Mechanics** - Saving throws, THAC0 tables, and attack ranks system for dwarves, elves, and halflings
- **Spell Casting System** - Spell lists exist but no casting mechanics, effects, or descriptions
- **Optional Classes** - Druid and Mystic classes not implemented

### Partially Implemented but Needing Work:
- **Thief Special Abilities** - Backstab, scroll reading/casting abilities missing
- **Class Restrictions** - Weapon restrictions (e.g., clerics can't use edged weapons) not enforced
- **Prime Requisite Bonuses** - XP bonuses for high ability scores not implemented

### Well Implemented:
- **Ability Modifiers** - Correctly implemented
- **Basic Spell Lists** - Magic-User and Cleric spell names are present
- **Spell Slot Tables** - Progression appears correct
- **Thief Skill Tables** - Basic skill percentages implemented

### Implementation Priority

**High Priority** (core functionality):
- Experience system with XP tracking and level progression
- Demihuman saving throws, THAC0, and attack ranks
- Spell casting mechanics and effects
- Character schema updates

**Medium Priority** (gameplay features):
- Thief special abilities (backstab, scroll use)
- Class-based restrictions
- Equipment verification

**Low Priority** (advanced features):
- Optional classes (Druid, Mystic)
- Optional rules (weapon mastery, two-weapon fighting)

## Character Classes

### Class Definitions
**Status: Partial Compliance**

#### Issues Found:
1. **Missing Classes**: Half-Elf class is mentioned in the table of contents but not implemented. The code has "halfling" but the rules use "halfing" (appears to be a typo in the rules for "halfling").
2. **Optional Classes**: Druid and Mystic classes are not implemented, though they are marked as optional in the rules.
3. **Class Requirements**: Current requirements in `classes.ts` appear correct but need verification against full class descriptions.
4. **Prime Requisites**: The prime requisite handling needs verification - some classes have dual primes (e.g., Elf has STR/INT).

#### Current Implementation:
```typescript
// From src/rules/tables/classes.ts
export const CLASS_DEFINITIONS: Record<string, ClassDefinition> = {
  cleric: { key: "cleric", name: "Cleric", hd: 6, req: { wis: 9 }, prime: "wis", type: "human" },
  fighter: { key: "fighter", name: "Fighter", hd: 8, req: { str: 9 }, prime: "str", type: "human" },
  magicuser: { key: "magicuser", name: "Magic-User", hd: 4, req: { int: 9 }, prime: "int", type: "human" },
  thief: { key: "thief", name: "Thief", hd: 4, req: { dex: 9 }, prime: "dex", type: "human" },
  dwarf: { key: "dwarf", name: "Dwarf", hd: 8, req: { con: 9 }, prime: "str", type: "demihuman" },
  elf: { key: "elf", name: "Elf", hd: 6, req: { int: 9, str: 9 }, prime: "str_int", type: "demihuman" },
  halfling: { key: "halfling", name: "Halfling", hd: 6, req: { dex: 9, con: 9 }, prime: "str_dex", type: "demihuman" },
};
```

#### Required Changes:
1. Implement Half-Elf class (if it's a valid class) or remove from table of contents references
2. Add optional Druid and Mystic classes
3. Verify and correct prime requisite handling for multi-stat classes
4. Add experience bonus calculations (5% for 13-15, 10% for 16-18 in prime stats)

### Experience Tables
**Status: Not Implemented**

#### Issues Found:
1. **Missing Experience Tables**: No experience point tables implemented for any class
2. **Level Progression**: Characters have level but no XP tracking
3. **Schema Issue**: Character schema lacks XP field entirely
4. **Prime Requisite Bonuses**: XP bonuses for high prime stats (5% for 13-15, 10% for 16-18) not implemented

#### Current Implementation Gaps:
- No XP field in Character interface
- No experience tables for any class
- No level-up mechanics
- No XP bonus calculations

#### Required Changes:
1. Add `xp: number` field to Character interface
2. Implement complete experience tables:
   - Cleric: 1,500 → 2,900,000 XP (36 levels)
   - Fighter: 2,000 → 3,480,000 XP (36 levels)
   - Magic-User: 2,500 → 2,750,000 XP (36 levels)
   - Thief: 1,250 → 1,800,000 XP (36 levels)
   - Dwarf: 2,200 → 220,000 XP (12 levels max)
   - Elf: 4,000 → 375,000 XP (10 levels max)
   - Halfling: 2,000 → 100,000 XP (8 levels max)
3. Add XP tracking and level-up logic
4. Implement prime requisite XP bonuses
5. Add experience bonus calculations for high ability scores

### Hit Dice
**Status: Basic Implementation**

#### Issues Found:
1. **Constitution Bonuses**: Hit die rolls include CON bonuses but post-9th level rules may not be correctly implemented
2. **Post-9th Level**: Rules specify +1 hp/level after 9th for clerics, +2 hp/level after 9th for fighters, but CON bonuses stop applying

#### Required Changes:
1. Verify post-9th level HP calculation is correct
2. Ensure CON bonuses only apply to rolled HP, not fixed post-9th bonuses

### Saving Throws
**Status: Partially Implemented - Human Classes Only**

#### Issues Found:
1. **Missing Demihuman Tables**: No saving throw tables implemented for demihuman classes
2. **Table Verification Needed**: Human class tables need verification against official values

#### Current Implementation:
- Human classes (Fighter, Cleric, Magic-User, Thief) have saving throw tables
- Demihuman classes completely missing saving throw implementations

#### Official Rules Discrepancies:
**Dwarf Saving Throws** (levels 1-3/4-6/7-9/10-12):
- Death/Poison: 8/6/4/2
- Wands: 9/7/5/3
- Paralysis/Stone: 10/8/6/4
- Breath: 13/10/7/4
- Spells: 12/9/6/3
- Special: At 1,400,000 XP, half damage from spells, quarter if save successful

**Elf Saving Throws** (levels 1-3/4-6/7-9/10):
- Death/Poison: 12/8/4/2
- Wands: 13/10/7/4
- Paralysis/Stone: 13/10/7/4
- Breath: 15/11/7/3
- Spells: 15/11/7/3
- Special: At 1,600,000 XP, half damage from breath, quarter if save successful

**Halfling Saving Throws**: Need to locate in rules

#### Required Changes:
1. Implement demihuman saving throw tables with correct progressions
2. Add special saving throw bonuses for high-level demihumans
3. Verify human class saving throw values against official tables
4. Add level-based saving throw lookups for demihumans

### THAC0 (To Hit Armor Class 0)
**Status: Basic Implementation - Human Classes Only**

#### Issues Found:
1. **Missing Demihuman THAC0**: No THAC0 tables for demihuman classes
2. **Attack Ranks System**: Demihumans use "attack ranks" instead of levels beyond their maximum experience level
3. **Table Verification**: Human THAC0 values need verification against official tables

#### Current Implementation:
- Human classes have THAC0 progressions (appears mostly correct)
- Demihuman THAC0 completely missing

#### Official Rules - Demihuman Attack Ranks:
**Dwarf Attack Ranks**: After 12th level, dwarves gain attack ranks every 100,000 XP
- Attack ranks use fighter THAC0 equivalent (e.g., attack rank 1 = fighter level 1, etc.)

**Elf Attack Ranks**: After 10th level, elves gain attack ranks every 200,000 XP
- Limited to 5th level spells but can continue improving combat ability

**Halfling Attack Ranks**: After 8th level, halflings gain attack ranks every 150,000 XP

#### Required Changes:
1. Implement demihuman THAC0 tables with attack rank system
2. Add attack rank tracking for demihumans beyond level caps
3. Verify human class THAC0 values against official tables
4. Implement attack rank progression XP requirements

## Ability Scores

### Ability Modifiers
**Status: Needs Verification**

#### Issues Found:
1. **Missing Implementation**: No ability modifier tables found in current code
2. **Prime Requisite Bonuses**: XP bonuses for high prime stats not implemented

#### Required Changes:
1. Implement ability score modifiers table
2. Add prime requisite XP bonus calculations
3. Verify all ability score effects (hit probability, damage, etc.)

## Spells

### Spell Lists
**Status: Partially Implemented - Basic Lists Exist**

#### Current Implementation:
- Magic-User spell lists implemented (9 levels, appears complete)
- Cleric spell lists implemented (7 levels, higher levels empty)
- Spell slot tables implemented for both classes
- Basic spell memorization framework exists

#### Issues Found:
1. **Spell Descriptions**: No spell descriptions, effects, ranges, durations implemented
2. **Casting Mechanics**: No actual spell casting system (range, duration, effects)
3. **Druid/Mystic Spells**: Optional class spells not implemented
4. **Spell Verification**: Need to verify spell lists against official rules
5. **Cleric Spell Slots**: Higher level slots appear empty in implementation

#### Official Rules Requirements:
- Magic-Users: 9 spell levels, specific spells per level
- Clerics: 7 spell levels (no 8th/9th level spells)
- Druids: Separate spell list (optional class)
- Mystics: Separate spell list (optional class)
- Elves: Limited to 5th level magic-user spells

#### Required Changes:
1. Add complete spell descriptions (effects, ranges, durations, components)
2. Implement spell casting mechanics and resolution
3. Add druid and mystic spell lists
4. Verify all spell names and placements against official rules
5. Implement elf spell level restrictions (5th level max)
6. Complete cleric spell slots for all levels

### Spell Progression
**Status: Partial Implementation**

#### Issues Found:
1. **Slot Tracking**: Basic slot arrays exist but need verification against official tables
2. **Demihuman Limits**: Elves limited to 5th level spells, not implemented

#### Required Changes:
1. Verify spell slot tables against official rules
2. Implement spell level limits for demihumans
3. Add spell progression for optional classes (druid, mystic)

## Thief Skills

### Thief Skills and Special Abilities
**Status: Partially Implemented - Basic Tables Exist**

#### Current Implementation:
- Thief skill tables implemented (14 levels, 9 skills: OL, FT, RT, CW, MS, HS, PP, HN, RL)
- Skill progression appears to follow official patterns

#### Issues Found:
1. **Skill Verification**: Need to verify skill percentages against official tables
2. **Backstab**: Thief backstab ability not implemented
3. **Special Abilities**: Thief special abilities (read languages from scrolls, cast MU spells from scrolls at 10th level) not implemented
4. **Thief Tools**: Requirements for thieves' tools not enforced

#### Official Rules Requirements:
**Thief Skills** (need verification):
- Open Locks (OL)
- Find/Remove Traps (FT/RT)
- Climb Walls (CW)
- Move Silently (MS)
- Hide in Shadows (HS)
- Pick Pockets (PP)
- Hear Noise (HN)
- Read Languages (RL) - starts at 4th level

**Special Abilities**:
- Backstab (x2 damage at 1st-4th, x3 at 5th-8th, x4 at 9th-12th, x5 at 13th+)
- Read languages from scrolls/books at 4th level
- Cast magic-user spells from scrolls at 10th level (10% chance of backfire)
- Thieves' tools required for most skills

#### Required Changes:
1. Verify thief skill percentages against official tables
2. Implement backstab mechanics with level-based multipliers
3. Add special thief abilities (scroll reading, spell casting)
4. Implement thieves' tools requirements
5. Add skill failure mechanics and consequences

## Equipment

### Weapons & Armor
**Status: Needs Verification**

#### Issues Found:
1. **Missing Equipment Tables**: Equipment definitions exist but need verification against official costs and stats
2. **Weapon Mastery**: Not implemented (optional rule for fighters)
3. **Class Restrictions**: Weapon restrictions by class not fully implemented

#### Required Changes:
1. Verify all equipment costs, weights, damage values
2. Implement weapon mastery system (optional)
3. Add class-based weapon restrictions (clerics can't use edged weapons)

### Adventuring Gear
**Status: Needs Verification**

#### Issues Found:
1. **Incomplete Gear List**: Basic equipment exists but comprehensive adventuring gear may be missing

#### Required Changes:
1. Verify complete equipment list against rules
2. Add missing adventuring gear items

## Combat

### Attack Rolls
**Status: Basic Implementation**

#### Issues Found:
1. **THAC0 System**: Basic implementation exists but demihuman attack ranks missing
2. **Two-Weapon Fighting**: Optional rule not implemented
3. **Unarmed Combat**: Rules exist but may not be implemented

#### Required Changes:
1. Complete THAC0 implementation for all classes
2. Add optional two-weapon fighting rules
3. Implement unarmed combat mechanics

### Initiative
**Status: Not Implemented**

#### Issues Found:
1. **Missing Initiative System**: No initiative mechanics found

#### Required Changes:
1. Implement initiative system (roll 1d6, optional DEX modifiers)

### Morale
**Status: Not Implemented**

#### Issues Found:
1. **Monster Morale**: Optional rule not implemented
2. **Retainer Morale**: Basic tracking exists but rules may be incomplete

#### Required Changes:
1. Implement monster morale checks (optional)
2. Verify retainer morale mechanics

## Dungeon Exploration

### Wandering Monsters
**Status: Not Implemented**

#### Issues Found:
1. **Missing Encounter Tables**: No wandering monster mechanics
2. **Turn Structure**: Basic turn tracking exists but full exploration rules missing

#### Required Changes:
1. Implement wandering monster encounter tables
2. Add encounter frequencies and triggers
3. Complete dungeon exploration turn mechanics

### Treasure Generation
**Status: Partial Implementation**

#### Issues Found:
1. **Treasure Types**: Basic treasure generation exists but needs verification against official tables
2. **Magic Item Generation**: May be incomplete or missing

#### Required Changes:
1. Verify treasure tables (A-L types)
2. Complete magic item generation
3. Add gem and jewelry value tables

## Wilderness Exploration

### Travel Rules
**Status: Basic Implementation**

#### Issues Found:
1. **Movement Rates**: Basic hex movement exists but detailed terrain modifiers may be missing
2. **Encounters**: Wilderness encounter tables not fully implemented

#### Required Changes:
1. Verify terrain movement costs
2. Implement complete wilderness encounter tables
3. Add weather effects on travel

### Weather
**Status: Not Implemented**

#### Issues Found:
1. **Missing Weather System**: No weather generation or effects

#### Required Changes:
1. Implement weather generation system
2. Add weather effects on movement and encounters

## Stronghold & Dominion Rules

### Stronghold Construction
**Status: Basic Implementation**

#### Issues Found:
1. **Cost Calculations**: Basic stronghold building exists but needs verification
2. **Special Benefits**: Castle benefits and income generation may be incomplete

#### Required Changes:
1. Verify stronghold construction costs
2. Implement castle income and benefits
3. Add stronghold management rules

### Dominion Management
**Status: Partial Implementation**

#### Issues Found:
1. **Taxation**: Basic tax system exists but may not match official rules
2. **Population Growth**: Population mechanics need verification

#### Required Changes:
1. Verify taxation and income rules
2. Complete population growth mechanics
3. Add dominion event system

## Merchant & Trade Rules

### Trade Mechanics
**Status: Implementation Exists**

#### Status: Needs Verification
1. **Profit Calculations**: Merchant system exists but needs verification against official trade rules

#### Required Changes:
1. Verify trade good prices and profit margins
2. Check caravan costs and risks

## Siege Rules

### Siege Mechanics
**Status: Implementation Exists**

#### Status: Needs Verification
1. **Combat Calculations**: Siege system exists but needs verification against official rules

#### Required Changes:
1. Verify siege engine effects and costs
2. Check troop quality modifiers

## Calendar & Time

### Time Tracking
**Status: Basic Implementation**

#### Issues Found:
1. **Calendar System**: Basic calendar exists but holiday and festival system may be incomplete

#### Required Changes:
1. Implement complete holiday and festival calendar
2. Add seasonal effects on activities

## Critical Issues Requiring Immediate Attention

1. **Experience Point System**: Completely missing - characters have levels but no XP tracking or experience tables
2. **Demihuman Classes**: Saving throws, THAC0 tables, and attack ranks system completely missing
3. **Spell Casting Mechanics**: Spell lists exist but no casting system, spell effects, or descriptions implemented
4. **Optional Classes**: Druid and Mystic classes not implemented (marked as optional in rules)
5. **Thief Special Abilities**: Backstab, scroll reading/casting abilities not implemented
6. **Class Restrictions**: Weapon restrictions (clerics can't use edged weapons) not enforced
7. **Prime Requisite Bonuses**: XP bonuses for high ability scores not implemented
8. **Character Schema**: Missing XP field and other core character attributes

## Rules Questions Requiring Decisions

1. **Half-Elf Class**: The rules mention Half-Elf in the table of contents but provide minimal detail. Is this a complete class that should be implemented?
2. **Optional Rules**: Which optional rules should be included (Druid/Mystic classes, weapon mastery, two-weapon fighting, morale, etc.)?
3. **Magic Item Identification**: How should magic item identification work (current implementation unclear)?
4. **Hireling Loyalty**: How should retainer/hireling loyalty be handled beyond basic morale?

## Implementation Priority

### High Priority (Core BECMI Functionality)
1. **Experience System**: Implement XP tracking, experience tables, and level progression for all classes
2. **Demihuman Mechanics**: Add saving throws, THAC0 tables, and attack ranks for dwarves, elves, halflings
3. **Spell Casting**: Implement spell effects, casting mechanics, and spell descriptions
4. **Character Schema Updates**: Add missing fields (XP, proper ability handling)

### Medium Priority (Gameplay Features)
1. **Thief Abilities**: Implement backstab, scroll reading/casting, and skill tool requirements
2. **Class Restrictions**: Enforce weapon restrictions and class-specific rules
3. **Prime Requisite System**: Add XP bonuses and multi-stat prime req handling
4. **Equipment Verification**: Verify all costs, weights, and complete equipment lists

### Low Priority (Advanced/Optional Features)
1. **Optional Classes**: Druid and Mystic class implementation
2. **Optional Rules**: Weapon mastery, two-weapon fighting, detailed morale
3. **Advanced Magic**: Complete magic item creation and identification
4. **Calendar Details**: Holiday events and seasonal effects
