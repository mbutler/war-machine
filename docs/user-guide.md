# War Machine User Guide

*A Suite of Productivity Tools for Classic D&D BECMI Campaigns*

---

## Welcome, Dungeon Master

War Machine isn't a video game. It's a **game master's companion**—a collection of tools designed to handle the arithmetic, tables, and bookkeeping that can slow down your classic D&D game sessions. This suite helps you run adventures according to strict BECMI (Basic, Expert, Companion, Master, Immortal) rules, freeing you to focus on storytelling, rulings, and player interaction.

Think of War Machine as your digital referee's screen: it doesn't replace your judgment or imagination, but it does the heavy lifting when you need to generate a party of characters, track dungeon turns, calculate dominion income, or roll treasure hoards by-the-book.

### What You'll Find Here

This guide walks you through **how to use War Machine** while explaining **why BECMI D&D works the way it does**. You'll learn the natural workflow of classic D&D—from creating characters to exploring dungeons to ruling kingdoms—and see how each tool supports that experience.

---

## The Heart of BECMI: Procedural Play and Timekeeping

Before we dive into specific tools, let's understand what makes BECMI D&D distinct.

### The Three Scales of Time

Classic D&D operates on three interconnected timescales:

**1. The Dungeon Turn (10 minutes)**
When your party ventures underground, time becomes precious. Each turn represents 10 minutes of careful exploration: checking for traps, listening at doors, mapping corridors. After every two turns, you roll for wandering monsters. Torches burn for 6 turns (1 hour). This creates tension—every decision has a time cost.

**2. The Wilderness Day**
When traveling overland, time moves in day-long increments. Your party covers miles based on terrain difficulty (6 miles in clear terrain, 12 miles through mountains). You must track rations (one per person per day), water (important in deserts), and check for encounters. Weather affects morale and travel speed.

**3. The Dominion Season**
Once characters reach Name level (9th+) and rule domains, time advances in seasonal turns. You collect taxes, pay troops, manage resources, and resolve events. This is where your adventurers become kings, building the world they've been exploring.

War Machine's **Calendar** tool coordinates all three scales, ensuring that when your party spends 3 days in a dungeon, those days pass on your campaign clock. When a merchant caravan travels for 2 weeks, that time advances properly. Everything stays synchronized.

---

## Starting Your Campaign: The Party Generator

### Creating Characters the Classic Way

In BECMI D&D, character creation is quick, random, and embraces the unpredictability of fate. You don't craft an optimized build—you roll dice and discover who you're playing.

**The Strict Method (3d6 in Order)**
Roll 3d6 six times, in order: Strength, Intelligence, Wisdom, Dexterity, Constitution, Charisma. Whatever you roll, those are your abilities. This is the classic way, teaching players to make the most of what they're given. A fighter with an 8 Strength learns to be clever. A magic-user with low Intelligence becomes cautious.

**The Heroic Method (4d6 drop lowest)**
For more competent heroes, this method provides higher average scores. Still random, but characters will be more capable.

### Using the Party Generator

1. **Navigate to the Party panel** in War Machine
2. **Set your preferences**:
   - **Party Size**: 4-6 characters is traditional
   - **Level**: Start at 1st level for new campaigns
   - **Method**: Choose Strict or Heroic
3. **Click "Generate Party"**

War Machine instantly creates a complete party following BECMI rules:
- Ability scores rolled appropriately
- Classes assigned (or race-as-class for demihumans)
- Prime requisites adjusted (you can optionally lower other abilities to raise your prime requisite)
- Hit points rolled (with Constitution modifiers)
- Starting equipment purchased
- Saving throws and THAC0 calculated
- Spells selected for casters
- Thief skills noted

### Understanding Your Party

Each character card shows:

**Ability Scores**: The six core abilities with their modifiers. In BECMI, modifiers are smaller than in modern D&D—a +1 bonus is significant.

**Combat Profile**: 
- **Hit Points**: Damage you can sustain. At 0 HP, you're dead (no unconscious rules at basic level).
- **Armor Class**: Lower is better. AC 9 is unarmored, AC 2 is plate mail with shield.
- **THAC0**: "To Hit Armor Class 0"—your attack capability. Roll 1d20, meet or beat THAC0 minus enemy AC.

**Saving Throws**: Five categories of saves against special attacks. These don't scale with your level as quickly as in modern games—a 1st level character facing a dragon's breath has a real chance of dying.

**Equipment**: Starting gear based on class. Fighters get better armor, magic-users get minimal protection but spell components.

### Retainers: You Can't Do It Alone

One of BECMI's best features is **retainers**—NPCs who join your party. At low levels, the wilderness is deadly. Smart parties recruit help:

- **Normal retainers**: Hired hands (5 gp/month)
- **Torchbearers**: Carry light sources (1 gp/month)
- **Porters**: Haul treasure (1 gp/month)
- **Mercenaries**: Armed guards (varies by type)

Charisma determines how many retainers you can employ and their morale. A character with Charisma 13 can have up to 5 retainers. When danger strikes, the DM rolls morale checks (2d6)—if retainers fail, they flee.

To add a retainer in War Machine:
1. Select a character
2. Click **"Recruit Retainer"**
3. Choose the type
4. The retainer appears with stats and equipment

Remember: Retainers are people, not disposable resources. Treat them well or watch them abandon you at the worst moment.

---

## The Treasury Ledger: Gold and Logistics

In BECMI, **gold matters**. You don't level up from killing monsters—you level up from **recovering treasure**. The classic formula: 1 XP per 1 gp of treasure returned to civilization.

### The Party Treasury

The **Ledger** is your party's shared financial record. It tracks:
- **Balance**: Current gold pieces
- **Transactions**: Income and expenses with date stamps
- **Recurring Expenses**: Retainer wages, spell research, stronghold upkeep

### The Equipment Shop

War Machine includes BECMI's complete equipment list with accurate costs and encumbrance:

