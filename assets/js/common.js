/* ==========================================================================
   common.js
   Shared utilities used by both astronaut.js and mission-control.js:
     - nav injection + hamburger toggle
     - CSV parsing
     - data loading (from data/data.js, embedded so file:// works)
     - trend detection helpers (moving average, slope, baseline comparison)
     - the alert engine (turns numbers into NOMINAL / ATTENTION / CRITICAL)
     - a tiny cross-tab event log + messaging layer (localStorage-based)
   Keep this file free of page-specific rendering code — that belongs in
   astronaut.js / mission-control.js.
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
      toggle.addEventListener('click', () => {
        links.classList.toggle('is-open');
      });
    }
    nav.querySelectorAll('.site-nav__links a').forEach((a) => {
      if (a.dataset.page === activePage) {
        a.setAttribute('aria-current', 'page');
      }
    });
  }

  /* ------------------------------------------------------------------ *
   * 2. CSV parsing (simple, dependency-free — no quoted-comma handling
   *    is needed since every field in telemetry.csv is a plain number
   *    or identifier).
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
        'before this script (see index.html for the script order).'
      );
    }
    const telemetry = parseCsv(window.AHM_DATA.telemetryCsv);
    return {
      telemetry,
      crew: window.AHM_DATA.crew,
      mission: window.AHM_DATA.mission,
      references: window.AHM_DATA.references,
    };
  }

  function telemetryForCrew(telemetry, crewId) {
    return telemetry
      .filter((r) => r.crew_id === crewId)
      .sort((a, b) => a.mission_day - b.mission_day);
  }

  function environmentSeries(telemetry) {
    // Environment readings are duplicated per crew member per day in the
    // CSV (see README) — de-duplicate down to one row per mission day.
    const byDay = new Map();
    telemetry.forEach((r) => {
      if (!byDay.has(r.mission_day)) byDay.set(r.mission_day, r);
    });
    return Array.from(byDay.values()).sort((a, b) => a.mission_day - b.mission_day);
  }

  /* ------------------------------------------------------------------ *
   * 4. Trend detection helpers
   *    Deliberately simple, non-ML methods per the project brief:
   *    moving average, % change from baseline, linear slope, and
   *    consecutive-abnormal-day counting.
   * ------------------------------------------------------------------ */

  function movingAverage(values, window) {
    const out = [];
    for (let i = 0; i < values.length; i++) {
      const start = Math.max(0, i - window + 1);
      const slice = values.slice(start, i + 1);
      out.push(slice.reduce((a, b) => a + b, 0) / slice.length);
    }
    return out;
  }

  function trailingAverage(values, window) {
    const slice = values.slice(-window);
    if (slice.length === 0) return null;
    return slice.reduce((a, b) => a + b, 0) / slice.length;
  }

  function baseline(rows, field, baselineDays) {
    const [start, end] = baselineDays;
    const slice = rows.filter((r) => r.mission_day >= start && r.mission_day <= end);
    if (slice.length === 0) return null;
    return slice.reduce((sum, r) => sum + r[field], 0) / slice.length;
  }

  function pctChangeFromBaseline(current, base) {
    if (base === null || base === 0) return null;
    return ((current - base) / base) * 100;
  }

  // Simple linear regression slope (least squares) over the last `window`
  // points. Returns { slope, intercept } in units of [value]/[day].
  function linearTrend(rows, field, window) {
    const slice = rows.slice(-window);
    const n = slice.length;
    if (n < 3) return null;
    const xs = slice.map((r) => r.mission_day);
    const ys = slice.map((r) => r[field]);
    const xMean = xs.reduce((a, b) => a + b, 0) / n;
    const yMean = ys.reduce((a, b) => a + b, 0) / n;
    let num = 0, den = 0;
    for (let i = 0; i < n; i++) {
      num += (xs[i] - xMean) * (ys[i] - yMean);
      den += (xs[i] - xMean) ** 2;
    }
    const slope = den === 0 ? 0 : num / den;
    const intercept = yMean - slope * xMean;
    return { slope, intercept, lastX: xs[n - 1], lastY: ys[n - 1] };
  }

  // Projects how many days until `field` crosses `threshold`, given its
  // recent linear trend. Returns null if not trending toward the threshold.
  function projectDaysToThreshold(trend, threshold) {
    if (!trend || trend.slope === 0) return null;
    const daysToCross = (threshold - trend.lastY) / trend.slope;
    if (daysToCross <= 0 || !Number.isFinite(daysToCross)) return null;
    return daysToCross;
  }

  function consecutiveDaysWhere(rows, field, predicate) {
    let count = 0;
    for (let i = rows.length - 1; i >= 0; i--) {
      if (predicate(rows[i][field])) count++;
      else break;
    }
    return count;
  }

  /* ------------------------------------------------------------------ *
   * 5. Alert engine
   *    Classifies a single reading (or trend) into NOMINAL / ATTENTION /
   *    CRITICAL using the configurable thresholds in
   *    data/nasa-references.json (loaded as `refs`).
   * ------------------------------------------------------------------ */

  const LEVEL = { NOMINAL: 'NOMINAL', ATTENTION: 'ATTENTION', CRITICAL: 'CRITICAL' };
  const LEVEL_RANK = { NOMINAL: 0, ATTENTION: 1, CRITICAL: 2 };

  function worseOf(a, b) {
    return LEVEL_RANK[a] >= LEVEL_RANK[b] ? a : b;
  }

  function inRange(v, range) {
    return v >= range[0] && v <= range[1];
  }

  function inAnyRange(v, ranges) {
    return ranges.some((r) => inRange(v, r));
  }

  function classifyVital(value, cfg) {
    if (cfg.critical_above !== undefined && value > cfg.critical_above) return LEVEL.CRITICAL;
    if (cfg.critical_below !== undefined && value < cfg.critical_below) return LEVEL.CRITICAL;
    if (inRange(value, cfg.nominal)) return LEVEL.NOMINAL;
    if (inRange(value, cfg.attention)) return LEVEL.ATTENTION;
    return LEVEL.ATTENTION;
  }

  function classifyBand(value, cfg) {
    // Generic classifier for environment params shaped like
    // { nominal: [a,b], attention: [[..],[..]], critical_below, critical_above }
    if (cfg.critical_above !== undefined && value > cfg.critical_above) return LEVEL.CRITICAL;
    if (cfg.critical_below !== undefined && value < cfg.critical_below) return LEVEL.CRITICAL;
    if (cfg.nominal_below !== undefined) {
      return value < cfg.nominal_below ? LEVEL.NOMINAL : LEVEL.ATTENTION;
    }
    if (cfg.nominal_min !== undefined) {
      return value >= cfg.nominal_min ? LEVEL.NOMINAL : LEVEL.ATTENTION;
    }
    if (inRange(value, cfg.nominal)) return LEVEL.NOMINAL;
    const attn = Array.isArray(cfg.attention[0]) ? cfg.attention : [cfg.attention];
    if (inAnyRange(value, attn)) return LEVEL.ATTENTION;
    return LEVEL.ATTENTION;
  }

  function classifyCo2(value, cfg) {
    if (value > cfg.critical_above) return LEVEL.CRITICAL;
    if (value < cfg.nominal_below) return LEVEL.NOMINAL;
    return LEVEL.ATTENTION;
  }

  /**
   * Builds a full assessment for one crew member on their latest day:
   * per-parameter status, active alerts (with explanations), and an
   * overall status (the worst of everything, plus multi-parameter and
   * environmental alerts folded in).
   */
  function assessCrewMember(rows, refs, baselineDays) {
    const latest = rows[rows.length - 1];
    const alerts = [];
    const metrics = {};

    const vitalsCfg = refs.vitals;
    ['heart_rate_bpm', 'respiration_rate', 'skin_temp_c'].forEach((field) => {
      const cfg = vitalsCfg[field];
      const level = classifyVital(latest[field], cfg);
      metrics[field] = { value: latest[field], level };
      if (level !== LEVEL.NOMINAL) {
        alerts.push({
          level,
          field,
          title: `${labelFor(field)} is ${level === LEVEL.CRITICAL ? 'outside the safe operating range' : 'trending outside its nominal range'} (${latest[field]} ${unitFor(field)})`,
        });
      }
    });

    // SpO2 (uses a min-threshold shape)
    {
      const cfg = vitalsCfg.spo2_pct;
      const level = latest.spo2_pct < cfg.critical_below ? LEVEL.CRITICAL
        : latest.spo2_pct < cfg.attention_min ? LEVEL.ATTENTION
        : latest.spo2_pct < cfg.nominal_min ? LEVEL.ATTENTION
        : LEVEL.NOMINAL;
      metrics.spo2_pct = { value: latest.spo2_pct, level };
      if (level !== LEVEL.NOMINAL) {
        alerts.push({ level, field: 'spo2_pct', title: `SpO2 is low (${latest.spo2_pct}%)` });
      }
    }

    // Sleep: trailing 3-day average vs. scheduled
    const sleepSeries = rows.map((r) => r.sleep_actual_hr);
    const sleepTrailing = trailingAverage(sleepSeries, 3);
    const sleepCfg = refs.sleep;
    let sleepLevel = LEVEL.NOMINAL;
    if (sleepTrailing !== null) {
      if (sleepTrailing < sleepCfg.critical_trailing3_below) sleepLevel = LEVEL.CRITICAL;
      else if (sleepTrailing < sleepCfg.attention_trailing3_below) sleepLevel = LEVEL.ATTENTION;
    }
    metrics.sleep = { value: sleepTrailing, level: sleepLevel, latest: latest.sleep_actual_hr };
    if (sleepLevel !== LEVEL.NOMINAL) {
      alerts.push({
        level: sleepLevel,
        field: 'sleep',
        title: `Sleep duration has averaged ${sleepTrailing.toFixed(1)} h over the last 3 days (scheduled: ${sleepCfg.scheduled_hr} h)`,
      });
    }

    // Exercise compliance vs. prescribed minutes
    const prescribed = refs.exercise.prescribed_minutes_per_day;
    const exerciseSeries = rows.map((r) => (r.exercise_aerobic_min + r.exercise_resistance_min) / prescribed * 100);
    const complianceTrailing = trailingAverage(exerciseSeries, 3);
    const belowCritical = (v) => v < refs.exercise.critical_compliance_pct;
    const sustainedDays = consecutiveDaysWhere(
      rows.map((r, i) => ({ mission_day: r.mission_day, _c: exerciseSeries[i] })),
      '_c',
      belowCritical
    );
    let exerciseLevel = LEVEL.NOMINAL;
    if (complianceTrailing < refs.exercise.critical_compliance_pct && sustainedDays >= refs.exercise.critical_sustained_days) {
      exerciseLevel = LEVEL.CRITICAL;
    } else if (complianceTrailing < refs.exercise.attention_compliance_pct) {
      exerciseLevel = LEVEL.ATTENTION;
    }
    metrics.exercise = { value: complianceTrailing, level: exerciseLevel, sustainedDays };
    if (exerciseLevel !== LEVEL.NOMINAL) {
      alerts.push({
        level: exerciseLevel,
        field: 'exercise',
        title: `Exercise compliance has averaged ${complianceTrailing.toFixed(0)}% of the prescribed regimen over the last 3 days`,
      });
    }

    // Wellbeing: fatigue is scored 1-5 where HIGHER = more fatigued
    // (unlike mood/motivation/social, where higher is better).
    const fatigueLevel = latest.fatigue_1_5 >= 4 ? LEVEL.CRITICAL
      : latest.fatigue_1_5 >= 3 ? LEVEL.ATTENTION
      : LEVEL.NOMINAL;
    metrics.fatigue = { value: latest.fatigue_1_5, level: fatigueLevel };
    if (fatigueLevel !== LEVEL.NOMINAL) {
      alerts.push({ level: fatigueLevel, field: 'fatigue', title: `Self-reported fatigue is elevated (${latest.fatigue_1_5}/5)` });
    }

    // Musculoskeletal: modeled cumulative bone-loss estimate
    const msk = modelBoneTrajectory(rows, refs);
    metrics.musculoskeletal = msk;
    if (msk.level !== LEVEL.NOMINAL) {
      alerts.push({
        level: msk.level,
        field: 'musculoskeletal',
        title: `Modeled bone-density trajectory shows an estimated ${msk.cumulativeLossPct.toFixed(1)}% cumulative loss (resistance-exercise compliance: ${msk.avgResistanceCompliancePct.toFixed(0)}%)`,
      });
    }

    // Multi-parameter "recovery" composite: sleep + exercise + fatigue + HR trend
    const hrTrend = linearTrend(rows, 'heart_rate_bpm', 7);
    const hrRising = hrTrend && hrTrend.slope > 0.3;
    const decliningCount = [
      sleepLevel !== LEVEL.NOMINAL,
      exerciseLevel !== LEVEL.NOMINAL,
      fatigueLevel !== LEVEL.NOMINAL,
      hrRising,
    ].filter(Boolean).length;

    if (decliningCount >= 3) {
      const level = decliningCount === 4 ? LEVEL.CRITICAL : LEVEL.ATTENTION;
      alerts.unshift({
        level,
        field: 'composite',
        title: 'Recovery indicators are deteriorating (sleep, exercise, fatigue, and resting heart rate trending together)',
        composite: true,
      });
    }

    let overall = LEVEL.NOMINAL;
    alerts.forEach((a) => { overall = worseOf(overall, a.level); });

    return { latest, metrics, alerts, overall };
  }

  function modelBoneTrajectory(rows, refs) {
    const cfg = refs.musculoskeletal;
    const missionDay = rows[rows.length - 1].mission_day;
    const months = missionDay / 30;
    const complianceSeries = rows.map((r) => {
      const cap = 90; // minutes of resistance exercise NASA prescribes/day (ARED-style)
      return Math.min(100, (r.exercise_resistance_min / cap) * 100);
    });
    const avgCompliance = complianceSeries.reduce((a, b) => a + b, 0) / complianceSeries.length;
    // Full compliance mitigates most (not all) of the loss; 0% compliance
    // experiences the full typical monthly rate.
    const mitigation = Math.min(0.85, avgCompliance / 100 * 0.85);
    const effectiveMonthlyRate = cfg.bone_loss_pct_per_month_typical * (1 - mitigation);
    const cumulativeLossPct = effectiveMonthlyRate * months;

    let level = LEVEL.NOMINAL;
    if (cumulativeLossPct >= cfg.critical_cumulative_loss_pct) level = LEVEL.CRITICAL;
    else if (cumulativeLossPct >= cfg.attention_cumulative_loss_pct) level = LEVEL.ATTENTION;

    return {
      cumulativeLossPct,
      avgResistanceCompliancePct: avgCompliance,
      effectiveMonthlyRate,
      level,
    };
  }

  function assessEnvironment(envRows, refs, crewCount = 3) {
    const latest = envRows[envRows.length - 1];
    const cfg = refs.environment;
    const metrics = {};
    const alerts = [];

    metrics.co2_mmhg = { value: latest.co2_mmhg, level: classifyCo2(latest.co2_mmhg, cfg.co2_mmhg) };
    metrics.o2_pp_mmhg = { value: latest.o2_pp_mmhg, level: classifyBand(latest.o2_pp_mmhg, cfg.o2_pp_mmhg) };
    metrics.cabin_pressure_psia = { value: latest.cabin_pressure_psia, level: classifyBand(latest.cabin_pressure_psia, cfg.cabin_pressure_psia) };
    metrics.cabin_temp_c = { value: latest.cabin_temp_c, level: classifyBand(latest.cabin_temp_c, cfg.cabin_temp_c) };
    metrics.humidity_pct = { value: latest.humidity_pct, level: classifyBand(latest.humidity_pct, cfg.humidity_pct) };

    const co2Trend = linearTrend(envRows, 'co2_mmhg', 7);
    const co2ProjDays = co2Trend ? projectDaysToThreshold(co2Trend, cfg.co2_mmhg.critical_above) : null;
    metrics.co2_projection = co2ProjDays;

    Object.entries(metrics).forEach(([field, m]) => {
      if (field === 'co2_projection' || !m || m.level === LEVEL.NOMINAL) return;
      alerts.push({
        level: m.level,
        field,
        title: `${labelFor(field)} is ${m.level === LEVEL.CRITICAL ? 'outside the certified range' : 'trending toward its limit'} (${m.value} ${unitFor(field)})`,
      });
    });

    if (co2ProjDays !== null && co2ProjDays < 240 && metrics.co2_mmhg.level !== LEVEL.CRITICAL) {
      alerts.push({
        level: LEVEL.ATTENTION,
        field: 'co2_projection',
        title: `CO2 is rising and, at the current rate, is projected to reach the ${cfg.co2_mmhg.critical_above} mmHg limit in about ${(co2ProjDays * 24).toFixed(0)} hours (model, not a guarantee)`,
      });
    }

    const foodDays = latest.food_reserve_days;
    const waterDaysPerPerson = latest.water_reserve_l / (refs.resources.water_l_per_person_per_day * crewCount);
    const resCfg = refs.resources;
    const foodLevel = foodDays < resCfg.critical_days_remaining ? LEVEL.CRITICAL : foodDays < resCfg.attention_days_remaining ? LEVEL.ATTENTION : LEVEL.NOMINAL;
    const waterLevel = waterDaysPerPerson < resCfg.critical_days_remaining ? LEVEL.CRITICAL : waterDaysPerPerson < resCfg.attention_days_remaining ? LEVEL.ATTENTION : LEVEL.NOMINAL;
    metrics.food_reserve_days = { value: foodDays, level: foodLevel };
    metrics.water_reserve_days = { value: waterDaysPerPerson, level: waterLevel };
    if (foodLevel !== LEVEL.NOMINAL) alerts.push({ level: foodLevel, field: 'food_reserve_days', title: `Food reserve is down to ${foodDays.toFixed(0)} days at current consumption` });
    if (waterLevel !== LEVEL.NOMINAL) alerts.push({ level: waterLevel, field: 'water_reserve_days', title: `Water reserve is down to an estimated ${waterDaysPerPerson.toFixed(0)} days at current consumption` });

    let overall = LEVEL.NOMINAL;
    alerts.forEach((a) => { overall = worseOf(overall, a.level); });

    return { latest, metrics, alerts, overall };
  }

  /* ------------------------------------------------------------------ *
   * 6. Formatting helpers
   * ------------------------------------------------------------------ */

  const LABELS = {
    heart_rate_bpm: 'Heart rate',
    respiration_rate: 'Respiration rate',
    spo2_pct: 'SpO2',
    skin_temp_c: 'Skin temperature',
    co2_mmhg: 'Cabin CO2',
    o2_pp_mmhg: 'O2 partial pressure',
    cabin_pressure_psia: 'Cabin pressure',
    cabin_temp_c: 'Cabin temperature',
    humidity_pct: 'Humidity',
    food_reserve_days: 'Food reserve',
    water_reserve_days: 'Water reserve',
  };
  const UNITS = {
    heart_rate_bpm: 'bpm',
    respiration_rate: 'br/min',
    spo2_pct: '%',
    skin_temp_c: '\u00b0C',
    co2_mmhg: 'mmHg',
    o2_pp_mmhg: 'mmHg',
    cabin_pressure_psia: 'psia',
    cabin_temp_c: '\u00b0C',
    humidity_pct: '%',
    food_reserve_days: 'days',
    water_reserve_days: 'days',
  };
  function labelFor(field) { return LABELS[field] || field; }
  function unitFor(field) { return UNITS[field] || ''; }

  function formatTime(ts) {
    const d = new Date(ts);
    return d.toLocaleString(undefined, {
      month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
    });
  }

  /* ------------------------------------------------------------------ *
   * 7. Event log + messaging
   *
   * DESIGN NOTE: this app runs both the astronaut view and the mission
   * control view as two panels of ONE HTML document (console.html) that
   * share this same JavaScript module, rather than as two separate
   * file:// documents. That's a deliberate choice: localStorage sharing
   * between two different file:// documents is explicitly undefined
   * behavior (MDN) and, in current Firefox, is OFF by default (each
   * file:// path gets its own storage origin) — so a two-file design
   * would not reliably sync "live" without a local server. Keeping both
   * views in one document means the event log below is a single
   * in-memory array shared directly by reference — no cross-document
   * storage or messaging is needed for the core demo to work.
   *
   * localStorage is still used, best-effort, purely so your event log
   * survives an ordinary page *reload* of this same document.
   * ------------------------------------------------------------------ */

  const STORAGE_KEY = 'ahm_events_v1';
  let events = [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    events = raw ? JSON.parse(raw) : [];
  } catch (e) {
    events = [];
  }

  const subscribers = [];

  function persist() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(events)); } catch (e) { /* storage unavailable */ }
  }

  function notify() {
    subscribers.forEach((cb) => { try { cb(); } catch (e) { /* a subscriber's own error shouldn't break others */ } });
  }

  function readEvents() {
    return events;
  }

  function logEvent(entry) {
    events.push({
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      time: Date.now(),
      acknowledged: false,
      ...entry,
    });
    persist();
    notify();
    return events;
  }

  function acknowledgeEvent(id) {
    const idx = events.findIndex((e) => e.id === id);
    if (idx >= 0) {
      events[idx].acknowledged = true;
      events[idx].acknowledgedAt = Date.now();
      persist();
      notify();
    }
    return events;
  }

  // Auto-logs an "Alert generated" history entry the first time a given
  // scope (a crew member, or 'environment') reaches a given level on a
  // given mission day. Deduplicated by scopeKey so scrubbing the mission
  // day slider back and forth doesn't spam the log.
  function ensureAlertLogged(scopeId, day, level, title, crewId) {
    if (level === LEVEL.NOMINAL) return;
    const scopeKey = `${scopeId}:${day}:${level}`;
    if (events.some((e) => e.scopeKey === scopeKey)) return;
    events.push({
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      time: Date.now(),
      type: 'alert',
      level,
      scopeKey,
      crewId: crewId || null,
      title,
      acknowledged: true, // alerts themselves don't require acknowledgement
    });
    persist();
    notify();
  }

  // Registers a callback to run whenever the event log changes (a new
  // alert, a sent message, an acknowledgement, a check-in). Both the
  // astronaut view and the mission control view subscribe to this so
  // either one immediately reflects changes made by the other.
  function onEventsChanged(cb) {
    subscribers.push(cb);
  }

  return {
    LEVEL,
    initNav,
    parseCsv,
    loadData,
    telemetryForCrew,
    environmentSeries,
    movingAverage,
    trailingAverage,
    baseline,
    pctChangeFromBaseline,
    linearTrend,
    projectDaysToThreshold,
    consecutiveDaysWhere,
    assessCrewMember,
    assessEnvironment,
    modelBoneTrajectory,
    labelFor,
    unitFor,
    formatTime,
    worseOf,
    readEvents,
    logEvent,
    acknowledgeEvent,
    ensureAlertLogged,
    onEventsChanged,
  };
})();
