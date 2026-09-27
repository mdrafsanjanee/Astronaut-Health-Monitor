"""
generate_telemetry.py
----------------------
Generates data/telemetry.csv: SIMULATED daily health + environment telemetry
for a 3-person crew over a 45-day demo mission.

This is not real astronaut data. It is a plausible, NASA-informed simulation
built for the NASA Space Apps Challenge "Astronaut Health Monitoring" prototype.
Reference ranges and rates used to shape the simulation (see README.md /
data/nasa-references.json for full citations):
  - CO2 (ppCO2) limits & headache thresholds: NASA-STD-3001 Vol 2 [V2 6004],
    OCHMO-TB-004
  - O2 partial pressure / cabin pressure / humidity / temperature:
    NASA-STD-3001 Vol 2 [V2 6003, V2 6006], OCHMO-TB-002, OCHMO-TB-003
  - Sleep: scheduled 8.5 h/night, observed ~6.0-6.1 h average
    (Barger et al., 2014, Lancet Neurology)
  - Exercise regimen: ~2.5 h/day, 6 days/week (Ploutz-Snyder, ISS ExRx)
  - Bone mineral density loss: ~0.4-2.7%/month at weight-bearing sites,
    mitigated by resistance exercise compliance (Smith et al., 2012;
    NASA/TM-2018-219938)

Run: python3 generate_telemetry.py
Output: ../data/telemetry.csv
"""

import csv
import math
import os
import random

random.seed(7)  # deterministic output so the demo story is reproducible

DAYS = 45
OUT_PATH = os.path.join(os.path.dirname(__file__), "..", "data", "telemetry.csv")

CREW = [
    {"id": "CMD-01", "name": "Cmdr. Amara Reyes", "arc": "decline_recover"},
    {"id": "FE-02", "name": "Flt. Eng. Kenji Tanaka", "arc": "stable"},
    {"id": "MS-03", "name": "Msn. Spec. Fatima Noor", "arc": "mild_dip"},
]


def clamp(v, lo, hi):
    return max(lo, min(hi, v))


def noise(scale):
    return random.uniform(-scale, scale)


def env_for_day(day):
    """Cabin-wide environmental readings (shared by all crew on that day).
    CO2 drifts up gradually across the mission (simulated CDRA loading /
    increased crew metabolic output), crossing the NASA-STD-3001 1-hour
    average limit of 3.0 mmHg [V2 6004] around the mid-mission
    'deterioration' window, then is brought back down after the simulated
    Mission Control intervention around day 33.
    """
    if day <= 18:
        co2 = 1.9 + 0.02 * day + noise(0.08)
    elif day <= 33:
        co2 = 2.3 + 0.11 * (day - 18) + noise(0.10)
    else:
        co2 = max(2.2, 4.0 - 0.10 * (day - 33) + noise(0.08))

    o2 = 149.5 + noise(1.2)  # target band 145-155 mmHg [V2 6003]
    pressure = 14.65 + noise(0.06)  # nominal ~14.7 psia band
    cabin_temp = 22.0 + noise(0.5)  # comfort target 20-24C within 18-27C
    humidity = 48 + noise(4)

    # Slow, steady resource drawdown across the mission
    food_reserve_days = round(60 - day * 0.9, 1)
    water_reserve_l = round(900 - day * 14.5, 1)

    return {
        "co2_mmhg": round(clamp(co2, 1.6, 5.2), 2),
        "o2_pp_mmhg": round(clamp(o2, 140, 160), 1),
        "cabin_pressure_psia": round(clamp(pressure, 14.0, 15.0), 2),
        "cabin_temp_c": round(clamp(cabin_temp, 18, 27), 1),
        "humidity_pct": round(clamp(humidity, 25, 75), 1),
        "food_reserve_days": max(0, food_reserve_days),
        "water_reserve_l": max(0, water_reserve_l),
    }