**Key Items for Adventurers**:
- **Torches** (1 gp for 6): Burn for 1 hour (6 turns), light a 30' radius. Essential for dungeons.
- **Iron Rations** (1 week for 15 gp): Preserved food that won't spoil. Each character needs 1 per day of travel.
- **Waterskin** (1 gp): Holds water for 1 day. Critical in deserts.
- **Rope** (50' for 1 gp): You'll need this constantly.
- **Iron Spikes** (12 for 1 gp): Jam doors, secure ropes, test pit depths.
- **Backpack** (5 gp): Carry your gear. Without one, you're limited to what you can hold.

**Buying and Selling**:
1. Go to the **Ledger** panel
2. Select the **"Equipment Shop"** tab
3. Search or browse by category
4. Set quantity and click **"Buy"**
5. The cost is deducted from your treasury automatically

Selling equipment returns 50% of the purchase price (standard BECMI rule).

### Manual Adjustments

Found treasure? Paid for room and board? Use **Manual Adjustment**:
1. Enter the amount (positive for income, negative for expenses)
2. Add a description ("Goblin treasure, room 12" or "Week at the Green Dragon Inn")
3. Click **Add**

The ledger timestamps every transaction, creating a complete financial history of your campaign.

---

## Wilderness Exploration: The Royal Cartographer

When your party leaves civilization, they enter the **wilderness hexcrawl**—one of BECMI's most atmospheric modes of play.

### Understanding Hex Travel

The BECMI wilderness is mapped in **hexes**, each representing about **8 miles** (or 24 miles for large-scale maps). Travel time depends on terrain:

- **Clear/Grassland**: 6 miles per day (3/4 of a hex)
- **Woods/Hills**: 9 miles per day (slightly more than 1 hex)
- **Mountains/Swamp/Desert**: 12 miles per day (1.5 hexes)
- **Settlement**: 4 miles per day (1/2 hex)

These speeds assume **careful travel**—the party is mapping, watching for danger, and moving tactically. Forced marches can double distance but cause exhaustion.

### The Royal Cartographer Tool

War Machine's Wilderness panel simulates hex exploration with proper time tracking and survival mechanics.

**Setting Up Your Expedition**:

1. **Party Size**: How many travelers? This affects resource consumption.
2. **Rations**: Each person needs 1 iron ration per day. Track carefully!
3. **Water**: Essential in deserts. Refill at rivers and oases.

**The Map**:

The hex map shows:
- **Your party** (red dot)
- **Explored hexes** (terrain revealed)
- **Unexplored hexes** (question mark)
- **Features** (settlements, resources, special locations)

You can:
- **Drag to pan** the map
- **"Center on Party"** to reset view
- See current **coordinates** and **terrain type**

**Map Modes**:

- **Procedural Mode**: War Machine generates terrain as you explore (classic for sandbox campaigns)
- **Static Map Mode**: Import a pre-generated world from the Python simulator (for planned campaigns)

### Daily Travel Actions

**Moving**: Click a direction arrow (six directions in hex movement). Your party:
- Moves to the new hex
- Consumes time based on terrain
- Uses 1 ration per person
- May trigger encounters or weather changes
- Reveals the hex's terrain and features

**Foraging (2 hours)**: Attempt to find food in the wild:
- Requires 2 hours of game time
- Success rates vary by terrain (forests are better than deserts)
- Can provide rations or reduce consumption
- May lead to animal encounters

**Foraging (Full Day)**: Spend an entire day hunting and gathering:
- Better success rates than 2-hour foraging
- Party doesn't travel that day
- Significant ration savings over time
- Useful when low on supplies

**Refilling Water**: At rivers, streams, and oases, refill waterskins for free. The button is only active when water is available in your current hex.

### Weather and Light

Each day, War Machine rolls weather based on climate:
- **Temperature**: Affects comfort and morale
- **Wind**: Can aid or hinder travel
- **Precipitation**: Rain, snow, or clear skies

Pay attention to **light conditions**:
- **Clear Daylight**: Normal visibility and encounter distance
- **Dim Light** (dawn/dusk): Reduced visibility
- **No Light** (night): Greatly limited visibility, increased danger

Characters without darkvision need torches at night—and torches can be seen for miles, attracting attention.

### Wilderness Resources

BECMI assumes that high-level characters will eventually rule domains. The wilderness generates **resources** (Animal, Vegetable, Mineral) that can be exploited:

- **Animal** (furs, ivory, livestock)
- **Vegetable** (timber, herbs, crops)
- **Mineral** (iron, gems, stone)

Note these in your log. When a character establishes a dominion in a hex with resources, those resources generate monthly income.

### The Survey Log

Every significant event is recorded:
- Hexes explored
- Encounters
- Discoveries
- Resources found

This creates a **campaign journal** that you can reference later. When players return to an area, you'll know what they found before.

---

## Dungeon Delving: Into the Depths

The dungeon crawl is the heart of classic D&D. This isn't a frantic battle simulator—it's a game of **careful exploration**, **resource management**, and **risk assessment**.

### The Turn Structure

In a dungeon, time advances in **10-minute turns**. Each turn, the party can:
- Move 120 feet (if cautious and mapping)
- Search one 10'×10' area thoroughly
- Listen at a door
- Pick a lock or disable a trap
- Rest and catch their breath

After **every 2 turns**, the DM rolls for **wandering monsters** (1-in-6 chance). This creates urgency: the longer you linger, the more likely something finds you.

### Critical Resources

**Torches**: Each torch lasts **6 turns** (1 hour). When torches run out, you're in **darkness**—you can't see, can't fight effectively, and most monsters can see you perfectly. Always track torch consumption.

**Rations**: Delving is exhausting work. Every **6 turns** (1 hour of exploration), characters should rest for a turn and eat. Fighting on an empty stomach imposes penalties.

**Hit Points**: There's no healing surge, short rest, or easy recovery. When you take damage, it stays until you:
- Rest for a full day (recover 1d3 HP)
- Receive magical healing (clerical spells)
- Drink a healing potion (if you have one)

Wise parties retreat to rest and heal rather than pushing deeper when wounded.

### Using the Dungeon Delver

The Dungeon panel tracks everything for a delve:

**Status Display**:
- **Depth**: What dungeon level? Deeper levels have deadlier monsters and better treasure.
- **Turn**: How many turns have you been exploring? Wandering monsters check every 2 turns.
- **Lighting**: Bright (magic), Dim (torches), or Dark (no light source)
- **Torches**: How many remaining? Current torch turns left?
- **Rations**: How much food is left?
- **Loot**: Gold pieces carried (but not yet banked)
- **Treasury**: Your safe balance back in town

**Delving Actions**:

**"Explore New Room"**: 
- Advances 1 turn
- Consumes torch time
- Rolls for wandering monsters (if turn 2, 4, 6, etc.)
- May generate an encounter, obstacle, or empty room
- Reveals the room's contents

**"Search the Area"**:
- Takes 1 turn
- Chance to find hidden treasure, secret doors, or traps
- Can only search each room once
- Use this when you suspect something's hidden

**"Rest & Eat"**:
- Consumes 1 turn
- Uses 1 ration per party member
- Recovers 1d3 HP for wounded characters
- Riskier in dungeons (wandering monster check still applies)

### Encounters: The Reaction Roll

When you meet monsters in BECMI, they don't automatically attack. The DM rolls a **reaction**:

- **Hostile**: Immediate attack, fight to the death
- **Aggressive**: Threatening, likely to attack unless intimidated
- **Cautious**: Defensive, watching for aggression
- **Neutral**: Indifferent, might negotiate
- **Friendly**: Potentially helpful, open to parley

War Machine's encounter system simulates this:

**Surprise Encounters**:
If the party surprises monsters, they have **tactical advantage**:
- **Evade**: Automatically escape unnoticed
- **Ambush**: Free attack round before the monsters can react
- **Approach**: Reveal yourselves and attempt parley

**Normal Encounters**:
The panel shows:
- **Monster name and quantity**
- **Reaction** (hostile to friendly)
- **Distance** (10' to 90')
- **Stats** (AC, HP, morale)
- **Special abilities** (if any)

**Your Options**:
- **Fight**: Roll attack rolls, apply damage, track enemy HP. War Machine handles damage tracking—you input damage dealt, it updates monster HP and checks for morale breaks.
- **Parley**: Attempt negotiation. Charisma modifies reaction rolls. Offering treasure can improve reactions.
- **Flee**: Not guaranteed! Roll vs. enemy movement rate. If caught, they attack with a free round.

**Combat Tips**:
War Machine doesn't roll dice for you—it tracks state. You roll attacks at the table, apply the result in the tool:
- Enter damage dealt in the input field
- Click "Apply Damage"
- The encounter HP updates
- When HP reaches 0, monsters are defeated
- When HP is below 50%, the DM may check morale

### Obstacles: Doors, Traps, and Hazards

Not all challenges are monsters. The Dungeon Delver generates procedural obstacles:

**Doors**:
- **Stuck Door**: Requires a Strength check to force (1d6 roll, 1-2 succeeds for most characters)
- **Locked Door**: Needs a thief to pick the lock
- **Spiked Door**: Jammed from the other side, harder to open

**Traps**:
- **Poison Needle**: Saving throw vs. poison or take damage
- **Pit Trap**: Fall damage, possibly with spikes
- **Gas Trap**: Poison gas, affects entire party

**Hazards**:
- **Slippery Floor**: Risk of falling
- **Unstable Ceiling**: May collapse if disturbed
- **Magic Ward**: Spell effect when crossed

For each obstacle, you choose:
- **Force**: Quick and loud, may alert monsters
- **Careful**: Slow and methodical, safer but costs time
- **Avoid**: Find another way, costs extra movement

Thieves excel at "careful" approaches (disarming traps, picking locks). Fighters excel at "force" (smashing doors). Choice matters.

### Loot and Treasure

When you defeat monsters or search thoroughly, you may find **treasure**. War Machine tracks this as **loot**—gold carried by the party.

**Important**: Loot isn't yours until you return to civilization and **bank it**. If the party dies in the dungeon, the gold stays there. This creates a crucial decision point: do we push deeper for more treasure, or retreat to safety and bank what we have?

**The Return Journey**:

When you click **"Attempt Return Journey"**, War Machine calculates:
- **Turns to surface**: Depth × 3 (Level 3 = 9 turns to escape)
- **Wandering monster checks**: One per 2 turns of travel
- **Probability of encounter**: Shown as a percentage

If you encounter monsters on the way out, you must fight or flee. Fleeing parties move faster but may lose treasure. Victory lets you continue. Defeat... well, roll new characters.

Once you reach the surface, click **"Secure Loot"** to add it to your Treasury in the Ledger. Now you can spend it on equipment, training, spell research, or saving for a stronghold.

### Experience Points

In BECMI, you gain 1 XP per 1 gp of treasure returned, plus small amounts for monsters defeated. War Machine doesn't auto-calculate XP (that's your call as DM), but the Ledger's transaction history shows all treasure recovered, making end-of-session XP awards simple.

