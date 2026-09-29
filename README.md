# Apollo 15 Astronaut Health Monitor — Real-Data Replay

A working prototype built for the **NASA Space Apps Challenge 2026** challenge
*"Create Health Monitoring Software for Astronauts on Space Missions."*

This version replays **Apollo 15's real 1971 biomedical record** — not a
fictional scenario. Every event, timestamp, and cited figure comes from
NASA's own Apollo 15 Mission Report and related public sources. Where the
app fills a gap the public record doesn't cover, it says so, in the UI,
every time.

```
MONITOR → DETECT → EXPLAIN → ACT → RECORD
```

## Quick start

**Just open `index.html` in a browser.** No build step, no install, no
server required. Plain HTML, CSS, and vanilla JavaScript throughout.

From the landing page, open **Astronaut Interface** or **Mission
Control** — both live inside `console.html` as switchable views sharing
one script (see "Why one console page, not two" further down).

## Controls

- **Simulate** — press to auto-advance Ground Elapsed Time (GET) at
  roughly 1 mission day per 3 seconds. Press again to pause.
- **−6h / +6h** — step manually.
- **⟲** — reset to launch (GET 0:00).
- **Jump to** — a dropdown of all 27 real mission events; pick one to
  go straight there (e.g. "GET 178:00 — Cardiac arrhythmia detected").
- The **GET readout** at the top is the flight-hour counter, in the
  same Ground-Elapsed-Time format NASA itself used in 1971.

## The real story this replays

Minutes after Lunar Module Pilot James Irwin lifted off the Moon (GET
171:37), ground-based flight surgeons watched his EKG telemetry
develop a **bigeminy rhythm** — paired heartbeats with pauses between
them, five premature ventricular contractions in 30 seconds. NASA's
chief flight surgeon, Dr. Charles Berry, called it serious enough that
on Earth, he'd have put Irwin in an ICU. Mission leadership chose not
to tell Commander Scott, reasoning Irwin was already about as
monitored as he could be. Before the crew's next sleep period, Deke
Slayton radioed up a recommendation to take a sedative; the crew
declined, and finally slept 3.5 hours late after roughly 22 hours
awake. Irwin's rhythm was back to normal by splashdown. He suffered
his first heart attack a few months later, and died of one in 1991 —
the first of the twelve Apollo moonwalkers to die.

This mission is a big part of *why* NASA started taking in-flight
astronaut health monitoring seriously — which makes it a fitting real
case study for this challenge, not just a dramatic one.

**Demo path:** open Mission Control, use **Jump to** → "Cardiac
arrhythmia detected (Irwin)", watch his status flip to CRITICAL, then
switch to the Astronaut Interface and select James Irwin to see the
same event on his Mission Timeline card, with its sources cited.

## What's real, what's filled in, and how you can tell

Every screen makes this distinction visible, not just this README:

- **Real, cited events** — all 27 entries in `data/events.json` (EVA
  start/end times accurate to the second, the cardiac event, Mission
  Control's real decisions, real medication use, real postflight
  findings). Each carries a `source` field shown in the UI.
- **Real, cited biomedical figures** — heart-rate averages/ranges by
  mission phase, food intake, radiation dose, bone-density loss, body
  weight loss — all from Section 10 of the Apollo 15 Mission Report.
  On the heart-rate chart these render as solid gold dots; hover one
  to see its citation.
- **Interpolated** — the smooth line connecting those real points on
  the vitals chart. The report gives period averages, not a
  minute-by-minute trace, so this line is drawn for readability, not
  presented as measured data. Tagged `interpolated` in
  `data/telemetry.csv`.
- **Estimated** — values with no real reported figure at all (e.g.
  Worden's heart rate — the sources used here don't publish his,
  unlike Scott's and Irwin's) get a plausible, clearly-labeled
  placeholder rather than an invented "reported" number.
