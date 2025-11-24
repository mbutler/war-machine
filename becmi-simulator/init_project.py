import os
import sqlite3

# --- CONFIGURATION ---
DB_PATH = "db/world.db"
DIRS = ["data", "db", "logs", "modules"]

# --- SQL SCHEMA ---
SCHEMA_SQL = """
-- 1. The Map
CREATE TABLE IF NOT EXISTS hex_grid (
    hex_id TEXT PRIMARY KEY, -- Format "X,Y"
    x INTEGER,
    y INTEGER,
    terrain TEXT,           -- Clear, Woods, Swamp, etc.
    elevation FLOAT,        -- 0.0 to 1.0
    moisture FLOAT,         -- 0.0 to 1.0
    is_civilized BOOLEAN,   -- Ch 17: 1=Settled, 0=Wild
    resource_type TEXT,     -- Ch 12: Animal, Veg, Mineral
    owner_id INTEGER        -- FK to dominions
);

-- 2. The Actors (PCs/NPCs)
CREATE TABLE IF NOT EXISTS actors (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT,
    type TEXT,              -- PC, NPC, Monster
    class TEXT,             -- Fighter, Magic-User, etc.
    level INTEGER,
    stats_json TEXT,        -- STR, INT, WIS, DEX, CON, CHA
    hp_current INTEGER,
    hp_max INTEGER,
    location_hex TEXT,      -- FK hex_grid
    gold INTEGER,
    inventory_json TEXT,
    state TEXT              -- Idle, Travel, War, Dead
);

-- 3. Dominions (Economics Ch 12)
CREATE TABLE IF NOT EXISTS dominions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ruler_id INTEGER,       -- FK actors
    name TEXT,
    center_hex TEXT,
    population_families INTEGER,
    treasury INTEGER,
    confidence_score INTEGER DEFAULT 200, -- Base confidence
    tax_rate FLOAT DEFAULT 0.10,          -- Standard 1gp/family
    FOREIGN KEY(ruler_id) REFERENCES actors(id)
);

-- 4. Military Units (War Machine Ch 9)
CREATE TABLE IF NOT EXISTS military_units (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT,
    commander_id INTEGER,   -- FK actors
    dominion_id INTEGER,    -- FK dominions
    troop_count INTEGER,
    troop_class TEXT,       -- Untrained, Fair, Elite, etc.
    bfr_rating INTEGER,     -- Basic Force Rating
    location_hex TEXT
);

-- 5. The History Log (Event Bus storage)
CREATE TABLE IF NOT EXISTS world_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    game_year INTEGER,
    game_month INTEGER,
    game_day INTEGER,
    event_type TEXT,        -- TAX_CHANGE, BATTLE, MOVE
    source_id INTEGER,      -- Who did it
    target_id INTEGER,      -- Who/What was affected
    description TEXT,       -- Human readable log
    payload_json TEXT       -- Data for 2nd order effects
);
"""

def create_directory_structure():
    """Creates the folders needed for the project."""
    base_path = os.getcwd()
    print(f"Initializing Project in: {base_path}")
    
    for d in DIRS:
        dir_path = os.path.join(base_path, d)
        if not os.path.exists(dir_path):
            os.makedirs(dir_path)
            print(f"  [+] Created directory: {d}/")
        else:
            print(f"  [.] Directory exists: {d}/")

    # Create empty __init__.py in modules
    init_file = os.path.join(base_path, "modules", "__init__.py")
    if not os.path.exists(init_file):
        with open(init_file, 'w') as f:
            pass

def init_database():
    """Creates the SQLite tables."""
    print("Initializing Database...")
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        
        # Execute schema
        cursor.executescript(SCHEMA_SQL)
        
        conn.commit()
        conn.close()
        print(f"  [+] Database created successfully at {DB_PATH}")
        print("  [+] Schema applied (Tables: hex_grid, actors, dominions, military_units, world_history)")
    except sqlite3.Error as e:
        print(f"  [!] SQLite Error: {e}")

if __name__ == "__main__":
    create_directory_structure()
    init_database()
    print("\nSetup Complete. You are ready to run the Map Generator.")
