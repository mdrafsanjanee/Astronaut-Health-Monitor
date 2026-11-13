# Astronomican - Apollo 15 astronaut health monitor

A working prototype for the **NASA Space Apps Challenge 2026**:
*"Create Health Monitoring Software for Astronauts on Space Missions."*

It replays **Apollo 15's real 1971 biomedical record** so every figure can be traced to a document.
Where the app fills a gap (interpolated, estimated, modeled, simulated or demo values) it says so on screen.

    MONITOR -> DETECT -> EXPLAIN -> ACT -> RECORD

## Run it

Open `index.html` in a browser. No build step, no install, no server, no login.
Plain HTML, CSS and vanilla JavaScript.

## What is in the app (a home page plus six pages, one top bar)

| Page | What it is |
|------|-----------|
| **Home** | Landing page: an animated glimpse of Apollo 15's flight path (Earth, Moon, five real milestones), three ways in, the method and the data badges. |
| **Demo Astronaut** | Pick a crew member. Live vitals (heart rate, blood pressure, breathing, temperature) from a placeholder datasheet, step-by-step alerts, crewmate notices, a body map and a daily check-in. No Apollo data. |
| **Demo Mission Control** | All three crew with live numbers, live alerts and what each astronaut was told, live heart-rate charts, an alert log. No Apollo data. |
| **Apollo 15 Simulation** | Press Simulate to replay the real mission: status score, body map, alerts with a send-and-acknowledge exchange, heart-rate chart, all-crew board, cited mission log. No live feed. |
| **Project** | The detailed project description: challenge, approach, why Apollo 15, hazard-by-hazard table, data honesty, limits, next steps. |
| **Resources** | The NASA challenge resources (published **15 November 2026**). Empty slots are ready; see "Adding the resources" below. |
| **References** | The "data used" table, the list of what the app generates itself, the APA 7 reference list and items still to verify. |

The two demo pages share the live placeholder feed. The Apollo 15 Simulation has its own replay clock: **Simulate** (8 mission hours per second), a slider, and **Jump to event** (all 27 real events).

**Demo paths:** (1) Demo Astronaut -> "Demo: jump to next alert" -> follow the steps -> switch to Scott to see the crew notice. (2) Apollo 15 Simulation -> Jump to event -> "Cardiac arrhythmia detected" -> Send to Irwin -> Acknowledge as Irwin.

## Using the app

The Astronaut and Apollo 15 pages put the body map on the left and one topic at a time on the right, chosen with tabs
(Live vitals / Body detail / Check-in, and Overview / Body detail / Crew & log / Data & limits). Tapping a body system, on the figure
or in the list under it, opens its Body detail tab. The Apollo 15 replay bar stays on screen while you scroll. On phones the main pages
sit in a bottom tab bar and the full menu opens from the top-right button.

## Adding the resources (after 15 November 2026)

Nothing needs rebuilding for the Resources and References pages.

1. `data/resources.js`: copy the example entry into `items` (title, type, URL, what it is used for, status).
   The four empty slots disappear once there is at least one item.
2. `data/references.js`: add the APA entry under `references` and a short in-text form under `cite`.
   Optionally add a row to `dataUsed` saying what data it supplies and where it shows up.
3. If a resource supplies data or ranges, put them in `data/` (`telemetry.csv`, `events.json`,
   `nasa-references.json`) and run `node tools/build-data.js` to regenerate `data/data.js`.
4. To cite it on an event, add its key to that event's `refs` list in `data/events.json` and rebuild.

## Live vitals and the alert system (version 1)

The top of the Astronaut page shows **live vitals** (heart rate, blood pressure, breathing, temperature).
They come from a **placeholder datasheet**, `data/sensor-feed.js`, played one row every 3 seconds and looped.
Each crew member reads the sheet from a different start row. Nothing here is real sensor data, and it is labelled
that way on screen. The Apollo 15 replay (status score, charts, timeline) is separate and sits below the vitals.

How an alert works (`assets/js/live.js`):

1. **Rules** classify every reading as normal, watch or alert. Blood pressure follows the American Heart
   Association categories, resting heart rate its 60-100 bpm range, temperature MedlinePlus; heart rate and blood
   pressure are not alarmed while the sheet says `exercise`. Bands beyond those ranges and the breathing band are this
   app's own rules and are labelled.
