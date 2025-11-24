import argparse
import sqlite3
import random
import math
from enum import Enum
from dataclasses import dataclass, asdict
from typing import List
import sys
import os

# Check for noise library
try:
    from noise import pnoise2
except ImportError:
    print("Error: The 'noise' library is required. Install it via 'pip install noise'")
    sys.exit(1)

# --- CONSTANTS & CONFIGURATION ---

DB_PATH = "db/world.db"

# BECMI Standard Scale: 8 miles per hex
HEX_SCALE_MILES = 8 

# Map Dimensions (200x160 hexes = approx 1600x1280 miles, a small continent)
MAP_WIDTH = 200
MAP_HEIGHT = 160

# Generation Seeds
SEED_ELEVATION = random.randint(0, 10000)
SEED_MOISTURE = random.randint(0, 10000)
SEED_TEMP = random.randint(0, 10000)

# Noise Scale Factors (Lower = "Zoomed in" / smoother features)
SCALE_ELEV_BASE = 40.0
SCALE_ELEV_CONTINENT = 120.0
SCALE_ELEV_WARP = 90.0
ELEVATION_WARP_STRENGTH = 8.0

SCALE_MOIST_BASE = 35.0
SCALE_MOIST_WARP = 110.0
MOISTURE_WARP_STRENGTH = 5.0

TEMPERATURE_WARP_SCALE = 70.0
HEX_NOISE_Y_SCALE = math.sqrt(3) / 2  # vertical spacing for odd-q hex layout

ROTATE_ANGLE = math.pi / 4  # 45 degrees to break axis alignment
ROTATE_COS = math.cos(ROTATE_ANGLE)
ROTATE_SIN = math.sin(ROTATE_ANGLE)

JITTER_STRENGTH_X = 0.75
JITTER_STRENGTH_Y = 0.65

NOISE_ROTATION_ANGLES = [0.0, math.pi / 3, 2 * math.pi / 3]
NOISE_ROTATION_PARAMS = [
    (math.cos(theta), math.sin(theta), idx * 97)
    for idx, theta in enumerate(NOISE_ROTATION_ANGLES)
]

OCTAVES = 6

# Hydrology tuning
SPRING_MIN_ELEVATION = 0.7
SPRING_DENSITY = 0.004  # proportion of map cells that become river springs
RIVER_MAX_STEPS = 1000

# --- DATA STRUCTURES ---

class TerrainType(str, Enum):
    DEEP_SEA = "Deep Sea"
    SEA = "Sea"
    COAST = "Coast"
    SWAMP = "Swamp"
    DESERT = "Desert"
    PLAINS = "Clear" # "Clear" is the BECMI term for open grassland
    FOREST = "Forest" # "Woods"
    HILLS = "Hills"
    MOUNTAINS = "Mountains"
    JUNGLE = "Jungle"
    GLACIER = "Glacier"
    BADLANDS = "Barren"

@dataclass
class HexData:
    x: int
    y: int
    elevation: float  # 0.0 - 1.0
    moisture: float   # 0.0 - 1.0
    temperature: float # 0.0 - 1.0 (0=Arctic, 1=Tropical)
    terrain: TerrainType
    is_river: bool = False
    is_lake: bool = False
    road_level: int = 0  # 0=None, 1=Trail, 2=Road
    dominion_id: int = None # For future political layer
    
    def to_dict(self):
        return asdict(self)


def _pseudo_random(x: float, y: float, seed: float) -> float:
    """Deterministic hash-based pseudo-random value in [0,1)."""
    raw = math.sin((x + seed * 0.37) * 12.9898 + (y + seed * 0.71) * 78.233) * 43758.5453123
    frac, _ = math.modf(raw)
    return frac if frac >= 0 else frac + 1.0


def _sample_perlin(x: float, y: float, scale: float, base: int, octaves: int, persistence: float, lacunarity: float) -> float:
    """Isotropic Perlin sampling by averaging several rotated inputs."""
    acc = 0.0
    for cos_a, sin_a, base_offset in NOISE_ROTATION_PARAMS:
        rx = x * cos_a - y * sin_a
        ry = x * sin_a + y * cos_a
        acc += pnoise2(
            rx / scale,
            ry / scale,
            octaves=octaves,
            persistence=persistence,
            lacunarity=lacunarity,
            base=base + base_offset,
        )
    return acc / len(NOISE_ROTATION_PARAMS)

# --- THE GENERATOR CLASS ---