---

## The Master Chronometer: Calendar Management

One of BECMI's most elegant (and often ignored) features is **integrated timekeeping**. The Calendar tool brings this to life.

### Why Track Time?

Time passing has consequences:
- **Spell durations** expire
- **Torch burns** last 6 turns
- **Dominion seasons** advance
- **Merchant caravans** arrive
- **Magic item research** completes
- **Moon phases** affect lycanthropes
- **Seasons** change travel conditions

War Machine's Calendar coordinates all of this across different scales.

### The Campaign Clock

The display shows:
- **Full date**: Day, month (BECMI has 12 months of 28 days each), year
- **Time of day**: Hour and minute
- **Season**: Spring, Summer, Autumn, Winter
- **Moon phase**: New Moon to Full Moon (important for some monsters and magic)

### Advancing Time

Use the appropriate button for your current activity:

**Dungeon Scale**:
- **+1 Round** (10 seconds): Combat rounds
- **+1 Turn** (10 minutes): Exploration turns

**Adventure Scale**:
- **+1 Hour**: Overland travel segments
- **+1 Watch** (4 hours): Guard duty shifts, rest periods

**Campaign Scale**:
- **+1 Day**: Wilderness travel, urban activities
- **+1 Week**: Downtime, training
- **+1 Month**: Long-term projects
- **+1 Season**: Dominion management

