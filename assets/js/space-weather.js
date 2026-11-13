/* ==========================================================================
   space-weather.js - live space weather from NASA DONKI (through api.nasa.gov).

   DONKI = Space Weather Database Of Notifications, Knowledge, Information (NASA CCMC).
   Four event types are read: solar flares (FLR), solar energetic particle events (SEP),
   geomagnetic storms (GST) and coronal mass ejections (CME).

   1. FETCH    asks NASA for the last few days of events (settings and the API key: assets/js/config.js).
   2. FALLBACK if NASA cannot be reached, shows data/space-weather-sample.js, labelled SAMPLE.
   3. ASSESS   turns the events into ok / watch / alert with plain steps for the crew.
               The thresholds are THIS APP'S OWN rules (not a NASA operational standard) and are listed
               on the References page.

   Public API (used by shell.js):  SPACEWX.start()  SPACEWX.refresh()  SPACEWX.state()
                                   SPACEWX.assess()  SPACEWX.onChange(fn)
   ========================================================================== */

window.SPACEWX = (function () {
  'use strict';

  const CFG = Object.assign({ NASA_API_KEY: '', DONKI_BASE: 'https://api.nasa.gov/DONKI', DONKI_DAYS: 7, DONKI_REFRESH_MIN: 30, DONKI_TIMEOUT_MS: 12000 }, window.AHM_CONFIG || {});
  const SAMPLE = window.AHM_SPACEWX_SAMPLE || { flares: [], sep: [], storms: [], cmes: [] };
  const CACHE_KEY = 'ahm-spacewx-v1';
  const HOUR = 3600 * 1000;

  const listeners = [];
  const st = { status: 'loading', keyMode: CFG.NASA_API_KEY ? 'own' : 'demo', events: [], fetchedAt: null, message: '', failed: [] };
  let timer = null, busy = false;

  const emit = () => listeners.forEach((fn) => { try { fn(); } catch (e) { /* a listener error must not stop the loader */ } });
  const apiKey = () => (CFG.NASA_API_KEY && String(CFG.NASA_API_KEY).trim()) || 'DEMO_KEY';
  const ymd = (ms) => new Date(ms).toISOString().slice(0, 10);

  /* ---------------- normalise NASA's four response shapes into one event list ---------------- */

  const maxKp = (g) => Math.max(0, ...(g.allKpIndex || []).map((k) => Number(k.kpIndex) || 0));

  function fromFlares(rows) {
    return (rows || []).map((r) => ({ kind: 'flare', t: Date.parse(r.peakTime || r.beginTime), cls: r.classType || '?', title: `Solar flare ${r.classType || ''}`.trim(), detail: r.sourceLocation ? `Peak near ${r.sourceLocation}` : 'Solar flare', link: r.link }));
  }
  function fromSep(rows) {
    return (rows || []).map((r) => ({ kind: 'sep', t: Date.parse(r.eventTime), title: 'Solar energetic particle event', detail: (r.instruments || []).map((i) => i.displayName).filter(Boolean).join(', ') || 'Detected by NASA/NOAA instruments', link: r.link }));
  }
  function fromStorms(rows) {
    return (rows || []).map((r) => { const kp = maxKp(r); return { kind: 'storm', t: Date.parse(r.startTime), kp, title: `Geomagnetic storm (Kp ${kp})`, detail: 'Disturbance of Earth’s magnetic field', link: r.link }; });
  }
  function fromCmes(rows) {
    return (rows || []).map((r) => {
      const list = r.cmeAnalyses || [], a = list.find((x) => x.isMostAccurate) || list[0] || {};
      const speed = Number(a.speed) || null;
      return { kind: 'cme', t: Date.parse(r.startTime), speed, title: 'Coronal mass ejection', detail: speed ? `About ${Math.round(speed)} km/s (NASA analysis)` : 'Speed not yet analysed', link: r.link };
    });
  }
  function fromSample() {
    const now = Date.now(), ago = (h) => now - h * HOUR;
    return [].concat(
      SAMPLE.flares.map((r) => ({ kind: 'flare', t: ago(r.hoursAgo), cls: r.cls, title: `Solar flare ${r.cls}`, detail: r.note })),
      SAMPLE.sep.map((r) => ({ kind: 'sep', t: ago(r.hoursAgo), title: 'Solar energetic particle event', detail: r.note })),
      SAMPLE.storms.map((r) => ({ kind: 'storm', t: ago(r.hoursAgo), kp: r.kp, title: `Geomagnetic storm (Kp ${r.kp})`, detail: r.note })),
      SAMPLE.cmes.map((r) => ({ kind: 'cme', t: ago(r.hoursAgo), speed: r.speed, title: 'Coronal mass ejection', detail: `About ${r.speed} km/s. ${r.note}` }))
    ).sort((a, b) => b.t - a.t);
  }

  /* ---------------- fetch ---------------- */

  async function get(type, parse) {
    const end = Date.now(), start = end - CFG.DONKI_DAYS * 24 * HOUR;
    const url = `${CFG.DONKI_BASE}/${type}?startDate=${ymd(start)}&endDate=${ymd(end)}&api_key=${encodeURIComponent(apiKey())}`;
    const ctl = new AbortController(), to = setTimeout(() => ctl.abort(), CFG.DONKI_TIMEOUT_MS);
    try {
      const res = await fetch(url, { signal: ctl.signal });
      if (res.status === 429) throw new Error('rate limit reached');
      if (res.status === 403) throw new Error('key rejected');
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const text = await res.text();
      return parse(text ? JSON.parse(text) : []);   // DONKI answers an empty body when there are no events
    } finally { clearTimeout(to); }
  }

  function readCache() {
    try {
      const c = JSON.parse(localStorage.getItem(CACHE_KEY) || 'null');
      if (c && c.keyMode === st.keyMode && Date.now() - c.fetchedAt < CFG.DONKI_REFRESH_MIN * 60 * 1000) return c;
    } catch (e) { /* storage blocked: just fetch */ }
    return null;
  }
  function writeCache() {
    try { localStorage.setItem(CACHE_KEY, JSON.stringify({ keyMode: st.keyMode, fetchedAt: st.fetchedAt, events: st.events })); } catch (e) { /* ignore */ }
  }

  async function refresh(force) {
    if (busy) return;
    if (!force) {
      const c = readCache();
      if (c) { Object.assign(st, { status: 'live', events: c.events, fetchedAt: c.fetchedAt, message: 'Loaded from this browser’s cache', failed: [] }); emit(); return; }
    }
    busy = true; st.status = st.events.length ? st.status : 'loading'; emit();
    const jobs = [['FLR', fromFlares], ['SEP', fromSep], ['GST', fromStorms], ['CME', fromCmes]];
    const results = await Promise.allSettled(jobs.map(([t, p]) => get(t, p)));
    const failed = [], events = [];
    results.forEach((r, i) => { if (r.status === 'fulfilled') events.push(...r.value); else failed.push(`${jobs[i][0]}: ${r.reason && r.reason.name === 'AbortError' ? 'timed out' : (r.reason && r.reason.message) || 'failed'}`); });
    if (failed.length === jobs.length) {
      Object.assign(st, { status: 'sample', events: fromSample(), fetchedAt: Date.now(), failed, message: `NASA could not be reached (${failed[0].split(': ')[1]}). Showing SAMPLE data.` });
    } else {
      events.sort((a, b) => b.t - a.t);
      Object.assign(st, { status: 'live', events, fetchedAt: Date.now(), failed, message: failed.length ? `Partial: ${failed.join('; ')}` : '' });
      writeCache();
    }
    busy = false; emit();
  }

  /* ---------------- assess: events -> ok / watch / alert (this app's own rules) ---------------- */

  const STEPS = {
    alert: [
      'Move to the most shielded area (storm shelter or the thickest-walled, supply-lined part of the vehicle) and stay until the flight surgeon says it is clear.',
      'Pause non-essential EVAs and exposed work. Read your personal dosimeter now and log it in your check-in.',
      'Tell your crewmates and contact the flight surgeon. If the delay is long, follow your onboard radiation plan and decide with the crew.'
    ],
    watch: [
      'Be ready to move to the shielded area. Keep the route clear and know where the dosimeter is.',
      'Check the dosimeter rate every few hours and log it in your check-in.',
      'Plan EVAs with care while this lasts, and tell the flight surgeon if the rate climbs.'
    ],
    ok: ['No special action. Keep to the normal dosimeter checks.']
  };

  function assess() {
    const now = Date.now(), within = (e, h) => now - e.t <= h * HOUR;
    const ev = st.events, reasons = [];
    const sep = ev.filter((e) => e.kind === 'sep' && within(e, 48));
    const xFlare = ev.filter((e) => e.kind === 'flare' && /^X/i.test(e.cls) && within(e, 24));
    let level = 'ok';
    if (sep.length) { level = 'alert'; reasons.push('A solar energetic particle event in the last 48 h'); }
    if (xFlare.length) { level = 'alert'; reasons.push(`X-class flare (${xFlare[0].cls}) in the last 24 h`); }
    if (level !== 'alert') {
      const m = ev.filter((e) => e.kind === 'flare' && /^M/i.test(e.cls) && within(e, 24));
      const kp = ev.filter((e) => e.kind === 'storm' && e.kp >= 5 && within(e, 24));
      const sepOld = ev.filter((e) => e.kind === 'sep');
      const fast = ev.filter((e) => e.kind === 'cme' && e.speed >= 1000 && within(e, 48));
      if (m.length) reasons.push(`M-class flare (${m[0].cls}) in the last 24 h`);
      if (kp.length) reasons.push(`Geomagnetic storm Kp ${kp[0].kp} in the last 24 h`);
      if (sepOld.length) reasons.push('A solar energetic particle event earlier this week');
      if (fast.length) reasons.push(`Fast coronal mass ejection (${Math.round(fast[0].speed)} km/s) in the last 48 h`);
      if (reasons.length) level = 'watch';
    }
    return { level, reasons, steps: STEPS[level], title: level === 'alert' ? 'Radiation alert: take shelter' : level === 'watch' ? 'Radiation watch: be ready' : 'Space weather quiet' };
  }

  function start() {
    if (timer) return;
    refresh(false);
    timer = setInterval(() => refresh(true), CFG.DONKI_REFRESH_MIN * 60 * 1000);
  }

  return {
    start, refresh: () => refresh(true), assess,
    state: () => Object.assign({}, st, { events: st.events.slice(), days: CFG.DONKI_DAYS, refreshMin: CFG.DONKI_REFRESH_MIN }),
    onChange: (fn) => listeners.push(fn)
  };
})();
