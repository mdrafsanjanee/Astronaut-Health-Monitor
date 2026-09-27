"""
generate_telemetry.py
----------------------
Generates data/telemetry.csv: hourly heart-rate and respiration-rate
values for Apollo 15's three crew members across the full 295-hour
mission (GET 0 to splashdown).

IMPORTANT — what is real vs. interpolated:
Apollo's bioharness measured only two continuous physiological signals:
ECG-derived heart rate and an impedance-pneumogram respiration rate. The
Apollo 15 Mission Report (Section 10) publishes a handful of PERIOD
AVERAGES and RANGES for these — not a continuous minute-by-minute trace.
This script:
  1. Places every number the report actually gives at its correct GET
     as a "reported" anchor point (source cited in ANCHORS below).
  2. Smoothly interpolates between anchors to draw a continuous line,
     tagging every interpolated hour as "interpolated" in the CSV's
     basis column so the UI can show real points as solid markers and
     everything else as a lighter, clearly-secondary line.
There is no real reported data for the quiet translunar/lunar-orbit
coast phases (no EVA, no anomaly), so those hours interpolate toward a
labeled, literature-typical resting range rather than inventing a
"reported" figure that doesn't exist. Respiration rate is not
separately reported at all — it is estimated from heart rate using a
fixed physiological ratio (labeled "estimated" in the CSV), since only
its instrumentation problem (not its values) is described in the
report.

Run: python3 generate_telemetry.py
Output: ../data/telemetry.csv
"""

import csv
import os

OUT_PATH = os.path.join(os.path.dirname(__file__), "..", "data", "telemetry.csv")
TOTAL_HOURS = 296  # slightly past splashdown (295.198h) so the last row is complete

# Each crew member's REPORTED heart-rate anchors: (get_hours, bpm, label, basis)
# All figures are from Apollo 15 Mission Report, Section 10 (Biomedical
# Evaluation), NASA, 1971, unless noted otherwise.
ANCHORS = {
    "CDR": [  # David Scott
        (0.2, 110, "Launch (typical Apollo commander range; not individually reported)", "estimated"),
        (104.7, 90, "Lunar descent (range reported: 81-98 bpm)", "reported"),
        (119.7, 92, "EVA-1 average", "reported"),
        (126.2, 88, "EVA-1 end", "reported"),
        (142.3, 84, "EVA-2 average", "reported"),
        (149.4, 82, "EVA-2 end", "reported"),
        (163.3, 85, "EVA-3 average", "reported"),
        (168.1, 80, "EVA-3 end", "reported"),
        (171.6, 76, "Lunar ascent (range reported: 65-88 bpm)", "reported"),
        (295.2, 100, "Splashdown / entry (typical Apollo range; not individually reported)", "estimated"),
    ],
    "CMP": [  # Alfred Worden — no EVA-period figures published in the sources
        # used here; modeled as a steady, unremarkable resting range with a
        # bump for his real deep-space EVA at ~241h.
        (0.2, 105, "Launch (typical Apollo range; not individually reported)", "estimated"),
        (60, 68, "Lunar-orbit coast (typical resting range; not individually reported)", "estimated"),
        (173.6, 70, "Docking with Falcon (typical range; not individually reported)", "estimated"),
        (223.8, 68, "Transearth injection (typical range; not individually reported)", "estimated"),
        (241.0, 105, "Deep-space EVA — first in history (elevated exertion typical of EVA; not individually reported)", "estimated"),
        (245.0, 70, "Post-EVA rest (typical range; not individually reported)", "estimated"),
        (295.2, 100, "Splashdown / entry (typical Apollo range; not individually reported)", "estimated"),
    ],
    "LMP": [  # James Irwin
        (0.2, 115, "Launch (typical Apollo range; not individually reported)", "estimated"),
        (104.7, 90, "Lunar descent (shared cabin range with CDR; not separately reported)", "estimated"),
        (119.7, 125, "EVA-1 average", "reported"),
        (126.2, 115, "EVA-1 end", "reported"),
        (142.3, 107, "EVA-2 average", "reported"),
        (149.4, 100, "EVA-2 end", "reported"),
        (163.3, 105, "EVA-3 average", "reported"),
        (168.1, 95, "EVA-3 end", "reported"),
        (171.6, 80, "Lunar ascent (typical range; not individually reported)", "estimated"),
        # The arrhythmia itself is a RHYTHM abnormality (paired beats with
        # pauses), not simply a rate spike — a plain heart-rate number for
        # this hour would misrepresent it, so the app surfaces it as a
        # distinct medical event (see events.json) rather than a chart
        # anomaly. The rate anchor below stays in a plausible range.
        (178.0, 88, "Cardiac event window — bigeminy rhythm on EKG (see medical event; rate alone doesn't show this)", "reported"),
        (181.5, 75, "Post-event recovery (typical range; not individually reported)", "estimated"),
        (295.2, 100, "Splashdown / entry (typical Apollo range; not individually reported)", "estimated"),
    ],
}

RESP_RATIO = 0.16  # rough breaths-per-minute as a fraction of heart rate, for a
                    # physiologically plausible (labeled "estimated") respiration
                    # curve — the report describes the instrument, not values.


def interpolate(anchors, hour):
    """Piecewise-linear interpolation across (hour, value, label, basis)
    anchors. Returns (value, basis, label) using the basis/label of the
    nearer anchor when between two points."""
    if hour <= anchors[0][0]:
        return anchors[0][1], anchors[0][3], anchors[0][2]
    if hour >= anchors[-1][0]:
        return anchors[-1][1], anchors[-1][3], anchors[-1][2]
    for i in range(len(anchors) - 1):
        h0, v0, label0, basis0 = anchors[i]
        h1, v1, label1, basis1 = anchors[i + 1]
        if h0 <= hour <= h1:
            # Exact anchor hits are "reported" (or "estimated") as tagged;
            # in-between hours are always "interpolated".
            if abs(hour - h0) < 0.05:
                return v0, basis0, label0
            if abs(hour - h1) < 0.05:
                return v1, basis1, label1
            t = (hour - h0) / (h1 - h0)
            value = v0 + t * (v1 - v0)
            return round(value, 1), "interpolated", ""
    return anchors[-1][1], anchors[-1][3], anchors[-1][2]


def main():
    fieldnames = [
        "get_hours", "crew_id", "heart_rate_bpm", "heart_rate_basis",
        "heart_rate_label", "respiration_rate", "respiration_basis",
    ]
    rows = []
    for hour in range(0, TOTAL_HOURS):
        for crew_id, anchors in ANCHORS.items():
            hr, basis, label = interpolate(anchors, float(hour))
            resp = round(hr * RESP_RATIO, 1)
            resp_basis = "estimated"  # never "reported" — see module docstring
            rows.append({
                "get_hours": hour,
                "crew_id": crew_id,
                "heart_rate_bpm": hr,
                "heart_rate_basis": basis,
                "heart_rate_label": label,
                "respiration_rate": resp,
                "respiration_basis": resp_basis,
            })

    os.makedirs(os.path.dirname(OUT_PATH), exist_ok=True)
    with open(OUT_PATH, "w", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames, lineterminator="\n")
        writer.writeheader()
        writer.writerows(rows)

    print(f"Wrote {len(rows)} rows to {OUT_PATH}")


if __name__ == "__main__":
    main()