class WorldGenerator:
    def __init__(self, width, height):
        self.width = width
        self.height = height
        self.grid: List[List[HexData]] = [[None for _ in range(height)] for _ in range(width)]

    def generate_base_layers(self):
        """Pass 1: Generate Elevation, Moisture, and Temperature using Perlin Noise."""
        print("Generating geological layers...")
        
        elev_min, elev_max = float("inf"), float("-inf")
        moist_min, moist_max = float("inf"), float("-inf")
        temp_min, temp_max = float("inf"), float("-inf")

        for x in range(self.width):
            for y in range(self.height):
                # --- Domain warping to break up straight noise bands ---
                offset = 0.5 if y % 2 else 0.0
                base_x = x + offset
                base_y = y * HEX_NOISE_Y_SCALE
                jitter_primary = _pseudo_random(base_x, base_y, SEED_ELEVATION + 0.1234)
                jitter_secondary = _pseudo_random(base_x, base_y, SEED_ELEVATION + 987.654)
                base_x += (jitter_primary - 0.5) * JITTER_STRENGTH_X
                base_y += (jitter_secondary - 0.5) * JITTER_STRENGTH_Y

                rot_base_x = base_x * ROTATE_COS - base_y * ROTATE_SIN
                rot_base_y = base_x * ROTATE_SIN + base_y * ROTATE_COS

                warp_x = _sample_perlin(
                    rot_base_x,
                    rot_base_y,
                    SCALE_ELEV_WARP,
                    SEED_ELEVATION + 13,
                    octaves=3,
                    persistence=0.4,
                    lacunarity=2.1,
                ) * ELEVATION_WARP_STRENGTH
                warp_y = _sample_perlin(
                    rot_base_x + 997,
                    rot_base_y + 421,
                    SCALE_ELEV_WARP,
                    SEED_ELEVATION + 37,
                    octaves=3,
                    persistence=0.4,
                    lacunarity=2.1,
                ) * ELEVATION_WARP_STRENGTH
                warp_x *= 0.8
                warp_y *= 0.8

                elev_x = (base_x + warp_x) * ROTATE_COS - (base_y + warp_y) * ROTATE_SIN
                elev_y = (base_x + warp_x) * ROTATE_SIN + (base_y + warp_y) * ROTATE_COS

                # --- Elevation: blend continent-scale and local detail ---
                cont_val = _sample_perlin(
                    elev_x,
                    elev_y,
                    SCALE_ELEV_CONTINENT,
                    SEED_ELEVATION,
                    octaves=3,
                    persistence=0.5,
                    lacunarity=1.8,
                )
                detail_val = _sample_perlin(
                    elev_x,
                    elev_y,
                    SCALE_ELEV_BASE,
                    SEED_ELEVATION + 101,
                    octaves=OCTAVES,
                    persistence=0.55,
                    lacunarity=2.25,
                )
                elev_val = (0.65 * cont_val) + (0.35 * detail_val)
                elevation = max(0.0, min(1.0, (elev_val + 1.0) / 2.0))

                # --- Moisture: warped noise with altitude influence ---
                moist_warp_x = _sample_perlin(
                    base_x,
                    base_y,
                    SCALE_MOIST_WARP,
                    SEED_MOISTURE + 19,
                    octaves=2,
                    persistence=0.45,
                    lacunarity=2.0,
                ) * MOISTURE_WARP_STRENGTH
                moist_warp_y = _sample_perlin(
                    base_x + 503,
                    base_y + 211,
                    SCALE_MOIST_WARP,
                    SEED_MOISTURE + 41,
                    octaves=2,
                    persistence=0.45,
                    lacunarity=2.0,
                ) * MOISTURE_WARP_STRENGTH
                moist_x = (base_x + moist_warp_x) * ROTATE_COS - (base_y + moist_warp_y) * ROTATE_SIN
                moist_y = (base_x + moist_warp_x) * ROTATE_SIN + (base_y + moist_warp_y) * ROTATE_COS

                moist_val = _sample_perlin(
                    moist_x,
                    moist_y,
                    SCALE_MOIST_BASE,
                    SEED_MOISTURE,
                    octaves=OCTAVES,
                    persistence=0.5,
                    lacunarity=2.1,
                )
                moisture = max(0.0, min(1.0, (moist_val + 1.0) / 2.0))

                # --- Temperature: latitude, warped noise, and altitude ---
                lat_factor = y / self.height  # 0.0 north (cold) -> 1.0 south (hot)
                temp_x = (base_x + warp_x * 0.3) * ROTATE_COS - (base_y + warp_y * 0.3) * ROTATE_SIN
                temp_y = (base_x + warp_x * 0.3) * ROTATE_SIN + (base_y + warp_y * 0.3) * ROTATE_COS
                temp_noise = _sample_perlin(
                    temp_x,
                    temp_y,
                    TEMPERATURE_WARP_SCALE,
                    SEED_TEMP,
                    octaves=3,
                    persistence=0.5,
                    lacunarity=2.0,
                ) * 0.25
                temperature = lat_factor + temp_noise
                temperature = max(0.0, min(1.0, temperature))

                elev_min = min(elev_min, elevation)
                elev_max = max(elev_max, elevation)
                moist_min = min(moist_min, moisture)
                moist_max = max(moist_max, moisture)
                temp_min = min(temp_min, temperature)
                temp_max = max(temp_max, temperature)

                # Create the Hex
                # Placeholder terrain, will be assigned in Pass 3
                self.grid[x][y] = HexData(x, y, elevation, moisture, temperature, TerrainType.DEEP_SEA)

        # Normalize each scalar layer to the observed range to maximize contrast.
        elev_span = elev_max - elev_min if elev_max > elev_min else 1.0
        moist_span = moist_max - moist_min if moist_max > moist_min else 1.0
        temp_span = temp_max - temp_min if temp_max > temp_min else 1.0

        for x in range(self.width):
            for y in range(self.height):
                cell = self.grid[x][y]

                elevation = (cell.elevation - elev_min) / elev_span
                elevation = max(0.0, min(1.0, elevation))
                elevation = elevation ** 1.2  # tuck lowlands, raise highlands

                temperature = (cell.temperature - temp_min) / temp_span
                temperature = max(0.0, min(1.0, temperature))
                temperature -= (elevation - 0.5) * 0.35
                temperature = max(0.0, min(1.0, temperature))

                moisture = (cell.moisture - moist_min) / moist_span
                moisture = max(0.0, min(1.0, moisture))
                if elevation > 0.65:
                    moisture *= 0.85
                if elevation < 0.35:
                    moisture = min(1.0, moisture + (0.35 - elevation) * 0.6)
                if temperature > 0.75:
                    moisture = max(0.0, moisture - (temperature - 0.75) * 0.6)
                elif temperature < 0.20:
                    moisture = min(1.0, moisture + (0.20 - temperature) * 0.25)
                moisture = max(0.0, min(1.0, moisture ** 1.1))

                if moisture > 0.78:
                    temperature -= 0.04
                elif moisture < 0.20:
                    temperature += 0.03
                temperature = max(0.0, min(1.0, temperature))

                cell.elevation = elevation
                cell.moisture = moisture
                cell.temperature = temperature

    def generate_rivers(self):
        """Pass 2: Hydrology. Drop water on mountains and flow downhill."""
        print("Simulating hydrology...")
        candidate_springs = [
            self.grid[x][y]
            for x in range(self.width)
            for y in range(self.height)
            if self.grid[x][y].elevation >= SPRING_MIN_ELEVATION
        ]

        if not candidate_springs:
            return

        random.shuffle(candidate_springs)
        target_springs = max(1, int(self.width * self.height * SPRING_DENSITY))
        springs = candidate_springs[:min(len(candidate_springs), target_springs)]

        for spring in springs:
            if self.grid[spring.x][spring.y].is_river:
                continue

            current_x, current_y = spring.x, spring.y
            steps = 0

            while steps < RIVER_MAX_STEPS:
                current_cell = self.grid[current_x][current_y]
                current_cell.is_river = True
                steps += 1

                neighbors = self.get_neighbors(current_x, current_y)
                if not neighbors:
                    break

                random.shuffle(neighbors)
                lowest = min(neighbors, key=lambda h: h.elevation)

                if lowest.elevation >= current_cell.elevation:
                    current_cell.is_lake = True
                    break

                if lowest.elevation < 0.3:
                    # Mark mouth cell for visualization but do not propagate through ocean.
                    lowest.is_river = True
                    break

                current_x, current_y = lowest.x, lowest.y

    def assign_biomes(self):
        """Pass 3: Apply BECMI terrain logic based on layers."""
        print("Assigning BECMI biomes...")
        
        for x in range(self.width):
            for y in range(self.height):
                h = self.grid[x][y]
                e = h.elevation
                m = h.moisture
                t = h.temperature
                
                # 1. Water
                if e < 0.15:
                    h.terrain = TerrainType.DEEP_SEA
                elif e < 0.30:
                    h.terrain = TerrainType.SEA
                
                # 2. Land
                else:
                    # Adjust moisture if next to river/lake
                    if h.is_river or h.is_lake:
                        m += 0.2
                    
                    # Mountains / Hills
                    if e > 0.85:
                        if t < 0.2:
                            h.terrain = TerrainType.GLACIER
                        else:
                            h.terrain = TerrainType.MOUNTAINS
                    elif e > 0.70:
                        h.terrain = TerrainType.HILLS
                    
                    # Flatlands - Determined by Moisture & Temp
                    else:
                        if t < 0.15: # Arctic
                            h.terrain = TerrainType.GLACIER
                        
                        elif t > 0.8: # Tropical
                            if m > 0.6: h.terrain = TerrainType.JUNGLE
                            elif m > 0.3: h.terrain = TerrainType.SWAMP
                            else: h.terrain = TerrainType.DESERT
                        
                        else: # Temperate
                            if m > 0.7: h.terrain = TerrainType.SWAMP
                            elif m > 0.5: h.terrain = TerrainType.FOREST
                            elif m > 0.2: h.terrain = TerrainType.PLAINS
                            else: h.terrain = TerrainType.BADLANDS

    def get_neighbors(self, x, y) -> List[HexData]:
        """Returns the 6 neighbors of a hex coordinates in an odd-q vertical layout."""
        # Offset coordinates logic for Hex Grids
        # Directions: Odd columns vs Even columns behave differently
        directions_even = [
            (0, -1), (1, -1), (1, 0), (0, 1), (-1, 0), (-1, -1)
        ]
        directions_odd = [
            (0, -1), (1, 0), (1, 1), (0, 1), (-1, 1), (-1, 0)
        ]
        
        neighbors = []
        directions = directions_odd if x % 2 else directions_even
        
        for dx, dy in directions:
            nx, ny = x + dx, y + dy
            if 0 <= nx < self.width and 0 <= ny < self.height:
                neighbors.append(self.grid[nx][ny])
        return neighbors

    def save_to_db(self):
        """Exports the world to the SQLite database defined in init_project.py"""
        if not os.path.exists(DB_PATH):
            print(f"Error: Database not found at {DB_PATH}. Run init_project.py first.")
            return

        print(f"Saving world data to {DB_PATH}...")
        
        # Flatten the grid into a list of tuples for SQL insertion
        data_rows = []
        for row in self.grid:
            for h in row:
                # Hex ID Format "X,Y"
                hex_id = f"{h.x},{h.y}"
                
                # Prepare row based on schema:
                # hex_id, x, y, terrain, elevation, moisture, is_civilized, resource_type, owner_id
                
                # Note: Rivers/Lakes are currently stored in terrain logic or implicit in moisture,
                # as the current schema in init_project.py doesn't have specific bool columns for them.
                # We strictly adhere to the provided schema.
                
                data_rows.append((
                    hex_id,
                    h.x,
                    h.y,
                    h.terrain.value,
                    h.elevation,
                    h.moisture,
                    0,   # is_civilized (Default False, populated in later phases)
                    None, # resource_type (Populated in later phases)
                    None  # owner_id (Populated in later phases)
                ))

        try:
            conn = sqlite3.connect(DB_PATH)
            cursor = conn.cursor()
            
            # Clear existing map data to avoid Primary Key conflicts on re-run
            print("Clearing old map data...")
            cursor.execute("DELETE FROM hex_grid")
            
            print(f"Inserting {len(data_rows)} hexes...")
            cursor.executemany("""
                INSERT INTO hex_grid (
                    hex_id, x, y, terrain, elevation, moisture, 
                    is_civilized, resource_type, owner_id
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, data_rows)
            
            conn.commit()
            conn.close()
            print("Save complete.")
            
        except sqlite3.Error as e:
            print(f"Database Error: {e}")

    def render_ascii_map(self, slice_width=80, slice_height=40, use_color=True, to_file=None):
        """Print an ASCII map preview or the full map.

        Parameters
        ----------
        slice_width : int | None
            Maximum number of hex columns to render. None renders full width.
        slice_height : int | None
            Maximum number of hex rows to render. None renders full height.
        use_color : bool
            Whether to include ANSI color codes in terminal output.
        to_file : str | None
            Optional file path to dump a plain-text version of the map.
        """
        # ANSI Color Codes
        BLUE = '\033[44m'
        CYAN = '\033[46m'
        GREEN = '\033[42m'
        YELLOW = '\033[43m'
        WHITE = '\033[47m'
        GREY = '\033[100m'
        RESET = '\033[0m'

        # Character Mappings
        chars = {
            TerrainType.DEEP_SEA: (BLUE, ' '),
            TerrainType.SEA: (CYAN, ' '),
            TerrainType.COAST: (CYAN, '#'),
            TerrainType.SWAMP: (GREEN, 's'),
            TerrainType.DESERT: (YELLOW, '.'),
            TerrainType.PLAINS: (GREEN, '.'),
            TerrainType.FOREST: (GREEN, 'T'),
            TerrainType.JUNGLE: (GREEN, '&'),
            TerrainType.HILLS: (YELLOW, 'n'),
            TerrainType.MOUNTAINS: (GREY, '^'),
            TerrainType.GLACIER: (WHITE, '*'),
            TerrainType.BADLANDS: (YELLOW, '-'),
        }

        if to_file and use_color:
            # Files stay easier to read without ANSI codes.
            use_color = False

        effective_width = self.width if slice_width is None else max(1, min(self.width, slice_width))
        effective_height = self.height if slice_height is None else max(1, min(self.height, slice_height))
        is_full_map = effective_width == self.width and effective_height == self.height

        heading = f"\n--- WORLD MAP {'FULL' if is_full_map else f'PREVIEW ({effective_width}x{effective_height})'} ---"
        footer = "-" * len(heading.strip())

        plain_lines = [heading]
        color_lines = [heading] if use_color else None

        for y in range(effective_height):
            plain_line = ""
            color_line = "" if use_color else None

            # Offset shift for hex look
            if y % 2:
                plain_line += " "
                if use_color:
                    color_line += " "

            for x in range(effective_width):
                cell = self.grid[x][y]
                color, char = chars.get(cell.terrain, (RESET, '?'))

                # Override char for rivers/lakes for visualization
                if cell.is_lake:
                    color = CYAN
                    char = 'O'
                elif cell.is_river and cell.terrain not in (TerrainType.SEA, TerrainType.DEEP_SEA):
                    char = '~'

                token_plain = f"{char} "
                plain_line += token_plain

                if use_color:
                    token_color = f"{color}{char} {RESET}"
                    color_line += token_color

            plain_lines.append(plain_line)
            if use_color and color_line is not None:
                color_lines.append(color_line)

        plain_lines.append(footer)
        if use_color and color_lines is not None:
            color_lines.append(footer)
            print("\n".join(color_lines))
        else:
            print("\n".join(plain_lines))

        if to_file:
            with open(to_file, "w", encoding="utf-8") as map_file:
                map_file.write("\n".join(plain_lines))
            print(f"ASCII map saved to {to_file}")

# --- MAIN EXECUTION ---

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Generate and visualize a BECMI-style hex world.")
    parser.add_argument(
        "--full-map",
        action="store_true",
        help="Render the full map instead of the default 80x40 preview."
    )
    parser.add_argument(
        "--map-width",
        type=int,
        help="Limit the ASCII render to this many columns (ignored with --full-map)."
    )
    parser.add_argument(
        "--map-height",
        type=int,
        help="Limit the ASCII render to this many rows (ignored with --full-map)."
    )
    parser.add_argument(
        "--map-output",
        type=str,
        help="Write the ASCII map (without colors) to the given file path."
    )
    parser.add_argument(
        "--no-color",
        action="store_true",
        help="Disable ANSI colors in the ASCII map output."
    )
    args = parser.parse_args()

    if args.map_width is not None and args.map_width <= 0:
        parser.error("--map-width must be a positive integer.")
    if args.map_height is not None and args.map_height <= 0:
        parser.error("--map-height must be a positive integer.")

    # 1. Initialize
    world = WorldGenerator(MAP_WIDTH, MAP_HEIGHT)

    # 2. Generate Height/Temp/Moist
    world.generate_base_layers()

    # 3. Run Water Physics
    world.generate_rivers()

    # 4. Determine BECMI Terrain
    world.assign_biomes()

    # 5. Visualize
    if args.full_map:
        slice_width = None
        slice_height = None
    else:
        slice_width = args.map_width if args.map_width is not None else 80
        slice_height = args.map_height if args.map_height is not None else 40

    world.render_ascii_map(
        slice_width=slice_width,
        slice_height=slice_height,
        use_color=not args.no_color,
        to_file=args.map_output
    )

    # 6. Export Data to SQLite
    world.save_to_db()