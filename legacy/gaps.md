1. Gaps in Individual Simulators
dungeon.html (The Dungeon Delver) - Biggest Deviation*
* Logic Gap (Critical): This is the least faithful simulator. It abstracts the entire party into a single "HP %" bar. In BECMI, the emergent gameplay comes from individual resource management—the Fighter holding the line while the Magic-User (with 2 HP) cowers in the back.
Rules Gap: It lacks THAC0, Saving Throws, and Armor Class mechanics. Combat is a flat % win chance.
Rules Gap: No Treasure Type tables. Loot is generic gold/xp. Using the actual Treasure Types (A-O) is essential for the "risk vs. reward" logic of BECMI.
Missing: No spell slot management for the party during the delve.
dominion.html (Dominion Administrator)
Rules Gap: The Confidence calculation is the "Simplified RC" version. The full rules include a more complex check involving the ruler's alignment vs. the population's, distinct "Holiday" expenses, and specific resource demands.
Rules Gap: Resource logic is generic (Animal/Veg/Min). BECMI (specifically the Companion set) has specific resources (Salt, Iron, Horses) that dictate trade value and dominion quirks.
Missing: No Vassal/Liege tree. Dominion play is often about the hierarchy; this tool treats the dominion in a vacuum.
siege.html (War Machine)
Logic Gap: The Casualties are calculated but applying them is a simple manual deduction. In the rules, casualties affect the BR (Battle Rating) immediately for the next round (if continuous battle).
Rules Gap: Siege Mechanics are too simple. War Machine has detailed rules for structural damage points, siege engine rates of fire, and supply lines during a siege (starvation attrition).
Accuracy: The BFR (Basic Force Rating) calculator is actually quite good and accurate to the Companion rules.
party.html (Mustard Hall Registry)
Rules Gap: Thief Skills are missing.
Rules Gap: Spells are not generated. A Level 1 Magic-User needs their specific Read Magic + 1 other spell to be playable.
Rules Gap: Saving Throws and THAC0 tables are not displayed, which are critical derived stats.
merchant.html (Merchant of Darokin)
Rules Gap: Based more on the Gazetteer (GAZ11) economy than the generic Expert set trade rules. It lacks the specific "Demand Modifiers" based on location (e.g., selling Wood in a Desert should have a specific multiplier).
Missing: No mechanic for Tax/Tariffs at borders, which is a huge gold sink in the rules.
    lab.html (Artificer's Lab)
    (Up to Date) - Correct BECMI formula and Formula Research mechanics implemented.

    wilderness.html (Royal Cartographer)
Rules Gap: Movement is simplified to "Days." BECMI tracks Movement Points (MP) per day (e.g., 12/24/36) vs Terrain Cost (e.g., 2/3 MP per hex).
Rules Gap: Encounter Tables are hardcoded. It needs to reference the actual Level 1-3 Wilderness Encounter tables (Castle vs. Ruin vs. Lair probabilities).
2. Gaps in the Suite (Missing Simulators)
To make this a "complete" BECMI engine, you are missing these critical tools:
The Stronghold Architect:
Why: dominion.html manages the stats, but building the castle is a huge part of the Expert/Companion transition. You need a tool to calculate the cost of Walls, Towers, Keeps, and Gatehouses to determine the "Dominion Value."
The Treasure Hoard Generator:
Why: dungeon.html gives generic loot. You need a generator that takes a Treasure Type (A-O) and rolls the specific CP/SP/EP/GP/PP, Gems, Jewelry, and Magic Items.
The Calendar / Timekeeper:
Why: The tools are disconnected. Time is the most important resource in old-school D&D. A master clock that tracks:
Dungeon Turns (Sim 1)
Wilderness Days (Sim 2)
Dominion Months (Sim 3)
Healing/Research Weeks (Sim 4)
The Hireling Hall:
Why: Mercenaries (for War Machine) and Specialists (Spies, Sages, Armorers) are distinct from Retainers. You need a tool to generate these standard NPCs with their monthly wage requirements.
Recommendation
If you want to proceed, I recommend we start by refactoring dungeon.html. It is currently a "mini-game" rather than a simulation. It needs to accept data from party.html and run a faithful turn-based resolution (even if text-based) that respects individual AC, THAC0, and Saving Throws.