When you advance time, several things happen automatically:
- The clock updates
- Active timers countdown
- Expired timers trigger notifications
- Associated systems (Dungeon, Wilderness, Merchant, Dominion) receive updates

### Active Timers

Timers track ongoing activities:

**Creating a Timer**:
1. Enter a name: "Torch", "Cleric spell: Bless", "Merchant caravan to Specularum"
2. Enter duration: "6 turns", "2 hours", "14 days"
3. Click **Add**

The timer appears in the **Active Timers** list with:
- Remaining time
- Original duration
- Start timestamp

**Blocking Timers**:
Some activities (magic research, merchant journeys, dominion seasons) create **blocking timers**. These prevent certain actions until complete. For example, you can't process a new dominion season while a season timer is active—you must advance time to complete it.

When blocking timers expire, you receive a **notification** and can resolve the activity (caravan arrives, research completes, season ends).

### The Chronicle

Every significant time advancement is logged:
- "Advanced 1 day (wilderness travel)"
- "Timer expired: Merchant caravan completed"
- "Manual time set to Day 15, Month 3, Year 1000"

This creates an **audit trail** of your campaign timeline. When players ask "How long has it been since we left Threshold?", check the Chronicle.

### Integration with Other Tools

The Calendar's real power is synchronization:

**Dungeon**: Each turn button click here advances Dungeon turns simultaneously.

**Wilderness**: Each day of travel adds to the campaign clock.

**Merchant**: Caravans create timers—when they expire, the trade resolves.

**Dominion**: Season processing creates a 4-week timer—when it expires, you can process the next season.

**Lab**: Magic item research creates timers (weeks to months) that block new research until complete.

This means your campaign time always makes sense. The party can't spend 10 days in a dungeon while only 2 days pass at the merchant prince's counting house.

---

## Trading Caravans: The Merchant of Darokin

At mid-to-high levels, BECMI assumes characters engage in **domain-level play**—not just fighting monsters, but managing strongholds, trading goods, and building economic power.

The Merchant tool simulates **BECMI's trade rules**: buying goods in one market, transporting them to another, and selling at a profit (or loss).

### Trade Goods

War Machine includes accurate BECMI trade goods:
- **Grain** (staple, low margin, high volume)
- **Cloth** (steady demand)
- **Wine** (good margins in wealthy cities)
- **Spices** (expensive, very profitable)
- **Gems** (ultra-valuable, high risk)
- **Arms** (weapons, armor—lucrative but attracts bandits)

Each good has a **base price per cargo unit** and different demand in different markets.

### Planning a Trade Route

**1. Select Trade Good**: What are you transporting?

**2. Set Cargo Value**: How much are you investing? More cargo = more profit (and more guards needed).

**3. Origin Terrain**: Where are you buying? (Plains, Forest, Coast, etc.). Terrain affects base price.

**4. Destination Terrain**: Where are you selling? Price varies by destination.

**5. Distance**: How many miles? Longer routes = higher costs but potentially better margins.

**6. Transport**:
   - **Wagon Caravan**: Standard land transport
   - **Merchant Ship**: Coastal/river routes, faster and cheaper for bulk goods
   - **Camel Caravan**: Desert trade routes

**7. Guards**: 
   - **None**: Cheap but risky (high bandit chance)
   - **Light Guard**: +10% cost, modest protection
   - **Standard**: +25% cost, good protection
   - **Heavy Escort**: +50% cost, very safe

**8. Guild Status**:
   - **Independent**: Pay full border taxes
   - **Guild Member**: -20% taxes
   - **Guild Master**: -50% taxes

**9. Border Crossings**: Each border = tax checkpoint. More borders = lower margins.

**10. Market Conditions**:
   - **Normal**: Standard prices
   - **Festival**: +20% demand, better selling prices
   - **Siege/Shortage**: +50% demand, excellent prices but dangerous to reach
   - **Oversupply**: -30% demand, poor prices

### Making the Journey

War Machine calculates:
- **Transport cost** (wagons, ships, crews)
- **Guard cost** (based on level chosen)
- **Border taxes** (modified by guild status)
- **Projected sale price** (based on destination and market conditions)
- **Profit margin** (percentage return on investment)

When you click **"Make the Journey"**, the system:
1. Deducts cargo cost and expenses from your treasury
2. Rolls for **random events** (bandit attacks, weather delays, surprise bonuses)
3. Applies market fluctuations at destination
4. Creates a **Calendar timer** for the journey duration
5. Logs the caravan as "En Route" in your ledger

### Journey Resolution

The caravan travels in real campaign time. When the timer expires (advance the Calendar), you receive a notification:

**"Merchant caravan arrived!"**

The ledger updates:
- **Event summary**: "Uneventful journey" or "Repelled bandit attack" or "Blessed by weather"
- **Market summary**: "Sold at festival prices" or "Normal sale"
- **Net profit/loss**: Final gold amount added to treasury

If the caravan encountered dangers, guards may have been lost. If market conditions changed unexpectedly, prices may have dropped. This is speculative risk, just like real medieval trade.

### Multiple Caravans

You can run multiple trade routes simultaneously. The **Transit Banner** shows how many caravans are currently en route. Each has its own timer and will resolve independently.

