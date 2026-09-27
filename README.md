# Astronaut Health Monitor

A working prototype built for the **NASA Space Apps Challenge 2026** challenge
*"Create Health Monitoring Software for Astronauts on Space Missions."*

It monitors a simulated crew's vitals, sleep, exercise, wellbeing, and
musculoskeletal risk, alongside the spacecraft's environment — detects
concerning trends — and connects the crew to Mission Control:

```
MONITOR → DETECT → EXPLAIN → ACT → RECORD
```

## Quick start

**Just open `index.html` in a browser.** No build step, no install, no
server required. Plain HTML, CSS, and vanilla JavaScript throughout.

From there, click through to **Astronaut Interface** or **Mission
Control** — both live inside `console.html` as two switchable views (a
nav click swaps panels instantly, no page reload). See
[Why one console page, not two](#why-one-console-page-not-two) for why
that's a deliberate choice, not a shortcut.

## Demonstrating the scenario

The bundled 45-day simulated mission (`data/telemetry.csv`) is scripted so
the alert engine has something real to catch:

1. Open **Mission Control**. Drag the **Mission Day** slider to around
   **day 25–33**. Watch Cmdr. Reyes's status flip to `ATTENTION` and then
   `CRITICAL` as her sleep, exercise compliance, fatigue, and resting heart
   rate decline together — the banner explains this as a *multi-parameter*
   alert, not a single bad reading. Cabin CO2 also crosses into `CRITICAL`
   around the same window.
2. Click Cmdr. Reyes's card to see her detail panel, then look at **Active
   Alerts** for the full list.
3. In the **Send Recommendation** panel, pick a template (or write your
   own) and click **Send to astronaut**.
4. Switch to the **Astronaut Interface** view, select **Cmdr. Amara
   Reyes**, and set the same Mission Day. A message banner from Mission
   Control appears immediately — click **Acknowledge**.
5. Check **History** on either view: alert generated → recommendation
   sent → astronaut acknowledged, all timestamped.
6. Drag the slider on to **day 40–45** to see the scripted recovery.

Msn. Spec. Fatima Noor has a second, independent decline in the same
window — a good way to demo that Mission Control is monitoring the whole
crew, not just one person, and has to triage between them.

You can also use the **Wellbeing Check-In** sliders on the Astronaut
Interface to submit a live self-assessment and watch the alert engine
react immediately.

## Why one console page, not two

The challenge brief describes two interfaces — astronaut and Mission
Control — and it's tempting to build them as two separate HTML files
(`astronaut.html`, `mission-control.html`) that "talk" to each other so
they can be demoed as if from two different locations. An earlier version
of this project did exactly that, using `localStorage` +
`BroadcastChannel` for the two files to sync.

That turned out to be unreliable specifically *because* the brief asks
for a zero-server, `file://`-opened prototype: per MDN, localStorage
behavior for `file://` documents is explicitly **undefined and varies by
browser**, and modern Firefox (92+) gives every `file://` path its own
storage origin by default — meaning two separate local files do **not**
reliably share `localStorage`, so a two-file version can silently fail to
sync depending on which browser a judge happens to open it in.

If you deploy this on a real static file server later (see [Future
enhancements](#future-enhancements)), splitting the two views back into
separate pages — or wiring up real cross-device communication — becomes
straightforward without touching the alert engine at all.

## Project structure

```
Astronaut-Health-Monitor/
├── index.html                Landing page — links into console.html
├── console.html               Astronaut view + Mission Control view
│                               (switchable panels, one shared script)
│
├── assets/
│   ├── css/
│   │   ├── theme.css         Design tokens, nav, shared components
│   │   └── pages.css         Landing hero + dashboard layouts
│   └── js/
│       ├── common.js         CSV parsing, trend math, alert engine, event log
│       ├── charts.js         Tiny dependency-free SVG sparkline renderer
│       └── app.js            View switching + both dashboards' rendering
│
├── data/
│   ├── telemetry.csv          SIMULATED daily crew + environment readings
│   ├── crew.json              Crew roster
│   ├── mission.json           Mission metadata (day range, baseline window)
│   ├── nasa-references.json   Every threshold used by the alert engine, cited
│   └── data.js                AUTO-GENERATED embed of the four files above
│                               (see tools/build_data_js.py — this is what
│                               lets the app run via file:// with no server)
│
├── tools/
│   ├── generate_telemetry.py  Regenerates telemetry.csv (edit + re-run to
│   │                          change the simulated scenario)
│   └── build_data_js.py       Regenerates data/data.js from the CSV/JSON
│
└── README.md
```

**If you edit `data/telemetry.csv`, `crew.json`, `mission.json`, or
`nasa-references.json` by hand,** re-run `python3 tools/build_data_js.py`
from the `tools/` folder afterward so `data.js` picks up your changes —
the app reads `data.js`, not the CSV/JSON directly, for the file:// reason
explained above.

## What's simulated vs. what's real

**Simulated:** every number in `data/telemetry.csv` — heart rate,
respiration, SpO2, skin temperature, sleep, exercise minutes, wellbeing
scores, and cabin environment readings for a fictional 3-person crew and
45-day mission. None of it is real astronaut telemetry.

**Real and cited:** the thresholds the alert engine uses to judge those
numbers, wherever an authoritative NASA source publishes one. See
`data/nasa-references.json` for the full, structured list with citations
attached to every value. In short:

| Parameter | Reference value | Source |
|---|---|---|
| Cabin CO2 (ppCO2) | ≤ 3.0 mmHg average 1-hr limit; historical ISS operating range 1–9 mmHg, typically ~4.0 mmHg | NASA-STD-3001 Vol 2 [V2 6004]; OCHMO-TB-004 |
| O2 partial pressure | 145–155 mmHg normoxia target | NASA-STD-3001 Vol 2 [V2 6003]; OCHMO-TB-002 |
| Cabin total pressure | 7.5–15.0 psia certified tolerance band | NASA-STD-3001 Vol 2 [V2 6006 / HS3004] |
| Cabin temperature | 18–27 °C nominal range | NASA-STD-3001 Vol 2; NASA Human Integration Design Handbook |
| Relative humidity | ~25–75%, 40–60% preferred | NASA-STD-3001 Vol 2; OCHMO-TB-002/003 |
| Food | ~3,035 kcal/day average | NASA-STD-3001 Vol 2 [V2 7003] |
| Water | ≥ 2.5 L/day/crewmember minimum | NASA-STD-3001 Vol 2 [V2 6109] |
| Sleep | Scheduled 8.5 h/night; observed spaceflight average ~5.96–6.09 h | Barger LK, et al., *Lancet Neurology*, 2014 |
| Exercise | ~2.5 h/day, 6 days/week (aerobic + resistance) | Ploutz-Snyder L., NASA JSC ISS exercise Rx; Smith SM, et al., 2012 |
| Bone mineral density | 0.4–2.7%/month loss at weight-bearing sites absent countermeasures, mitigated by resistance-exercise compliance | Smith SM, et al., 2012; NASA/TM-2018-219938; Shackelford LC, et al. |

Vitals reference ranges (resting heart rate, respiration rate, SpO2,
skin temperature) are **general clinical reference ranges, not
NASA-specific numbers** — this is stated explicitly in
`nasa-references.json`, since NASA does not publish a single universal
numeric cutoff for these that's appropriate to reproduce here. The
prototype also compares each crew member against their own personal
baseline (mission days 1–7), not just a population range.

The **musculoskeletal / bone-loss indicator is a modeled estimate**, built
from mission duration and each crew member's average resistance-exercise
compliance, using the published monthly loss-rate range above. It is
**not a measurement** and the UI says so.

## Design notes

- No frameworks, no build step, no database, no authentication — plain
  HTML/CSS/JS and CSV/JSON, per the challenge's technology constraints.
- Trend detection uses only simple, explainable methods: trailing moving
  averages, percent-change from a personal baseline, basic least-squares
  linear trend/slope, consecutive-abnormal-day counts, and a linear
  threshold-crossing projection for CO2. No machine learning.
- All thresholds live in one JSON file (`data/nasa-references.json`) so
  they're easy to find, cite, and adjust — nothing is hard-coded into the
  alert logic itself.
- UI/CSS follows a dark, mission-control-inspired look built around the
  NASA insignia palette (NASA blue `#0b3d91`, NASA red `#fc3d21`) with a
  cyan/amber/red status system for NOMINAL/ATTENTION/CRITICAL.

## Development priority (what's implemented)

1. ✅ Basic astronaut dashboard
2. ✅ Simulated CSV telemetry (45 days × 3 crew)
3. ✅ Health/environment calculations
4. ✅ Trend detection (moving average, slope, baseline delta, projection)
5. ✅ Alerts (single-parameter, multi-parameter, environmental)
6. ✅ History/log (shared, cross-tab)
7. ✅ Mission Control dashboard
8. ✅ Mission Control → astronaut notification
9. ✅ Astronaut acknowledgement
10. 🔄 Polish UI and presentation — functional and demo-ready; see below
    for ideas if you have more time before the deadline.

## Future enhancements (not needed for the MVP)

- A small Node.js/WebSocket server for real cross-device (not just
  cross-tab) Mission Control ↔ astronaut communication.
- Per-parameter historical detail pages with longer date ranges and CSV
  export.
- A settings page to adjust thresholds in the browser instead of editing
  `nasa-references.json` by hand.
- Real NASA OSDR dataset integration for a non-fictional case study
  alongside the simulated demo mission.
- Accessibility pass with a screen-reader user (current build: visible
  focus states, `prefers-reduced-motion` respected, semantic table
  markup for history/log).

## Sources consulted

- NASA-STD-3001, *Space Flight Human System Standard*, Volumes 1 & 2.
- NASA Office of the Chief Health & Medical Officer (OCHMO) Technical
  Briefs: OCHMO-TB-002 (ECLSS), OCHMO-TB-003 (Habitable Atmosphere),
  OCHMO-TB-004 (Carbon Dioxide), OCHMO-TB-030 (Bone Loss).
- Barger LK, Flynn-Evans EE, Kubey A, Walsh L, Ronda JM, Wang W, Wright
  KP, Czeisler CA. "Prevalence of sleep deficiency and use of hypnotic
  drugs in astronauts before, during, and after spaceflight." *Lancet
  Neurology*, 2014;13:904–912.
- Smith SM, et al. Bone/exercise-compliance findings from ISS missions
  2006–2009; NASA/TM-2018-219938 (modeled BMD change, 0.4–2.7%/month).
- Shackelford LC, et al., bone densitometry findings, Mir/ISS
  long-duration crews.
- Ploutz-Snyder L. "An Evidence-Based Approach to Exercise Prescriptions
  on ISS," NASA Johnson Space Center / Universities Space Research
  Association.
- NASA Human Integration Design Handbook (companion to NASA-STD-3001).

All of the above are publicly available NASA or peer-reviewed sources.
No NASA requirement is invented in this project — where a number isn't
backed by one of these, it's labeled as a general/demo reference value
in `data/nasa-references.json`.

## Important note

This is a **decision-support and monitoring prototype**, not an
autonomous medical diagnostic system. It does not diagnose disease,
prescribe medication, or give medical instructions. Every recommendation
Mission Control can send is operational/recovery-oriented (review
recovery schedule, review exercise compliance, notify the flight
surgeon, etc.) and is designed to prompt human review, not replace it.
