import math
import random
from enum import Enum
from dataclasses import dataclass

# --- BECMI COMPATIBLE CONSTANTS ---
# Standard BECMI Calendar: 12 Months, 28 Days each (Example)
DAYS_IN_YEAR = 336 
MONTH_NAMES = [
    "Nuwmont", "Vatermont", "Thaumont", "Flaurmont", 
    "Yarthmont", "Klarmont", "Felmont", "Fyrmont", 
    "Ambyrmont", "Sviftmont", "Eirmont", "Kaldmont"
]

class WeatherCondition(str, Enum):
    CLEAR = "Clear"
    OVERCAST = "Overcast"
    RAIN_LIGHT = "Light Rain"
    RAIN_HEAVY = "Heavy Rain" # Halves movement (Mud)
    STORM = "Storm"           # Stops movement
    SNOW_LIGHT = "Light Snow"
    SNOW_HEAVY = "Heavy Snow" # Halves movement
    BLIZZARD = "Blizzard"     # Stops movement/Damage
    HEATWAVE = "Heatwave"     # Double water consumption

@dataclass
class DailyWeather:
    temperature_f: int
    condition: WeatherCondition
    wind_speed_mph: int
    movement_penalty: float # 1.0 = Normal, 0.5 = Half speed

class WeatherEngine:
    def __init__(self, global_seed=42):
        self.global_seed = global_seed

    def get_season_modifier(self, day_of_year: int) -> float:
        """
        Returns a temp modifier (-0.2 to +0.2) based on a cosine wave.
        Assumes Day 0 is Mid-Winter, Day 168 is Mid-Summer.
        """
        # Map day 0-336 to radians 0-2pi
        # We shift by PI so Day 0 is the trough (Winter)
        radians = (day_of_year / DAYS_IN_YEAR) * 2 * math.pi
        # -1.0 (Winter) to 1.0 (Summer)
        seasonal_swing = -math.cos(radians) 
        return seasonal_swing * 0.25  # Strength of season swing

    def generate_weather(self, hex_data: dict, day_of_year: int) -> DailyWeather:
        """
        Determines weather for a specific hex on a specific day.
        This is deterministic: Same Hex + Same Day = Same Weather.
        """
        # 1. Seed the RNG with location + time
        # We multiply x by a large prime to avoid patterns with adjacent hexes
        local_seed = self.global_seed + (hex_data['x'] * 73856093) ^ (hex_data['y'] * 19349663) ^ day_of_year
        rng = random.Random(local_seed)

        # 2. Calculate Temperature
        # Base temp from hex (0.0 - 1.0). Map 0.0->-20F, 1.0->110F
        base_temp = hex_data['temperature']
        season_mod = self.get_season_modifier(day_of_year)
        
        # Variance represents daily fluctuation
        daily_variance = rng.uniform(-0.05, 0.05)
        
        final_temp_factor = base_temp + season_mod + daily_variance
        final_temp_factor = max(0.0, min(1.0, final_temp_factor)) # Clamp
        
        # Convert to Fahrenheit (BECMI standard)
        temp_f = int(-20 + (final_temp_factor * 130))

        # 3. Calculate Precipitation
        # BECMI "Water Travel" table uses 2d6. We adopt that bell curve.
        # Low roll = Calm/Clear, High roll = Storm/Gale.
        
        roll = rng.randint(1, 6) + rng.randint(1, 6) # 2d6
        
        # Modifiers based on Hex Moisture (0.0 - 1.0)
        # Desert (0.1) -> -4 to roll
        # Jungle/Swamp (0.9) -> +3 to roll
        moisture_mod = int((hex_data['moisture'] * 8) - 4)
        
        # Modifiers based on Season (Winter/Spring wetter?)
        # Let's say Spring (Days 50-100) is wetter
        season_precip_mod = 0
        if 50 < day_of_year < 100: 
            season_precip_mod = 1
            
        final_roll = roll + moisture_mod + season_precip_mod

        # 4. Determine Condition
        condition = WeatherCondition.CLEAR
        penalty = 1.0
        
        # Precipitation Thresholds
        if final_roll >= 10: # Storm territory
            if temp_f <= 32:
                condition = WeatherCondition.BLIZZARD if final_roll >= 12 else WeatherCondition.SNOW_HEAVY
                penalty = 0.0 if condition == WeatherCondition.BLIZZARD else 0.5
            else:
                condition = WeatherCondition.STORM if final_roll >= 12 else WeatherCondition.RAIN_HEAVY
                penalty = 0.0 if condition == WeatherCondition.STORM else 0.66 # Mud (pg 88)
        
        elif final_roll >= 8: # Light Precip
            if temp_f <= 32:
                condition = WeatherCondition.SNOW_LIGHT
            else:
                condition = WeatherCondition.RAIN_LIGHT
        
        elif final_roll <= 3 and temp_f > 90:
            # Clear but blazing hot
            condition = WeatherCondition.HEATWAVE
            # No movement penalty, but logic should trigger water consumption increase

        elif final_roll >= 6 and hex_data['moisture'] > 0.7:
             # High moisture but no rain = Fog/Overcast
             condition = WeatherCondition.OVERCAST

        # 5. Wind (For Sailing/Flying)
        # BECMI pg 90: 2d6, 2=No wind, 12=Gale.
        wind_roll = rng.randint(1, 6) + rng.randint(1, 6)
        if hex_data['elevation'] > 0.7: wind_roll += 2 # Windier in mountains
        
        wind_speed = 0
        if wind_roll == 2: wind_speed = 0
        elif wind_roll < 10: wind_speed = rng.randint(5, 20)
        else: wind_speed = rng.randint(30, 70) # Gale

        return DailyWeather(temp_f, condition, wind_speed, penalty)

# --- DEMONSTRATION ---
if __name__ == "__main__":
    import json
    
    # Load the map we generated previously
    try:
        with open("becmi_world_map.json", "r") as f:
            world_data = json.load(f)
    except FileNotFoundError:
        print("Map file not found. Generating a mock hex for testing.")
        # Mock data: A temperate forest hex
        world_data = [{
            "x": 50, "y": 50, 
            "elevation": 0.4, "moisture": 0.6, "temperature": 0.5, 
            "terrain": "Forest"
        }]

    engine = WeatherEngine()
    
    # Pick a random hex to sample
    test_hex = world_data[len(world_data)//2] 
    print(f"Simulating 1 Year of Weather for Hex {test_hex['x']},{test_hex['y']} ({test_hex['terrain']})")
    print(f"Base Stats :: Temp: {test_hex['temperature']:.2f} | Moisture: {test_hex['moisture']:.2f}")
    print("-" * 60)
    print(f"{'Date':<15} | {'Temp':<6} | {'Weather':<15} | {'Effect'}")
    print("-" * 60)

    # Sample every 14 days
    for day in range(0, DAYS_IN_YEAR, 14):
        w = engine.generate_weather(test_hex, day)
        
        month_idx = int(day / 28)
        date_str = f"{MONTH_NAMES[month_idx]} {day % 28 + 1}"
        
        effect_str = ""
        if w.movement_penalty < 1.0:
            effect_str = f"Move x{w.movement_penalty}"
        if w.condition == WeatherCondition.HEATWAVE:
            effect_str = "Water x2"
            
        print(f"{date_str:<15} | {w.temperature_f}F   | {w.condition.value:<15} | {effect_str}")