This allows merchant characters (or stronghold-owning PCs with hired merchants) to build trade empires: multiple wagons on different routes, diversifying risk and maximizing income.

---

## High-Level Play: Dominion Management

At **9th level** (Name level), BECMI characters reach a milestone: they become **rulers** rather than mere adventurers.

**Fighters** build castles and attract followers.  
**Clerics** found temples and lead congregations.  
**Magic-users** construct towers and take apprentices.  
**Thieves** establish guilds and control underworld networks.

The Dominion tool simulates **seasonal domain management**: taxes, expenses, confidence, events, and long-term growth.

### Understanding Dominions

A **dominion** is a hex (8 miles) or set of hexes containing:
- **Families**: Peasant households (5 members each)
- **Hexes**: Land area under your control
- **Resources**: Animal, Vegetable, Mineral (generate income)
- **Stronghold**: Your castle, tower, or temple (construction cost paid separately)

### Setting Up Your Dominion

Navigate to the Dominion panel:

**Basic Information**:
- **Dominion Name**: "Barony of Blackstone", "The Northern Towers", etc.
- **Ruler**: Your character's name
- **Ruler Alignment**: Lawful, Neutral, or Chaotic (affects confidence)
- **Dominion Alignment**: Overall populace alignment (may differ from ruler)
- **Families**: Starting population (50-500 for a wilderness barony)
- **Hexes**: How many 8-mile hexes you control (start with 1)
- **Treasury**: Domain funds (separate from personal wealth)
- **Confidence**: Loyalty and satisfaction (starts at 250—average)

**Feudal Structure**:
- **Liege**: Who you swore fealty to (if anyone). They receive a tithe.
- **Vassals**: Lesser nobles who swear fealty to you. They pay you tithes.

**Resources**:

Click **Add Resource** and define:
- **Type**: Animal, Vegetable, or Mineral
- **Name**: "Iron ore", "Timber", "Cattle"
- **Value**: Economic value multiplier (1.0 = standard, 2.0 = rich deposit)

Resources generate monthly income based on type and value. Hexes with multiple resources are very valuable—and targets for conquest.

### Processing a Season

When a season begins (Spring, Summer, Autumn, Winter, or Year End), you resolve that turn:

**1. Set Season Parameters**:

- **Season**: Choose which season you're resolving
- **Ruler Status**: 
  - **Present**: +10 confidence, full control
  - **Advisor Only**: No confidence penalty, regent manages
  - **Absent**: -20 confidence, domain may suffer
- **Tax Rate** (gp per family): 1-2 gp is light, 3-5 is standard, 6+ is heavy (reduces confidence)
- **Holiday Spending**: Festivals boost confidence but cost gold
- **Event**: 
  - **Normal/None**: Standard season
  - **Festival**: +20 confidence
  - **Good Event**: Positive occurrence (good harvest, trade boom)
  - **Bad Event**: Negative occurrence (disease, bandits)
  - **Calamity**: Disaster (war, plague, famine)
  - **Roll Random**: Let the dice decide
- **Expenses** (Troops/Works): Ongoing costs (military wages, construction, maintenance)
- **Tithe to Liege** (%): If you have a liege lord, what percentage of income goes to them?

**2. Review the Projection**:

War Machine calculates:
- **Projected Income**: 
  - **Tax income** (families × tax rate)
  - **Resource income** (resources × value × multiplier)
  - **Standard income** (base for domain type)
- **Projected Confidence Delta**: How will confidence change? (Affected by ruler status, taxes, events, alignment match)
- **Final Confidence**: Where you'll end up after the season

High confidence attracts settlers and improves income. Low confidence causes emigration and even rebellion (below 100).

**3. Process the Turn**:

Click **"Process Turn"**. The system:
1. Rolls for events (if "random" was selected)
2. Calculates income and expenses
3. Updates treasury
4. Modifies confidence based on all factors
5. Checks for population changes (families may increase with high confidence, decrease with low)
6. Logs the season in the **Dominion Chronicle**
7. Creates a **4-week Calendar timer** (one season = 4 weeks of game time)

You cannot process another season until the timer expires—advance the Calendar to continue.

### The Dominion Chronicle

Each season is recorded:
- **Season** and timestamp
- **Event description** ("Excellent harvest", "Bandit raids repelled")
- **Factors applied** (tax level, ruler present, alignment match)
- **Treasury delta**: Income minus expenses
- **Confidence delta**: Change in loyalty
- **Population change**: Families gained or lost

Over time, this creates a **history of your realm**. You can see whether your rule has been prosperous or troubled.

### Long-Term Strategy

Successful domain management in BECMI requires balancing:

**Income vs. Confidence**: High taxes bring gold but anger peasants. Low taxes keep them happy but limit your military budget.

**Present vs. Absent**: Adventuring characters must leave their domains for quests. Each season away costs confidence. Appoint a trusted seneschal!

**Expansion**: Conquering new hexes adds resources but increases expenses (more land to patrol). Growing too fast can strain your treasury.

**Feudal Politics**: If you're a vassal, you owe tithes—but your liege may send aid when attacked. If you have vassals, you receive tithes—but must defend them from threats.

Dominion play adds a strategic layer to high-level campaigns. Your characters become **invested in the world**, with holdings to defend and rivals to negotiate with.

---

## Treasure Generation: The Hoard Roller

One of BECMI's joys is **authentic treasure**. The Treasure panel implements the full treasure tables from the Rules Cyclopedia.

### Treasure Types

BECMI categorizes treasure by **type** (A through V), corresponding to monster difficulty and lair size:

- **Type A**: Small hoard (goblins, bandits)
- **Type D**: Medium hoard (ogres, lesser undead)
- **Type H**: Large hoard (dragons, powerful wizards)
- **Type I**: Ultra-rich hoard (ancient dragons, demon princes)

