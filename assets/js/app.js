/* ==========================================================================
   app.js
   Drives console.html: a view switcher plus the two dashboard renderers
   (astronaut view, mission control view). Both views run in this same
   script, sharing AHM's in-memory event log directly — see the design
   note in common.js for why that matters.
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
    a.addEventListener('click', (e) => {
      e.preventDefault();
      location.hash = a.dataset.view;
    });
  });

  window.addEventListener('hashchange', () => setActiveView(currentViewFromHash()));

  const navToggle = document.querySelector('.site-nav__toggle');
  const navLinks = document.querySelector('.site-nav__links');
  if (navToggle && navLinks) {
    navToggle.addEventListener('click', () => navLinks.classList.toggle('is-open'));
  }

  setActiveView(currentViewFromHash());

  /* ------------------------------------------------------------------ *
   * Shared data + helpers
   * ------------------------------------------------------------------ */

  const data = AHM.loadData();
  const crewList = data.crew.members;
  const missionMax = data.mission.mission_day_range[1];
  const baselineDays = data.mission.baseline_window_days;

  function levelClass(level) { return level.toLowerCase(); }

  function metricTile(label, value, unit, level) {
    const cls = level === 'CRITICAL' ? 'is-critical' : level === 'ATTENTION' ? 'is-attention' : '';
    return `<div class="metric ${cls}">
      <div class="label">${label}</div>
      <div class="value">${value}<span class="unit">${unit}</span></div>
    </div>`;
  }

  /* ==================================================================== *
   * ASTRONAUT VIEW
   * ==================================================================== */

  const astro = (() => {
    const state = { crewId: crewList[0].id, day: 30 };

    const OVERRIDES_KEY = 'ahm_wellbeing_overrides_v1';
    function loadOverrides() {
      try { return JSON.parse(localStorage.getItem(OVERRIDES_KEY)) || {}; }
      catch (e) { return {}; }
    }
    function saveOverrides(overrides) {
      try { localStorage.setItem(OVERRIDES_KEY, JSON.stringify(overrides)); } catch (e) { /* storage unavailable */ }
    }
    function applyOverrides(rows, crewId) {
      const overrides = loadOverrides();
      return rows.map((r) => {
        const key = `${crewId}:${r.mission_day}`;
        return overrides[key] ? { ...r, ...overrides[key] } : r;
      });
    }

    const crewSelect = document.getElementById('a-crew-select');
    crewList.forEach((c) => {
      const opt = document.createElement('option');
      opt.value = c.id;
      opt.textContent = `${c.name} — ${c.role}`;
      crewSelect.appendChild(opt);
    });
    crewSelect.value = state.crewId;
    crewSelect.addEventListener('change', () => { state.crewId = crewSelect.value; render(); });

    const daySlider = document.getElementById('a-day-slider');
    const dayValue = document.getElementById('a-day-value');
    daySlider.max = missionMax;
    daySlider.value = state.day;
    dayValue.textContent = state.day;
    daySlider.addEventListener('input', () => {
      state.day = Number(daySlider.value);
      dayValue.textContent = state.day;
      render();
    });

    function render() {
      const crew = crewList.find((c) => c.id === state.crewId);
      const allRows = applyOverrides(AHM.telemetryForCrew(data.telemetry, state.crewId), state.crewId);
      const rows = allRows.filter((r) => r.mission_day <= state.day);
      const envAll = AHM.environmentSeries(data.telemetry).filter((r) => r.mission_day <= state.day);
      const assessment = AHM.assessCrewMember(rows, data.references, baselineDays);
      const envAssessment = AHM.assessEnvironment(envAll, data.references, crewList.length);
      const latest = assessment.latest;

      document.getElementById('a-title').textContent = crew.name;
      document.getElementById('a-subtitle').textContent =
        `${crew.role} · Mission Day ${state.day} of ${missionMax} · Baseline: days ${baselineDays[0]}\u2013${baselineDays[1]}`;

      const overall = AHM.worseOf(assessment.overall, envAssessment.overall);
      document.getElementById('a-status-code').className = `status-banner__code status-banner__code--${levelClass(overall)}`;
      document.getElementById('a-status-code').textContent = overall;
      const topAlerts = [...assessment.alerts, ...envAssessment.alerts].filter((a) => a.level !== 'NOMINAL');
      document.getElementById('a-status-desc').textContent = topAlerts.length
        ? topAlerts[0].title + (topAlerts.length > 1 ? ` — plus ${topAlerts.length - 1} more indicator${topAlerts.length > 2 ? 's' : ''} outside nominal range.` : '.')
        : 'All monitored indicators are within their nominal ranges.';

      document.getElementById('a-vitals-grid').innerHTML = [
        metricTile('Heart rate', latest.heart_rate_bpm, 'bpm', assessment.metrics.heart_rate_bpm.level),
        metricTile('Respiration', latest.respiration_rate, '/min', assessment.metrics.respiration_rate.level),
        metricTile('SpO2', latest.spo2_pct, '%', assessment.metrics.spo2_pct.level),
        metricTile('Skin temp', latest.skin_temp_c, '\u00b0C', assessment.metrics.skin_temp_c.level),
      ].join('');

      const hrSeries = rows.slice(-14).map((r) => r.heart_rate_bpm);
      const hrBaseline = AHM.baseline(allRows, 'heart_rate_bpm', baselineDays);
      document.getElementById('a-hr-chart').innerHTML = AHM_CHARTS.sparkline(hrSeries, { color: '#39c2c9', baselineLine: hrBaseline });

      const sleepTrailing = assessment.metrics.sleep.value;
      document.getElementById('a-sleep-hint').textContent = assessment.metrics.sleep.level;
      document.getElementById('a-sleep-grid').innerHTML = [
        metricTile('Last night', latest.sleep_actual_hr, 'h', 'NOMINAL'),
        metricTile('3-day avg', sleepTrailing.toFixed(1), 'h', assessment.metrics.sleep.level),
        metricTile('Scheduled', data.references.sleep.scheduled_hr, 'h', 'NOMINAL'),
        metricTile('Deficit (3d)', (data.references.sleep.scheduled_hr - sleepTrailing).toFixed(1), 'h', assessment.metrics.sleep.level),
      ].join('');
      document.getElementById('a-sleep-chart').innerHTML = AHM_CHARTS.sparkline(
        rows.slice(-14).map((r) => r.sleep_actual_hr), { color: '#39c2c9', thresholdLine: data.references.sleep.scheduled_hr }
      );
      document.getElementById('a-sleep-footnote').textContent =
        'Dashed red line = scheduled sleep (8.5 h, per NASA in-flight scheduling). The trailing 3-day average drives alerts, not a single night.';

      const totalMin = latest.exercise_aerobic_min + latest.exercise_resistance_min;
      const prescribed = data.references.exercise.prescribed_minutes_per_day;
      document.getElementById('a-exercise-hint').textContent = assessment.metrics.exercise.level;
      document.getElementById('a-exercise-grid').innerHTML = [
        metricTile('Today', totalMin, 'min', 'NOMINAL'),
        metricTile('Aerobic', latest.exercise_aerobic_min, 'min', 'NOMINAL'),
        metricTile('Resistance', latest.exercise_resistance_min, 'min', 'NOMINAL'),
        metricTile('Compliance (3d)', assessment.metrics.exercise.value.toFixed(0), '%', assessment.metrics.exercise.level),
      ].join('');
      document.getElementById('a-exercise-chart').innerHTML = AHM_CHARTS.sparkline(
        rows.slice(-14).map((r) => r.exercise_aerobic_min + r.exercise_resistance_min), { color: '#39c2c9', thresholdLine: prescribed }
      );
      document.getElementById('a-exercise-footnote').textContent =
        `Dashed red line = prescribed regimen (~${prescribed} min/day, 6 days/week, per ISS exercise countermeasure protocol).`;

      renderWellbeingSliders(latest);

      const msk = assessment.metrics.musculoskeletal;
      document.getElementById('a-musculoskeletal-panel').innerHTML = `
        <div class="metric-grid">
          ${metricTile('Est. cumulative BMD change', '\u2212' + msk.cumulativeLossPct.toFixed(1), '%', msk.level)}
          ${metricTile('Resistance compliance (avg)', msk.avgResistanceCompliancePct.toFixed(0), '%', 'NOMINAL')}
          ${metricTile('Effective monthly rate', '\u2212' + msk.effectiveMonthlyRate.toFixed(2), '%/mo', 'NOMINAL')}
        </div>
        <p class="footnote" style="margin-top:12px;">
          A <strong>modeled estimate</strong>, not a direct measurement — spaceflight studies report
          0.4\u20132.7% BMD loss per month at weight-bearing sites absent effective countermeasures,
          mitigated by resistance-exercise compliance (Smith et al., 2012; NASA/TM-2018-219938).
          Never read this as an actual densitometry result.
        </p>`;

      document.getElementById('a-alerts-hint').textContent = `${topAlerts.length} active`;
      document.getElementById('a-alerts-list').innerHTML = topAlerts.length
        ? topAlerts.map((a) => `
            <div class="alert-item">
              <span class="dot dot--${levelClass(a.level)}" style="margin-top:6px;"></span>
              <div class="alert-item__body">
                <div class="alert-item__title">${a.title}</div>
                <div class="alert-item__meta">${a.level}${a.composite ? ' · MULTI-PARAMETER' : ''}</div>
              </div>
            </div>`).join('')
        : `<div class="empty-state">No active alerts for Mission Day ${state.day}.</div>`;

      renderIncomingMessage();
      renderHistory();
    }

    function renderWellbeingSliders(latest) {
      const fields = [
        ['mood_1_5', 'Mood'], ['stress_1_5', 'Stress'], ['fatigue_1_5', 'Fatigue'],
        ['motivation_1_5', 'Motivation'], ['social_1_5', 'Social'],
      ];
      const container = document.getElementById('a-wellbeing-sliders');
      container.innerHTML = fields.map(([field, label]) => `
        <div class="slider-row">
          <span>${label}</span>
          <input type="range" min="1" max="5" step="1" value="${Math.round(latest[field])}" data-field="${field}" />
          <span class="val" data-out="${field}">${Math.round(latest[field])}</span>
        </div>`).join('');
      container.querySelectorAll('input[type="range"]').forEach((input) => {
        input.addEventListener('input', () => {
          container.querySelector(`[data-out="${input.dataset.field}"]`).textContent = input.value;
        });
      });
    }

    document.getElementById('a-submit-wellbeing').addEventListener('click', () => {
      const container = document.getElementById('a-wellbeing-sliders');
      const overrides = loadOverrides();
      const key = `${state.crewId}:${state.day}`;
      const entry = overrides[key] || {};
      container.querySelectorAll('input[type="range"]').forEach((input) => { entry[input.dataset.field] = Number(input.value); });
      overrides[key] = entry;
      saveOverrides(overrides);
      AHM.logEvent({
        type: 'checkin', crewId: state.crewId, day: state.day,
        title: `${crewList.find((c) => c.id === state.crewId).name} submitted a wellbeing check-in`,
      });
      render();
    });

    function renderIncomingMessage() {
      const pending = AHM.readEvents()
        .filter((e) => e.type === 'message' && e.crewId === state.crewId && !e.acknowledged)
        .sort((a, b) => b.time - a.time)[0];

      const slot = document.getElementById('a-incoming-message-slot');
      if (!pending) { slot.innerHTML = ''; return; }

      slot.innerHTML = `
        <div class="incoming-message">
          <div class="incoming-message__from">MESSAGE FROM MISSION CONTROL — ${AHM.formatTime(pending.time)}</div>
          <div class="incoming-message__body">${pending.title}${pending.detail ? `<br><span style="color:var(--text-dim); font-size:0.88rem;">${pending.detail}</span>` : ''}</div>
          <button class="btn btn--primary" id="a-ack-btn">Acknowledge</button>
        </div>`;

      document.getElementById('a-ack-btn').addEventListener('click', () => {
        AHM.acknowledgeEvent(pending.id);
        AHM.logEvent({
          type: 'ack', crewId: state.crewId,
          title: `${crewList.find((c) => c.id === state.crewId).name} acknowledged Mission Control's recommendation`,
        });
        render();
      });
    }

    function renderHistory() {
      const events = AHM.readEvents()
        .filter((e) => !e.crewId || e.crewId === state.crewId)
        .sort((a, b) => b.time - a.time)
        .slice(0, 25);
      const tbody = document.querySelector('#a-history tbody');
      tbody.innerHTML = events.length
        ? events.map((e) => `
            <tr>
              <td class="mono">${AHM.formatTime(e.time)}</td>
              <td>${eventTypeLabel(e.type)}</td>
              <td>${e.title}${e.acknowledged && e.type === 'message' ? ' <span class="pill pill--nominal" style="margin-left:6px;">ACK</span>' : ''}</td>
            </tr>`).join('')
        : `<tr><td colspan="3" class="empty-state">No events yet.</td></tr>`;
    }

    function eventTypeLabel(type) {
      return { alert: 'Alert generated', message: 'Mission Control message', ack: 'Acknowledged', checkin: 'Wellbeing check-in' }[type] || type;
    }

    return { render };
  })();

  /* ==================================================================== *
   * MISSION CONTROL VIEW
   * ==================================================================== */

  const missionControl = (() => {
    const RECOMMENDATION_TEMPLATES = [
      'Review scheduled recovery period and upcoming workload.',
      'Consider additional rest before the next duty shift.',
      'Review exercise compliance and adjust the regimen together.',
      'Review environmental conditions and CDRA performance.',
      'Notify the flight surgeon for a medical consultation.',
      'Investigate the abnormal telemetry source before next shift.',
    ];

    const state = { selectedCrewId: crewList[0].id, day: 30 };

    const daySlider = document.getElementById('m-day-slider');
    const dayValue = document.getElementById('m-day-value');
    daySlider.max = missionMax;
    daySlider.value = state.day;
    dayValue.textContent = state.day;
    daySlider.addEventListener('input', () => {
      state.day = Number(daySlider.value);
      dayValue.textContent = state.day;
      render();
    });

    function assessAllCrew() {
      return crewList.map((crew) => {
        const rows = AHM.telemetryForCrew(data.telemetry, crew.id).filter((r) => r.mission_day <= state.day);
        return { crew, rows, assessment: AHM.assessCrewMember(rows, data.references, baselineDays) };
      });
    }

    function render() {
      const perCrew = assessAllCrew();
      const envAll = AHM.environmentSeries(data.telemetry).filter((r) => r.mission_day <= state.day);
      const envAssessment = AHM.assessEnvironment(envAll, data.references, crewList.length);

      document.getElementById('m-subtitle').textContent =
        `Mission Day ${state.day} of ${missionMax} · ${crewList.length} crew · Baseline: days ${baselineDays[0]}\u2013${baselineDays[1]}`;

      let overall = envAssessment.overall;
      perCrew.forEach(({ assessment }) => { overall = AHM.worseOf(overall, assessment.overall); });
      document.getElementById('m-status-code').className = `status-banner__code status-banner__code--${levelClass(overall)}`;
      document.getElementById('m-status-code').textContent = overall;

      const allAlerts = [];
      perCrew.forEach(({ crew, assessment }) => {
        assessment.alerts.forEach((a) => allAlerts.push({ ...a, crewId: crew.id, crewName: crew.name }));
        AHM.ensureAlertLogged(crew.id, state.day, assessment.overall,
          `${crew.name}: ${assessment.alerts[0] ? assessment.alerts[0].title : 'status change'}`, crew.id);
      });
      envAssessment.alerts.forEach((a) => allAlerts.push({ ...a, crewId: null, crewName: 'Station environment' }));
      AHM.ensureAlertLogged('environment', state.day, envAssessment.overall,
        envAssessment.alerts[0] ? envAssessment.alerts[0].title : 'Environment status change', null);

      document.getElementById('m-status-desc').textContent = allAlerts.length
        ? `${allAlerts.length} active indicator${allAlerts.length > 1 ? 's' : ''} outside nominal range across the crew and station.`
        : 'All crew and station indicators are within their nominal ranges.';

      renderCrewRoster(perCrew);
      renderEnvironment(envAssessment, envAll);
      renderCrewDetail(perCrew);
      renderAlerts(allAlerts);
      renderHistory();
    }

    function renderCrewRoster(perCrew) {
      const container = document.getElementById('m-crew-roster');
      container.innerHTML = perCrew.map(({ crew, assessment }) => `
        <button class="crew-card ${crew.id === state.selectedCrewId ? 'is-selected' : ''}" data-crew="${crew.id}">
          <span class="crew-card__avatar">${crew.photo_initials}</span>
          <span>
            <span class="crew-card__name" style="display:block;">${crew.name}</span>
            <span class="crew-card__role">${crew.role}</span>
          </span>
          <span class="crew-card__status pill pill--${levelClass(assessment.overall)}">
            <span class="dot dot--${levelClass(assessment.overall)}"></span>${assessment.overall}
          </span>
        </button>`).join('');

      container.querySelectorAll('.crew-card').forEach((btn) => {
        btn.addEventListener('click', () => { state.selectedCrewId = btn.dataset.crew; render(); });
      });
    }

    function renderEnvironment(envAssessment, envAll) {
      const m = envAssessment.metrics;
      document.getElementById('m-env-grid').innerHTML = [
        metricTile('CO2', m.co2_mmhg.value, 'mmHg', m.co2_mmhg.level),
        metricTile('O2 partial pressure', m.o2_pp_mmhg.value, 'mmHg', m.o2_pp_mmhg.level),
        metricTile('Cabin pressure', m.cabin_pressure_psia.value, 'psia', m.cabin_pressure_psia.level),
        metricTile('Cabin temp', m.cabin_temp_c.value, '\u00b0C', m.cabin_temp_c.level),
        metricTile('Humidity', m.humidity_pct.value, '%', m.humidity_pct.level),
        metricTile('Food reserve', m.food_reserve_days.value.toFixed(0), 'days', m.food_reserve_days.level),
        metricTile('Water reserve', m.water_reserve_days.value.toFixed(0), 'days', m.water_reserve_days.level),
      ].join('');

      document.getElementById('m-co2-chart').innerHTML = AHM_CHARTS.sparkline(
        envAll.slice(-21).map((r) => r.co2_mmhg),
        { color: '#39c2c9', thresholdLine: data.references.environment.co2_mmhg.critical_above }
      );
      const proj = m.co2_projection;
      document.getElementById('m-env-footnote').textContent = proj !== null
        ? `CO2 trend (21-day). Dashed red line = NASA-STD-3001 attention ceiling. Projected to reach it in ~${(proj * 24).toFixed(0)} h at the current rate (model, not a guarantee).`
        : 'CO2 trend (21-day). Dashed red line = NASA-STD-3001 attention ceiling (4.0 mmHg operational / 3.0 mmHg standard).';
    }

    function renderCrewDetail(perCrew) {
      const entry = perCrew.find((p) => p.crew.id === state.selectedCrewId) || perCrew[0];
      const { crew, assessment } = entry;
      const latest = assessment.latest;

      document.getElementById('m-crew-detail-name').textContent = crew.name;
      document.getElementById('m-crew-detail-role').textContent = `${crew.role} \u00b7 ${assessment.overall}`;

      document.getElementById('m-crew-detail-grids').innerHTML = `
        <div>
          <h4 style="font-size:0.82rem; color:var(--text-faint); margin-bottom:10px;">VITALS</h4>
          <div class="metric-grid">
            ${metricTile('Heart rate', latest.heart_rate_bpm, 'bpm', assessment.metrics.heart_rate_bpm.level)}
            ${metricTile('Respiration', latest.respiration_rate, '/min', assessment.metrics.respiration_rate.level)}
            ${metricTile('SpO2', latest.spo2_pct, '%', assessment.metrics.spo2_pct.level)}
          </div>
        </div>
        <div>
          <h4 style="font-size:0.82rem; color:var(--text-faint); margin-bottom:10px;">RECOVERY</h4>
          <div class="metric-grid">
            ${metricTile('Sleep (3d avg)', assessment.metrics.sleep.value.toFixed(1), 'h', assessment.metrics.sleep.level)}
            ${metricTile('Exercise compliance', assessment.metrics.exercise.value.toFixed(0), '%', assessment.metrics.exercise.level)}
            ${metricTile('Fatigue', latest.fatigue_1_5, '/5', assessment.metrics.fatigue.level)}
          </div>
        </div>
        <div>
          <h4 style="font-size:0.82rem; color:var(--text-faint); margin-bottom:10px;">MUSCULOSKELETAL (MODELED)</h4>
          <div class="metric-grid">
            ${metricTile('Est. BMD change', '\u2212' + assessment.metrics.musculoskeletal.cumulativeLossPct.toFixed(1), '%', assessment.metrics.musculoskeletal.level)}
          </div>
        </div>`;
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
                <div class="alert-item__meta">${a.crewName} \u00b7 ${a.level}${a.composite ? ' \u00b7 MULTI-PARAMETER' : ''}</div>
              </div>
            </div>`).join('')
        : `<div class="empty-state">No active alerts on Mission Day ${state.day}.</div>`;
    }

    function renderHistory() {
      const events = AHM.readEvents().sort((a, b) => b.time - a.time).slice(0, 40);
      const tbody = document.querySelector('#m-history tbody');
      tbody.innerHTML = events.length
        ? events.map((e) => `
            <tr>
              <td class="mono">${AHM.formatTime(e.time)}</td>
              <td>${eventTypeLabel(e.type)}</td>
              <td>${e.title}${e.acknowledged && e.type === 'message' ? ' <span class="pill pill--nominal" style="margin-left:6px;">ACK</span>' : ''}</td>
            </tr>`).join('')
        : `<tr><td colspan="3" class="empty-state">No events yet.</td></tr>`;
    }

    function eventTypeLabel(type) {
      return { alert: 'Alert generated', message: 'Recommendation sent', ack: 'Astronaut acknowledged', checkin: 'Wellbeing check-in' }[type] || type;
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
      AHM.logEvent({ type: 'message', crewId: crew.id, title: `Recommendation sent to ${crew.name}`, detail: text });
      document.getElementById('m-message-text').value = '';
      render();
    });

    return { render };
  })();

  /* ------------------------------------------------------------------ *
   * Wire the two views to the shared event log and do the first render
   * ------------------------------------------------------------------ */

  AHM.onEventsChanged(() => { astro.render(); missionControl.render(); });
  astro.render();
  missionControl.render();
})();
