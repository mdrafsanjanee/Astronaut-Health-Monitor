/* ==========================================================================
   shell.js - the whole app UI, kept deliberately small.

   No login and no sidebar. One top bar with five pages:
     #astronaut   one page: status, vitals, chart, timeline, check-in
     #control     one page: crew board, alerts, charts, event log
     #project     the detailed project description
     #resources   the NASA challenge resources (published 15 Nov 2026) - data/resources.js
     #references  APA references + "what data is used where"           - data/references.js

   The numbers come from engine.js (which reads the real Apollo 15 dataset).
   Old links such as #astronaut-dashboard or #control-alerts still work.
   ========================================================================== */

(function () {
  'use strict';

  const I = (name, size) => `<i data-icon="${name}" data-size="${size || 18}"></i>`;
  const esc = (s) => String(s).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
  const fmt1 = (n) => (Math.round(n * 10) / 10).toFixed(1);
  const fmt0 = (n) => Math.round(n).toString();

  const REFS = window.AHM_REFS || { references: {}, cite: {}, dataUsed: [], generated: [], toVerify: [] };
  const RES = window.AHM_RESOURCES || { publishDate: '2026-11-15', publishLabel: '15 November 2026', items: [], slots: [] };

  // The clock runs a little past the last telemetry row so the post-flight events (GET 295.3 to 295.6) can be reached.
  const TOTAL_HOURS = Math.max(ENGINE.TOTAL_HOURS, ...ENGINE.DATA.events.map((e) => e.get_hours)) + 0.05;
  const sim = { hour: 0, playing: false, timer: null, speed: 8 };   // 8 GET-hours per real second
  const TICK_MS = 200;

  const state = { crew: 'LMP', organ: null, open: {} };
  const reviewed = new Set();

  const NAV = [['home', 'Home'], ['astronaut', 'Demo Astronaut'], ['control', 'Demo Mission Control'], ['simulation', 'Apollo 15 Simulation'], ['project', 'Project'], ['resources', 'Resources'], ['references', 'References']];
  const LIVE_PAGES = ['astronaut', 'control', 'simulation'];

  const crewMember = () => ENGINE.CREW.find((c) => c.id === state.crew) || ENGINE.CREW[2];
  const crewById = (id) => ENGINE.CREW.find((c) => c.id === id);
  const shortName = (id) => ENGINE.crewShortName(crewById(id));

  /* ------------------------------------------------------------------ *
   * Events + citations
   * ------------------------------------------------------------------ */

  const visibleEvents = (role) => role === 'control' ? ENGINE.DATA.events : ENGINE.DATA.events.filter((e) => !e.crew_id || e.crew_id === state.crew);
  const eventsSoFar = (role) => visibleEvents(role).filter((e) => e.get_hours <= sim.hour);
  const activeNotices = (role) => visibleEvents(role).filter((e) => e.severity && sim.hour >= e.get_hours && sim.hour <= (e.active_until_hours ?? e.get_hours + 3));

  // In-text APA citation, e.g. "(NASA, 1971, Section 10.2.3)"
  function citeText(keys, where) {
    keys = keys || [];
    if (!keys.length) return '';
    const parts = keys.map((k, i) => (REFS.cite[k] || k) + (i === 0 && where ? ', ' + where : ''));
    return '(' + parts.join('; ') + ')';
  }
  const cite = (keys, where) => (keys && keys.length ? `<a class="cite" href="#references">${esc(citeText(keys, where))}</a>` : '');

  function evidenceBadge(e) {
    if (e.evidence === 'secondary') return '<span class="ev ev-sec" title="Narrative from non-NASA accounts; see References">Secondary source</span>';
    if (e.evidence === 'estimated') return '<span class="ev ev-est" title="Exact time not in the sources used">Estimated time</span>';
    return '<span class="ev ev-nasa">NASA source</span>';
  }

  function EventItem(e, showCrew) {
    const sev = e.severity === 'CRITICAL' ? 'critical' : e.severity ? 'warn' : '';
    const who = showCrew ? (e.crew_id ? shortName(e.crew_id) : 'Mission') : '';
    return `<li class="ev-item ${sev}">
      <div class="ev-time">GET ${AHM.formatGet(e.get_hours)}${who ? `<small>${esc(who)}</small>` : ''}</div>
      <div class="ev-main">
        <div class="ev-title"><strong>${esc(e.title)}</strong>${evidenceBadge(e)}</div>
        <p>${esc(e.detail)}</p>
        <small class="ev-cite">Source: ${e.refs && e.refs.length ? cite(e.refs, e.where) : 'no source for the exact time (estimated)'}</small>
      </div>
    </li>`;
  }

  /* ------------------------------------------------------------------ *
   * Small shared pieces
   * ------------------------------------------------------------------ */

  const StatusPill = (text, tone) => `<span class="pill ${tone || 'good'}"><span></span>${esc(text)}</span>`;

  function MetricCard({ label, value, unit, status, change, icon }) {
    return `<div class="card metric-card">
      <div class="metric-head"><span>${esc(label)}</span><div class="metric-icon ${status || 'good'}">${I(icon)}</div></div>
      <div class="metric-value${typeof value === 'string' && value.length > 6 ? ' text' : ''}">${esc(value)}<small>${esc(unit)}</small></div>
      <div class="metric-foot">${StatusPill(status === 'danger' ? 'Alert' : status === 'warn' ? 'Monitor' : 'Normal', status || 'good')}<span>${esc(change)}</span></div>
    </div>`;
  }

  // points: [{x,y}]; eva: [{start,end}] in the same x-domain
  function LineChart({ color = 'cyan', points, eva = [] }) {
    if (!points.length) return `<svg class="line-chart ${color}" viewBox="0 0 340 100"></svg>`;
    const xs = points.map((p) => p.x); const ys = points.map((p) => p.y);
    const x0 = xs[0], x1 = xs[xs.length - 1] || x0 + 1;
    const yMin = Math.min(...ys), yMax = Math.max(...ys);
    const pad = (yMax - yMin) * 0.15 || 1;
    const sx = (x) => x1 === x0 ? 0 : ((x - x0) / (x1 - x0)) * 340;
    const sy = (y) => 96 - ((y - (yMin - pad)) / ((yMax + pad) - (yMin - pad))) * 92;
    const coords = points.map((p) => `${sx(p.x).toFixed(1)},${sy(p.y).toFixed(1)}`).join(' ');
    const bands = eva.filter((w) => w.end >= x0 && w.start <= x1).map((w) =>
      `<rect class="eva-band" x="${sx(Math.max(w.start, x0)).toFixed(1)}" y="0" width="${Math.max(2, sx(Math.min(w.end, x1)) - sx(Math.max(w.start, x0))).toFixed(1)}" height="100"></rect>`).join('');
    return `<svg class="line-chart ${color}" preserveAspectRatio="none" viewBox="0 0 340 100" role="img" aria-label="Trend chart">
      <defs><linearGradient id="fill-${color}" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="currentColor" stop-opacity=".28"></stop><stop offset="1" stop-color="currentColor" stop-opacity="0"></stop></linearGradient></defs>
      <path class="grid-line" d="M0 20h340M0 50h340M0 80h340"></path>
      ${bands}
      <polygon fill="url(#fill-${color})" points="${coords} 340,100 0,100"></polygon>
      <polyline class="series" fill="none" points="${coords}"></polyline>
    </svg>`;
  }

  function ChartCard({ kicker = 'TREND', label, meta, body }) {
    return `<div class="card chart-card">
      <div class="card-head"><div><span class="card-kicker">${esc(kicker)}</span><strong>${esc(label)}</strong></div><span class="chart-meta">${esc(meta)}</span></div>
      <div class="chart-body">${body}</div>
    </div>`;
  }

  function toast(msg) {
    let t = document.getElementById('toast');
    if (!t) { t = document.createElement('div'); t.id = 'toast'; t.className = 'toast'; t.setAttribute('role', 'status'); document.body.appendChild(t); }
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => t.classList.remove('show'), 2600);
  }

  const toneOf = (level) => level === 'NOMINAL' ? 'good' : level === 'ATTENTION' ? 'warn' : 'danger';
  const overallWord = (o) => o === 'NOMINAL' ? 'Nominal' : o === 'ATTENTION' ? 'Review' : 'Critical';

  /* ------------------------------------------------------------------ *
   * Top bar + replay bar
   * ------------------------------------------------------------------ */

  function navLinkHtml(id, label) {
    const open = id === 'control' ? LIVE.allActive().length : id === 'simulation' ? activeNotices('control').length : 0;
    return `${label}${open ? `<span class="sx-badge" title="${open} active alert${open > 1 ? 's' : ''}">${open}</span>` : ''}`;
  }

  const utcNow = () => new Date().toISOString().slice(11, 19);

  function tplTopbar(page) {
    return `<header class="sx-top">
      <a class="sx-brand" href="#home" aria-label="Astronomican home"><span class="brand-mark"><span class="brand-orbit"></span><span class="brand-star"></span></span><span class="sx-brand-name">ASTRONOMICAN</span></a>
      <nav class="sx-nav" aria-label="Pages">
        ${NAV.map(([id, label]) => `<a href="#${id}" class="${id === page ? 'active' : ''}" ${id === page ? 'aria-current="page"' : ''}>${navLinkHtml(id, label)}</a>`).join('')}
      </nav>
      <span class="sx-clock" title="Coordinated Universal Time">UTC <b id="utc-clock">${utcNow()}</b></span>
    </header>`;
  }

  function tplSimBar() {
    const events = ENGINE.DATA.events;
    return `<div class="sx-sim" role="group" aria-label="Mission replay clock">
      <span class="sx-sim-label">APOLLO 15 REPLAY</span>
      <button class="btn primary sx-play ${sim.playing ? 'is-playing' : ''}" id="sim-play" type="button" title="Replay the Apollo 15 mission">${I(sim.playing ? 'pause' : 'play', 14)}<span>${sim.playing ? 'Pause' : 'Simulate'}</span></button>
      <div class="sx-get"><span>GET</span><strong id="sim-readout">${AHM.formatGet(sim.hour)}</strong><small id="sim-day">Day ${ENGINE.missionDay(sim.hour) + 1} of ${ENGINE.missionTotalDays()}</small></div>
      <input class="sx-range" id="sim-range" type="range" min="0" max="${TOTAL_HOURS}" step="0.05" value="${sim.hour}" aria-label="Mission time in hours">
      <select class="select-ctl" id="sim-jump" aria-label="Jump to a mission event"><option value="">Jump to Apollo 15 event…</option>${events.map((e) => `<option value="${e.get_hours}">GET ${AHM.formatGet(e.get_hours)} · ${esc(e.title)}</option>`).join('')}</select>
    </div>`;
  }

  /* ------------------------------------------------------------------ *
   * Page: Home (landing)
   * ------------------------------------------------------------------ */

  function pageHome() {
    const ev = ENGINE.DATA.events.length;
    const days = 12; // Apollo 15 flew 12.3 days (295.6 h)
    const words = ['Monitor', 'Detect', 'Explain', 'Act', 'Record', 'Apollo 15 · 1971', 'Real NASA data', 'Every number cited', 'Onboard decision support', 'NASA Space Apps 2026'];
    const track = words.concat(words).map((w) => `<span>${esc(w)}</span>`).join('');
    const tile = (n, href, title, copy, cls) => `<a class="tile-link ${cls || ''}" href="${href}"><span class="tile-no">${n}</span><h3>${title}</h3><p>${copy}</p><span class="tile-go">Open <span aria-hidden="true">→</span></span></a>`;
    const step = (n, t, d) => `<div class="step5"><b>0${n}</b><h3>${t}</h3><p>${d}</p></div>`;
    return `<section class="hero">
        <div>
          <div class="eyebrow"><i aria-hidden="true"></i>NASA SPACE APPS 2026 · HEALTH MONITORING</div>
          <h1>Keep every astronaut <em>healthy</em>, even when Earth is far away.</h1>
          <p class="hero-lead">Astronomican watches vitals, flags what changed, explains it in plain words and tells the crew what to do next. It is tested on Apollo 15's real 1971 medical record, with every figure traced to a source.</p>
          <div class="hero-cta">
            <a class="btn primary" href="#simulation">Replay Apollo 15 <span class="arr" aria-hidden="true">↗</span></a>
            <a class="btn secondary" href="#astronaut">Try the astronaut demo</a>
            <a class="btn secondary" href="#project">Read the project</a>
          </div>
        </div>
        <div class="hero-art" aria-hidden="true">
          <svg viewBox="0 0 400 400">
            <circle class="ring" cx="200" cy="200" r="190"/><circle class="ring dash" cx="200" cy="200" r="150"/><circle class="ring" cx="200" cy="200" r="104"/>
            <path class="arc" d="M200 10A190 190 0 0 1 390 200"/>
            <circle class="planet" cx="200" cy="200" r="58"/>
            <path d="M150 200h24l10-22 18 46 12-24h36" fill="none" stroke="#b9a3ff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
            <g class="sat"><circle cx="390" cy="200" r="7" fill="#8b5cf6"/><circle cx="390" cy="200" r="14" fill="none" stroke="#8b5cf6" stroke-opacity=".4"/></g>
            <g class="sat2"><circle cx="200" cy="50" r="5" fill="#34d399"/></g>
          </svg>
          <div class="hero-readout r2"><span>Status</span><b>Nominal</b></div>
          <div class="hero-readout"><span>Mission</span><b>${days} days</b></div>
        </div>
      </section>
      <div class="ticker" aria-hidden="true"><div class="ticker-track">${track}</div></div>
      <section class="stats" aria-label="Project at a glance">
        <div class="stat"><b>${days}</b><span>Days replayed</span></div>
        <div class="stat"><b>${ev}</b><span>Cited events</span></div>
        <div class="stat"><b>${ENGINE.CREW.length}</b><span>Crew members</span></div>
        <div class="stat"><b>5</b><span>NASA hazards covered</span></div>
      </section>

      <section class="home-sec">
        <div class="sec-head"><div><span class="sn-label">01 — Explore</span><h2>Three ways <em>in</em></h2></div><p>Each page shows only one kind of data, so you always know what you are looking at.</p></div>
        <div class="tiles">
          ${tile('01', '#astronaut', 'Demo astronaut', 'Live vitals, a body map, step-by-step alerts, crewmate notices and a daily check-in.')}
          ${tile('02', '#control', 'Demo mission control', 'All three crew on one board with live alerts and what each astronaut was told.')}
          ${tile('03', '#simulation', 'Apollo 15 simulation', 'Press Simulate and watch the real mission unfold, including the heart-rhythm event.', 'feature')}
        </div>
      </section>

      <section class="home-sec">
        <div class="sec-head"><div><span class="sn-label">02 — Method</span><h2>From signal to <em>action</em></h2></div><p>Monitor, detect, explain, act, record.</p></div>
        <div class="steps5">
          ${step(1, 'Monitor', 'Heart rate, breathing, sleep, dose and a daily self-report.')}
          ${step(2, 'Detect', 'Events and context, not only a number crossing a line.')}
          ${step(3, 'Explain', 'Plain words on what changed and which hazard it relates to.')}
          ${step(4, 'Act', 'Onboard suggestions; Mission Control can send and the crew acknowledges.')}
          ${step(5, 'Record', 'A cited timeline with demo entries kept apart from history.')}
        </div>
      </section>

      <section class="home-sec">
        <div class="sec-head"><div><span class="sn-label">03 — Trust</span><h2>Honest about <em>data</em></h2></div><p>Every value wears a badge that says what kind it is.</p></div>
        <div class="honest">
          <div><span class="ev ev-nasa">NASA source</span><p>Stated in a NASA document and cited.</p></div>
          <div><span class="ev ev-est">Estimated</span><p>Filled in where nothing was reported.</p></div>
          <div><span class="ev ev-sec">Secondary</span><p>Non-NASA narrative, flagged until verified.</p></div>
          <div><span class="ev ev-sim">Simulated</span><p>Generated to show what a modern system adds.</p></div>
          <div><span class="ev ev-live">Live · placeholder</span><p>The datasheet standing in for real sensors.</p></div>
          <div><span class="ev ev-demo">Demo</span><p>Interactive inputs, never mixed into the record.</p></div>
        </div>
      </section>

      <section class="cta-band">
        <h2>Watch a <em>12-day mission</em> unfold in under a minute.</h2>
        <div class="hero-cta" style="margin-top:0"><a class="btn primary" href="#simulation">Start the replay <span class="arr" aria-hidden="true">↗</span></a><a class="btn secondary" href="#references">See the sources</a></div>
      </section>`;
  }

  /* ------------------------------------------------------------------ *
   * Page: Astronaut
   * ------------------------------------------------------------------ */

  function crewChips() {
    return `<div class="sx-chips" role="group" aria-label="Crew member">${ENGINE.CREW.map((c) =>
      `<button class="sx-chip ${c.id === state.crew ? 'active' : ''}" data-act="crew" data-val="${c.id}" type="button" aria-pressed="${c.id === state.crew}"><b>${c.photo_initials}</b><span>${esc(ENGINE.crewShortName(c))}<small>${esc(c.role)}</small></span></button>`).join('')}</div>`;
  }

  function DecisionSupport(s) {
    const acts = ENGINE.advise(s, null);
    const arr = s.assess.alerts.some((a) => /arrhythmia/i.test(a.title));
    const banner = (cls, icon, kicker, body) => `<div class="insight-banner ${cls}"><div class="insight-icon">${I(icon)}</div><div><span>${kicker}</span><strong>${body}</strong></div></div>`;
    return (arr ? banner('', 'orbit', 'WHY ONBOARD DECISION SUPPORT',
        'Houston was about 1.3 s away for this call, so flight surgeons could weigh in live. A Mars crew facing the same event would wait up to about 22 min each way and have to decide alone.') : '')
      + banner(acts.length ? 'is-message' : '', 'spark', 'SUGGESTED ACTION · ONBOARD RULES',
        acts.length ? acts.map(esc).join('<br>') : 'No action needed. Vitals and check-ins are within range.');
  }

  /* ------------------------------------------------------------------ *
   * Body map (interactive avatar) + organ details
   * ------------------------------------------------------------------ */

  const LEVEL = { NOMINAL: 'ok', ATTENTION: 'watch', CRITICAL: 'alert' };
  const LEVEL_WORD = { ok: 'Normal', watch: 'Attention', alert: 'Critical', none: 'No data flagged' };
  const LEVEL_RANK = { none: 0, ok: 1, watch: 2, alert: 3 };
  const LEVEL_TONE = { ok: 'good', watch: 'warn', alert: 'danger', none: 'info' };
  const worse = (a, b) => (LEVEL_RANK[b] > LEVEL_RANK[a] ? b : a);
  const ORGAN_NAMES = { heart: 'Heart and circulation', lungs: 'Lungs and breathing', brain: 'Brain, sleep and mood', msk: 'Bones and muscle', digestive: 'Stomach and gut', kidneys: 'Kidneys and hydration', rad: 'Whole body: radiation and temperature' };

  // A check-in counts for two hours; after that the body map stops using it.
  function recentCheckin(crew) {
    const rows = AHM.readDemoLog().filter((e) => e.type === 'checkin' && e.crewId === crew && Date.now() - e.time < 2 * 3600 * 1000);
    return rows.length ? rows[rows.length - 1] : null;
  }

  const insight = (cls, icon, kicker, body) => `<div class="insight-banner ${cls}"><div class="insight-icon">${I(icon)}</div><div><span>${kicker}</span><strong>${body}</strong></div></div>`;

  // Suggested actions from a self-report only (the Apollo replay has its own advice in engine.js).
  function checkinActions(ci) {
    const out = [];
    if (!ci) return out;
    if (ci.fatigue >= 4) out.push('Fatigue reported: protect the next sleep period and defer non-critical tasks.');
    if (ci.mood <= 2) out.push('Low mood reported: schedule a private call or crew debrief.');
    if (ci.symptoms) out.push('Symptom logged: recheck your vitals in 1 hour and report it if it persists or worsens.');
    return out;
  }

  // What the app flags for each organ right now.
  //   mode 'demo': the live placeholder feed and the latest check-in. No Apollo data.
  //   mode 'sim' : the Apollo 15 replay at the current mission time. No live feed, no check-in.
  function organStates(mode, s) {
    const id = state.crew, hour = sim.hour, isSim = mode === 'sim';
    const ci = isSim ? null : recentCheckin(id);
    const sym = ci && ci.symptoms ? ci.symptoms : '';
    const o = {};
    ['heart', 'lungs', 'brain', 'msk', 'digestive', 'kidneys', 'rad'].forEach((k) => { o[k] = { level: 'none', reasons: [] }; });
    const monitored = isSim ? ['heart', 'lungs', 'brain', 'msk', 'rad'] : ['heart', 'lungs', 'rad'].concat(ci ? ['brain'] : []);
    monitored.forEach((k) => { o[k].level = 'ok'; });
    const flag = (k, level, text) => { o[k].level = worse(o[k].level === 'none' ? 'ok' : o[k].level, level); o[k].reasons.push(text); };
    const evText = (e) => `${esc(e.title)} (GET ${AHM.formatGet(e.get_hours)}) ${evidenceBadge(e)} <small>${cite(e.refs, e.where)}</small>`;
    const symFlag = (k, re, label) => { if (re.test(sym)) flag(k, 'watch', `Check-in symptom: "${esc(sym)}" (${label}) <span class="ev ev-demo">DEMO</span>`); };

    if (isSim) {
      // heart
      if (s.assess.hrLevel !== 'NOMINAL') flag('heart', LEVEL[s.assess.hrLevel], `Heart rate ${fmt0(s.assess.row.heart_rate_bpm)} bpm (${s.assess.row.heart_rate_basis}) is outside the expected band.`);
      activeNotices('astronaut').filter((e) => /arrhythmia/i.test(e.title)).forEach((e) => flag('heart', LEVEL[e.severity === 'CRITICAL' ? 'CRITICAL' : 'ATTENTION'], evText(e)));
      if ((id === 'CDR' || id === 'LMP') && hour >= 295.6) flag('heart', 'watch', `Post-flight exercise test: weaker response at high heart rates, about a week to recover <small>${cite(['apollo15_mr'], 'Section 10.3')}</small>`);
      // lungs
      if (s.assess.rrLevel !== 'NOMINAL') flag('lungs', LEVEL[s.assess.rrLevel], `Breathing rate ${fmt1(s.assess.row.respiration_rate)} per minute (${s.assess.row.respiration_basis}) is outside the expected band.`);
      // brain: real sleep disruption in the last 24 h
      ENGINE.DATA.events.filter((e) => e.category === 'sleep' && hour >= e.get_hours && hour <= e.get_hours + 24).forEach((e) => flag('brain', 'watch', evText(e)));
      // bones and muscle
      ENGINE.DATA.events.filter((e) => /aspirin/i.test(e.title) && (!e.crew_id || e.crew_id === id) && hour >= e.get_hours && hour <= e.get_hours + 24).forEach((e) => flag('msk', 'watch', evText(e)));
      if (id === 'LMP' && hour >= 295.4) flag('msk', 'watch', `Heel-bone mineral change linked to bed-rest results <small>${cite(['apollo15_mr'], 'Section 10.4')}</small>`);
    } else {
      LIVE.active(id).forEach((a) => {
        const k = a.metric === 'resp' ? 'lungs' : a.metric === 'temp' ? 'rad' : 'heart';
        flag(k, a.level, `${esc(a.title)}: ${esc(a.value)} <span class="ev ev-live">LIVE · placeholder feed</span> <small>${cite(a.cite)}</small>`);
      });
      if (ci && ci.fatigue >= 4) flag('brain', 'watch', `Fatigue ${ci.fatigue}/5 reported at check-in <span class="ev ev-demo">DEMO</span>`);
      if (ci && ci.mood <= 2) flag('brain', 'watch', `Mood ${ci.mood}/5 reported at check-in <span class="ev ev-demo">DEMO</span>`);
      symFlag('heart', /palpit|chest|dizz|faint/i, 'heart');
      symFlag('lungs', /breath|cough|wheez/i, 'lungs');
      symFlag('brain', /head|dizz|confus|anxi/i, 'brain');
      symFlag('msk', /back|shoulder|pain|muscle|joint|bone/i, 'bones and muscle');
      symFlag('digestive', /nausea|vomit|stomach|appetite|diarr/i, 'stomach and gut');
      symFlag('kidneys', /urin|kidney|thirst|dehydrat/i, 'kidneys');
    }
    return o;
  }

  const CREW_FACTS = { CDR: { kcal: '2,801', lb: '2.75' }, CMP: { kcal: '2,372', lb: '3' }, LMP: { kcal: '2,568', lb: '5.5' } };

  // Plain-language information per organ. "generic" applies anywhere; "apollo" is only shown in the Apollo 15 Simulation.
  // The text lists possibilities, never a diagnosis.
  const ORGAN_INFO = {
    heart: {
      does: 'Pumps blood around the body. Heart rate, blood pressure and rhythm all describe how hard it is working.',
      generic: () => [
        'A fast rate during exertion is expected. At rest it can reflect pain, stress, fever, dehydration or poor sleep.',
        `High blood pressure can come from stress, pain, stimulants or a medical condition. A reading after rest tells you more than a single reading ${cite(['aha_bp'])}.`,
        'An irregular rhythm such as bigeminy (paired beats with pauses) can have several causes. Flight surgeons decide which; this app cannot diagnose it.',
        `Gravity changes make the body's organs adjust ${cite(['hrp_hazards'])}.`],
      apollo: () => [],
      act: { ok: 'No action needed. Keep your scheduled exercise and drink water.', watch: 'Rest, drink water and re-measure in 15 minutes. Report dizziness or palpitations.', alert: 'Repeat the measurement, limit exertion and contact the flight surgeon now.' }
    },
    lungs: {
      does: 'Move oxygen in and carbon dioxide out.',
      generic: () => [
        `Faster breathing can reflect exertion, anxiety, illness, or changes in cabin air such as higher CO2 ${cite(['ochmo_co2'])}.`,
        'A sensor that has slipped or dried out can look like a change in the body. Check it before worrying.'],
      apollo: () => [`Apollo measured breathing with a chest sensor. Early in the flight the signal shifted because air was trapped in the electrode sponges; the crew vented them ${cite(['apollo15_mr'], 'Section 10.1')}.`],
      act: { ok: 'No action needed.', watch: 'Re-check the sensor, then re-measure at rest. Check cabin air if others feel the same.', alert: 'Contact the flight surgeon and check cabin air quality.' }
    },
    brain: {
      does: 'Controls alertness, mood and sleep.',
      generic: () => [
        'Short or shifted sleep lowers alertness and mood.',
        `Isolation and confinement is one of NASA's five spaceflight hazards ${cite(['hrp_hazards'])}.`,
        'Low mood or high fatigue at check-in is a prompt to talk to someone, not a diagnosis.'],
      apollo: () => [`Apollo 15's lunar crew worked on their physiological reserves after displaced sleep ${cite(['apollo15_mr'], 'Section 10.2.3')}.`],
      act: { ok: 'Keep a regular sleep schedule and stay in contact with the crew.', watch: 'Protect the next sleep period, defer non-critical tasks and talk with a crewmate.', alert: 'Tell the flight surgeon or behavioural-health support today.' }
    },
    msk: {
      does: 'Bones, joints and muscles. They adapt, and can weaken, in low gravity.',
      generic: () => [
        'Pain or soreness after a strain is worth reporting early.',
        `On long missions bone loss can be larger; gravity fields are one of the five hazards ${cite(['hrp_hazards'])}.`],
      apollo: () => [
        `Scott strained his right shoulder during deep-core drilling and took aspirin ${cite(['apollo15_mr'], 'Sections 10.2.2 and 10.3')}.`,
        `Bone-mineral scans after the flight found essentially no radius change; the report links the Lunar Module Pilot's heel-bone change to bed-rest results ${cite(['apollo15_mr'], 'Section 10.4')}.`],
      act: { ok: 'Keep your scheduled exercise sessions.', watch: 'Note the pain, rest the area and report it at the next conference with the flight surgeon.', alert: 'Report the injury to the flight surgeon now and avoid loading the area.' }
    },
    digestive: {
      does: 'Digests food and absorbs nutrients.',
      generic: () => ['Nutrition is one of the problems the challenge brief lists. Nausea, poor appetite or weight loss would be worth reporting.'],
      apollo: (id) => [`Apollo 15 recorded no stomach or gut problem. ${shortName(id)} averaged ${CREW_FACTS[id].kcal} kcal per day ${cite(['apollo15_mr'], 'Section 10.2.7')} and lost ${CREW_FACTS[id].lb} lb by the post-flight exam ${cite(['apollo15_mr'], 'Section 10.3')}.`],
      act: { ok: 'No action needed. Eat the planned meals.', watch: 'Log what you ate and how you feel, and report it if it lasts.', alert: 'Contact the flight surgeon.' }
    },
    kidneys: {
      does: 'Filter blood and balance water and salts.',
      generic: () => ['Low fluid intake can strain the heart and kidneys.', 'There is no kidney measurement in this prototype, so this region shows "no data flagged" rather than "normal".'],
      apollo: () => [`The Apollo 15 report records in-suit drinking-water failures during the moonwalks, including the Lunar Module Pilot's device not delivering water ${cite(['apollo15_mr'], 'Section 10.2.6')}.`],
      act: { ok: 'Drink on schedule.', watch: 'Drink water, log the symptom and report it if it lasts.', alert: 'Contact the flight surgeon.' }
    },
    rad: {
      does: 'Radiation and body temperature affect the whole body, so they are shown here instead of on one organ.',
      generic: () => [
        `Space radiation is one of the five hazards ${cite(['hrp_hazards'])}.`,
        `A raised temperature can be an early sign of illness, which spreads easily in a closed cabin ${cite(['hrp_hazards'])}; the live bands follow ${citeText(['nlm_temp'])}.`],
      apollo: () => [`Personal dosimeters read 360 mrad (Commander) and 510 mrad (Lunar Module Pilot); passive dosimeters averaged 300 mrad, below the level of detectable medical effects ${cite(['apollo15_mr'], 'Section 10.2.4')}. The dose curve on the dose tile is modeled; only the totals are reported.`],
      act: { ok: 'No action needed.', watch: 'Re-measure after resting. Follow the numbered steps in the alert if one is open.', alert: 'Contact the flight surgeon.' }
    }
  };

  function organDetail(key, organs, mode, s) {
    const info = ORGAN_INFO[key], o = organs[key], isSim = mode === 'sim';
    let act;
    if (isSim) {
      const acts = key === 'heart' ? ENGINE.advise(s, null) : [];
      act = acts.length ? acts.map(esc).join('<br>') : info.act[o.level === 'none' ? 'ok' : o.level];
    } else {
      const liveNow = LIVE.active(state.crew).some((a) => (key === 'heart' && (a.metric === 'hr' || a.metric === 'bp')) || (key === 'lungs' && a.metric === 'resp') || (key === 'rad' && a.metric === 'temp'));
      act = (liveNow ? 'A live alert is open: follow the numbered steps in the Live vitals panel above. ' : '') + info.act[o.level === 'none' ? 'ok' : o.level];
    }
    const means = info.generic().concat(isSim ? info.apollo(state.crew) : []);
    const empty = o.level === 'none'
      ? (isSim ? 'Nothing recorded for this region in the Apollo 15 data.' : 'No live sensor feeds this region yet. A check-in symptom would flag it.')
      : 'Nothing flagged at this time.';
    return `<div class="card sx-organ st-${o.level}" id="organ-detail">
      <div class="sx-organ-head"><div><span class="card-kicker">BODY DETAIL · ${isSim ? 'APOLLO 15 SIMULATION' : 'DEMO'} · ${esc(crewMember().name.toUpperCase())}</span><h3>${ORGAN_NAMES[key]}</h3></div>${StatusPill(LEVEL_WORD[o.level], LEVEL_TONE[o.level])}</div>
      <p class="sx-organ-does">${info.does}</p>
      <h5>Right now</h5>
      ${o.reasons.length ? `<ul class="sx-list">${o.reasons.map((r) => `<li>${r}</li>`).join('')}</ul>` : `<p class="sx-note">${empty}</p>`}
      <h5>What it might mean</h5>
      <ul class="sx-list">${means.map((m) => `<li>${m}</li>`).join('')}</ul>
      <h5>What to do</h5>
      <p>${act}</p>
      <small class="sx-note">These are possibilities for learning, not a diagnosis. Follow your flight surgeon.</small>
    </div>`;
  }

  function avatarCard(o, shown) {
    const grp = (key, shapes, labelHtml) => `<g class="org st-${o[key].level}${shown === key ? ' selected' : ''}" data-act="organ" data-val="${key}" role="button" tabindex="0" aria-pressed="${shown === key}" aria-label="${ORGAN_NAMES[key]}: ${LEVEL_WORD[o[key].level]}">${shapes}${labelHtml}</g>`;
    const lab = (text, x, y, anchor, x1, x2) => `<line class="lead" x1="${x1}" y1="${y}" x2="${x2}" y2="${y}"></line><text class="lbl" x="${x}" y="${y + 4}" text-anchor="${anchor}">${text}</text>`;
    const limbs = '<path class="shape" d="M108 118 Q80 126 72 162 L62 252 Q60 270 74 270 Q87 270 89 254 L101 178 Z"></path><path class="shape" d="M232 118 Q260 126 268 162 L278 252 Q280 270 266 270 Q253 270 251 254 L239 178 Z"></path>'
      + '<path class="shape" d="M104 282 Q136 294 168 286 L162 410 Q160 450 146 458 L124 458 Q112 452 114 412 Z"></path><path class="shape" d="M236 282 Q204 294 172 286 L178 410 Q180 450 194 458 L216 458 Q228 452 226 412 Z"></path>'
      + '<circle class="joint" cx="112" cy="124" r="5"></circle><circle class="joint" cx="228" cy="124" r="5"></circle><circle class="joint" cx="132" cy="296" r="5"></circle><circle class="joint" cx="208" cy="296" r="5"></circle><circle class="joint" cx="138" cy="392" r="5"></circle><circle class="joint" cx="202" cy="392" r="5"></circle>';
    const svg = `<svg class="sx-body" viewBox="0 0 340 470" role="group" aria-label="Interactive body map. Select an organ for details.">
      <g class="sil"><ellipse cx="170" cy="52" rx="32" ry="38"></ellipse><rect x="157" y="86" width="26" height="24" rx="6"></rect>
        <path d="M110 112 Q170 96 230 112 Q242 130 240 190 L236 292 Q170 312 104 292 L100 190 Q98 130 110 112 Z"></path></g>
      ${grp('msk', limbs, lab('Bones &amp; muscle', 332, 360, 'end', 226, 262))}
      ${grp('kidneys', '<ellipse class="shape" cx="138" cy="232" rx="9" ry="15" transform="rotate(-14 138 232)"></ellipse><ellipse class="shape" cx="202" cy="232" rx="9" ry="15" transform="rotate(14 202 232)"></ellipse>', lab('Kidneys', 8, 232, 'start', 62, 128))}
      ${grp('lungs', '<path class="shape" d="M164 120 C150 116 124 124 122 160 C120 190 126 206 144 204 C158 202 164 190 164 170 Z"></path><path class="shape" d="M176 120 C190 116 216 124 218 160 C220 190 214 206 196 204 C182 202 176 190 176 170 Z"></path>', lab('Lungs', 8, 150, 'start', 52, 124))}
      ${grp('heart', '<path class="shape" d="M164 200 C144 180 138 164 148 154 C156 146 164 154 164 160 C164 154 172 146 180 154 C190 164 184 180 164 200 Z"></path>', lab('Heart', 332, 176, 'end', 182, 292))}
      ${grp('digestive', '<path class="shape" d="M178 214 C198 208 212 222 206 240 C200 256 184 250 178 258 C170 250 170 228 178 214 Z"></path><path class="shape thick" d="M132 266 C132 250 208 250 208 266 C208 278 132 276 132 288"></path>', lab('Stomach &amp; gut', 332, 246, 'end', 214, 232))}
      ${grp('brain', '<path class="shape" d="M142 46 C140 28 156 20 170 22 C184 20 200 28 198 46 C202 60 188 68 170 68 C152 68 138 60 142 46 Z"></path><path class="fold" d="M170 24 V66"></path>', lab('Brain', 8, 46, 'start', 52, 140))}
    </svg>`;
    return `<div class="card sx-avatar">
      <div class="card-head"><div><span class="card-kicker">BODY MAP</span><strong>Tap an organ for details</strong></div></div>
      ${svg}
      <button class="sx-rad st-${o.rad.level}${shown === 'rad' ? ' selected' : ''}" data-act="organ" data-val="rad" type="button">Whole body · radiation &amp; temperature <b>${LEVEL_WORD[o.rad.level]}</b></button>
      <ul class="sx-legend" aria-label="Colour key"><li><i class="st-alert"></i>Critical</li><li><i class="st-watch"></i>Attention</li><li><i class="st-ok"></i>Normal</li><li><i class="st-none"></i>No data flagged</li></ul>
    </div>`;
  }

  const VitalTile = ({ label, value, unit, status, note, icon }) => `<div class="sx-tile ${status}">
    <div class="metric-icon ${status}">${I(icon)}</div>
    <div class="sx-tile-body"><span>${esc(label)}</span><strong>${esc(value)}<small>${esc(unit)}</small></strong><em>${esc(note)}</em></div>
    ${StatusPill(status === 'danger' ? 'Alert' : status === 'warn' ? 'Monitor' : 'Normal', status)}</div>`;

  const ORGAN_ORDER = ['heart', 'lungs', 'brain', 'msk', 'digestive', 'kidneys', 'rad'];
  function pickShown(organs) {
    const severe = ORGAN_ORDER.reduce((best, k) => (LEVEL_RANK[organs[k].level] > LEVEL_RANK[organs[best].level] ? k : best), 'heart');
    return state.organ || severe;
  }
  function demoCtx() { const organs = organStates('demo'); return { organs, shown: pickShown(organs) }; }
  function simCtx() { const s = ENGINE.crewSnapshot(state.crew, sim.hour); const organs = organStates('sim', s); return { s, organs, shown: pickShown(organs) }; }

  const sideHtml = (c) => avatarCard(c.organs, c.shown);

  /* ---- live vitals (placeholder feed) + alert panel ---- */

  const liveTone = (l) => (l === 'ok' ? 'good' : l === 'watch' ? 'warn' : 'danger');

  function liveAlertCard(a, mc) {
    const key = 'live-' + a.id, done = mc && reviewed.has(key);
    const notified = a.notified.map((p) => `${LIVE.NAMES[p.crew]} ${p.seen ? 'saw it' : 'waiting'}`).join(' · ');
    return `<div class="card sx-livealert ${a.level === 'alert' ? 'critical' : 'warn'} ${done ? 'reviewed' : ''}">
      <div class="sx-alert-head">${StatusPill(a.level === 'alert' ? 'Alert' : 'Attention', a.level === 'alert' ? 'danger' : 'warn')}<strong>${esc(LIVE.NAMES[a.crew])}: ${esc(a.title)}</strong><span class="ev ev-live">LIVE · placeholder feed</span><small>${esc(a.value)} · ${esc(a.category)}</small></div>
      <span class="card-kicker">${mc ? 'WHAT THE ASTRONAUT WAS TOLD' : 'WHAT TO DO NOW'}</span>
      <ol class="sx-steps">${a.steps.map((st) => `<li>${esc(st)}</li>`).join('')}</ol>
      <div class="sx-alert-act"><div><span class="card-kicker">CREWMATES NOTIFIED</span><strong>${esc(notified)}</strong></div>
        <div class="sx-btns">${mc
          ? `<button class="btn secondary compact" data-act="review" data-key="${key}" type="button" ${done ? 'disabled' : ''}>${done ? 'Reviewed' : 'Mark reviewed'}</button>`
          : `<button class="btn ${a.ack ? 'secondary' : 'primary'} compact" data-act="live-ack" data-id="${a.id}" type="button" ${a.ack ? 'disabled' : ''}>${a.ack ? 'Acknowledged' : 'I am doing this'}</button>`}</div></div>
      <small class="ev-cite">${a.cite.length ? `Rule source: ${cite(a.cite)}` : 'Rule: this app\'s own band (see References)'}</small>
    </div>`;
  }

  function feedHtml() {
    const smp = LIVE.latest(state.crew);
    if (!smp) return '';
    const f = LIVE.rate(smp);
    const active = LIVE.active(state.crew);
    const notices = LIVE.notices(state.crew);
    const tile = (label, value, unit, icon, r) => MetricCard({ label, value, unit, icon, status: liveTone(r.level), change: r.category });
    return `<section class="sx-live" aria-label="Live vitals">
        <div class="sx-live-head">
          <div><span class="live-dot" aria-hidden="true"></span><span class="card-kicker">LIVE VITALS · ${esc(crewMember().name.toUpperCase())}</span></div>
          <small>Placeholder datasheet · a new reading every ${Math.round(LIVE.intervalMs / 1000)} s · reading #${LIVE.count() + 1}</small>
          <button class="btn secondary compact" data-act="skip-alert" type="button">Demo: jump to next alert</button>
        </div>
        <div class="sx-grid4">
          ${tile('Heart rate', fmt0(smp.hr), ' bpm', 'heart', f.hr)}
          ${tile('Blood pressure', `${fmt0(smp.sys)}/${fmt0(smp.dia)}`, ' mmHg', 'activity', f.bp)}
          ${tile('Breathing', fmt1(smp.resp), ' /min', 'bolt', f.resp)}
          ${tile('Temperature', fmt1(smp.temp), ' °C', 'thermometer', f.temp)}
        </div>
        ${active.map((a) => liveAlertCard(a, false)).join('')}
        ${notices.map((n) => `<div class="sx-msg ${n.kind === 'resolved' ? 'is-ok' : ''}"><div>${I('send', 18)}</div><div><span class="card-kicker">CREW NOTICE · FROM ${esc(LIVE.NAMES[n.from].toUpperCase())} · PLACEHOLDER FEED</span><strong>${esc(n.text)}</strong></div><button class="btn primary compact" data-act="notice-ack" data-id="${n.id}" type="button">${I('check', 14)} Got it</button></div>`).join('')}
        ${!active.length && !notices.length ? '<p class="sx-note sx-allclear">No live alerts. Your live vitals are in range, and your crewmates will be told if that changes.</p>' : ''}
      </section>`;
  }

  // Demo Astronaut, below the live panel: organ detail and any suggestions from the latest check-in.
  function demoBody(c) {
    const acts = checkinActions(recentCheckin(state.crew));
    return `${acts.length ? insight('is-message', 'spark', 'SUGGESTED ACTION · FROM YOUR CHECK-IN', acts.map(esc).join('<br>')) : ''}
      ${organDetail(c.shown, c.organs, 'demo')}`;
  }

  // Apollo 15 Simulation: everything that depends on the replay clock.
  function simBody(c) {
    const { s, organs, shown } = c;
    const [title, copy] = ENGINE.scoreCopy(s.score);
    const alerts = activeNotices('astronaut');
    const hr = ENGINE.series(state.crew, sim.hour, 48, 'heart_rate_bpm');
    const tone = s.score >= 90 ? 'good' : s.score >= 75 ? '' : s.score >= 55 ? 'is-warn' : 'is-danger';
    const surfaceSleep = AHM.eventsUpTo(ENGINE.DATA.events, sim.hour).filter((e) => e.category === 'sleep').pop();
    const dose = s.modern.doseMrad;
    const log = eventsSoFar('control').slice(-8).reverse();
    return `<div class="card sx-status ${tone}">
        <div class="score-ring" style="--ring-p:${s.score};${s.score < 90 ? '--ring-c:var(--orange)' : ''}"><div><strong>${s.score}</strong><span>/ 100</span></div></div>
        <div class="sx-status-copy">
          <span class="card-kicker">${esc(crewMember().name.toUpperCase())} · GET ${AHM.formatGet(sim.hour)}</span>
          <h2>${title}</h2>
          <p>${copy}</p>
          ${StatusPill(alerts.length ? `${alerts.length} active notice${alerts.length > 1 ? 's' : ''}` : 'All systems nominal', alerts.length ? 'warn' : 'good')}
          <small class="sx-note">The score is this app's own measure (replayed heart-rate and breathing bands plus active events, see engine.js), not a NASA score.</small>
        </div>
      </div>
      <h3 class="sx-h3">Alerts at this moment <small>all crew</small></h3>
      ${controlAlerts()}
      <section class="sx-grid2">
        ${VitalTile({ label: 'Radiation dose', value: fmt1(dose * 0.01), unit: ' mSv', icon: 'orbit', status: 'good', note: `Modeled · real total ${fmt0(s.modern.doseEndpointMrad)} mrad` })}
        ${VitalTile({ label: 'Latest sleep period', value: surfaceSleep ? surfaceSleep.title.replace(/ lunar-surface sleep period/, ' surface sleep') : 'None yet', unit: '', icon: 'moon', status: surfaceSleep ? 'warn' : 'good', note: surfaceSleep ? 'Displaced · crew-reported' : 'Before lunar landing' })}
      </section>
      ${DecisionSupport(s)}
      ${organDetail(shown, organs, 'sim', s)}
      ${ChartCard({ kicker: 'HEART RATE', label: `${crewMember().name} · last 48 hours`, meta: `AVG ${fmt0(ENGINE.avg(hr))} BPM · shaded = moonwalk`, body: LineChart({ color: 'cyan', points: hr, eva: AHM.EVA_WINDOWS }) })}
      <p class="sx-note">The averages NASA reported are ${cite(['apollo15_mr'], 'Section 10.1')}; the line between them is interpolated, and values with no report (for example Worden's heart rate) are estimated.</p>
      <h3 class="sx-h3">All crew at this moment</h3>
      <div class="card sx-board">${ENGINE.allCrewSnapshots(sim.hour).map((sn) => crewRowSim(sn, crewById(sn.crewId))).join('')}</div>
      <h3 class="sx-h3">Mission log <small>${eventsSoFar('control').length} of ${ENGINE.DATA.events.length} events so far</small></h3>
      <ul class="ev-list">${log.map((e) => EventItem(e, true)).join('') || '<li class="empty">Nothing yet. Press Simulate or drag the clock.</li>'}</ul>
      ${ModernLayer(s)}
      ${LimitsBlock()}`;
  }

  function ModernLayer(s) {
    const m = s.modern;
    return `<details class="sx-details" data-key="modern" ${state.open.modern ? 'open' : ''}>
      <summary><span>Modern monitoring layer</span><span class="ev ev-sim">SIMULATED · not measured on Apollo 15</span></summary>
      <p class="sx-note">Apollo's body sensors measured only heart rhythm (ECG) and breathing. Today's wearables add the signals below. These numbers are generated by this app to show what a current system would add.</p>
      <section class="sx-grid4">
        ${MetricCard({ label: 'Blood pressure (est.)', value: `${fmt0(m.systolicBp)}/${fmt0(m.systolicBp - 40)}`, unit: 'mmHg', icon: 'activity', status: 'good', change: 'Simulated' })}
        ${MetricCard({ label: 'Oxygen saturation (est.)', value: fmt1(m.spo2), unit: '%', icon: 'spark', status: 'good', change: 'Simulated' })}
        ${MetricCard({ label: 'Skin temperature (est.)', value: fmt1(m.skinTemp), unit: '°C', icon: 'thermometer', status: 'good', change: 'Simulated' })}
        ${MetricCard({ label: 'Sleep quality (est.)', value: fmt0(m.sleepQuality), unit: '/100', icon: 'moon', status: m.sleepQuality >= 70 ? 'good' : 'warn', change: 'Simulated' })}
      </section>
    </details>`;
  }

  function LimitsBlock() {
    const rows = [
      ['Bone loss', `Apollo 15 has only before-and-after scans over 12 days ${citeText(['apollo15_mr'], 'Section 10.4')}. Long missions can lose more; see the gravity-fields hazard ${citeText(['hrp_hazards'])}.`],
      ['Eye and brain pressure (SANS)', 'Builds over months on the ISS. A 12-day flight is far too short to show it.'],
      ['Immune changes', 'Need weeks to months of exposure and lab work. Apollo 15 has no usable in-flight record.'],
      ['Isolation and confinement', 'Effects grow with duration. A 12-day mission with a 1.3 s link barely tests them.'],
    ];
    return `<details class="sx-details" data-key="limits" ${state.open.limits ? 'open' : ''}>
      <summary><span>What this 12-day replay cannot show</span></summary>
      ${rows.map(([t, d]) => `<div class="sx-row"><strong>${t}</strong><span>${d}</span></div>`).join('')}
    </details>`;
  }

  function checkinBlock() {
    const rows = AHM.readDemoLog().filter((e) => e.type === 'checkin' && (!e.crewId || e.crewId === state.crew)).slice(-3).reverse();
    const slider = (f, label) => `<div class="slider-row"><span>${label}</span><input type="range" min="1" max="5" value="3" data-f="${f}" aria-label="${label}"><span class="val">3</span></div>`;
    return `<h3 class="sx-h3">Daily check-in <span class="ev ev-demo">DEMO</span></h3>
      <p class="sx-note">Apollo crews did not fill in a daily survey; modern crews do. A check-in colours the body map for two hours and can add a suggested action.</p>
      <div class="card composer">
        ${slider('mood', 'Mood (1 low – 5 high)')}${slider('fatigue', 'Fatigue (1–5)')}
        <div class="field"><span>Symptoms (optional)</span><textarea id="ci-sym" placeholder="e.g. palpitations, headache, nausea"></textarea></div>
        <div class="field"><span>Dosimeter reading, mSv (optional)</span><input id="ci-dose" type="number" min="0" step="0.1"></div>
        <button class="btn primary" id="ci-save" type="button">${I('check', 14)} Log check-in</button>
      </div>
      ${rows.length ? `<ul class="ev-list">${rows.map((e) => `<li class="ev-item"><div class="ev-time">${new Date(e.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div><div class="ev-main"><div class="ev-title"><strong>Mood ${e.mood}/5 · Fatigue ${e.fatigue}/5${e.dose != null ? ` · ${e.dose} mSv` : ''}</strong><span class="ev ev-demo">DEMO</span></div>${e.symptoms ? `<p>${esc(e.symptoms)}</p>` : ''}</div></li>`).join('')}</ul>` : ''}`;
  }

  function pageAstronaut() {
    const c = demoCtx();
    return `<section class="sx-head">
        <div><div class="eyebrow">01 · DEMO ASTRONAUT</div><h1>Your health, <em>at a glance</em></h1>
        <p>Live vitals come from a placeholder datasheet that updates every 3 seconds, standing in for real sensors. This page uses no Apollo 15 data; open <a href="#simulation">Apollo 15 Simulation</a> for the mission replay.</p></div>
      </section>
      <div class="sx-controls">${crewChips()}</div>
      <div class="sx-split">
        <aside class="sx-side" aria-label="Body map"><div id="side-body">${sideHtml(c)}</div></aside>
        <div class="sx-main">
          <div id="feed-body">${feedHtml()}</div>
          <div id="live-body">${demoBody(c)}</div>
        </div>
      </div>
      <section id="checkin-body">${checkinBlock()}</section>`;
  }

  function pageSimulation() {
    const c = simCtx();
    return `<section class="sx-head">
        <div><div class="eyebrow">03 · APOLLO 15 SIMULATION · REAL 1971 RECORD</div><h1>Replay the <em>mission</em></h1>
        <p>Press Simulate to replay Apollo 15's real biomedical record. Status, alerts, the body map and the log all follow the mission clock. The live demo feed is not used here.</p></div>
      </section>
      <div class="sx-controls">${crewChips()}${tplSimBar()}</div>
      <div class="sx-split">
        <aside class="sx-side" aria-label="Body map"><div id="side-body">${sideHtml(c)}</div></aside>
        <div class="sx-main"><div id="live-body">${simBody(c)}</div></div>
      </div>`;
  }

  /* ------------------------------------------------------------------ *
   * Page: Demo Mission Control (live placeholder feed only)
   * ------------------------------------------------------------------ */

  // Apollo replay row: replay numbers only.
  function crewRowSim(s, c) {
    const level = LEVEL[s.assess.overall] || 'ok';
    return `<div class="sx-crew">
      <div class="crew-avatar">${c.photo_initials}</div>
      <div class="sx-crew-name"><strong>${esc(c.name)}</strong><span>${esc(c.role)}</span></div>
      ${StatusPill(overallWord(s.assess.overall), LEVEL_TONE[level])}
      <div class="sx-crew-num"><small>HEART RATE</small><strong>${fmt0(s.assess.row.heart_rate_bpm)}<span> bpm</span></strong></div>
      <div class="sx-crew-num"><small>BREATHING</small><strong>${fmt1(s.assess.row.respiration_rate)}<span> /min</span></strong></div>
      <div class="sx-crew-num"><small>SCORE</small><strong>${s.score}</strong></div>
      <button class="btn secondary compact" data-act="crew" data-val="${c.id}" type="button">Show</button>
    </div>`;
  }

  // Demo row: live placeholder numbers only.
  function crewRowLive(c) {
    const smp = LIVE.latest(c.id), live = LIVE.active(c.id);
    const level = live.length ? live[0].level : 'ok';
    const word = level === 'alert' ? 'Alert' : level === 'watch' ? 'Attention' : 'In range';
    return `<div class="sx-crew">
      <div class="crew-avatar">${c.photo_initials}</div>
      <div class="sx-crew-name"><strong>${esc(c.name)}</strong><span>${esc(c.role)}</span></div>
      ${StatusPill(word, LEVEL_TONE[level])}
      <div class="sx-crew-num"><small>HEART RATE</small><strong>${smp ? fmt0(smp.hr) : '-'}<span> bpm</span></strong></div>
      <div class="sx-crew-num"><small>BLOOD PRESSURE</small><strong>${smp ? fmt0(smp.sys) + '/' + fmt0(smp.dia) : '-'}</strong></div>
      <div class="sx-crew-num"><small>BREATHING</small><strong>${smp ? fmt1(smp.resp) : '-'}<span> /min</span></strong></div>
      <div class="sx-crew-num"><small>TEMPERATURE</small><strong>${smp ? fmt1(smp.temp) : '-'}<span> °C</span></strong></div>
      <button class="btn secondary compact" data-act="open-crew" data-val="${c.id}" type="button">Astronaut view</button>
    </div>`;
  }

  const alertKey = (e) => String(e.get_hours);

  // Apollo 15 replay alerts for all crew, with the recommend / acknowledge exchange (demo messages).
  function controlAlerts() {
    const items = activeNotices('control');
    if (!items.length) return '<div class="empty">No alerts at this mission time. Jump to GET 178:00 to see the real heart-rhythm event.</div>';
    return items.map((e) => {
      const c = e.crew_id ? crewById(e.crew_id) : null;
      const snap = c ? ENGINE.crewSnapshot(c.id, sim.hour) : null;
      const rec = (snap && ENGINE.advise(snap, null)[0]) || 'Repeat the vitals check, limit exertion and report any symptoms.';
      const sent = c ? AHM.readDemoLog().find((m) => m.type === 'message' && m.alertKey === alertKey(e) && m.crewId === c.id) : null;
      const done = reviewed.has(alertKey(e));
      let sentHtml = '';
      if (c && !sent) sentHtml = `<button class="btn primary compact" data-act="send-rec" data-key="${alertKey(e)}" data-crew="${c.id}" type="button">${I('send', 14)} Send to ${esc(ENGINE.crewShortName(c))}</button>`;
      else if (sent && !sent.acknowledged) sentHtml = `<span class="pill info"><span></span>Sent (demo) · waiting</span><button class="btn primary compact" data-act="ack" data-id="${esc(sent.id)}" data-crew="${c.id}" type="button">${I('check', 14)} Acknowledge as ${esc(ENGINE.crewShortName(c))}</button>`;
      else if (sent) sentHtml = '<span class="pill good"><span></span>Acknowledged (demo)</span>';
      return `<div class="card sx-alert ${e.severity === 'CRITICAL' ? 'critical' : 'warn'} ${done ? 'reviewed' : ''}">
        <div class="sx-alert-head">${StatusPill(e.severity === 'CRITICAL' ? 'Critical' : 'Warning', e.severity === 'CRITICAL' ? 'danger' : 'warn')}<strong>${esc(e.title)}</strong>${evidenceBadge(e)}<small>GET ${AHM.formatGet(e.get_hours)}</small></div>
        <p>${esc(e.detail)}</p>
        <small class="ev-cite">Source: ${e.refs && e.refs.length ? cite(e.refs, e.where) : 'estimated'}</small>
        <div class="sx-alert-act"><div><span class="card-kicker">RECOMMENDED ACTION</span><strong>${esc(rec)}</strong></div>
          <div class="sx-btns">${sentHtml}
            <button class="btn secondary compact" data-act="review" data-key="${alertKey(e)}" type="button" ${done ? 'disabled' : ''}>${done ? 'Reviewed' : 'Mark reviewed'}</button>
          </div></div>
      </div>`;
    }).join('');
  }

  function controlLive() {
    const liveAll = LIVE.allActive();
    const stamp = (t) => new Date(t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    return `<h3 class="sx-h3">Crew status <small>placeholder live feed</small></h3>
      <div class="card sx-board">${ENGINE.CREW.map((c) => crewRowLive(c)).join('')}</div>
      <h3 class="sx-h3">Live alerts</h3>
      ${liveAll.length ? liveAll.map((a) => liveAlertCard(a, true)).join('') : '<div class="empty">No live alerts. Open Demo Astronaut and press "Demo: jump to next alert" to see one.</div>'}
      <h3 class="sx-h3">Live heart rate by crew <small>last 30 readings, one every ${Math.round(LIVE.intervalMs / 1000)} s</small></h3>
      <section class="sx-grid3">${ENGINE.CREW.map((c) => {
        const pts = LIVE.history(c.id).map((r, i) => ({ x: i, y: r.hr }));
        const latest = LIVE.latest(c.id);
        return ChartCard({ kicker: ENGINE.crewShortName(c).toUpperCase(), label: c.role, meta: latest ? `NOW ${fmt0(latest.hr)} BPM` : '', body: LineChart({ color: c.id === 'LMP' ? 'orange' : c.id === 'CMP' ? 'violet' : 'cyan', points: pts }) });
      }).join('')}</section>
      <h3 class="sx-h3">Live alert log</h3>
      <ul class="ev-list">${LIVE.log().map((l) => `<li class="ev-item ${l.level === 'alert' ? 'critical' : l.level === 'watch' ? 'warn' : ''}"><div class="ev-time">${stamp(l.ts)}</div><div class="ev-main"><div class="ev-title"><strong>${esc(l.text)}</strong><span class="ev ev-live">LIVE · placeholder feed</span></div></div></li>`).join('') || '<li class="empty">No alerts yet. The placeholder datasheet raises one within about two minutes.</li>'}</ul>`;
  }

  function pageControl() {
    return `<section class="sx-head">
        <div><div class="eyebrow">02 · DEMO MISSION CONTROL</div><h1>The whole crew, <em>one screen</em></h1>
        <p>Flight surgeons see all three astronauts' live vitals, the alerts that opened and what each astronaut was told. The numbers are a placeholder datasheet; the Apollo 15 mission lives on <a href="#simulation">Apollo 15 Simulation</a>.</p></div>
      </section>
      <div id="live-body">${controlLive()}</div>`;
  }

  /* ------------------------------------------------------------------ *
   * Page: Project (detailed description)
   * ------------------------------------------------------------------ */

  function pageProject() {
    const ev = ENGINE.DATA.events.length;
    const step = (n, t, d) => `<div class="card sx-step"><span class="sx-num">${n}</span><strong>${t}</strong><p>${d}</p></div>`;
    const kind = (cls, name, d) => `<div class="sx-row"><span class="ev ${cls}">${name}</span><span>${d}</span></div>`;
    const tr = (a, b, c) => `<tr><td><strong>${a}</strong></td><td>${b}</td><td>${c}</td></tr>`;
    return `<section class="sx-head"><div><div class="eyebrow">04 · NASA SPACE APPS CHALLENGE 2026</div>
        <h1>Project <em>description</em></h1>
        <p>Astronomican is a health-monitoring prototype for astronauts and the flight surgeons who support them. It explains what it sees, suggests what to do, and shows where every number comes from.</p></div></section>

      <section class="sx-block"><h2><span class="sx-sn">01</span>The challenge</h2>
        <p>Long missions expose astronauts to the five hazards NASA's Human Research Program has mapped: space radiation, isolation and confinement, distance from Earth, gravity fields, and hostile closed environments ${cite(['hrp_hazards'])}. These can bring immune changes, bone loss, cardiovascular events and behavioural-health problems. On long missions astronauts carry much of the responsibility for spotting such changes in themselves, so the brief asks for software that gathers health indicators and helps the astronaut evaluate and act on them ${cite(['challenge2026'])}.</p></section>

      <section class="sx-block"><h2><span class="sx-sn">02</span>Our approach in one line</h2>
        <p><strong>Monitor, detect, explain, act, record</strong>, using a real mission as the test case instead of an invented scenario.</p>
        <div class="sx-grid5">
          ${step(1, 'Monitor', 'Gather the indicators a crew has: heart rate, breathing, sleep, dose, and a daily self-report.')}
          ${step(2, 'Detect', 'Flag a change using events and bands, not only a number crossing a line.')}
          ${step(3, 'Explain', 'Say in plain words what was seen, which hazard it relates to, and where the information comes from.')}
          ${step(4, 'Act', 'Suggest an onboard action; Mission Control can send a recommendation that the crew acknowledges.')}
          ${step(5, 'Record', 'Keep a cited timeline, with demo entries kept apart from the historical record.')}
        </div></section>

      <section class="sx-block"><h2><span class="sx-sn">03</span>Why Apollo 15</h2>
        <p>Apollo 15 was a 12.3-day mission with a three-person crew ${cite(['apollo15_mr'], 'Section 10')}. Its medical record is public, so every figure in this replay can be traced to a document. The prototype loads ${ev} dated events: moonwalks, sleep, medication, radiation and post-flight findings.</p>
        <p>The most useful event is one the official medical summary does not describe: after the Lunar Module lifted off the Moon, flight surgeons saw an abnormal rhythm on Lunar Module Pilot James Irwin's ECG ${cite(['sp368', 'wiki_return15'])}. The worry was the <em>rhythm</em> (paired beats with pauses), not a high heart rate. A monitor that only checks a rate threshold would not have described it. That is why status here is driven by documented events and context, such as moonwalk exertion being expected, rather than by rate alone.</p>
        <p>The sources for this one event are mostly secondary (see the badge on the event), so it is labelled and listed under "still to verify" on the <a href="#references">References</a> page.</p></section>

      <section class="sx-block"><h2><span class="sx-sn">04</span>What you can do in the app</h2>
        <p>The demo and the Apollo 15 data are kept on separate pages, so you always know which one you are looking at.</p>
        <div class="sx-row"><strong>Demo Astronaut</strong><span>Live vitals (heart rate, blood pressure, breathing, temperature) from a placeholder datasheet that updates every 3 seconds, a body map that turns yellow or red, step-by-step alerts, notices from crewmates and a daily check-in. No Apollo data is used here.</span></div>
        <div class="sx-row"><strong>Demo Mission Control</strong><span>All three astronauts on one board with live numbers, the live alerts with what each astronaut was told and who has been notified, live heart-rate charts and an alert log.</span></div>
        <div class="sx-row"><strong>Apollo 15 Simulation</strong><span>Press Simulate to replay the real 1971 record at 8 mission hours per second, drag the slider, or jump to any of the ${ev} cited events. Status score, body map, alerts with a send-and-acknowledge exchange, charts and the mission log all follow the mission clock.</span></div>
        <div class="sx-row"><strong>Sources everywhere</strong><span>Every Apollo event shows an in-text APA citation. Click it to open the References page.</span></div></section>

      <section class="sx-block"><h2><span class="sx-sn">05</span>How each hazard is handled</h2>
        <div class="table-scroll"><table class="sx-table"><thead><tr><th>NASA hazard</th><th>What the app does</th><th>Where</th></tr></thead><tbody>
          ${tr('Space radiation', 'Shows accumulated dose as a modeled curve ending at the real totals (360 and 510 mrad); the check-in accepts a dosimeter reading.', 'Simulation: dose tile')}
          ${tr('Isolation and confinement', 'Uses the real sleep disruptions and a mood and fatigue self-report that feeds the suggested actions.', 'Simulation: sleep events; Demo: check-in')}
          ${tr('Distance from Earth', 'Explains why onboard decision support matters: a 1.3 s Moon link versus up to about 22 minutes each way to Mars.', 'Simulation: decision banner')}
          ${tr('Gravity fields', 'Includes post-flight findings: weaker exercise response at high heart rates, weight loss and heel-bone changes.', 'Timeline events')}
          ${tr('Hostile closed environments', 'Reports the real cabin atmosphere; a modern comparison in the data shows today\'s ISS CO2 limit (3 mmHg) and symptom bands.', 'Data, References')}
        </tbody></table></div></section>

      <section class="sx-block"><h2><span class="sx-sn">06</span>Being honest about the data</h2>
        <p>Every number is one of these kinds, and the app says which:</p>
        ${kind('ev-nasa', 'Reported', 'Stated in a NASA document and cited. Shown with a "NASA source" badge.')}
        ${kind('ev-est', 'Interpolated or estimated', 'Drawn between reported points for readability, or filled in where nothing was reported. Labelled in the data and on the vitals cards.')}
        ${kind('ev-sec', 'Secondary', 'Narrative taken from non-NASA accounts, for example the Mission Control decisions. Badged until a primary source is found.')}
        ${kind('ev-sim', 'Simulated', 'Generated by the app to show what a modern system adds (blood pressure, oxygen saturation, skin temperature, sleep quality).')}
        ${kind('ev-live', 'Live (placeholder)', 'The vitals datasheet that stands in for sensors. It lives only on the demo pages.')}
        ${kind('ev-demo', 'Demo', 'Interactive inputs such as the check-in and the send-and-acknowledge exchange. Never mixed into the historical record.')}</section>

      <section class="sx-block"><h2><span class="sx-sn">07</span>What the brief asks for, and where to find it</h2>
        <div class="table-scroll"><table class="sx-table"><thead><tr><th>Objective in the brief</th><th>What the app does</th><th>Where</th></tr></thead><tbody>
          ${tr('Gather health indicators from the user', 'Live vitals (heart rate, blood pressure, breathing, temperature) plus a check-in form (mood, fatigue, symptoms, dosimeter).', '<a href="#astronaut">Demo Astronaut</a>')}
          ${tr('Help the astronaut evaluate and act', 'Step-by-step alerts, crewmate notices, a body map and suggested actions.', '<a href="#astronaut">Demo Astronaut</a>')}
          ${tr('Charts, colour coding, interactivity', 'Trend charts, green, amber and red status pills, a clickable body map, a replay clock and jump list.', 'All three app pages')}
          ${tr('Explain measurements and risks simply', 'Plain-language notes on every card and organ; the limits section lists what a 12-day replay cannot show.', 'Demo Astronaut, Simulation')}
          ${tr('Use NASA Human Research Program resources', `NASA documents are cited throughout. The official challenge resources are released on ${esc(RES.publishLabel)}.`, '<a href="#resources">Resources</a>')}
        </tbody></table></div></section>

      <section class="sx-block"><h2><span class="sx-sn">08</span>Limits, and what comes next</h2>
        <p>This is an educational prototype, not a medical device and not medical advice. It replays one short mission with sparse 1971 sensors, so it cannot show duration-dependent risks.</p>
        <div class="sx-row"><strong>Next</strong><span>Add the 15 November resources and reference ranges; confirm the in-flight rhythm-event source; add a swappable data adapter so a wearable feed can replace the replay; analyse the ECG waveform itself; learn each astronaut's personal baseline; test the decision support with flight surgeons.</span></div></section>`;
  }

  /* ------------------------------------------------------------------ *
   * Page: Resources
   * ------------------------------------------------------------------ */

  function daysUntil(iso) {
    return Math.ceil((new Date(iso + 'T00:00:00Z').getTime() - Date.now()) / 86400000);
  }

  function pageResources() {
    const days = daysUntil(RES.publishDate);
    const items = RES.items || [];
    let banner;
    if (items.length) banner = `<div class="sx-banner good">${I('check')}<div><strong>${items.length} resource${items.length > 1 ? 's' : ''} listed.</strong> Keep adding entries in data/resources.js.</div></div>`;
    else if (days > 0) banner = `<div class="sx-banner">${I('clock')}<div><strong>The challenge resources are published on ${esc(RES.publishLabel)}.</strong> ${days} day${days > 1 ? 's' : ''} to go. The slots below are ready for them.</div></div>`;
    else banner = `<div class="sx-banner warn">${I('alert')}<div><strong>The resources are now published.</strong> Add them to data/resources.js (steps below).</div></div>`;

    const card = (r) => `<div class="card sx-res">
      <div class="sx-res-top"><span class="ev ev-nasa">${esc(r.type || 'Resource')}</span><span class="pill ${r.status === 'used in app' ? 'good' : r.status === 'in progress' ? 'warn' : 'info'}"><span></span>${esc(r.status || 'planned')}</span></div>
      <strong>${esc(r.title)}</strong><small>${esc(r.publisher || '')}</small>
      <p>${esc(r.usedFor || '')}</p>
      ${r.apa ? `<small class="sx-apa">${r.apa}</small>` : ''}
      ${r.url ? `<a class="btn secondary compact" href="${esc(r.url)}" target="_blank" rel="noopener noreferrer">Open source</a>` : ''}
    </div>`;
    const slot = (s) => `<div class="card sx-res sx-slot">
      <div class="sx-res-top"><span class="ev ev-demo">EMPTY SLOT</span><span class="pill info"><span></span>waiting for ${esc(RES.publishLabel)}</span></div>
      <strong>${esc(s.kind)}</strong><small>e.g. ${esc(s.example)}</small>
      <p><b>Plugs into:</b> ${esc(s.plugsInto)}</p></div>`;

    const questions = ['Which measurements can be performed in space?', 'Why is each exam needed?', 'How do the spaceflight hazards affect each indicator?', 'When should a result go to the crew or to flight surgeons?', 'What actions can prevent a critical condition?'];
    return `<section class="sx-head"><div><div class="eyebrow">05 · NASA SPACE APPS CHALLENGE 2026</div><h1>Mission <em>resources</em></h1>
        <p>The brief points to NASA Human Research Program material and public resources from other agencies. This page tracks each resource and what it is used for.</p></div></section>
      ${banner}
      <h3 class="sx-h3">Resources</h3>
      <section class="sx-grid2">${items.length ? items.map(card).join('') : (RES.slots || []).map(slot).join('')}</section>
      <h3 class="sx-h3">Already in use</h3>
      <p class="sx-note">Until the official list is out, the app already cites NASA documents (Apollo 15 Mission Report, Biomedical Results of Apollo, the Human Research Program hazards page, the CO2 technical brief). See the <a href="#references">References</a> page for the full list.</p>
      <h3 class="sx-h3">How to add a resource</h3>
      <ol class="sx-steps">
        <li>Open <code>data/resources.js</code> and copy the example entry into <code>items</code>. Fill in title, type, URL, what it is used for and its status.</li>
        <li>Add the APA entry to <code>data/references.js</code> (<code>references</code> and <code>cite</code>), so it appears on the References page.</li>
        <li>If it holds data or ranges, put them in <code>data/</code> and run <code>node tools/build-data.js</code>; otherwise no build is needed.</li>
        <li>Refresh the page. The empty slots are replaced by your entries.</li>
      </ol>
      <h3 class="sx-h3">Questions every resource should help answer</h3>
      <p class="sx-note">These come straight from the brief. When a resource answers one, note it in <code>usedFor</code>.</p>
      <ul class="sx-checks">${questions.map((q) => `<li><span class="sx-box"></span>${esc(q)}</li>`).join('')}</ul>`;
  }

  /* ------------------------------------------------------------------ *
   * Page: References
   * ------------------------------------------------------------------ */

  function pageReferences() {
    const groups = [['nasa', 'NASA and NASA-hosted sources'], ['clinical', 'Medical reference ranges (not NASA)'], ['secondary', 'Secondary sources (non-NASA, narrative only)']];
    const plain = (h) => h.replace(/<[^>]+>/g, '');
    const sorted = (g) => Object.entries(REFS.references).filter(([, r]) => r.group === g).sort((a, b) => plain(a[1].apa).localeCompare(plain(b[1].apa)));
    const rows = REFS.dataUsed.map((d) => `<tr><td><strong>${esc(d.what)}</strong><br><span>${esc(d.values)}</span></td><td>${esc(d.where)}<br>${cite([d.ref].concat(d.refs2 || []))}</td><td>${esc(d.used)}</td></tr>`).join('');
    return `<section class="sx-head"><div><div class="eyebrow">06 · CITATIONS · APA 7TH EDITION</div><h1>References and <em>data used</em></h1>
        <p>Where every number comes from, what it is used for, and what the app generates itself. In-text citations across the app link here.</p></div></section>
      <section class="sx-block"><h2>Data used</h2>
        <div class="table-scroll"><table class="sx-table"><thead><tr><th>Data and values</th><th>Where it comes from</th><th>Used in the app for</th></tr></thead><tbody>${rows}</tbody></table></div></section>
      <section class="sx-block"><h2>Generated by this app (not measured)</h2>
        <ul class="sx-list">${REFS.generated.map((g) => `<li>${esc(g)}</li>`).join('')}</ul></section>
      <section class="sx-block"><h2>Reference list</h2>
        ${groups.map(([g, title]) => `<h4>${title}</h4>${sorted(g).map(([, r]) => `<p class="sx-ref">${r.apa}${r.note ? `<small>${esc(r.note)}</small>` : ''}</p>`).join('')}`).join('')}
        <p class="sx-note">Report and page titles are set in italics, as APA requires. Retrieval dates are shown for pages that can change.</p></section>
      <section class="sx-block"><h2>Still to verify before submission</h2>
        <ul class="sx-list">${REFS.toVerify.map((g) => `<li>${esc(g)}</li>`).join('')}</ul></section>`;
  }

  /* ------------------------------------------------------------------ *
   * Render + wiring
   * ------------------------------------------------------------------ */

  const root = document.getElementById('app');
  let current = 'home';

  function parsePage() {
    const h = (location.hash || '#home').slice(1).toLowerCase();
    if (h.startsWith('simulation')) return 'simulation';
    if (h.startsWith('control')) return 'control';
    if (h.startsWith('astronaut') || h === 'role') return 'astronaut';
    if (h === 'about') return 'project';
    if (NAV.some(([id]) => id === h)) return h;
    return 'home';
  }

  const PAGES = { home: pageHome, astronaut: pageAstronaut, control: pageControl, simulation: pageSimulation, project: pageProject, resources: pageResources, references: pageReferences };

  function render() {
    current = parsePage();
    if (current !== 'simulation') stopClock();
    root.innerHTML = `${tplTopbar(current)}<main class="sx-page" id="main">${PAGES[current]()}</main>
      <footer class="sx-foot"><strong>Astronomican</strong> · Educational prototype for the NASA Space Apps Challenge 2026. Not a medical device and not medical advice. Historical figures are cited on the <a href="#references">References</a> page; anything the app computes is labelled.</footer>`;
    AHM_ICONS.hydrate(root);
    window.scrollTo({ top: 0 });
    document.title = `${NAV.find(([id]) => id === current)[1]} · Astronomican`;
  }

  // Make `from` look like `to` without recreating nodes that already match. Because the nodes survive,
  // hover, focus, scroll position and clicks keep working while the clock or the live feed is updating.
  function morph(from, to) {
    const keepOpen = (el, name) => el.nodeName === 'DETAILS' && name === 'open';
    const syncAttrs = (f, t) => {
      Array.from(f.attributes).forEach((at) => { if (!t.hasAttribute(at.name) && !keepOpen(f, at.name)) f.removeAttribute(at.name); });
      Array.from(t.attributes).forEach((at) => { if (f.getAttribute(at.name) !== at.value && !keepOpen(f, at.name)) f.setAttribute(at.name, at.value); });
    };
    const fk = Array.from(from.childNodes), tk = Array.from(to.childNodes);
    tk.forEach((t, i) => {
      const f = fk[i];
      if (!f) from.appendChild(document.importNode(t, true));
      else if (f.nodeType !== t.nodeType || f.nodeName !== t.nodeName) from.replaceChild(document.importNode(t, true), f);
      else if (t.nodeType === 3) { if (f.nodeValue !== t.nodeValue) f.nodeValue = t.nodeValue; }
      else if (t.nodeType === 1) { syncAttrs(f, t); morph(f, t); }
    });
    for (let i = fk.length - 1; i >= tk.length; i--) from.removeChild(fk[i]);
  }

  function patch(id, html) {
    const el = document.getElementById(id);
    if (!el) return;
    const tpl = document.createElement('template');
    tpl.innerHTML = html;
    AHM_ICONS.hydrate(tpl.content);
    morph(el, tpl.content);
  }

  // Update everything that depends on the replay clock or the live feed (keeps the check-in form, slider and open sections stable).
  function renderLive() {
    if (!LIVE_PAGES.includes(current)) return;
    if (current === 'astronaut') {
      const c = demoCtx();
      patch('side-body', sideHtml(c));
      patch('feed-body', feedHtml());
      patch('live-body', demoBody(c));
    } else if (current === 'control') {
      patch('live-body', controlLive());
    } else {
      const c = simCtx();
      patch('side-body', sideHtml(c));
      patch('live-body', simBody(c));
    }
    const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
    set('sim-readout', AHM.formatGet(sim.hour));
    set('sim-day', `Day ${ENGINE.missionDay(sim.hour) + 1} of ${ENGINE.missionTotalDays()}`);
    set('ci-get', AHM.formatGet(sim.hour));
    const range = document.getElementById('sim-range');
    if (range && document.activeElement !== range) range.value = sim.hour;
    const playBtn = document.getElementById('sim-play');
    if (playBtn) { playBtn.innerHTML = `${I(sim.playing ? 'pause' : 'play', 14)}<span>${sim.playing ? 'Pause' : 'Simulate'}</span>`; playBtn.classList.toggle('is-playing', sim.playing); AHM_ICONS.hydrate(playBtn); }
    NAV.forEach(([id, label]) => {
      const link = document.querySelector(`.sx-nav a[href="#${id}"]`);
      if (link && (id === 'control' || id === 'simulation')) { const html = navLinkHtml(id, label); if (link.innerHTML !== html) link.innerHTML = html; }
    });
  }

  function setHour(h) { sim.hour = Math.max(0, Math.min(TOTAL_HOURS, h)); renderLive(); }
  function stopClock() { sim.playing = false; if (sim.timer) clearInterval(sim.timer); sim.timer = null; }
  function pause() { stopClock(); renderLive(); }
  function play() {
    if (sim.playing) return;
    if (sim.hour >= TOTAL_HOURS) sim.hour = 0;
    sim.playing = true;
    renderLive();
    sim.timer = setInterval(() => {
      if (sim.hour >= TOTAL_HOURS) { pause(); return; }
      setHour(sim.hour + sim.speed * (TICK_MS / 1000));
    }, TICK_MS);
  }

  root.addEventListener('click', (ev) => {
    if (ev.target.closest('#sim-play')) { sim.playing ? pause() : play(); return; }
    if (ev.target.closest('#ci-save')) {
      const v = (f) => Number(root.querySelector(`[data-f="${f}"]`).value), dose = document.getElementById('ci-dose').value;
      AHM.logDemoEvent({ type: 'checkin', crewId: state.crew, mood: v('mood'), fatigue: v('fatigue'),
        symptoms: document.getElementById('ci-sym').value.trim(), dose: dose === '' ? null : Number(dose) });
      const box = document.getElementById('checkin-body');
      box.innerHTML = checkinBlock();
      AHM_ICONS.hydrate(box);
      renderLive();
      toast('Check-in logged');
      return;
    }
    const el = ev.target.closest('[data-act]');
    if (!el || !root.contains(el)) return;
    const val = el.dataset.val;
    switch (el.dataset.act) {
      case 'crew': state.crew = val; state.organ = null; render(); break;
      case 'open-crew': state.crew = val; state.organ = null; if (location.hash === '#astronaut') render(); else location.hash = '#astronaut'; break;
      case 'organ': state.organ = val; renderLive(); if (window.innerWidth < 900) document.getElementById('organ-detail').scrollIntoView({ block: 'nearest', behavior: 'smooth' }); break;
      case 'skip-alert': LIVE.skipToNextAlert(state.crew); toast('Jumped the placeholder feed to the next alert'); break;
      case 'live-ack': LIVE.ackAlert(el.dataset.id); toast('Acknowledged. Your crewmates can see you are on it.'); break;
      case 'notice-ack': LIVE.ackNotice(el.dataset.id); toast('Thanks. The sender can see you saw it.'); break;
      case 'review': reviewed.add(el.dataset.key); renderLive(); toast('Marked as reviewed'); break;
      case 'send-rec': {
        const e = ENGINE.DATA.events.find((x) => alertKey(x) === el.dataset.key);
        const c = crewById(el.dataset.crew);
        const snap = ENGINE.crewSnapshot(c.id, sim.hour);
        const text = ENGINE.advise(snap, null)[0] || 'Repeat the vitals check, limit exertion and report any symptoms.';
        AHM.logDemoEvent({ type: 'message', crewId: c.id, get_hours: sim.hour, alertKey: alertKey(e), title: `Recommendation sent to ${c.name} (demo)`, detail: text });
        renderLive(); toast(`Recommendation sent to ${ENGINE.crewShortName(c)} (demo)`); break;
      }
      case 'ack':
        AHM.acknowledgeDemoEvent(el.dataset.id);
        AHM.logDemoEvent({ type: 'ack', crewId: el.dataset.crew, get_hours: sim.hour, title: `${crewById(el.dataset.crew).name} acknowledged the recommendation (demo)` });
        renderLive(); toast('Acknowledged'); break;
      default: break;
    }
  });

  root.addEventListener('keydown', (ev) => {
    const g = ev.target.closest && ev.target.closest('[data-act="organ"]');
    if (g && (ev.key === 'Enter' || ev.key === ' ')) { ev.preventDefault(); state.organ = g.dataset.val; renderLive(); const again = root.querySelector(`[data-act="organ"][data-val="${state.organ}"]`); if (again) again.focus(); }
  });

  root.addEventListener('input', (ev) => {
    if (ev.target.matches('.slider-row input')) ev.target.nextElementSibling.textContent = ev.target.value;
    if (ev.target.id === 'sim-range') { stopClock(); setHour(Number(ev.target.value)); }
  });

  root.addEventListener('change', (ev) => {
    if (ev.target.id === 'sim-jump' && ev.target.value !== '') { pause(); setHour(Number(ev.target.value)); ev.target.value = ''; }
  });

  // Remember which <details> sections are open across live re-renders.
  root.addEventListener('toggle', (ev) => {
    const d = ev.target;
    if (d.matches && d.matches('details[data-key]')) state.open[d.dataset.key] = d.open;
  }, true);

  setInterval(() => { const c = document.getElementById('utc-clock'); if (c) c.textContent = utcNow(); }, 1000);
  window.addEventListener('hashchange', render);
  LIVE.onChange(renderLive);
  LIVE.start();
  render();
})();