Each type specifies:
- **Coin chances**: Copper, silver, electrum, gold, platinum
- **Gem chances**: How many gems, what values
- **Jewelry chances**: Ornate items worth hundreds to thousands of gp
- **Magic chances**: Scrolls, potions, weapons, armor, wondrous items

### Generating a Hoard

1. **Select Treasure Type**: Match the monster/lair difficulty
2. **Click "Generate Hoard"**

War Machine instantly rolls:
- **Coins**: Individual amounts of each denomination, with total gp value calculated
- **Gems**: Random gems with individual values (10 gp, 50 gp, 100 gp, 500 gp, 1000 gp)
- **Jewelry**: Unique pieces with descriptions and values
- **Magic Items**: Rolled from BECMI magic tables by category

### The Results

The Latest Hoard panel shows:
- **Total Value** (in gp—important for XP calculation)
- **Coin Breakdown** (1,200 CP, 800 SP, 400 EP, 200 GP, etc.)
- **Gems** ("Amethyst — 100 gp", "Jade — 50 gp")
- **Jewelry** ("Gold bracelet with inset pearls — 800 gp")
- **Magic Items** ("Potion of Healing", "Sword +1", "Scroll of Fireball")

**Copy Latest**: Copies the hoard to clipboard (formatted for notes or sharing with players)

**Clear History**: Removes all saved hoards (you can save unlimited hoards)

### Using Generated Treasure

The treasure result gives you **descriptive detail**—not just "200 gp", but "a leather sack containing 50 platinum coins stamped with a dragon sigil". Use this to make treasure memorable.

**Player Interaction**:
- Describe what they see first (the obvious coins)
- Let them search for hidden compartments (maybe the gems are wrapped in cloth)
- Identify magic items (requires *detect magic* or experimentation)
- Transport logistics (2,000 cp weighs 200 lbs—can they carry it?)

The Ledger integration: When players return treasure to civilization, record it in the Ledger as a **Manual Adjustment** with the total gp value (converting coins, selling gems and jewelry).

---

## Practical Workflows: Putting It All Together

Now that you understand each tool, let's walk through typical campaign scenarios showing how they interact.

### Scenario 1: Starting a New Campaign

**Goal**: Create a party, equip them, and send them on their first adventure.

1. **Generate the Party**:
   - Open Party panel
   - Set: Size 5, Level 1, Method Strict
   - Click Generate Party
   - Review characters, note their names and classes

2. **Initial Funding**:
   - Go to Ledger
   - Add Manual Adjustment: +500 gp, "Starting funds from patron"
   - This gives the party money to buy supplies

3. **Purchase Equipment**:
   - Ledger → Equipment Shop
   - Buy essentials:
     - 20 torches (20 gp)
     - 5 weeks iron rations per person = 25 weeks (375 gp)
     - 5 waterskins (5 gp)
     - 50' rope (1 gp)
     - 12 iron spikes (1 gp)
     - Remaining gold split among party for personal items
   - Total spent: ~400 gp
   - Treasury balance: ~100 gp

4. **Set Calendar**:
   - Open Calendar
   - Set starting date: Day 1, Month 1, Year 1000
   - This anchors your campaign timeline

5. **Begin Adventure**:
   - Open Dungeon panel
   - Click "Sync from Party" to load supplies
   - Set Depth: Level 1
   - Set Lighting: Bright (assuming the party brought torches)
   - Click "Explore New Room"
   - The delve begins!

**Result**: You have a party, equipped and funded, with time tracking active and dungeon exploration ready.

---

### Scenario 2: A Wilderness Expedition

**Goal**: The party travels 5 days through the forest to reach a ruined tower.

1. **Prepare Expedition**:
   - Open Wilderness panel
   - Set Party Size: 5
   - Set Rations: 25 (5 people × 5 days)
   - Set Water: 5 waterskins
   - Set Climate: Temperate
   - Set Start Terrain: Clear

2. **Daily Travel**:
   - Click direction arrow to move
   - Party enters forest hex (Woods terrain)
   - Movement cost: 9 miles per day
   - 1 ration consumed per person
   - Weather rolls: "Moderate, Light Wind, Clear"
   - Survey Log updates: "Day 1.0 - Entered woods hex"

3. **Foraging**:
   - Day 3, party forages for 2 hours
   - Forage roll succeeds: find edible plants
   - Rations: 25 → 24 (party consumed 1 less ration today)
   - Time advances 2 hours

4. **Encounter**:
   - Day 4, encounter rolled: "6 wolves"
   - Party decides to avoid (moves around the pack)
   - 2 hours lost detouring

5. **Arrival**:
   - Day 5, party reaches destination hex
   - Survey Log shows: 5 days traveled, 2 hexes explored, 1 encounter, 1 forage
   - Rations remaining: 20

6. **Calendar Updates**:
   - Open Calendar
   - Chronicle shows: "Advanced 5 days (wilderness travel)"
   - Current date: Day 6, Month 1, Year 1000

**Result**: The party has traveled, tracked supplies, and the campaign clock has advanced properly. The world feels alive.

---

### Scenario 3: Merchant Trade Run

**Goal**: A 9th-level merchant character sends a caravan to profit from a distant city's festival.

1. **Plan the Route**:
   - Open Merchant panel
   - Set Trade Good: Wine (good profit margins)
   - Set Cargo Value: 1,000 gp (initial investment)
   - Origin: Coast (wine-producing region)
   - Destination: Hills (inland city, less supply)
   - Distance: 200 miles
   - Transport: Wagon Caravan
   - Guards: Standard (+25% cost for safety)
   - Guild Status: Member (-20% taxes)
   - Borders: 1 (one frontier crossing)
   - Market Condition: Festival (+20% demand)

2. **Review Projection**:
   - Projected Margin: +35% profit
   - Estimated Profit: +350 gp
   - Event risk: Moderate (guards reduce bandit chance)
   - Travel Time: ~2 weeks

