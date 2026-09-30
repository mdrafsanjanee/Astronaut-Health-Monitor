/* ==========================================================================
   engine.js
   Turns the real Apollo 15 dataset (data/data.js, read through the AHM
   helpers in common.js) into the numbers the Figma-designed pages show.
   No UI/markup here — shell.js owns rendering. This is the one file a
   future edit to "what counts as healthy" or "how a score is computed"
   should touch.
   ========================================================================== */

const ENGINE = (() => {
  const DATA = AHM.loadData();
  const CREW = DATA.crew.members;                       // [{id,name,role,photo_initials,position_note}]
  const CREW_ROWS = Object.fromEntries(CREW.map((c) => [c.id, AHM.telemetryForCrew(DATA.telemetry, c.id)]));
  const TOTAL_HOURS = DATA.mission.total_get_hours;
  const VREF = DATA.references.vitals_general_reference;

  function crewShortName(c) { return c.name.split(' ').slice(-1)[0]; }

  // 0-100 wellbeing-style score from an assessment's alert severities +
  // how far HR/RR sit from the general reference band (EVA-aware).
  function healthScore(assess) {
    let score = 96;
    const overPct = (value, [lo, hi]) => {
      if (value >= lo && value <= hi) return 0;
      const span = hi - lo;
      return Math.min(1, (value > hi ? value - hi : lo - value) / span);
    };
    if (!assess.eva) {
      score -= overPct(assess.row.heart_rate_bpm, VREF.heart_rate_bpm.nominal) * 14;
      score -= overPct(assess.row.respiration_rate, VREF.respiration_rate.nominal) * 8;
    }
    assess.alerts.forEach((a) => { score -= a.level === 'CRITICAL' ? 22 : a.level === 'ATTENTION' ? 10 : 3; });
    return Math.max(38, Math.min(99, Math.round(score)));
  }

  function scoreCopy(score) {
    if (score >= 90) return ['Excellent condition', 'All primary biometrics are within the expected range. No action needed.'];
    if (score >= 75) return ['Stable condition', 'Readings are within range with one indicator to keep an eye on.'];
    if (score >= 55) return ['Attention advised', 'One or more readings are outside the expected band — under active review.'];
    return ['Requires review', 'A flagged event is active. Flight surgeons are assessing in real time.'];
  }

  function boneDensityPct(hour) {
    // Real endpoint: ~4% mineral loss by splashdown (M-078 experiment).
    // The accumulation curve itself was never measured in-flight, so it's
    // modeled as a smooth ramp against elapsed time — endpoint is real.
    return -(Math.min(1, hour / TOTAL_HOURS) * 4);
  }

  function missionDay(hour) { return Math.floor(hour / 24); }
  function missionTotalDays() { return Math.ceil(TOTAL_HOURS / 24); }

  // Build the assessment + derived "modern" vitals for one crew member at `hour`.
  function crewSnapshot(crewId, hour) {
    const assess = AHM.assessCrewMember(DATA.references, CREW_ROWS[crewId], DATA.events, crewId, hour);
    const modern = AHM.simulateModernVitals(crewId, hour, DATA.events);
    const score = healthScore(assess);
    return { crewId, hour, assess, modern, score };
  }

  function allCrewSnapshots(hour) { return CREW.map((c) => crewSnapshot(c.id, hour)); }

  // Rolling window series for the line charts — real values, in-order, no
  // synthetic smoothing. `hours` is how far back from `hour` to include.
  function series(crewId, hour, hours, field) {
    const rows = CREW_ROWS[crewId];
    const end = Math.floor(hour);
    const start = Math.max(0, end - hours);
    return rows.filter((r) => r.get_hours >= start && r.get_hours <= end).map((r) => ({ x: r.get_hours, y: r[field] }));
  }

  function avg(points) { return points.length ? points.reduce((s, p) => s + p.y, 0) / points.length : 0; }

  function eventsUpTo(hour) { return AHM.eventsUpTo(DATA.events, hour); }
  function recentEvents(hour, n) { return eventsUpTo(hour).slice(-n).reverse(); }

  // Most recent crew self-check-in (from the demo log) within 24 GET-hours before `hour`.
  const latestCheckin = (hour, crewId) => AHM.readDemoLog().filter((e) => e.type === 'checkin' && e.get_hours <= hour && hour - e.get_hours <= 24 && (!crewId || !e.crewId || e.crewId === crewId)).pop() || null;

  // Rule-based decision support: active alerts + latest self-report -> onboard actions (no ground link needed).
  function advise(s, ci) {
    const out = [], tired = ci && ci.fatigue >= 4;
    if (s.assess.alerts.some((a) => /arrhythmia/i.test(a.title)))
      out.push(tired ? 'Rhythm irregularity + fatigue: begin a rest cycle, defer EVA and strenuous work, repeat ECG in 2 h.'
                     : 'Rhythm irregularity: repeat ECG, limit exertion, review potassium/electrolyte intake.');
    if (tired && s.modern.sleepQuality < 70) out.push('Fatigue + poor recent sleep: protect the next sleep period, defer non-critical tasks.');
    if (ci && ci.mood <= 2) out.push('Low mood reported: schedule a private call or crew debrief.');
    if (ci && ci.symptoms) out.push('Symptom logged: recheck vitals in 1 h; escalate if it persists or worsens.');
    if (ci && ci.dose != null && ci.dose > s.modern.doseMrad * 0.01 * 1.5) out.push('Dosimeter above modeled accumulation: re-read it and move to the most shielded area if the rate is rising.');
    return out;
  }

  const EVENT_TAG_LABEL = {
    milestone: 'Milestone', eva: 'EVA', sleep: 'Sleep', medical: 'Medical',
    'mission-control-decision': 'MCC decision', postflight: 'Postflight',
  };

  return {
    DATA, CREW, CREW_ROWS, TOTAL_HOURS, VREF,
    crewShortName, healthScore, scoreCopy, boneDensityPct, missionDay, missionTotalDays,
    crewSnapshot, allCrewSnapshots, latestCheckin, advise, series, avg, eventsUpTo, recentEvents, EVENT_TAG_LABEL,
  };
})();
