/* ==========================================================================
   app.js
   Drives console.html: view switching, the shared GET simulation control
   bar, and the two dashboard renderers (astronaut view, mission control
   view). Both views run in this same script and share AHM's in-memory
   demo log directly by reference — see the design note in common.js for
   why the astronaut/Mission Control views live in one document rather
   than two separate file:// pages.
   ========================================================================== */

(function () {

  /* ------------------------------------------------------------------ *
   * View switching
   * ------------------------------------------------------------------ */

  const VALID_VIEWS = ['astronaut', 'mission-control'];
  function currentViewFromHash() {
    const h = (location.hash || '').replace('#', '');
    return VALID_VIEWS.includes(h) ? h : 'astronaut';
  }
  function setActiveView(view) {
    document.querySelectorAll('.app-view').forEach((el) => el.classList.remove('is-active'));
    const target = document.getElementById(`view-${view}`);
    if (target) target.classList.add('is-active');
    document.querySelectorAll('.site-nav__links a[data-view]').forEach((a) => {
      if (a.dataset.view === view) a.setAttribute('aria-current', 'page');
      else a.removeAttribute('aria-current');
    });
    document.querySelectorAll('.site-nav__links').forEach((el) => el.classList.remove('is-open'));
  }
  document.querySelectorAll('.site-nav__links a[data-view]').forEach((a) => {
    a.addEventListener('click', (e) => { e.preventDefault(); location.hash = a.dataset.view; });
  });
  window.addEventListener('hashchange', () => setActiveView(currentViewFromHash()));
  const navToggle = document.querySelector('.site-nav__toggle');
  const navLinks = document.querySelector('.site-nav__links');
  if (navToggle && navLinks) navToggle.addEventListener('click', () => navLinks.classList.toggle('is-open'));
  setActiveView(currentViewFromHash());

  /* ------------------------------------------------------------------ *
   * Shared data + GET simulation state
   * ------------------------------------------------------------------ */

  const data = AHM.loadData();
  const crewList = data.crew.members;
  const TOTAL_HOURS = data.mission.total_get_hours;
  const SPLASHDOWN_HOUR = TOTAL_HOURS;
  const RATE_HOURS_PER_SEC = 8; // "3 seconds ≈ 1 day" (24h / 3s = 8h/s)
  const TICK_MS = 200;
  const HOURS_PER_TICK = RATE_HOURS_PER_SEC * (TICK_MS / 1000);

  const sim = { hour: 0, playing: false, timer: null };

  function levelClass(level) { return level.toLowerCase(); }
  function metricTile(label, value, unit, level) {
    const cls = level === 'CRITICAL' ? 'is-critical' : level === 'ATTENTION' ? 'is-attention' : '';
    return `<div class="metric ${cls}"><div class="label">${label}</div><div class="value">${value}<span class="unit">${unit}</span></div></div>`;
  }

  const getReadout = document.getElementById('get-readout');
  const getDayReadout = document.getElementById('get-day-readout');
  const playBtn = document.getElementById('sim-play');

  function renderAll() {
    getReadout.textContent = AHM.formatGet(sim.hour);
    getDayReadout.textContent = `Day ${Math.floor(sim.hour / 24)} of ${Math.ceil(TOTAL_HOURS / 24)}`;
    astro.render();
    missionControl.render();
  }

  function setHour(h) {
    sim.hour = Math.max(0, Math.min(TOTAL_HOURS + 0.5, h));
    renderAll();
  }

  function play() {
    if (sim.playing) return;
    sim.playing = true;
    playBtn.textContent = '⏸ Pause';
    sim.timer = setInterval(() => {
      if (sim.hour >= TOTAL_HOURS) { pause(); return; }
      setHour(sim.hour + HOURS_PER_TICK);
    }, TICK_MS);
  }
  function pause() {
    sim.playing = false;
    playBtn.textContent = '▶ Simulate';
    if (sim.timer) clearInterval(sim.timer);
    sim.timer = null;
  }

  playBtn.addEventListener('click', () => (sim.playing ? pause() : play()));
  document.getElementById('sim-back').addEventListener('click', () => { pause(); setHour(sim.hour - 6); });
  document.getElementById('sim-fwd').addEventListener('click', () => { pause(); setHour(sim.hour + 6); });
  document.getElementById('sim-reset').addEventListener('click', () => { pause(); setHour(0); });

  const jumpSelect = document.getElementById('jump-select');
  jumpSelect.innerHTML = '<option value="">Jump to a mission event…</option>' + data.events.map((e) =>
    `<option value="${e.get_hours}">GET ${AHM.formatGet(e.get_hours)} — ${e.title}</option>`
  ).join('');
  jumpSelect.addEventListener('change', () => {
    if (!jumpSelect.value) return;
    pause();
    setHour(Number(jumpSelect.value));
    jumpSelect.value = '';
  });

  /* ------------------------------------------------------------------ *
   * Chart helpers — build a rolling window with real-anchor markers
   * ------------------------------------------------------------------ */

  function rollingSeries(rows, hour, windowHours, field, basisField) {
    const start = Math.max(0, Math.floor(hour) - windowHours);
    const end = Math.floor(hour);
    const slice = rows.filter((r) => r.get_hours >= start && r.get_hours <= end);
    const values = slice.map((r) => r[field]);
    const reportedIdx = [];
    const reportedLabels = [];
    slice.forEach((r, i) => {
      if (r[basisField] === 'reported') { reportedIdx.push(i); reportedLabels[i] = r.heart_rate_label || ''; }
    });
    const evaShading = [];
    AHM.EVA_WINDOWS.forEach((w) => {
      const s = slice.findIndex((r) => r.get_hours >= w.start);
      const e = slice.findIndex((r) => r.get_hours >= w.end);
      if (s >= 0) evaShading.push({ startIdx: s, endIdx: e >= 0 ? e : slice.length - 1 });
    });
    return { values, reportedIdx, reportedLabels, evaShading };
  }

  /* ==================================================================== *
   * ASTRONAUT VIEW
   * ==================================================================== */

  const astro = (() => {
    const state = { crewId: crewList[0].id };
    const WELLBEING_FIELDS = [['mood', 'Mood'], ['stress', 'Stress'], ['fatigue', 'Fatigue'], ['motivation', 'Motivation'], ['social', 'Social']];

    const crewSelect = document.getElementById('a-crew-select');
    crewList.forEach((c) => {
      const opt = document.createElement('option');
      opt.value = c.id;
      opt.textContent = `${c.name} — ${c.role}`;
      crewSelect.appendChild(opt);
    });
    crewSelect.value = state.crewId;
    crewSelect.addEventListener('change', () => { state.crewId = crewSelect.value; render(); });

    function render() {
      const crew = crewList.find((c) => c.id === state.crewId);
      const rows = AHM.telemetryForCrew(data.telemetry, state.crewId);
      const assessment = AHM.assessCrewMember(data.references, rows, data.events, state.crewId, sim.hour);
      const station = AHM.assessStation(data.events, sim.hour);

      document.getElementById('a-title').textContent = crew.name;
      document.getElementById('a-subtitle').textContent = `${crew.role} · ${crew.position_note}`;

      const overall = AHM.worseOf(assessment.overall, station.overall);
      document.getElementById('a-status-code').className = `status-banner__code status-banner__code--${levelClass(overall)}`;
      document.getElementById('a-status-code').textContent = overall;
      const allAlerts = [...assessment.alerts, ...station.alerts];
      document.getElementById('a-status-desc').textContent = allAlerts.length
        ? allAlerts[0].title + (assessment.eva ? ` — currently on ${assessment.eva.label} (elevated vitals expected).` : '.')
        : (assessment.eva ? `Currently on ${assessment.eva.label} — elevated heart rate is expected exertion, not a concern.` : 'No active alerts. All monitored indicators nominal.');

      document.getElementById('a-vitals-grid').innerHTML = [
        metricTile('Heart rate', assessment.row.heart_rate_bpm, 'bpm', assessment.hrLevel),
        metricTile('Respiration', assessment.row.respiration_rate, '/min', assessment.rrLevel),
      ].join('');

      const hrSeries = rollingSeries(rows, sim.hour, 48, 'heart_rate_bpm', 'heart_rate_basis');
      document.getElementById('a-hr-chart').innerHTML = AHM_CHARTS.sparkline(hrSeries.values, {
        color: '#8b7ff0', reportedIdx: hrSeries.reportedIdx, reportedLabels: hrSeries.reportedLabels, evaShading: hrSeries.evaShading,
      });
      document.getElementById('a-hr-footnote').innerHTML =
        `<span class="chart-legend"><span><span class="swatch" style="background:#f2c86b;"></span>reported figure (Mission Report)</span><span><span class="swatch" style="background:#8b7ff0; opacity:.6;"></span>interpolated for display</span><span><span class="swatch" style="background:#c9a24b; opacity:.3;"></span>real EVA window</span></span> 48-hour rolling window.`;

      const respSeries = rollingSeries(rows, sim.hour, 48, 'respiration_rate', 'respiration_basis');
      document.getElementById('a-resp-chart').innerHTML = AHM_CHARTS.sparkline(respSeries.values, { color: '#43d1b0', evaShading: respSeries.evaShading });

      renderModern();
      renderContext();
      renderTimeline(crew);
      renderWellbeing();
      renderPostflight();
      renderIncomingMessage(crew);
    }

    function renderModern() {
      const m = AHM.simulateModernVitals(state.crewId, sim.hour, data.events);
      const eva = AHM.activeEva(state.crewId, sim.hour);
      document.getElementById('a-modern-grid').innerHTML = [
        metricTile('SpO2', m.spo2.toFixed(1), '%', 'NOMINAL'),
        metricTile('Skin temp', m.skinTemp.toFixed(1), '\u00b0C', 'NOMINAL'),
        metricTile('Systolic BP (est.)', Math.round(m.systolicBp), 'mmHg', m.systolicBp > 140 ? 'ATTENTION' : 'NOMINAL'),
        metricTile('Sleep quality', Math.round(m.sleepQuality), '%', m.sleepQuality < 50 ? 'CRITICAL' : m.sleepQuality < 75 ? 'ATTENTION' : 'NOMINAL'),
        metricTile('Activity', m.activity, '', 'NOMINAL'),
      ].join('');

      const pct = Math.round((m.doseMrad / m.doseEndpointMrad) * 100);
      document.getElementById('a-dose-bar').innerHTML = `
        <div class="dose-bar__head"><span>Radiation dose (accumulating)</span><span class="mono">${m.doseMrad.toFixed(0)} / ${m.doseEndpointMrad} mrad</span></div>
        <div class="dose-bar__track"><div class="dose-bar__fill" style="width:${pct}%"></div></div>`;

      document.getElementById('a-modern-footnote').innerHTML =
        `Simulated with modern Bio-Monitor-style parameters (${data.modern.bio_monitor.parameters.length} signals: ECG, respiration, SpO2, skin temp, BP estimate, activity, sleep). ` +
        `Apollo's cabin was 100% oxygen, so a modern oximeter would read near the top of the scale all mission &mdash; Irwin's real problem was rhythm, not oxygenation, and no SpO2 number would have caught it. ` +
        `Sleep score follows the real displaced-sleep events (${m.sleepSource}). Radiation endpoints are real (Mission Report); the curve is estimated, since Apollo dosimeters were read only after landing` +
        (state.crewId === 'CMP' ? ' (Worden handed his personal dosimeter to Scott, so 300 mrad is the crew passive average).' : '.') +
        (eva ? ` Currently on ${eva.label}.` : '');
    }

    function renderContext() {
      const sans = data.modern.sans;
      document.getElementById('a-sans-panel').innerHTML =
        `<p style="color:var(--text);">About 1 in 3 astronauts on long-duration ISS missions show at least one ocular finding (optic disc edema, globe flattening, choroidal folds, hyperopic shift).</p>` +
        `<p>Apollo 15 lasted 12.3 days, far too short for SANS to develop, so it is not modeled here &mdash; it's the kind of <strong>duration-dependent risk</strong> that a monitoring system for Artemis- and Mars-length missions must track. Watched today with ${sans.monitored_today_with.toLowerCase()}.</p>` +
        `<div class="event-item__source">${sans.source}</div>`;
      const bhp = data.modern.behavioral_health;
      document.getElementById('a-bhp-panel').innerHTML =
        `<p style="color:var(--text);">Modern crews are tracked on fatigue, workload and wellbeing through private weekly conferences with a flight surgeon and dedicated software (${bhp.example_tool}).</p>` +
        `<p>The Wellbeing Check-In slider in this app is a teaching simplification of that, not a real instrument. Apollo 15's own record shows why it matters: three lunar-surface sleep periods displaced by roughly 2, 2 and 7 hours, then about 22 hours awake before the cardiac event.</p>` +
        `<div class="event-item__source">${bhp.source}</div>`;
    }

    function renderTimeline(crew) {
      const events = AHM.eventsUpTo(data.events, sim.hour)
        .filter((e) => !e.crew_id || e.crew_id === state.crewId)
        .slice().reverse().slice(0, 15);
      document.getElementById('a-timeline-hint').textContent = `${events.length} shown`;
      document.getElementById('a-timeline').innerHTML = events.length
        ? events.map(eventCardHtml).join('')
        : '<div class="empty-state">Mission has not started yet — press Simulate or Jump to an event.</div>';
    }

    function renderWellbeing() {
      const container = document.getElementById('a-wellbeing-sliders');
      if (!container.dataset.built) {
        container.innerHTML = WELLBEING_FIELDS.map(([field, label]) => `
          <div class="slider-row">
            <span>${label}</span>
            <input type="range" min="1" max="5" step="1" value="3" data-field="${field}" />
            <span class="val" data-out="${field}">3</span>
          </div>`).join('');
        container.querySelectorAll('input[type="range"]').forEach((input) => {
          input.addEventListener('input', () => {
            container.querySelector(`[data-out="${input.dataset.field}"]`).textContent = input.value;
          });
        });
        container.dataset.built = '1';
      }
    }

    document.getElementById('a-submit-wellbeing').addEventListener('click', () => {
      const container = document.getElementById('a-wellbeing-sliders');
      const values = {};
      container.querySelectorAll('input[type="range"]').forEach((input) => { values[input.dataset.field] = input.value; });
      const crew = crewList.find((c) => c.id === state.crewId);
      AHM.logDemoEvent({
        kind: 'demo', type: 'checkin', crewId: state.crewId, get_hours: sim.hour,
        title: `${crew.name} submitted a wellbeing check-in (demo)`,
        detail: WELLBEING_FIELDS.map(([f, l]) => `${l}: ${values[f]}/5`).join(', '),
      });
    });

    function renderPostflight() {
      const panel = document.getElementById('a-postflight-panel');
      if (sim.hour < SPLASHDOWN_HOUR) {
        panel.innerHTML = `<div class="empty-state">Revealed after splashdown (GET ${AHM.formatGet(SPLASHDOWN_HOUR)}).</div>`;
        return;
      }
      const findings = data.events.filter((e) => e.category === 'postflight');
      panel.innerHTML = findings.map(eventCardHtml).join('');
    }

    function renderIncomingMessage(crew) {
      const pending = AHM.readDemoLog()
        .filter((e) => e.type === 'message' && e.crewId === state.crewId && !e.acknowledged)
        .sort((a, b) => b.time - a.time)[0];
      const slot = document.getElementById('a-incoming-message-slot');
      if (!pending) { slot.innerHTML = ''; return; }
      slot.innerHTML = `
        <div class="incoming-message">
          <div class="incoming-message__from">MESSAGE FROM MISSION CONTROL — GET ${AHM.formatGet(pending.get_hours)} (demo)</div>
          <div class="incoming-message__body">${pending.title.replace(/^.*?: /, '')}${pending.detail ? `<br><span style="color:var(--text-dim); font-size:0.88rem;">${pending.detail}</span>` : ''}</div>
          <button class="btn btn--primary" id="a-ack-btn">Acknowledge</button>
        </div>`;
      document.getElementById('a-ack-btn').addEventListener('click', () => {
        AHM.acknowledgeDemoEvent(pending.id);
        AHM.logDemoEvent({ kind: 'demo', type: 'ack', crewId: state.crewId, get_hours: sim.hour, title: `${crew.name} acknowledged the recommendation (demo)` });
      });
    }

    return { render };
  })();

  /* ------------------------------------------------------------------ *
   * Shared: render one real/demo event as a timeline / log card
   * ------------------------------------------------------------------ */

  function eventCardHtml(e) {
    const tagClass = e.kind === 'demo' ? 'event-tag--demo' : `event-tag--${e.category}`;
    const tagLabel = e.kind === 'demo' ? 'INTERACTIVE DEMO' : (e.category || '').replace(/-/g, ' ').toUpperCase();
    return `
      <div class="event-item">
        <div class="event-item__get">${e.kind === 'demo' ? '' : 'GET ' + AHM.formatGet(e.get_hours)}</div>
        <div class="event-item__body">
          <span class="event-tag ${tagClass}">${tagLabel}</span>
          <div class="event-item__title">${e.title}</div>
          ${e.detail ? `<div class="event-item__detail">${e.detail}</div>` : ''}
          ${e.source ? `<div class="event-item__source">${e.source}</div>` : ''}
        </div>
      </div>`;
  }

  /* ==================================================================== *
   * MISSION CONTROL VIEW
   * ==================================================================== */

  const missionControl = (() => {
    const RECOMMENDATION_TEMPLATES = [
      'Review scheduled recovery period and upcoming workload.',
      'Consider additional rest before the next duty shift.',
      'Notify the flight surgeon for a medical consultation.',
      'Request an updated status check from the crew.',
    ];
    const state = { selectedCrewId: crewList[0].id };

    function render() {
      const perCrew = crewList.map((crew) => ({
        crew,
        rows: AHM.telemetryForCrew(data.telemetry, crew.id),
        assessment: AHM.assessCrewMember(data.references, AHM.telemetryForCrew(data.telemetry, crew.id), data.events, crew.id, sim.hour),
      }));
      const station = AHM.assessStation(data.events, sim.hour);

      document.getElementById('m-subtitle').textContent = `${data.mission.mission_title} · ${crewList.length} crew · GET ${AHM.formatGet(sim.hour)}`;

      let overall = station.overall;
      perCrew.forEach(({ assessment }) => { overall = AHM.worseOf(overall, assessment.overall); });
      document.getElementById('m-status-code').className = `status-banner__code status-banner__code--${levelClass(overall)}`;
      document.getElementById('m-status-code').textContent = overall;

      const allAlerts = [];
      perCrew.forEach(({ crew, assessment }) => assessment.alerts.forEach((a) => allAlerts.push({ ...a, crewName: crew.name })));
      station.alerts.forEach((a) => allAlerts.push({ ...a, crewName: 'Spacecraft / station' }));

      document.getElementById('m-status-desc').textContent = allAlerts.length
        ? `${allAlerts.length} active real event${allAlerts.length > 1 ? 's' : ''} across the crew.`
        : 'No active alerts. All monitored indicators nominal.';

      renderCrewRoster(perCrew);
      renderEnvironment();
      renderThenNow();
      renderCrewDetail(perCrew);
      renderAlerts(allAlerts);
      renderHistory();
    }

    function renderCrewRoster(perCrew) {
      const container = document.getElementById('m-crew-roster');
      container.innerHTML = perCrew.map(({ crew, assessment }) => `
        <button class="crew-card ${crew.id === state.selectedCrewId ? 'is-selected' : ''}" data-crew="${crew.id}">
          <span class="crew-card__avatar">${crew.photo_initials}</span>
          <span><span class="crew-card__name" style="display:block;">${crew.name}</span><span class="crew-card__role">${crew.role}</span></span>
          <span class="crew-card__status pill pill--${levelClass(assessment.overall)}"><span class="dot dot--${levelClass(assessment.overall)}"></span>${assessment.overall}</span>
        </button>`).join('');
      container.querySelectorAll('.crew-card').forEach((btn) => {
        btn.addEventListener('click', () => { state.selectedCrewId = btn.dataset.crew; render(); });
      });
    }

    function renderEnvironment() {
      const hw = data.references.flown_hardware;
      document.getElementById('m-env-grid').innerHTML = [
        metricTile('Cabin atmosphere', '100% O2', '5.0 psia', 'NOMINAL'),
        metricTile('CO2 removal', 'LiOH', 'canisters', 'NOMINAL'),
        metricTile('Biosensors', 'ECG + resp.', '', 'NOMINAL'),
      ].join('');
      document.getElementById('m-env-footnote').textContent = hw.cabin_atmosphere.source + '. ' + hw.cabin_atmosphere.note;
    }

    function renderThenNow() {
      const rows = [
        ['Heart rate', 'ECG', '3-lead ECG'],
        ['Respiration', 'Impedance pneumogram', 'Thoracic + abdominal bands'],
        ['Blood oxygen (SpO2)', '\u2014', 'Forehead SpO2 sensor'],
        ['Skin temperature', '\u2014', 'Skin-contact sensor'],
        ['Blood pressure', '\u2014', 'Continuous systolic estimate'],
        ['Physical activity', '\u2014', '3-axis accelerometer'],
        ['Sleep quality', 'Crew report only', 'Derived from sensors'],
        ['Radiation dose', 'Passive, read after landing', 'Continuous area + personal dosimetry'],
        ['Cabin CO2', 'LiOH canisters; no telemetry located', 'Real-time ppCO2 with symptom bands'],
      ];
      document.querySelector('#m-then-now tbody').innerHTML = rows.map(([p, a, t]) =>
        `<tr><td>${p}</td><td class="${a === '\u2014' ? 'cell-none' : ''}">${a}</td><td class="cell-now">${t}</td></tr>`).join('');
    }

    const co2Slider = document.getElementById('m-co2-slider');
    function renderCo2Explorer() {
      const v = Number(co2Slider.value);
      const band = AHM.co2Band(data.modern.co2_operational_bands_mmhg.bands, v);
      document.getElementById('m-co2-value').textContent = v.toFixed(1) + ' mmHg';
      const level = v < 2.3 ? 'nominal' : v < 3.0 ? 'attention' : 'critical';
      document.getElementById('m-co2-effect').innerHTML =
        `<span class="pill pill--${level}"><span class="dot dot--${level}"></span>${level.toUpperCase()}</span> <span style="margin-left:8px;">${band.effect}</span>`;
      document.getElementById('m-co2-footnote').textContent =
        data.modern.co2_operational_bands_mmhg.source + '. NASA-STD-3001 design limit: 3.0 mmHg (1-hour average). Not an Apollo 15 measurement.';
    }
    co2Slider.addEventListener('input', renderCo2Explorer);
    renderCo2Explorer();

    function renderCrewDetail(perCrew) {
      const entry = perCrew.find((p) => p.crew.id === state.selectedCrewId) || perCrew[0];
      const { crew, rows, assessment } = entry;
      document.getElementById('m-crew-detail-name').textContent = crew.name;
      document.getElementById('m-crew-detail-role').textContent = `${crew.role} · ${assessment.overall}`;

      const hrSeries = rollingSeries(rows, sim.hour, 48, 'heart_rate_bpm', 'heart_rate_basis');
      document.getElementById('m-crew-hr-chart').innerHTML = AHM_CHARTS.sparkline(hrSeries.values, {
        color: '#8b7ff0', reportedIdx: hrSeries.reportedIdx, reportedLabels: hrSeries.reportedLabels, evaShading: hrSeries.evaShading,
      });

      document.getElementById('m-crew-detail-grids').innerHTML = [
        metricTile('Heart rate', assessment.row.heart_rate_bpm, 'bpm', assessment.hrLevel),
        metricTile('Respiration', assessment.row.respiration_rate, '/min', assessment.rrLevel),
        metricTile('Current activity', assessment.eva ? assessment.eva.label : 'Nominal ops', '', 'NOMINAL'),
      ].join('');
    }

    function rank(level) { return { CRITICAL: 2, ATTENTION: 1, NOMINAL: 0 }[level]; }
    function renderAlerts(allAlerts) {
      document.getElementById('m-alerts-hint').textContent = `${allAlerts.length} active`;
      document.getElementById('m-alerts-list').innerHTML = allAlerts.length
        ? allAlerts.sort((a, b) => rank(b.level) - rank(a.level)).map((a) => `
            <div class="alert-item">
              <span class="dot dot--${levelClass(a.level)}" style="margin-top:6px;"></span>
              <div class="alert-item__body">
                <div class="alert-item__title">${a.title}</div>
                <div class="alert-item__meta">${a.crewName} · ${a.level} · GET ${AHM.formatGet(a.get_hours)}</div>
              </div>
            </div>`).join('')
        : `<div class="empty-state">No active alerts at GET ${AHM.formatGet(sim.hour)}.</div>`;
    }

    function renderHistory() {
      const real = AHM.eventsUpTo(data.events, sim.hour).map((e) => ({ ...e, kind: 'real' }));
      const demo = AHM.readDemoLog().map((e) => ({ ...e, kind: 'demo' }));
      const merged = [...real, ...demo].sort((a, b) => (b.get_hours || 0) - (a.get_hours || 0)).slice(0, 60);
      const tbody = document.querySelector('#m-history tbody');
      tbody.innerHTML = merged.length
        ? merged.map((e) => `
            <tr>
              <td class="mono">${e.kind === 'demo' ? 'demo' : 'GET ' + AHM.formatGet(e.get_hours)}</td>
              <td><span class="event-tag ${e.kind === 'demo' ? 'event-tag--demo' : `event-tag--${e.category}`}">${e.kind === 'demo' ? 'DEMO' : (e.category || '').replace(/-/g, ' ')}</span></td>
              <td>${e.title}${e.acknowledged ? ' <span class="pill pill--nominal" style="margin-left:6px;">ACK</span>' : ''}</td>
            </tr>`).join('')
        : `<tr><td colspan="3" class="empty-state">No events yet.</td></tr>`;
    }

    const chipsContainer = document.getElementById('m-template-chips');
    chipsContainer.innerHTML = RECOMMENDATION_TEMPLATES.map((t) => `<button class="template-chip">${t}</button>`).join('');
    chipsContainer.querySelectorAll('.template-chip').forEach((chip) => {
      chip.addEventListener('click', () => { document.getElementById('m-message-text').value = chip.textContent; });
    });

    document.getElementById('m-send-message').addEventListener('click', () => {
      const text = document.getElementById('m-message-text').value.trim();
      if (!text) return;
      const crew = crewList.find((c) => c.id === state.selectedCrewId);
      AHM.logDemoEvent({ kind: 'demo', type: 'message', crewId: crew.id, get_hours: sim.hour, title: `Recommendation sent to ${crew.name} (demo)`, detail: text });
      document.getElementById('m-message-text').value = '';
    });

    return { render };
  })();

  /* ------------------------------------------------------------------ *
   * Wire the demo log to both views and do the first render
   * ------------------------------------------------------------------ */

  AHM.onDemoLogChanged(renderAll);
  renderAll();
})();