3. **Launch Caravan**:
   - Click "Make the Journey"
   - Treasury deducted: -1,000 gp (cargo) -350 gp (costs) = -1,350 gp total
   - Ledger shows: "Wine caravan to Hills City — En Route"
   - Calendar creates timer: "Merchant Caravan, 14 days"

4. **Advance Time**:
   - Meanwhile, the PC adventures elsewhere
   - Open Calendar, advance time (party does other activities)
   - 14 days pass

5. **Caravan Arrives**:
   - Notification: "Merchant caravan completed"
   - Ledger updates: 
     - Event: "Favorable weather, quick travel"
     - Market: "Festival prices, high demand"
     - Sale: 1,600 gp
     - Net Profit: +250 gp (after all costs)
   - Treasury increased by 250 gp

**Result**: The character has profited from trade while adventuring elsewhere. Economic gameplay integrated seamlessly with exploration.

---

### Scenario 4: Dominion Season at Name Level

**Goal**: A 10th-level fighter rules a barony and processes Spring.

1. **Dominion Status**:
   - Open Dominion panel
   - Barony of Ironhold
   - Ruler: Sir Aldric the Bold
   - Families: 320
   - Hexes: 1
   - Treasury: 4,200 gp
   - Confidence: 280 (above average)
   - Resources: Iron (Mineral, 1.5 value)

2. **Set Spring Parameters**:
   - Season: Spring Start
   - Ruler Status: Present (Sir Aldric is home)
   - Tax Rate: 3 gp per family (moderate)
   - Holiday Spending: 200 gp (Spring festival)
   - Event: Normal
   - Expenses: 1,500 gp (troops and garrison)
   - Tithe to Liege: 10%

3. **Review Projection**:
   - Tax Income: 320 families × 3 gp = 960 gp
   - Resource Income: Iron deposit generates 1,800 gp
   - Standard Income: 200 gp (base for barony)
   - Gross Income: 2,960 gp
   - Tithe (10%): -296 gp
   - Expenses: -1,500 gp
   - Holiday: -200 gp
   - Net Income: +964 gp
   - Confidence Delta: +15 (ruler present, moderate taxes, festival)
   - Final Confidence: 295

4. **Process Turn**:
   - Click "Process Turn"
   - Chronicle logs:
     - "Spring Start, Year 1000"
     - "Good spring weather, planting successful"
     - Factors: Ruler present, moderate taxes, alignment match, festival
     - Treasury: 4,200 → 5,164 gp
     - Confidence: 280 → 295
     - Families: 320 → 322 (slight growth)
   - Calendar timer created: "Dominion Season, 4 weeks"

5. **Next Steps**:
   - Sir Aldric can now adventure for the rest of the season
   - If he's gone next season, set Ruler Status: Absent (confidence penalty)
   - Or appoint an advisor to minimize penalty
   - In 4 weeks (game time), process Summer

**Result**: The barony is prospering. Sir Aldric has funds for new projects and his people are loyal. The domain feels like a living part of the campaign.

---

## Advanced Tips and Best Practices

### For the Dungeon Master

**1. Let War Machine Handle the Math, You Handle the Story**

Don't narrate the tool. Narrate the dungeon:

**Bad**: "I'm clicking Explore Room. War Machine says you encounter 4 goblins."

**Good**: "You push open the iron-banded door. It groans on rusted hinges. Beyond, you see a circular chamber, maybe 30 feet across. Four goblins crouch around a sputtering fire, roasting something on a spit. One looks up—his yellow eyes widen in surprise. Roll for initiative!"

The tool gave you "4 goblins, cautious, 20' distance". You turned that into a scene.

**2. Enforce Resource Costs**

The tools track torches, rations, and time because BECMI expects these to matter:
- When the party's last torch sputters out in the dungeon, describe the darkness closing in
- When rations run low in the wilderness, describe hunger, irritability, fatigue
- When time pressure mounts, describe fatigue, dwindling light, distant sounds

Survival mechanics create tension and meaningful choices.

**3. Respect the Dice**

War Machine generates results procedurally—sometimes the treasure is disappointing, the encounter is deadly, or the weather turns foul. **Don't fudge**. Part of BECMI's charm is randomness creating emergent stories.

If a 1st-level party encounters a dragon (rare but possible), that's not a mistake—it's a clue that they should run, negotiate, or find a clever solution. Not every encounter is balanced for combat.

**4. Use the Calendar as Campaign Anchor**

When players ask "What month is it?" or "How long until the duke's festival?", reference the Calendar. This makes the world feel consistent.

Set timers for:
- NPC activities ("The wizard's research completes in 3 weeks")
- Plot deadlines ("The invasion begins in 30 days")
- Seasonal events ("Winter arrives in 2 months—travel becomes harder")

**5. Export Your Data**

Regularly export:
- **Party data** (backup characters)
- **Wilderness maps** (preserve exploration)
- **Ledger** (financial records)
- **Calendar logs** (campaign timeline)

War Machine stores everything in browser localStorage. Exports ensure you never lose months of play.

---

### For Players

**1. Track Your Character**

War Machine manages the party as a whole, but you're responsible for your individual character:
- Mark off used spell slots
- Track current HP after healing
- Note items carried vs. stored
- Record personal goals and NPCs you've met

**2. Think Strategically**

BECMI rewards smart play over optimized builds:
- Use retainers to scout and carry gear
- Retreat when wounded—healing is slow
- Set ambushes, use terrain, negotiate when outmatched
- Track torch consumption—always have a backup light source

**3. Communicate as a Group**

Decide collectively:
- When to retreat from the dungeon
- How to allocate party treasure
- Who carries essential equipment (torches, rope, rations)
- Risk tolerance (push deeper or bank treasure)

BECMI is a **cooperative game**. Individual glory is less important than group survival.

**4. Invest in Your Domain**

If you reach Name level, domain management isn't a chore—it's a new game mode:
- Prosperity generates wealth for equipment and magic research
- High confidence means loyal troops when war comes
- Resources can be traded for diplomatic leverage
- Strongholds become bases for mid-level allies and retainers

