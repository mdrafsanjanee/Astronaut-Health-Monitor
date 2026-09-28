/* ==========================================================================
   common.js
   Shared utilities for the Apollo 15 astronaut-health simulator:
     - nav injection + hamburger toggle
     - CSV parsing
     - data loading (from data/data.js, embedded so file:// works)
     - GET (Ground Elapsed Time) helpers and formatting
     - the real, event-driven status model (see "Why event-driven, not
       threshold-driven" below)
     - a small in-memory event log for the interactive demo layer
   Keep this file free of page-specific rendering code — that belongs in
   assets/js/app.js.

   WHY EVENT-DRIVEN, NOT THRESHOLD-DRIVEN:
   The original build of this prototype (for a fictional ISS-style
   mission) classified a crew member's status by running every vital
   sign through NOMINAL/ATTENTION/CRITICAL numeric thresholds every
   render. That doesn't fit real Apollo 15 data:
     - A high heart rate during a real EVA is expected exertion, not a
       problem — flagging it would be a false alarm a real flight
       surgeon would never raise.
     - The one real cardiac event on this mission (Irwin's EKG bigeminy)
       was a RHYTHM abnormality, not a rate spike — nothing in a
       heart-rate-only feed would trigger a rate threshold for it. It
       only shows up because it's a documented historical fact, not
       because a number crossed a line.
   So this build's crew status comes from real, cited events
   (data/events.json) that are "active" for a window of GET, plus a
   simple EVA-aware check that suppresses rate-based false alarms during
   real EVA windows. This is more honest about what a 1971 bioharness
   could and couldn't catch — and it's a deliberate example for the
   README's note on why the production version needs real waveform
   analysis, not just rate thresholds.
   ========================================================================== */