- **Interactive demo** — the Wellbeing Check-In slider and the Send
  Recommendation / Acknowledge workflow. Apollo crews didn't fill out
  a daily wellbeing survey (that's a modern, ISS-era practice), and
  nothing in this box is claimed to have happened in 1971 — it's
  there to demo how the same alert engine would react to that kind of
  input in a modern, real-time version. Every entry it creates is
  tagged `DEMO` in Mission History, right next to the real record.

## Modern monitoring layer (what today's NASA systems track)

The 1971 record is sparse by nature: Apollo's bioharness measured only ECG
and respiration. To show what a current system adds, the app carries a
clearly separate, violet-outlined **modern layer**, built from real current
NASA/CSA hardware and guidance in `data/modern-monitoring.json`:

- **Bio-Monitor parameters** (CSA smart shirt, flown on the ISS today):
  heart rate (3-lead ECG), respiration, SpO2, skin temperature, a
  continuous systolic-BP estimate, physical activity and sleep quality.
  Shown in the Astronaut view as *"Modern Monitoring"*, with the label
  **SIMULATED - not measured on Apollo 15** on the card itself.
- **Live radiation dose.** Endpoints are real (360 mrad Scott, 510 mrad
  Irwin; 300 mrad crew passive average used for Worden, who handed his
  personal dosimeter to Scott). The accumulation curve is estimated,
  because Apollo dosimeters were read only after landing.
- **Sleep quality score** that follows the real displaced-sleep events
  (about 2 h, 2 h and 7 h, then roughly 22 h awake before the cardiac event).
- **Then vs. Now table** (Mission Control): which parameters Apollo 15 could
  and could not monitor versus a modern Bio-Monitor.
- **Cabin CO2 Explorer** (Mission Control): drag a ppCO2 value and see the
  current ISS operational symptom bands (2.3 / 2.7 / 3.0 / 3.4 / 4.5 mmHg),
  from NASA OCHMO-TB-004 and the NASA CO2 operations update. Not an Apollo
  measurement; NASA-STD-3001's design limit is 3.0 mmHg.
- **Context cards** on SANS (spaceflight neuro-ocular syndrome; about 1 in 3
  long-duration ISS astronauts affected, too duration-dependent to appear in a
  12-day mission) and Behavioral Health & Performance monitoring.

One deliberate teaching point: Apollo's cabin was 100% oxygen, so a modern
SpO2 sensor would read near the top of the scale all mission. Irwin's real
problem was rhythm, not oxygenation; no SpO2 number would have caught it.

## Corrections made from the previous (fictional) version

Building this on real data surfaced two mismatches worth stating
plainly, since getting them wrong would have meant presenting
1990s/2000s-era ISS engineering as if it were 1971 Apollo hardware:

1. **Cabin atmosphere.** Apollo's Command and Lunar Modules ran
   **100% oxygen at ~5.0 psia** (with a 3.5 psia emergency floor) —
   not the mixed-gas, ~14.7 psia atmosphere used on the ISS today.
   The old NASA-STD-3001 thresholds (a modern standard, decades
   after Apollo) have been removed from this build's environment
   panel and replaced with the real, cited Apollo figures. See
   `data/nasa-references.json` → `flown_hardware.cabin_atmosphere`.
2. **No daily exercise regimen, no pulse oximetry.** The ISS's
   ~2.5h/day exercise countermeasure is a post-Apollo (Skylab-onward)
   practice, and pulse oximetry wasn't part of the 1971 bioharness —
   it measured only ECG (heart rate) and an impedance pneumogram
   (respiration). Both the fabricated "exercise compliance %" panel
   and the SpO2 tile have been removed; the Vitals panel now shows
   only what Apollo 15 actually measured.

The full, still-useful ISS-era numbers are kept in
`data/nasa-references.json` under `modern_comparison`, purely so the
app (and this README) can show how far things have moved on since
1971 — not as something that governed this mission.

## About the color palette

The brief asked for this build's palette to match mdrafsanjanee.tech's
dark mode. I wasn't able to actually pull the site's real color values —
I have no way to read a live page's CSS/assets in this environment, only
its text content, and I couldn't locate a public source repository for
it either. What's here (a warm near-black background with a violet
accent for interactive elements and a gold accent that specifically
marks real historical data points) is my own attempt at something in
that "modern dark portfolio" spirit rather than an extraction. If you
can share the actual hex values or a screenshot, I can match it exactly.