def crew_day(crew, day):
    arc = crew["arc"]

    if arc == "stable":
        sleep_actual = clamp(7.4 + noise(0.4), 5.5, 8.5)
        exercise_min = clamp(148 + noise(12), 90, 165)
        hr = clamp(60 + noise(3), 50, 75)
        fatigue = clamp(2 + noise(0.6), 1, 5)
        mood = clamp(4 + noise(0.5), 1, 5)
        stress = clamp(2 + noise(0.5), 1, 5)
        motivation = clamp(4 + noise(0.5), 1, 5)
        social = clamp(4 + noise(0.5), 1, 5)
        interruptions = random.choice([0, 0, 1])

    elif arc == "decline_recover":
        if day <= 19:
            phase = 0.0
        elif day <= 33:
            phase = (day - 19) / 14.0  # 0 -> 1 across the decline window
        else:
            phase = max(0.0, 1.0 - (day - 33) / 10.0)  # recovers by ~day 43

        sleep_actual = clamp(7.2 - 2.6 * phase + noise(0.25), 4.2, 8.5)
        exercise_min = clamp(150 - 95 * phase + noise(8), 35, 165)
        hr = clamp(63 + 20 * phase + noise(2.5), 55, 95)
        fatigue = clamp(2 + 2.8 * phase + noise(0.3), 1, 5)
        mood = clamp(4 - 1.8 * phase + noise(0.3), 1, 5)
        stress = clamp(2 + 2.2 * phase + noise(0.3), 1, 5)
        motivation = clamp(4 - 1.6 * phase + noise(0.3), 1, 5)
        social = clamp(4 - 1.2 * phase + noise(0.3), 1, 5)
        interruptions = 0 if phase < 0.2 else random.choice([1, 1, 2, 3])

    else:  # mild_dip: a smaller, self-resolving wellbeing dip mid-mission
        if 24 <= day <= 31:
            phase = 1.0 - abs(day - 27.5) / 4.5
            phase = clamp(phase, 0, 1)
        else:
            phase = 0.0

        sleep_actual = clamp(7.0 - 0.9 * phase + noise(0.3), 5.5, 8.3)
        exercise_min = clamp(140 - 25 * phase + noise(10), 90, 160)
        hr = clamp(64 + 1.5 * phase + noise(2.5), 55, 85)
        fatigue = clamp(2.2 + 1.3 * phase + noise(0.3), 1, 5)
        mood = clamp(3.8 - 1.1 * phase + noise(0.3), 1, 5)
        stress = clamp(2.2 + 1.2 * phase + noise(0.3), 1, 5)
        motivation = clamp(3.8 - 0.9 * phase + noise(0.3), 1, 5)
        social = clamp(3.8 - 0.7 * phase + noise(0.3), 1, 5)
        interruptions = random.choice([0, 0, 1]) if phase < 0.3 else random.choice([1, 2])

    resp = clamp(15 + noise(1.2) + (hr - 63) * 0.05, 11, 22)
    spo2 = clamp(98 - max(0, (hr - 80)) * 0.05 + noise(0.4), 94, 100)
    skin_temp = clamp(36.6 + noise(0.15), 35.9, 37.6)

    resistance_min = clamp(exercise_min * random.uniform(0.42, 0.52), 0, 90)
    aerobic_min = clamp(exercise_min - resistance_min, 0, 100)

    return {
        "heart_rate_bpm": round(hr, 1),
        "respiration_rate": round(resp, 1),
        "spo2_pct": round(spo2, 1),
        "skin_temp_c": round(skin_temp, 2),
        "sleep_scheduled_hr": 8.5,
        "sleep_actual_hr": round(sleep_actual, 2),
        "sleep_interruptions": interruptions,
        "exercise_aerobic_min": round(aerobic_min),
        "exercise_resistance_min": round(resistance_min),
        "mood_1_5": round(mood, 1),
        "stress_1_5": round(stress, 1),
        "fatigue_1_5": round(fatigue, 1),
        "motivation_1_5": round(motivation, 1),
        "social_1_5": round(social, 1),
    }


def main():
    fieldnames = [
        "mission_day", "crew_id", "crew_name",
        "heart_rate_bpm", "respiration_rate", "spo2_pct", "skin_temp_c",
        "sleep_scheduled_hr", "sleep_actual_hr", "sleep_interruptions",
        "exercise_aerobic_min", "exercise_resistance_min",
        "mood_1_5", "stress_1_5", "fatigue_1_5", "motivation_1_5", "social_1_5",
        "co2_mmhg", "o2_pp_mmhg", "cabin_pressure_psia", "cabin_temp_c",
        "humidity_pct", "food_reserve_days", "water_reserve_l",
    ]

    rows = []
    for day in range(1, DAYS + 1):
        env = env_for_day(day)
        for crew in CREW:
            row = {
                "mission_day": day,
                "crew_id": crew["id"],
                "crew_name": crew["name"],
            }
            row.update(crew_day(crew, day))
            row.update(env)
            rows.append(row)

    os.makedirs(os.path.dirname(OUT_PATH), exist_ok=True)
    with open(OUT_PATH, "w", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames, lineterminator="\n")
        writer.writeheader()
        writer.writerows(rows)

    print(f"Wrote {len(rows)} rows to {OUT_PATH}")


if __name__ == "__main__":
    main()