The domains you build become the world your next characters inherit.

---

## Troubleshooting and Common Questions

### "The party ran out of torches in the dungeon. What now?"

This is a **crisis**, not a bug. Options:
- Cast *Light* spell if you have a caster
- Use flint and steel to ignite a piece of wood or cloth (improvised torch, lasts 1d4 turns)
- Navigate by touch in darkness (very slow, automatic surprise by monsters)
- Retreat immediately

This teaches the lesson: **always bring extra torches**.

### "Confidence in my dominion dropped below 100. What happens?"

**Low confidence** causes:
- Families emigrate (population drops)
- Tax collection becomes difficult (reduced income)
- Risk of rebellion (DM rolls—villagers may revolt)

To recover:
- Lower taxes
- Hold festivals
- Stay present (don't adventure for a season)
- Resolve threats (clear bandits, defeat invaders)

Confidence is a **leadership mechanic**—neglect it at your peril.

### "The Wilderness panel shows a question mark on unexplored hexes. How do I reveal them?"

**Move into them**. When your party enters a hex, War Machine generates the terrain (procedural mode) or reveals pre-generated terrain (static map mode). The fog of war represents the fact that you don't know what's there until you explore.

### "My merchant caravan lost money. Why?"

Several factors can cause losses:
- Random events (bandit attacks, weather damage)
- Market fluctuations (prices dropped at destination)
- Excessive costs (heavy guards, multiple borders, low guild status)
- Bad choices (low-demand goods, oversupplied markets)

This is realistic! Medieval trade was **risky**. Diversify routes to minimize losses.

### "The Dungeon Delver generated a trap the party can't bypass. Are we stuck?"

**No.** BECMI assumes creative problem-solving:
- Trigger the trap intentionally (throw a rock)
- Use magic (*Knock* for locked doors, *Levitate* over pits)
- Find another route (secret doors, alternative path)
- Accept the damage (sometimes you take the hit and move on)

Not every obstacle requires specialized skills. Clever players find solutions.

### "War Machine doesn't roll dice for me. Why?"

**Design choice.** War Machine is a **productivity tool**, not an automation suite. Rolling physical dice:
- Keeps players engaged
- Maintains the tactile feel of tabletop RPGs
- Allows DM interpretation and rulings
- Respects the social element of gaming

War Machine tracks **state** and calculates **results**, but you still roll the d20s and tell the story.

---

## Conclusion: Your Campaign Awaits

War Machine doesn't replace the heart of D&D—the imagination, camaraderie, and spontaneous storytelling that make tabletop RPGs special. It **supports** that heart by handling the bookkeeping, ensuring rules consistency, and tracking the passage of time.

With these tools, you can run a **deep, authentic BECMI campaign**:
- Characters generated by-the-book
- Dungeons explored turn-by-turn with real resource pressure
- Wilderness traversed with travel times and survival mechanics
- Domains managed with seasonal economic cycles
- Trade routes operated with risk and profit

The tools coordinate with each other, creating a **living world** where time passes consistently, actions have consequences, and the campaign evolves organically.

### Where to Go From Here

**For New DMs**:
Start small—create a party, run a simple dungeon delve. Get comfortable with time tracking and resource management. The wilderness, merchants, and domains are for later, when players reach higher levels.

**For Experienced DMs**:
Experiment with full integration—run multiple timers simultaneously, coordinate merchant caravans with wilderness expeditions, process dominion seasons while parties delve. War Machine shines when managing complexity.

**For Players**:
Respect the tools' outputs as the impartial referee. When the dice say the torch burns out, when the reaction roll comes up hostile, when the dominion faces a bad harvest—**embrace it**. Those moments create the best stories.

---

## Appendix: Quick Reference

### Time Units
- **Round**: 10 seconds (combat)
- **Turn**: 10 minutes (dungeon exploration)
- **Watch**: 4 hours (guard shifts, rest)
- **Day**: 24 hours (wilderness travel)
- **Week**: 7 days (downtime, training)
- **Month**: 28 days (long projects)
- **Season**: 4 weeks (dominion turns)

### Key Formulas
- **XP from Treasure**: 1 XP per 1 gp returned to civilization
- **Encumbrance**: 1 coin weight (cn) = 0.1 lbs
- **Wandering Monsters**: 1-in-6 chance every 2 dungeon turns
- **Torch Duration**: 6 turns (1 hour)
- **Ration Consumption**: 1 per person per day of travel
- **Healing (natural)**: 1d3 HP per full day of rest

### Party Resource Checklist
Per character, always carry:
- [ ] 6+ torches
- [ ] 7+ days iron rations
- [ ] 1 waterskin
- [ ] 50' rope
- [ ] 12 iron spikes
- [ ] Backpack
- [ ] Appropriate weapon and armor

### Dominion Quick Setup
New barony (1 hex):
- **Families**: 100-300
- **Treasury**: 2,000-5,000 gp
- **Confidence**: 250 (average)
- **Tax Rate**: 3 gp/family (moderate)
- **Resources**: 1-2 types

### Treasure Value Ranges (by Type)
- **Type A** (small): 500-2,000 gp
- **Type D** (medium): 2,000-8,000 gp
- **Type H** (large): 10,000-30,000 gp
- **Type I** (hoard): 50,000+ gp

---

**May your torches burn long, your blades stay sharp, and your dominions prosper.**

*War Machine: For BECMI campaigns, by the book.*

---

## Document Information

**Version**: 1.0  
**Last Updated**: November 2025  
**Compatible with**: War Machine suite (current version)  
**BECMI Source**: Rules Cyclopedia  

**Feedback**: This is a living document. If sections are unclear or workflows need elaboration, please provide feedback for future updates.

**License**: This guide references rules from the D&D Rules Cyclopedia (TSR/Wizards of the Coast). War Machine is a fan-created tool for personal, non-commercial use.

