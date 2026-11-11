/* ==========================================================================
   live.js - live vitals feed + alert system (version 1, rule based).

   1. FEED     plays data/sensor-feed.js (a placeholder datasheet) one row every 3 s, per crew member.
               Real sensors later: call LIVE.push(crewId, { hr, sys, dia, resp, temp, activity }).
   2. RULES    turn one sample into findings: ok / watch / alert, plus plain steps for the astronaut.
   3. ALERTS   a finding must repeat for 2 samples before an alert opens, and 3 normal samples before it
               closes, so one noisy reading does not flap.
   4. NOTICES  when an alert opens, the other two crew members get a notice so they are aware.

   Thresholds: the blood-pressure bands follow the American Heart Association categories and the resting
   heart-rate band follows its 60-100 bpm range; the temperature bands follow MedlinePlus. Bands beyond
   those ranges, and the breathing band, are this app's own rules (listed on the References page).
   All wording is general guidance for a prototype, not medical advice.
   ========================================================================== */

window.LIVE = (function () {
  'use strict';

  const FEED = window.AHM_FEED || { intervalMs: 3000, offsets: {}, rows: [] };
  const CREW = ['CDR', 'CMP', 'LMP'];
  const NAMES = { CDR: 'Scott', CMP: 'Worden', LMP: 'Irwin' };
  const RANK = { ok: 0, watch: 1, alert: 2 };

  const latest = {};          // crewId -> latest sample
  const states = {};          // crewId -> metric -> { pendingLevel, pendingCount, okCount, alert }
  const notices = [];         // crew notices (in memory only)
  const history = {};         // crewId -> last 30 samples (for the live charts)
  const log = [];             // alert opened / closed entries, newest last
  const listeners = [];
  let tickCount = 0, timer = null, nextId = 1;

  CREW.forEach((c) => { states[c] = {}; history[c] = []; });

  /* ---------------- rules: one sample -> findings ---------------- */

  const BP_STEPS = {
    watch: ['Sit down and rest for 5 minutes. Breathe in for 4 seconds, out for 6.', 'Re-measure after resting. Hold off on caffeine and heavy work until it settles.', 'Your crewmates have been told so they can look out for you.'],
    alert: ['Stop what you are doing and sit or lie down.', 'Breathe slowly (in 4 s, out 6 s) for 5 minutes, then re-measure.', 'Tell a crewmate now. Contact the flight surgeon if it stays at or above 140/90, and immediately if you have chest pain, a severe headache, vision changes, weakness or trouble breathing.'],
    low: ['Sit or lie down and raise your legs if you can.', 'Drink some water and stand up slowly.', 'Tell a crewmate and the flight surgeon if you feel dizzy or faint.']
  };

  function rateBp(s) {
    if (s.activity === 'exercise') return null;
    const sys = s.sys, dia = s.dia, v = `${Math.round(sys)}/${Math.round(dia)} mmHg`;
    if (sys > 180 || dia > 120) return { metric: 'bp', level: 'alert', title: 'Blood pressure very high', value: v, category: 'Crisis range', steps: ['Rest and re-measure after 5 minutes.'].concat(BP_STEPS.alert, ['If it is still above 180/120, contact the flight surgeon immediately.']), cite: ['aha_bp'] };
    if (sys >= 140 || dia >= 90) return { metric: 'bp', level: 'alert', title: 'Blood pressure high', value: v, category: 'Stage 2 range', steps: BP_STEPS.alert, cite: ['aha_bp'] };
    if (sys >= 130 || dia >= 80) return { metric: 'bp', level: 'watch', title: 'Blood pressure above normal', value: v, category: 'Stage 1 range', steps: BP_STEPS.watch, cite: ['aha_bp'] };
    if (sys >= 120) return { metric: 'bp', level: 'watch', title: 'Blood pressure slightly raised', value: v, category: 'Elevated', steps: BP_STEPS.watch, cite: ['aha_bp'] };
    if (sys < 90 || dia < 60) return { metric: 'bp', level: 'watch', title: 'Blood pressure low', value: v, category: 'Low (app rule)', steps: BP_STEPS.low, cite: ['aha_bp'] };
    return { metric: 'bp', level: 'ok', value: v, category: 'Normal' };
  }

  function rateHr(s) {
    if (s.activity === 'exercise') return { metric: 'hr', level: 'ok', value: `${Math.round(s.hr)} bpm`, category: 'Exercise (expected)' };
    const hr = s.hr, v = `${Math.round(hr)} bpm`;
    const hiSteps = ['Stop what you are doing and sit down.', 'Breathe slowly and drink some water. Re-measure in 5 minutes.', 'Tell a crewmate. Contact the flight surgeon if it stays above 120 at rest, or with chest pain, dizziness or fainting.'];
    if (hr >= 120) return { metric: 'hr', level: 'alert', title: 'Resting heart rate very high', value: v, category: 'Above 100 at rest', steps: hiSteps, cite: ['aha_hr'] };
    if (hr > 100) return { metric: 'hr', level: 'watch', title: 'Resting heart rate high', value: v, category: 'Above 100 at rest', steps: ['Sit down and rest. Breathe slowly and drink some water.', 'Re-measure in 5 minutes.', 'Your crewmates have been told so they can look out for you.'], cite: ['aha_hr'] };
    if (hr < 50) return { metric: 'hr', level: 'alert', title: 'Resting heart rate very low', value: v, category: 'Below 60 at rest', steps: ['Sit down. Do not stand quickly.', 'Tell a crewmate and contact the flight surgeon, especially if you feel dizzy, faint or short of breath.'], cite: ['aha_hr'] };
    if (hr < 60) return { metric: 'hr', level: 'watch', title: 'Resting heart rate low', value: v, category: 'Below 60 at rest', steps: ['Sit down and check how you feel. A low rate can be normal for a fit person.', 'Report dizziness or fainting to the flight surgeon.'], cite: ['aha_hr'] };
    return { metric: 'hr', level: 'ok', value: v, category: 'Normal' };
  }

  function rateResp(s) {
    if (s.activity === 'exercise') return { metric: 'resp', level: 'ok', value: `${s.resp.toFixed(1)} /min`, category: 'Exercise (expected)' };
    const r = s.resp, v = `${r.toFixed(1)} /min`;
    const steps = ['Rest and breathe slowly.', 'Check the cabin air readout (CO2) and that the breathing sensor is seated correctly.', 'Tell a crewmate. Contact the flight surgeon if you feel short of breath.'];
    if (r > 24 || r < 10) return { metric: 'resp', level: 'alert', title: 'Breathing rate far from normal', value: v, category: 'Outside 12-20 (app rule)', steps, cite: [] };
    if (r > 20 || r < 12) return { metric: 'resp', level: 'watch', title: 'Breathing rate outside normal', value: v, category: 'Outside 12-20 (app rule)', steps, cite: [] };
    return { metric: 'resp', level: 'ok', value: v, category: 'Normal' };
  }

  function rateTemp(s) {
    const t = s.temp, v = `${t.toFixed(1)} \u00B0C`;
    const hot = ['Rest, drink water and re-measure in 30 minutes.', 'Check the cabin temperature and your clothing layers.', 'Tell a crewmate. Contact the flight surgeon if it reaches 38.0 \u00B0C or you feel unwell.'];
    if (t >= 38.0) return { metric: 'temp', level: 'alert', title: 'Fever', value: v, category: 'Fever range', steps: ['Rest and drink water. Re-measure in 30 minutes.', 'Contact the flight surgeon now and limit close contact with the crew where you can.'], cite: ['nlm_temp'] };
    if (t > 37.2) return { metric: 'temp', level: 'watch', title: 'Temperature slightly raised', value: v, category: 'Above 37.2 \u00B0C', steps: hot, cite: ['nlm_temp'] };
    if (t < 35.0) return { metric: 'temp', level: 'alert', title: 'Temperature very low', value: v, category: 'Below 35 \u00B0C', steps: ['Warm up with extra layers and a warm drink.', 'Contact the flight surgeon now.'], cite: ['nlm_temp'] };
    if (t < 36.1) return { metric: 'temp', level: 'watch', title: 'Temperature low', value: v, category: 'Below 36.1 \u00B0C', steps: ['Add a layer, warm up and re-measure in 30 minutes.', 'Tell a crewmate if you keep feeling cold.'], cite: ['nlm_temp'] };
    return { metric: 'temp', level: 'ok', value: v, category: 'Normal' };
  }

  // Public: classify a sample without opening any alert (used to colour the tiles right away).
  function rate(sample) {
    return { hr: rateHr(sample), bp: rateBp(sample) || { metric: 'bp', level: 'ok', value: `${Math.round(sample.sys)}/${Math.round(sample.dia)} mmHg`, category: 'Exercise (expected)' }, resp: rateResp(sample), temp: rateTemp(sample) };
  }

  /* ---------------- alert state machine + notices ---------------- */

  const emit = () => listeners.forEach((fn) => { try { fn(); } catch (e) { /* a listener error must not stop the feed */ } });

  function notifyCrew(alert) {
    CREW.filter((c) => c !== alert.crew).forEach((to) => {
      const text = alert.level === 'alert'
        ? `${NAMES[alert.crew]}: ${alert.title.toLowerCase()} (${alert.value}). Please check in with them and be ready to help or call the flight surgeon.`
        : `${NAMES[alert.crew]}: ${alert.title.toLowerCase()} (${alert.value}). They have been told to rest and re-measure. No action needed unless they ask for help.`;
      notices.push({ id: 'n' + nextId++, from: alert.crew, to, alertId: alert.id, level: alert.level, kind: 'alert', text, ack: false, ts: Date.now() });
    });
    alert.notified = CREW.filter((c) => c !== alert.crew).map((c) => ({ crew: c, seen: false }));
    log.push({ ts: Date.now(), crew: alert.crew, level: alert.level, text: `${NAMES[alert.crew]}: ${alert.title} (${alert.value}). ${alert.notified.map((p) => NAMES[p.crew]).join(' and ')} notified.` });
  }

  function openAlert(crew, f) {
    const alert = { id: 'a' + nextId++, crew, metric: f.metric, level: f.level, title: f.title, value: f.value, category: f.category, steps: f.steps, cite: f.cite || [], ack: false, since: Date.now(), tick: tickCount, notified: [] };
    notifyCrew(alert);
    return alert;
  }

  function closeAlert(crew, st) {
    const a = st.alert;
    CREW.filter((c) => c !== crew).forEach((to) => {
      notices.push({ id: 'n' + nextId++, from: crew, to, alertId: a.id, level: 'ok', kind: 'resolved', text: `${NAMES[crew]}: ${a.title.toLowerCase()} is back in range. No further action needed.`, ack: false, ts: Date.now() });
    });
    log.push({ ts: Date.now(), crew, level: 'ok', text: `${NAMES[crew]}: ${a.title.toLowerCase()} is back in range.` });
    st.alert = null;
  }

  function evaluate(crew, sample) {
    const findings = rate(sample);
    Object.keys(findings).forEach((metric) => {
      const f = findings[metric];
      const st = states[crew][metric] || (states[crew][metric] = { pendingLevel: 'ok', pendingCount: 0, okCount: 0, alert: null });
      if (f.level === 'ok') {
        st.pendingLevel = 'ok'; st.pendingCount = 0; st.okCount++;
        if (st.alert && st.okCount >= 3) closeAlert(crew, st);
        return;
      }
      st.okCount = 0;
      if (st.alert && st.alert.level === f.level) { st.alert.value = f.value; st.alert.category = f.category; return; }
      st.pendingCount = st.pendingLevel === f.level ? st.pendingCount + 1 : 1;
      st.pendingLevel = f.level;
      if (st.pendingCount >= 2 && (!st.alert || RANK[f.level] > RANK[st.alert.level])) {
        if (st.alert) closeAlert(crew, st);
        st.alert = openAlert(crew, f);
      }
    });
  }

  /* ---------------- feed ---------------- */

  function sampleFor(crew, n) {
    const rows = FEED.rows;
    if (!rows.length) return null;
    const row = rows[(n + (FEED.offsets[crew] || 0)) % rows.length];
    return { hr: row[0], sys: row[1], dia: row[2], resp: row[3], temp: row[4], activity: row[5], n, ts: Date.now() };
  }

  function record(crew, sample) {
    latest[crew] = sample;
    history[crew].push(sample);
    if (history[crew].length > 30) history[crew].shift();
    evaluate(crew, sample);
  }

  // Public: feed one reading for one crew member (placeholder loop today, real sensors later).
  function push(crew, sample) {
    if (!states[crew]) return;
    record(crew, Object.assign({ activity: 'rest', n: tickCount, ts: Date.now() }, sample));
    emit();
  }

  function tick() {
    tickCount++;
    CREW.forEach((c) => { const s = sampleFor(c, tickCount); if (s) record(c, s); });
    emit();
  }

  function start() {
    if (timer) return;
    CREW.forEach((c) => { const s = sampleFor(c, 0); if (s) record(c, s); });
    timer = setInterval(tick, FEED.intervalMs || 3000);
    emit();
  }

  // Demo helper: fast-forward the placeholder sheet until this crew member's next alert would open.
  function skipToNextAlert(crew) {
    if (!FEED.rows.length) return;
    for (let i = 0; i < FEED.rows.length * 2; i++) {
      tickCount++;
      CREW.forEach((c) => { const s = sampleFor(c, tickCount); if (s) record(c, s); });
      if (Object.keys(states[crew]).some((m) => states[crew][m].alert && !states[crew][m].alert.ack && states[crew][m].alert.tick === tickCount)) break;
    }
    emit();
  }

  /* ---------------- queries for the UI ---------------- */

  const activeFor = (crew) => Object.keys(states[crew]).map((m) => states[crew][m].alert).filter(Boolean).sort((a, b) => RANK[b.level] - RANK[a.level]);
  const allActive = () => CREW.reduce((all, c) => all.concat(activeFor(c)), []);
  const noticesFor = (crew) => notices.filter((n) => n.to === crew && !n.ack).slice(-4).reverse();

  function ackNotice(id) {
    const n = notices.find((x) => x.id === id);
    if (!n) return;
    n.ack = true;
    CREW.forEach((c) => Object.keys(states[c]).forEach((m) => {
      const a = states[c][m].alert;
      if (a && a.id === n.alertId) a.notified.forEach((p) => { if (p.crew === n.to) p.seen = true; });
    }));
    emit();
  }

  function ackAlert(id) {
    allActive().forEach((a) => { if (a.id === id) a.ack = true; });
    emit();
  }

  return {
    CREW, NAMES, start, push, rate, skipToNextAlert, ackNotice, ackAlert,
    latest: (c) => latest[c], history: (c) => history[c].slice(), log: () => log.slice(-8).reverse(), active: activeFor, allActive, notices: noticesFor,
    onChange: (fn) => listeners.push(fn),
    intervalMs: FEED.intervalMs || 3000,
    count: () => tickCount
  };
})();