## Why one console page, not two

Both views live in **one HTML document** (`console.html`) as two panels
toggled by JavaScript, rather than as two separate `astronaut.html` /
`mission-control.html` files. This is because `localStorage` sharing
between two different `file://` documents is explicitly undefined
behavior (per MDN) and, in current Firefox, is off by default — a
two-file version could silently fail to sync depending on the browser a
judge happens to open it in. One document means both views share the
exact same in-memory event log by direct reference, which always works,
in any browser, with no server. `localStorage` is still used, but only
to persist your demo log across an ordinary reload of that *same*
document.

## Project structure

```
Astronaut-Health-Monitor/
├── index.html                Landing page — links into console.html
├── console.html               Astronaut view + Mission Control view,
│                               the shared GET simulation bar
│
├── assets/
│   ├── css/
│   │   ├── theme.css         Design tokens, nav, sim bar, shared components
│   │   └── pages.css         Landing hero + dashboard layouts
│   └── js/
│       ├── common.js         CSV parsing, GET helpers, the event-driven
│       │                     status model, the interactive demo log
│       ├── charts.js         Dependency-free SVG chart (marks real vs.
│       │                     interpolated points, shades real EVA windows)
│       └── app.js            View switching, simulation controls, both
│                             dashboards' rendering
│
├── data/
│   ├── telemetry.csv          Hourly HR/respiration, each row tagged
│   │                          reported / estimated / interpolated
│   ├── events.json            The 27 real, cited mission events
│   ├── crew.json               Real crew: Scott, Worden, Irwin
│   ├── mission.json            Real mission metadata (GET range, dates)
│   ├── nasa-references.json    Flown-hardware facts (cited) + a
│   │                           modern-ISS comparison section
│   ├── modern-monitoring.json  Current Bio-Monitor parameters, CO2 bands,
│   │                           radiation, SANS, BHP (cited)
│   └── data.js                 AUTO-GENERATED embed of the four files
│                                above (see tools/build-data.js — this
│                                is what lets the app run via file://
│                                with no server)
│
├── tools/
│   ├── generate-telemetry.js  Regenerates telemetry.csv from the real
│   │                          anchor points (edit ANCHORS to adjust)
│   └── build-data.js          Regenerates data/data.js from the CSV/JSON
│
└── README.md
```

**If you edit any `data/*.json` or `data/telemetry.csv` by hand,**
re-run `node tools/build-data.js`
afterward so `data.js` picks up your changes.

## Primary data sources

- Apollo 15 Mission Report (MSC-07230), NASA, 1971 — Section 10,
  Biomedical Evaluation (heart-rate ranges/averages, sleep displacement,
  food intake, medications, bone mineral measurement, radiation dose,
  physical exams).
- Apollo 15 Activities Timeline, Table 4-I, via
  an.rsl.wustl.edu/apollo/data/A15/pages/time — second-accurate EVA and
  liftoff GET timestamps.
- Wikipedia, "Return of Apollo 15 to Earth" — the cardiac-event
  narrative and Mission Control's real decision, cross-referenced
  against published flight-director memoirs (Kraft, Kranz).
- Delp MD, et al., arXiv:2208.00892 — the specific PVC count and GET
  window for Irwin's arrhythmia.
- KUOW "Primed" podcast, season 3 episode 4 — Dr. Charles Berry's
  quoted assessment of Irwin's condition.