const AHM = (() => {

  /* ------------------------------------------------------------------ *
   * 1. Navigation
   * ------------------------------------------------------------------ */

  function initNav(activePage) {
    const nav = document.querySelector('.site-nav');
    if (!nav) return;
    const toggle = nav.querySelector('.site-nav__toggle');
    const links = nav.querySelector('.site-nav__links');
    if (toggle && links) {
      toggle.addEventListener('click', () => links.classList.toggle('is-open'));
    }
    nav.querySelectorAll('.site-nav__links a').forEach((a) => {
      if (a.dataset.page === activePage) a.setAttribute('aria-current', 'page');
    });
  }

  /* ------------------------------------------------------------------ *
   * 2. CSV parsing
   * ------------------------------------------------------------------ */

  function parseCsv(text) {
    const lines = text.trim().split('\n').filter((l) => l.length > 0);
    const headers = lines[0].split(',');
    const rows = [];
    for (let i = 1; i < lines.length; i++) {
      const cells = lines[i].split(',');
      const row = {};
      headers.forEach((h, idx) => {
        const raw = cells[idx];
        const num = Number(raw);
        row[h] = raw !== '' && !Number.isNaN(num) ? num : raw;
      });
      rows.push(row);
    }
    return rows;
  }

  /* ------------------------------------------------------------------ *
   * 3. Data loading
   * ------------------------------------------------------------------ */

  function loadData() {
    if (!window.AHM_DATA) {
      throw new Error(
        'window.AHM_DATA is missing. Make sure data/data.js is loaded ' +
        'before this script (see console.html for the script order).'
      );
    }
    const telemetry = parseCsv(window.AHM_DATA.telemetryCsv);
    return {
      telemetry,
      crew: window.AHM_DATA.crew,
      mission: window.AHM_DATA.mission,
      events: window.AHM_DATA.events.slice().sort((a, b) => a.get_hours - b.get_hours),
      references: window.AHM_DATA.references,
      modern: window.AHM_DATA.modern,
    };
  }

  function telemetryForCrew(telemetry, crewId) {
    return telemetry.filter((r) => r.crew_id === crewId).sort((a, b) => a.get_hours - b.get_hours);
  }

  // Latest row at or before `hour` (telemetry is hourly, so floor(hour) is exact).
  function rowAtHour(rows, hour) {
    const h = Math.floor(hour);
    let best = rows[0];
    for (const r of rows) {
      if (r.get_hours <= h) best = r;
      else break;
    }
    return best;
  }

  /* ------------------------------------------------------------------ *
   * 4. GET (Ground Elapsed Time) formatting
   * ------------------------------------------------------------------ */

  function formatGet(hours) {
    const totalMinutes = Math.round(hours * 60);
    const h = Math.floor(totalMinutes / 60);
    const m = totalMinutes % 60;
    return `${h}:${String(m).padStart(2, '0')}`;
  }

  function formatGetLong(hours) {
    const days = Math.floor(hours / 24);
    const remHours = Math.floor(hours % 24);
    const minutes = Math.round((hours - Math.floor(hours)) * 60);
    return `Day ${days}, ${String(remHours).padStart(2, '0')}:${String(minutes).padStart(2, '0')} GET`;
  }

  /* ------------------------------------------------------------------ *
   * 5. Real EVA windows (GET hours) — hardcoded from the Apollo 15
   *    Mission Report timeline (Table 4-I) since there are only five,
   *    all precisely known. Used to suppress false "high heart rate"
   *    alarms during real, expected physical exertion.
   * ------------------------------------------------------------------ */

  const EVA_WINDOWS = [
    { start: 106.713, end: 107.266, crew: ['CDR'], label: 'Stand-up EVA' },
    { start: 119.655, end: 126.200, crew: ['CDR', 'LMP'], label: 'EVA-1' },
    { start: 142.247, end: 149.450, crew: ['CDR', 'LMP'], label: 'EVA-2' },
    { start: 163.304, end: 168.134, crew: ['CDR', 'LMP'], label: 'EVA-3' },
    { start: 240.85, end: 241.15, crew: ['CMP'], label: "Worden's deep-space EVA" },
  ];

  function activeEva(crewId, hour) {
    return EVA_WINDOWS.find((w) => w.crew.includes(crewId) && hour >= w.start && hour <= w.end) || null;
  }

  /* ------------------------------------------------------------------ *
   * 6. Vital-sign classification
   *    General, era-independent clinical reference ranges. An EVA in
   *    progress always reads NOMINAL (elevated rate = expected exertion,
   *    per eva_context_rule in data/nasa-references.json).
   * ------------------------------------------------------------------ */

  const LEVEL = { NOMINAL: 'NOMINAL', ATTENTION: 'ATTENTION', CRITICAL: 'CRITICAL' };
  const LEVEL_RANK = { NOMINAL: 0, ATTENTION: 1, CRITICAL: 2 };
  function worseOf(a, b) { return LEVEL_RANK[a] >= LEVEL_RANK[b] ? a : b; }

  function classifyRate(value, [lo, hi], eva) {
    if (eva) return LEVEL.NOMINAL;
    if (value >= lo && value <= hi) return LEVEL.NOMINAL;
    const span = hi - lo;
    const over = value > hi ? value - hi : lo - value;
    return over > span * 0.3 ? LEVEL.CRITICAL : LEVEL.ATTENTION;
  }

  /* ------------------------------------------------------------------ *
   * 7. Event helpers
   * ------------------------------------------------------------------ */

  function eventsUpTo(events, hour) {
    return events.filter((e) => e.get_hours <= hour);
  }

  function nextEvent(events, hour) {
    return events.find((e) => e.get_hours > hour + 0.001) || null;
  }

  function prevEvent(events, hour) {
    const past = events.filter((e) => e.get_hours < hour - 0.001);
    return past.length ? past[past.length - 1] : null;
  }

  // Events with a severity that should currently read as an active alert
  // for a given crew member (or station-wide when crew_id is null).
  function activeAlertsFor(events, crewId, hour) {
    return events.filter((e) => {
      if (!e.severity) return false;
      if (e.crew_id && e.crew_id !== crewId) return false;
      const until = e.active_until_hours !== undefined ? e.active_until_hours : e.get_hours + 3;
      return hour >= e.get_hours && hour <= until;
    });
  }

  function assessCrewMember(references, rows, events, crewId, hour) {
    const row = rowAtHour(rows, hour);
    const eva = activeEva(crewId, hour);
    const vref = references.vitals_general_reference;
    const hrLevel = classifyRate(row.heart_rate_bpm, vref.heart_rate_bpm.nominal, eva);
    const rrLevel = classifyRate(row.respiration_rate, vref.respiration_rate.nominal, eva);

    const alerts = activeAlertsFor(events, crewId, hour).map((e) => ({
      level: e.severity, title: e.title, detail: e.detail, source: e.source, get_hours: e.get_hours,
    }));

    let overall = LEVEL.NOMINAL;
    alerts.forEach((a) => { overall = worseOf(overall, a.level); });
    // A rate/rhythm alert also colors the vitals reading it pertains to,
    // but never downgrades an EVA-suppressed reading back to non-nominal —
    // the alert list above is what actually carries the signal.

    return { row, eva, hrLevel, rrLevel, alerts, overall };
  }

  function assessStation(events, hour) {
    const alerts = activeAlertsFor(events, null, hour).map((e) => ({
      level: e.severity, title: e.title, detail: e.detail, source: e.source, get_hours: e.get_hours,
    }));
    let overall = LEVEL.NOMINAL;
    alerts.forEach((a) => { overall = worseOf(overall, a.level); });
    return { alerts, overall };
  }

  function formatTime(ts) {
    const d = new Date(ts);
    return d.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  }

  /* ------------------------------------------------------------------ *
   * 8. Modern Monitoring (SIMULATED)
   *    Apollo 15's bioharness measured only ECG + respiration. Today's
   *    CSA Bio-Monitor (flown on the ISS) also tracks SpO2, skin
   *    temperature, a continuous systolic-BP estimate, activity and sleep
   *    quality (see data/modern-monitoring.json). This function answers
   *    "what would a modern monitor have shown?" using simple,
   *    deterministic rules tied to the REAL mission timeline. Every
   *    value it returns is SIMULATED and must be labeled so in the UI.
   *
   *    Design notes (kept honest):
   *    - SpO2: Apollo's cabin was 100% oxygen, so a modern oximeter
   *      would read at the very top of the scale nearly all mission.
   *      The real problem (Irwin's rhythm) would NOT show up in SpO2.
   *    - Radiation: the ENDPOINTS are real (360 mrad Scott, 510 mrad
   *      Irwin; Worden's own dosimeter was handed to Scott, so his
   *      value uses the 300 mrad crew passive-dosimeter average). The
   *      accumulation CURVE between launch and splashdown is estimated;
   *      Apollo dosimeters were read only after landing.
   * ------------------------------------------------------------------ */

  const RADIATION_ENDPOINT_MRAD = { CDR: 360, LMP: 510, CMP: 300 };
  const SPLASHDOWN_HOURS = 295.198;

  function sleepQualityAt(events, hour) {
    const recent = events
      .filter((e) => e.sleep_quality_pct !== undefined && e.get_hours <= hour && hour - e.get_hours <= 24)
      .pop();
    return recent ? { value: recent.sleep_quality_pct, source: recent.title } : { value: 85, source: 'typical coast-phase rest' };
  }

  function simulateModernVitals(crewId, hour, events) {
    const eva = activeEva(crewId, hour);
    const cardiac = events.some((e) => e.category === 'medical' && e.severity && e.crew_id === crewId
      && hour >= e.get_hours && hour <= (e.active_until_hours !== undefined ? e.active_until_hours : e.get_hours + 3));

    const spo2 = eva ? 97.6 : 99.3;
    const skinTemp = 36.6 + (eva ? 0.4 : 0);
    let systolicBp = eva ? 138 : 116;
    if (cardiac) systolicBp += 14;
    const activity = eva ? 'High (EVA)' : (sleepQualityAt(events, hour).source === 'typical coast-phase rest' ? 'Low–moderate' : 'Low');
    const sleep = sleepQualityAt(events, hour);
    const doseMrad = Math.min(1, hour / SPLASHDOWN_HOURS) * RADIATION_ENDPOINT_MRAD[crewId];

    return {
      spo2, skinTemp, systolicBp, activity,
      sleepQuality: sleep.value, sleepSource: sleep.source,
      doseMrad, doseEndpointMrad: RADIATION_ENDPOINT_MRAD[crewId],
    };
  }

  // Which CO2 operational band (data/modern-monitoring.json) a value falls in.
  function co2Band(bands, mmhg) {
    return bands.find((b) => mmhg >= b.range[0] && mmhg < b.range[1]) || bands[bands.length - 1];
  }

  /* ------------------------------------------------------------------ *
   * 9. Interactive-demo event log
   *    This is deliberately SEPARATE from the real historical timeline
   *    in data/events.json. It's an in-memory log (shared directly by
   *    reference between the astronaut and Mission Control views — see
   *    the design note in assets/js/app.js) for the LIVE, interactive
   *    "send a recommendation / acknowledge it" feature, so the demo can
   *    show the software mechanism working without ever mislabeling a
   *    made-up message as something that really happened in 1971.
   * ------------------------------------------------------------------ */

  const STORAGE_KEY = 'ahm_demo_log_v2';
  let demoLog = [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    demoLog = raw ? JSON.parse(raw) : [];
  } catch (e) { demoLog = []; }

  const subscribers = [];
  function persist() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(demoLog)); } catch (e) { /* unavailable */ }
  }
  function notify() {
    subscribers.forEach((cb) => { try { cb(); } catch (e) { /* isolate subscriber errors */ } });
  }

  function readDemoLog() { return demoLog; }

  function logDemoEvent(entry) {
    demoLog.push({
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      time: Date.now(),
      acknowledged: false,
      ...entry,
    });
    persist();
    notify();
    return demoLog;
  }

  function acknowledgeDemoEvent(id) {
    const idx = demoLog.findIndex((e) => e.id === id);
    if (idx >= 0) {
      demoLog[idx].acknowledged = true;
      demoLog[idx].acknowledgedAt = Date.now();
      persist();
      notify();
    }
    return demoLog;
  }

  function onDemoLogChanged(cb) { subscribers.push(cb); }

  return {
    LEVEL, worseOf,
    initNav, parseCsv, loadData, telemetryForCrew, rowAtHour,
    formatGet, formatGetLong, formatTime,
    EVA_WINDOWS, activeEva,
    eventsUpTo, nextEvent, prevEvent, activeAlertsFor,
    assessCrewMember, assessStation,
    simulateModernVitals, co2Band,
    readDemoLog, logDemoEvent, acknowledgeDemoEvent, onDemoLogChanged,
  };
})();