2. **Debounce:** a finding must repeat for 2 readings to open an alert and 3 normal readings to close it.
3. **Steps:** an open alert shows numbered steps for the astronaut ("sit down, breathe in for 4 s and out for 6 s,
   re-measure after 5 minutes ...") plus when to contact the flight surgeon. Wording is general guidance for a
   prototype and still needs a clinician's review.
4. **Crewmates:** when an alert opens, the other two astronauts get a notice (switch crew to see it) and can press
   "Got it"; the alerted astronaut sees who has seen it. A "back in range" notice follows when it closes.
5. **Mission Control** lists every live alert with what the astronaut was told, and the body map colours the matching organ.

"Demo: jump to next alert" fast-forwards the sheet so you can show an alert without waiting about two minutes.

**Plugging in real sensors later:** keep the datasheet as a fallback and call, whenever a reading arrives,

    LIVE.push('LMP', { hr: 72, sys: 118, dia: 76, resp: 14, temp: 36.7, activity: 'rest' })

Rules, alerts, notices, tiles, body map and Mission Control all update from that one call.

## NASA space weather, radiation and signal delay (new)

A **Space weather** card appears on the Astronaut page (Live vitals tab) and on Demo Mission Control. It has two parts:

1. **Live space weather from NASA DONKI** (flares, solar energetic particle events, geomagnetic storms, coronal mass ejections from
   the last 7 days). The level (quiet / watch / alert) and the shelter steps are this app's own rules, written in
   `assets/js/space-weather.js`. An alert also colours the whole-body (radiation) region of the body map.
2. **Mission environment**: pick space station, Moon, deep-space transit or Mars surface to see its radiation baseline and one-way
   signal delay, plus NASA's career and solar-particle-event limits. Numbers live in `data/radiation-reference.json`
   (then run `node tools/build-data.js`). ISS and lunar dose rates are left unset until you choose a NASA source.

**Where to put your NASA API key:** open `assets/js/config.js` and paste it between the quotes on the line marked `KEY`
(`NASA_API_KEY: ''`). Nothing else needs to change.

- Key left empty: the app still works. It asks NASA with the shared `DEMO_KEY` (very few requests allowed).
- NASA unreachable or key rejected: the card shows **SAMPLE** events (invented, `data/space-weather-sample.js`), clearly labelled.
- Results are cached in the browser for 30 minutes (`DONKI_REFRESH_MIN` in `config.js`) to stay inside NASA's rate limits.
- The key is visible to anyone who opens the page. Use a free NASA key only, and think before committing it to a public repository.

The Apollo 15 replay does not use this card: DONKI only covers recent years, so 1971 has no space-weather record in it.
The Open Science Data Repository (Inspiration4 human data) is cited on the References page as a future biomarker source; it is not loaded.

## Body map

The body figure is drawn as inline SVG in `assets/js/shell.js` (`avatarCard`), with a plain-language entry per region in
`ORGAN_INFO` and the flagging rules in `organStates`. Regions are coloured only from the real Apollo 15 events,
the heart-rate and breathing bands, and the demo check-in. Stomach/gut and kidneys show "no data flagged" because
Apollo 15 recorded nothing for them. The text lists possibilities, never a diagnosis.

## Citations

Every event in `data/events.json` has `refs` (keys into `data/references.js`), `where` (section or table)
and `evidence`: `primary` (NASA document), `secondary` (non-NASA account) or `estimated` (time not in the sources).
The UI shows an APA in-text citation such as *(NASA, 1971, Section 10.2.3)* that links to the References page.

## Real, interpolated, estimated, modeled, simulated, demo

- **Reported** - stated in a NASA document and cited (events, heart-rate averages and ranges, radiation totals).
- **Interpolated** - the line between reported heart-rate points (`telemetry.csv`).
- **Estimated** - values with no report at all, such as Worden's heart rate.
- **Modeled** - the radiation-dose curve (it ends at the real totals).
- **Simulated** - the modern monitoring layer (blood pressure, SpO2, skin temperature, sleep quality), always labelled.
- **Demo** - the check-in and the recommend/acknowledge exchange; never mixed into the historical record.

## Files

    index.html            one page, loads everything below
    assets/js/shell.js    the whole UI (top bar + five pages)
    assets/js/engine.js   scores, snapshots, rule-based suggested actions
    assets/js/common.js   data loading, GET helpers, the event-driven status model, demo log
    assets/js/icons.js    inline icons
    assets/css/design.css the whole look: tokens at the top (colours, fonts, radius), then components
    data/events.json      27 cited events          data/telemetry.csv   per-hour heart rate / breathing
    data/sensor-feed.js   PLACEHOLDER live-vitals datasheet (3 s loop)
    assets/js/config.js   settings + YOUR NASA API KEY (paste it here)
    assets/js/space-weather.js  NASA DONKI loader, sample fallback, radiation watch/alert rules
    assets/css/spaceweather.css the space-weather card
    data/radiation-reference.json  radiation limits/baselines and signal delay by environment
    data/space-weather-sample.js   invented offline sample events (labelled SAMPLE)
    assets/js/live.js     feed player, alert rules, notices, LIVE.push() hook
    data/references.js    APA references (hand-edited, no build)
    data/resources.js     challenge resources (hand-edited, no build)
    data/*.json           crew, mission, reference ranges, modern-monitoring layer
    data/data.js          generated by `node tools/build-data.js` - do not edit by hand

## Corrections made in this version

- The Apollo 15 Mission Report is **MSC-05161** (NASA TM X-68394). MSC-07230, used before, is the Apollo 16 report.
- The "about 4% radius bone loss" figure could not be verified and conflicts with the report, which says the radius
  was essentially unchanged. It and the modeled bone-density curve were removed.
- The "5 PVCs in 30 seconds" count and the potassium explanation (cited to an arXiv paper that could not be
  verified) were removed from the event text.
- Wikipedia and forum sources are now badged **Secondary source** wherever they are used.

## Limits

An educational prototype, not a medical device and not medical advice. It replays one 12-day mission with
1971 sensors (ECG and breathing only), so it cannot show duration-dependent risks such as long-term bone loss,
eye and brain pressure changes (SANS) or immune changes. The in-flight rhythm event is not described in the
Mission Report's medical section; its source chapter (NASA SP-368) still has to be confirmed.