- Canadian Space Agency, "Bio-Monitor: Keeping an eye on astronauts' vital
  signs"; NASA ISS blog (Jan 2019); Waterloo Vascular Aging study via
  FrogHeart - Bio-Monitor sensor list.
- NASA OCHMO-TB-004, "Carbon Dioxide" (Rev C/D) and NTRS 20150019624 -
  modern CO2 operational bands.
- Brunstetter T., NASA JSC (NTRS 20170009173) and Frontiers in Neurology
  (2021) - SANS prevalence and monitoring.
- NASA SP-368, *Biomedical Results of Apollo* — Command/Service Module
  Environmental Control System design (cabin atmosphere, CO2 removal).
- NASA, "Apollo 15 Mission Details" (nasa.gov) and Wikipedia's Apollo 15
  infobox — mission-level facts (launch/splashdown times, EVA counts).

All of the above are publicly available NASA or otherwise-public
sources. Nothing in `data/events.json` or the "reported" rows of
`telemetry.csv` is invented — anything this app had to fill in to make
a continuous simulation possible is labeled `estimated` or
`interpolated`, never presented as a measured figure.

## Design notes

- No frameworks, no build step, no database, no authentication — plain
  HTML/CSS/JS and CSV/JSON, per the challenge's technology constraints.
- The status model is **event-driven**, not a bank of numeric
  thresholds — see the design note at the top of `common.js` for why
  that's a more honest fit for real 1971 data (and a deliberate
  teaching point: a simple heart-rate threshold would have missed the
  one real cardiac event on this mission entirely, because it was a
  rhythm problem, not a rate problem).
- UI follows a dark, mission-control-inspired look (see "About the
  color palette" above for an honest note on its sourcing).

## Production-version roadmap (not built here — pre-screening only)

This build is a historical replay, deliberately scoped for the
pre-screening round. A production version, built after this stage,
would need to become a **live, general-purpose** system rather than a
replay of one mission — here's the architecture that implies, so it's
on record before we build it:

- **Real-time data ingestion.** Replace `data/telemetry.csv` with a
  live ingestion layer reading from real biosensor APIs — e.g. the
  Astroskin wearable system NASA has already flight-tested in HERA
  analog missions (ECG, respiration, blood pressure, sleep, activity),
  or equivalent ISS/Artemis telemetry feeds. `common.js`'s assessment
  functions already take rows of `{get_hours, heart_rate_bpm,
  respiration_rate}` as plain data — swapping a CSV for a streamed API
  response is a data-layer change, not a rewrite of the alert logic.
- **Per-individual baselining.** Judge alerts against each astronaut's
  own personal baseline and medical history, not just general clinical
  ranges — the event-driven model here (nominal-unless-a-real-event-says-
  otherwise) would extend to include a rolling personal-baseline
  comparison once continuous real vitals exist to baseline against.
- **Rhythm-level analysis, not just rate.** Irwin's event is the case
  for this: production monitoring needs real waveform/rhythm analysis
  (arrhythmia detection), not heart-rate thresholds alone.
- **Multi-user, role-based access.** Concurrent accounts for every
  crew member plus one or more Mission Control operator roles, with
  the shared event log (already the architecture here — see "Why one
  console page, not two") moved from in-page memory to a real backend
  (database + authenticated API) so it works across devices, not just
  within one open browser tab.
- **A real device/EVA context feed**, replacing the hardcoded
  `EVA_WINDOWS` list in `common.js` with live telemetry from suit
  systems or activity logs, so "is this person currently exerting
  themselves" is sensed, not scripted.

None of this is implemented in the pre-screening build — it's
documented here so the team has a clear, reviewed starting point for
the next round rather than reinventing the architecture from scratch.

## Important note

This is a **decision-support and monitoring prototype**, not an
autonomous medical diagnostic system. It does not diagnose disease,
prescribe medication, or give medical instructions. Every real Mission
Control decision shown here is presented as historical record, cited to
its source — never as something the interactive demo layer generated.
