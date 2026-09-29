/* ==========================================================================
   shell.js
   The whole application: hash router + every screen template (role select,
   login, the astronaut/mission-control app shell and its 14 pages) plus
   the GET replay control bar. Markup and class names follow the Figma
   "Health Monitoring Application Design" export exactly; the data behind
   every number comes from engine.js, which reads the real Apollo 15
   dataset. No page here invents a figure the Figma file didn't already
   show as a placeholder — placeholders are replaced with real or clearly
   estimated mission data, never left as fiction.
   ========================================================================== */

(function () {
  const I = (name, size) => `<i data-icon="${name}" data-size="${size || 18}"></i>`;
  const esc = (s) => String(s).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
  const fmt1 = (n) => (Math.round(n * 10) / 10).toFixed(1);
  const fmt0 = (n) => Math.round(n).toString();

  const astronautNav = [['Dashboard', 'home'], ['Health Status', 'heart'], ['Activity', 'activity'], ['Sleep', 'moon'], ['Radiation', 'orbit'], ['Reports', 'report'], ['Settings', 'settings']];
  const controlNav = [['Dashboard', 'home'], ['Crew Monitoring', 'crew'], ['Health Analytics', 'activity'], ['Mission Status', 'orbit'], ['Alerts', 'alert'], ['Reports', 'report'], ['Settings', 'settings']];
  const slug = (label) => label.toLowerCase().replaceAll(' ', '-');

  /* ------------------------------------------------------------------ *
   * Shared state: route + the GET replay clock
   * ------------------------------------------------------------------ */

  const TOTAL_HOURS = ENGINE.TOTAL_HOURS;
  const sim = { hour: 0, playing: false, timer: null, speed: 8 };            // 8 GET-hours per real second
  const TICK_MS = 200;

  function parseHash() {
    const h = (location.hash || '#role').slice(1);
    if (h === 'role' || h === 'astronaut-login' || h === 'control-login') return { screen: h };
    const m = h.match(/^(astronaut|control)-(.+)$/);
    if (m) return { screen: 'app', role: m[1], page: m[2] };
    return { screen: 'role' };
  }

  function navigate(hash) {
    location.hash = hash;
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  /* ------------------------------------------------------------------ *
   * Small shared pieces
   * ------------------------------------------------------------------ */

  function Brand(compact) {
    return `<div class="brand ${compact ? 'brand-compact' : ''}">
      <div class="brand-mark"><div class="brand-orbit"></div><div class="brand-star"></div></div>
      ${compact ? '' : '<div><div class="brand-name">ASTRONOMICAN</div><div class="brand-caption">HUMAN SYSTEMS // ORBITAL — APOLLO 15 REPLAY</div></div>'}
    </div>`;
  }

  function BackButton(disabled) {
    return `<button class="btn back-btn" id="btn-back" ${disabled ? 'disabled' : ''} type="button">${I('arrow')}Back</button>`;
  }

  function Breadcrumb(items) {
    return `<div class="breadcrumb"><span>Astronomican</span>${items.map((i) => `<span>${esc(i)}</span>`).join('')}</div>`;
  }

  function StatusPill(text, tone) {
    return `<span class="pill ${tone || 'good'}"><span></span>${esc(text)}</span>`;
  }

  function MetricCard({ label, value, unit, status, change, icon }) {
    return `<div class="card metric-card">
      <div class="metric-head"><span>${esc(label)}</span><div class="metric-icon ${status || 'good'}">${I(icon)}</div></div>
      <div class="metric-value${typeof value === 'string' && value.length > 6 ? ' text' : ''}">${esc(value)}<small>${esc(unit)}</small></div>
      <div class="metric-foot">${StatusPill(status === 'danger' ? 'Alert' : status === 'warn' ? 'Monitor' : 'Normal', status || 'good')}<span>${esc(change)}</span></div>
    </div>`;
  }

  // points: [{x,y}]; eva: [{start,end}] in the same x-domain; markerX: real-event x positions
  function LineChart({ color = 'cyan', points, eva = [], markers = [] }) {
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
    const dots = markers.filter((m) => m.x >= x0 && m.x <= x1).map((m) => {
      const px = points.reduce((best, p) => Math.abs(p.x - m.x) < Math.abs(best.x - m.x) ? p : best, points[0]);
      return `<circle class="marker" cx="${sx(m.x).toFixed(1)}" cy="${sy(px.y).toFixed(1)}" r="1"></circle>`;
    }).join('');
    return `<svg class="line-chart ${color}" preserveAspectRatio="none" viewBox="0 0 340 100">
      <defs><linearGradient id="fill-${color}" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="currentColor" stop-opacity=".28"></stop><stop offset="1" stop-color="currentColor" stop-opacity="0"></stop></linearGradient></defs>
      <path class="grid-line" d="M0 20h340M0 50h340M0 80h340"></path>
      ${bands}
      <polygon fill="url(#fill-${color})" points="${coords} 340,100 0,100"></polygon>
      <polyline class="series" fill="none" points="${coords}"></polyline>
      ${dots}
    </svg>`;
  }

  function ChartCard({ kicker = 'TREND ANALYSIS', label, meta, body, axis }) {
    return `<div class="card chart-card">
      <div class="card-head"><div><span class="card-kicker">${esc(kicker)}</span><strong>${esc(label)}</strong></div><span class="chart-meta">${esc(meta)}</span></div>
      <div class="chart-body${axis ? ' has-y' : ''}">${axis ? `<div class="chart-y">${axis.map((a) => `<span>${esc(a)}</span>`).join('')}</div>` : ''}${body}</div>
    </div>`;
  }

  function ChartLegend(items) {
    return `<div class="chart-legend">${items.map((it) => `<span><i class="sw-${it.sw}"></i>${esc(it.label)}</span>`).join('')}</div>`;
  }

  function timeAgo(hour, nowHour) {
    const dh = nowHour - hour;
    if (dh < 1 / 60) return 'just now';
    if (dh < 1) return `${Math.round(dh * 60)}m ago`;
    if (dh < 24) return `${Math.round(dh)}h ago`;
    return `${Math.round(dh / 24)}d ago`;
  }

  /* ------------------------------------------------------------------ *
   * Screen: Role selection
   * ------------------------------------------------------------------ */

  let selectedRole = 'astronaut';

  function tplRoleSelect() {
    const roleCard = (active, bullets, icon, label, title, code) => `
      <button class="role-card ${active ? 'active' : ''}" data-role="${label === 'ASTRONAUT' ? 'astronaut' : 'control'}" type="button">
        <div class="role-card-top"><div class="role-icon">${I(icon, 28)}</div><span class="role-code">${label}</span><span class="radio-indicator">${active ? '<span></span>' : ''}</span></div>
        <div class="role-title">${title}</div>
        <div class="role-rule"></div>
        <div class="role-bullets">${bullets.map((b) => `<div>${I('check', 15)}<span>${esc(b)}</span></div>`).join('')}</div>
        <div class="role-card-footer">${active ? 'SELECTED' : 'SELECT ROLE'}<span>${code}</span></div>
      </button>`;
    return `<main class="entry-screen">
      <div class="starfield"></div>
      <header class="entry-header">${BackButton(true)}${Brand()}<div class="system-status"><span class="status-dot"></span>SYSTEM ONLINE</div></header>
      <div class="entry-breadcrumb">${Breadcrumb(['Role selection'])}</div>
      <section class="role-wrap">
        <div class="eyebrow">ORBITAL HEALTH NETWORK // ACCESS PORTAL</div>
        <div class="display-title">Welcome to Astronomican</div>
        <p class="display-subtitle">Real Apollo 15 biomedical telemetry, replayed hour by hour</p>
        <div class="role-grid">
          ${roleCard(selectedRole === 'astronaut', ['Personal health monitoring', 'Mission performance tracking', 'Radiation and wellness monitoring'], 'user', 'Crew Member', 'ASTRONAUT', '01')}
          ${roleCard(selectedRole === 'control', ['Crew monitoring', 'Mission oversight', 'Health analytics and alerts'], 'crew', 'Control Operator', 'MISSION CONTROL', '02')}
        </div>
        <button class="btn primary continue-btn" id="btn-continue" type="button">Continue as ${selectedRole === 'astronaut' ? 'Astronaut' : 'Mission Control'}${I('arrow')}</button>
        <div class="entry-footnote">SECURE ACCESS • AUTHORIZED PERSONNEL ONLY • ASTRONOMICAN v4.2 · <a href="#about" id="link-about">About this replay</a></div>
      </section>
      ${tplAbout()}
    </main>`;
  }

  function tplAbout() {
    const ev = ENGINE.DATA.events.length;
    const m = ENGINE.DATA.mission;
    return `<section class="about-wrap" id="about">
      <div class="about-head">
        <div class="eyebrow">NASA SPACE APPS 2026 — PRE-SCREENING PROTOTYPE</div>
        <h2>Replaying Apollo 15's real biomedical record</h2>
        <p>Every event, timestamp and cited figure in this replay is drawn from NASA's own Apollo 15 Mission Report — including the real cardiac arrhythmia Lunar Module Pilot James Irwin experienced after lunar liftoff, and Mission Control's real decision about it.</p>
      </div>
      <div class="about-stats">
        <div class="card about-stat"><span class="card-kicker">MISSION DURATION</span><strong>${AHM.formatGet(TOTAL_HOURS)}</strong><span>real GET, launch to splashdown</span></div>
        <div class="card about-stat"><span class="card-kicker">CREW</span><strong>${m.crew_size} crew</strong><span>${ENGINE.CREW.map((c) => ENGINE.crewShortName(c)).join(' · ')}</span></div>
        <div class="card about-stat"><span class="card-kicker">CITED EVENTS</span><strong>${ev} events</strong><span>sourced to NASA's own mission report</span></div>
      </div>
      <div class="about-grid">
        <div class="card card-pad">
          <span class="card-kicker">THE WORKFLOW</span><strong style="display:block;margin-top:6px;font-size:15px;">Monitor → detect → explain → act → record</strong>
          <div class="workflow"><span class="step">MONITOR</span><span class="arrow">→</span><span class="step">DETECT</span><span class="arrow">→</span><span class="step">EXPLAIN</span><span class="arrow">→</span><span class="step">ACT</span><span class="arrow">→</span><span class="step">RECORD</span></div>
          <p class="card-text">Irwin's EKG showed an abnormal rhythm (<strong>monitor</strong>); flight surgeon Dr. Charles Berry recognized it as serious (<strong>detect</strong>); leadership weighed what it meant for the mission (<strong>explain</strong>); Mission Control made a real call about what to do — and what to tell the crew (<strong>act</strong>) — and it's still documented and studied today (<strong>record</strong>).</p>
        </div>
        <div class="card card-pad">
          <span class="card-kicker">PRIMARY DATA SOURCES</span>
          <ul class="source-list">
            <li>Apollo 15 Mission Report (MSC-07230), NASA, 1971 — Section 10, Biomedical Evaluation.</li>
            <li>Apollo 15 Activities Timeline, Table 4-I — second-accurate EVA and liftoff timestamps.</li>
            <li>Wikipedia, "Return of Apollo 15 to Earth" — cardiac-event narrative, cross-checked against flight directors' memoirs.</li>
            <li>Delp MD, et al., arXiv:2208.00892 — PVC count and GET for Irwin's arrhythmia.</li>
            <li>NASA SP-368, <em>Biomedical Results of Apollo</em> — Environmental Control System design.</li>
          </ul>
        </div>
      </div>
      <div class="about-foot">Apollo 15 Health Monitor Replay — a NASA Space Apps Challenge 2026 prototype. Historical figures are cited; anything computed for this simulator (score, modern-monitor estimates, dose curve) is clearly labeled where it appears. See README.md for full citations and corrections.</div>
    </section>`;
  }

  /* ------------------------------------------------------------------ *
   * Screen: Login
   * ------------------------------------------------------------------ */

  function tplLogin(role) {
    const isA = role === 'astronaut';
    return `<main class="entry-screen login-screen">
      <div class="starfield"></div>
      <header class="entry-header">${BackButton(false)}${Brand()}<div class="system-status"><span class="status-dot"></span>ENCRYPTED CONNECTION</div></header>
      <div class="entry-breadcrumb">${Breadcrumb(['Role selection', `${isA ? 'Astronaut' : 'Mission Control'} login`])}</div>
      <section class="login-wrap">
        <div class="login-visual" aria-label="${isA ? 'Astronaut mission patch illustration' : 'Mission control orbital illustration'}">
          <div class="visual-grid"></div><div class="orbit orbit-one"></div><div class="orbit orbit-two"></div>
          <div class="planet">${I(isA ? 'user' : 'orbit', 48)}</div>
          <div class="mission-tag">${isA ? 'CREW ACCESS' : 'GROUND SYSTEMS'}</div>
          <div class="visual-data data-a">GET ${AHM.formatGet(sim.hour)}</div>
          <div class="visual-data data-b">LINK STABLE</div>
        </div>
        <form class="login-panel" id="login-form">
          <div class="eyebrow">${isA ? 'CREW IDENTITY VERIFICATION' : 'OPERATIONS AUTHORIZATION'}</div>
          <div class="login-title">${isA ? 'Astronaut' : 'Mission Control'} Login</div>
          <p>Enter your secure credentials to access the Astronomican health network.</p>
          <div class="form-stack">
            <label class="field"><span>${isA ? 'Astronaut ID' : 'Operator ID'}</span><input placeholder="${isA ? 'AST-2049' : 'MCO-7741'}" type="text"></label>
            <label class="field"><span>Password</span><input placeholder="Enter secure password" type="password"></label>
          </div>
          <div class="login-options"><span><span class="status-dot"></span>Biometric verification ready</span><span>Need access?</span></div>
          <button class="btn primary login-submit" type="submit">Authenticate &amp; Enter${I('arrow')}</button>
          <button class="btn secondary login-back" id="btn-login-back" type="button">${I('arrow')}Back to role selection</button>
          <div class="security-note">${I('shield')}<span>256-bit secure mission network<br>Session monitored by flight operations</span></div>
        </form>
      </section>
    </main>`;
  }

  /* ------------------------------------------------------------------ *
   * App shell (sidebar + topbar) + Simulate bar
   * ------------------------------------------------------------------ */

  function usesSimBar(page) {
    return ['dashboard', 'health-status', 'activity', 'sleep', 'radiation', 'crew-monitoring', 'health-analytics', 'mission-status', 'alerts'].includes(page);
  }

  function tplSimBar() {
    const events = ENGINE.DATA.events;
    const marks = events.map((e) => `<i style="left:${(e.get_hours / TOTAL_HOURS * 100).toFixed(2)}%;background:${e.severity === 'CRITICAL' ? 'var(--red)' : e.category === 'eva' ? 'var(--yellow)' : 'var(--line-strong)'}"></i>`).join('');
    return `<div class="sim-bar">
      <div class="sim-get"><span class="sim-label">GET</span><div><strong id="sim-readout">${AHM.formatGet(sim.hour)}</strong><br><small>Day ${ENGINE.missionDay(sim.hour)} of ${ENGINE.missionTotalDays()}</small></div></div>
      <div class="sim-controls">
        <button class="btn filter-btn" id="sim-reset" title="Jump to launch" type="button">${I('reset', 15)}</button>
        <button class="btn filter-btn" id="sim-back" title="Back 6h" type="button">−6h</button>
        <button class="btn primary ${sim.playing ? 'is-playing' : ''}" id="sim-play" type="button">${I(sim.playing ? 'pause' : 'play', 14)}${sim.playing ? 'Pause' : 'Simulate'}</button>
        <button class="btn filter-btn" id="sim-fwd" title="Forward 6h" type="button">+6h</button>
      </div>
      <div class="sim-scrub"><div class="sim-ticks">${marks}</div><input id="sim-range" max="${TOTAL_HOURS}" min="0" step="0.05" type="range" value="${sim.hour}"></div>
      <div class="sim-jump"><label>JUMP TO</label><select class="select-ctl" id="sim-jump"><option value="">Mission event…</option>${events.map((e) => `<option value="${e.get_hours}">GET ${AHM.formatGet(e.get_hours)} — ${esc(e.title)}</option>`).join('')}</select></div>
    </div>`;
  }

  function tplShell(role, page) {
    const nav = role === 'astronaut' ? astronautNav : controlNav;
    const title = (nav.find(([l]) => slug(l) === page) || nav[0])[0];
    const station = role === 'astronaut' ? ENGINE.crewSnapshot('LMP', sim.hour) : null; // logged-in astronaut = Irwin, the mission's documented case
    const openAlerts = ENGINE.DATA.events.filter((e) => e.severity && sim.hour >= e.get_hours && sim.hour <= (e.active_until_hours ?? e.get_hours + 3)).length;
    return `<main class="app-shell">
      <aside class="sidebar">
        ${Brand()}
        <div class="side-label">${role === 'astronaut' ? 'CREW SYSTEMS' : 'FLIGHT OPERATIONS'}</div>
        <nav class="side-nav">
          ${nav.map(([label, icon]) => `<button class="btn ${slug(label) === page ? 'active' : ''}" data-nav="${role}-${slug(label)}" type="button">${I(icon)}<span>${label}</span>${label === 'Alerts' && openAlerts ? `<span class="nav-count">${openAlerts}</span>` : ''}</button>`).join('')}
        </nav>
        <div class="side-mission">
          <div class="side-mission-top"><span>MISSION</span><span class="online-label">${sim.hour >= TOTAL_HOURS ? 'COMPLETE' : 'NOMINAL'}</span></div>
          <div class="mission-name">APOLLO 15</div>
          <div class="mission-progress"><span style="width:${Math.min(100, sim.hour / TOTAL_HOURS * 100).toFixed(1)}%"></span></div>
          <div class="side-mission-meta"><span>DAY ${ENGINE.missionDay(sim.hour)}</span><span>${Math.min(100, Math.round(sim.hour / TOTAL_HOURS * 100))}%</span></div>
        </div>
        <div class="side-user">
          <div class="avatar">${I('user')}</div>
          <div><strong>${role === 'astronaut' ? 'James B. Irwin' : 'Flight Director'}</strong><span>${role === 'astronaut' ? 'Lunar Module Pilot' : 'Mission Control, Houston'}</span></div>
          <span class="status-dot"></span>
        </div>
      </aside>
      <section class="workspace">
        <header class="topbar">
          <div>${BackButton(false)}${Breadcrumb([role === 'astronaut' ? 'Astronaut' : 'Mission Control', title])}</div>
          <div class="topbar-actions">
            <div class="sync-status"><span class="status-dot ${sim.playing ? 'live' : ''}"></span> ${sim.playing ? 'REPLAYING' : 'PAUSED'} <strong>GET ${AHM.formatGet(sim.hour)}</strong></div>
            <button class="btn icon-btn" data-nav="${role}-alerts" type="button">${I('alert')}${openAlerts ? '<span class="notification-ping"></span>' : ''}</button>
            <button class="btn icon-btn" data-nav="${role}-settings" type="button">${I('settings')}</button>
          </div>
        </header>
        <div class="workspace-content" id="workspace-content">${tplPageWrap(role, page, title)}</div>
      </section>
    </main>`;
  }

  function tplPageWrap(role, page, title) {
    return `<div class="page-heading">
        <div><div class="eyebrow">${role === 'astronaut' ? 'PERSONAL HEALTH SYSTEM' : 'MISSION OPERATIONS'} // ${title.toUpperCase()}</div><div class="page-title">${title}</div></div>
        <div class="page-tools"><span class="range-label">GET REPLAY</span><button class="btn filter-btn" disabled type="button">Apollo 15 · full mission</button><button class="btn export-btn" id="btn-export" type="button">${I('download')} Export</button></div>
      </div>
      ${usesSimBar(page) ? tplSimBar() : ''}
      <div id="page-body">${pageRouter(role, page)}</div>`;
  }

  /* ------------------------------------------------------------------ *
   * Astronaut pages
   * ------------------------------------------------------------------ */

  const ASTRO_CREW_DEFAULT = 'LMP';

  function AstronautDashboard() {
    const s = ENGINE.crewSnapshot(ASTRO_CREW_DEFAULT, sim.hour);
    const [title, copy] = ENGINE.scoreCopy(s.score);
    const alerts = ENGINE.DATA.events.filter((e) => e.severity && sim.hour >= e.get_hours && sim.hour <= (e.active_until_hours ?? e.get_hours + 3));
    const hrSeries = ENGINE.series(ASTRO_CREW_DEFAULT, sim.hour, 48, 'heart_rate_bpm');
    const rrSeries = ENGINE.series(ASTRO_CREW_DEFAULT, sim.hour, 48, 'respiration_rate');
    const tone = s.score >= 90 ? 'good' : s.score >= 75 ? '' : s.score >= 55 ? 'is-warn' : 'is-danger';
    return `<section class="hero-grid">
        <div class="card health-hero ${tone}">
          <div class="score-ring" style="--ring-p:${s.score};${s.score < 90 ? '--ring-c:var(--orange)' : ''}"><div><strong>${s.score}</strong><span>/ 100</span></div></div>
          <div class="health-copy"><span class="card-kicker">OVERALL HEALTH SCORE</span><strong>${title}</strong><p>${copy}</p>${StatusPill(alerts.length ? `${alerts.length} active notice${alerts.length > 1 ? 's' : ''}` : 'All systems nominal', alerts.length ? 'warn' : 'good')}<span class="derived-note">Score is computed from real HR/RR bands and active events — see engine.js.</span></div>
          <div class="hero-scan"></div>
        </div>
        <div class="card mission-hero">
          <div class="mission-hero-head"><span>MISSION STATUS</span>${StatusPill(sim.hour >= TOTAL_HOURS ? 'Complete' : 'Nominal', 'good')}</div>
          <div class="mission-hero-title">APOLLO 15 <span>• ${sim.hour < 104.7 ? 'TRANSLUNAR' : sim.hour < 240 ? 'LUNAR SURFACE / ORBIT' : 'TRANSEARTH'}</span></div>
          <div class="hero-stats">
            <div><small>MISSION DAY</small><strong>${ENGINE.missionDay(sim.hour)}</strong></div>
            <div><small>GET</small><strong>${AHM.formatGet(sim.hour)}</strong><span>H:MM</span></div>
            <div><small>COMPLETE</small><strong>${Math.round(sim.hour / TOTAL_HOURS * 100)}%</strong><span>OF MISSION</span></div>
          </div>
          <div class="mission-bar"><span style="width:${Math.min(100, sim.hour / TOTAL_HOURS * 100).toFixed(1)}%"></span></div>
        </div>
      </section>
      <div class="section-title"><span>LIVE VITALS — JAMES B. IRWIN (LMP)</span><small>GET ${AHM.formatGet(sim.hour)}</small></div>
      <section class="metric-grid six">
        ${MetricCard({ label: 'Heart Rate', value: fmt0(s.assess.row.heart_rate_bpm), unit: 'BPM', icon: 'heart', status: s.assess.hrLevel === 'NOMINAL' ? 'good' : s.assess.hrLevel === 'ATTENTION' ? 'warn' : 'danger', change: s.assess.eva ? 'EVA exertion — expected' : `${s.assess.row.heart_rate_basis}` })}
        ${MetricCard({ label: 'Blood Pressure (est.)', value: `${fmt0(s.modern.systolicBp)}/${fmt0(s.modern.systolicBp - 40)}`, unit: 'mmHg', icon: 'activity', status: 'good', change: 'Modern-monitor estimate' })}
        ${MetricCard({ label: 'Oxygen Saturation (est.)', value: fmt1(s.modern.spo2), unit: 'SpO₂', icon: 'spark', status: 'good', change: '100% O₂ cabin' })}
        ${MetricCard({ label: 'Skin Temperature (est.)', value: fmt1(s.modern.skinTemp), unit: '°C', icon: 'thermometer', status: 'good', change: 'Stable' })}
        ${MetricCard({ label: 'Bone Density', value: `${fmt1(ENGINE.boneDensityPct(sim.hour))}%`, unit: 'MODELED', icon: 'activity', status: ENGINE.boneDensityPct(sim.hour) < -1 ? 'warn' : 'good', change: 'Endpoint real: −4% by splashdown' })}
        ${MetricCard({ label: 'Respiration Rate', value: fmt1(s.assess.row.respiration_rate), unit: 'br/min', icon: 'bolt', status: s.assess.rrLevel === 'NOMINAL' ? 'good' : 'warn', change: s.assess.row.respiration_basis })}
      </section>
      <section class="dashboard-bottom">
        ${ChartCard({ label: 'Heart Rate — last 48h', meta: `AVG ${fmt0(ENGINE.avg(hrSeries))} BPM`, body: LineChart({ color: 'cyan', points: hrSeries, eva: AHM.EVA_WINDOWS }) })}
        ${ChartCard({ label: 'Respiration — last 48h', meta: `AVG ${fmt1(ENGINE.avg(rrSeries))} br/min`, body: LineChart({ color: 'teal', points: rrSeries, eva: AHM.EVA_WINDOWS }) })}
        ${AlertSummaryCard()}
      </section>`;
  }

  function AlertSummaryCard() {
    const items = ENGINE.recentEvents(sim.hour, 4);
    const iconFor = (cat) => ({ medical: 'alert', eva: 'orbit', 'mission-control-decision': 'crew', milestone: 'spark', sleep: 'moon', postflight: 'check' }[cat] || 'spark');
    const toneFor = (e) => e.severity === 'CRITICAL' ? 'warning' : e.severity === 'ATTENTION' ? 'warning' : e.category === 'medical' ? 'warning' : 'info';
    return `<div class="card alert-summary">
      <div class="card-head"><div><span class="card-kicker">SYSTEM FEED</span><strong>Real Mission Events</strong></div><span class="alert-count">${ENGINE.eventsUpTo(sim.hour).length}</span></div>
      ${items.map((e) => `<div class="alert-item ${toneFor(e)}">${I(iconFor(e.category))}<div><strong>${esc(e.title)}</strong><span>${esc(ENGINE.EVENT_TAG_LABEL[e.category] || e.category)}</span></div><small>${timeAgo(e.get_hours, sim.hour)}</small></div>`).join('') || `<div class="empty">No events yet — GET ${AHM.formatGet(sim.hour)}</div>`}
      <button class="btn text-btn" data-nav="astronaut-health-status" type="button">View full timeline ${I('arrow')}</button>
    </div>`;
  }

  const ASTRO_DETAIL = {
    'health-status': {
      icon: ['heart', 'activity', 'activity', 'activity'],
      chartTitle: 'Heart Rate History', chartField: 'heart_rate_bpm', chartColor: 'cyan',
      metrics: (s) => [
        ['Heart Rate', fmt0(s.assess.row.heart_rate_bpm), 'BPM', 'heart', s.assess.hrLevel === 'NOMINAL' ? 'good' : 'warn'],
        ['Blood Pressure (est.)', `${fmt0(s.modern.systolicBp)}/${fmt0(s.modern.systolicBp - 40)}`, 'mmHg', 'activity', 'good'],
        ['ECG Status', s.assess.alerts.some((a) => a.title.toLowerCase().includes('arrhythmia')) ? 'BIGEMINY' : 'SINUS RHYTHM', 'RHYTHM', 'activity', s.assess.alerts.some((a) => a.title.toLowerCase().includes('arrhythmia')) ? 'danger' : 'good'],
        ['Bone Density', `${fmt1(ENGINE.boneDensityPct(s.hour))}%`, 'MODELED', 'activity', ENGINE.boneDensityPct(s.hour) < -1 ? 'warn' : 'good'],
      ],
      sections: (s) => [
        ['Cardiovascular rhythm', s.assess.alerts.some((a) => a.title.toLowerCase().includes('arrhythmia')) ? 'Bigeminy flagged' : 'Normal sinus', s.assess.hrLevel === 'NOMINAL' ? 92 : 58, 'cyan'],
        ['Respiratory function', s.assess.rrLevel, s.assess.rrLevel === 'NOMINAL' ? 88 : 55, 'teal'],
        ['Skeletal / bone health', `${fmt1(ENGINE.boneDensityPct(s.hour))}% modeled loss`, Math.max(10, 100 + ENGINE.boneDensityPct(s.hour) * 15), 'violet'],
      ],
      summary: (s) => s.assess.alerts.length ? s.assess.alerts[0].detail : 'Cardiovascular and respiratory indicators are within the expected historical range for this mission phase.',
    },
    activity: {
      metrics: (s) => {
        const eva = s.assess.eva;
        const level = { High: 88, 'Low–moderate': 45, Low: 18 }[s.modern.activity] || 20;
        return [
          ['Exertion Level', eva ? 'HIGH (EVA)' : level > 30 ? 'MODERATE' : 'LOW', '', 'activity', 'good'],
          ['Heart Rate', fmt0(s.assess.row.heart_rate_bpm), 'BPM', 'heart', 'good'],
          ['EVA Status', eva ? `ACTIVE — ${eva.label}` : 'NOT IN EVA', '', 'bolt', eva ? 'warn' : 'good'],
          ['Cumulative EVA Time', fmt1(AHM.EVA_WINDOWS.filter((w) => w.crew.includes(ASTRO_CREW_DEFAULT) && w.start <= s.hour).reduce((sum, w) => sum + (Math.min(w.end, s.hour) - w.start), 0)), 'HOURS', 'orbit', 'good'],
        ];
      },
      sections: (s) => [
        ['EVA-1: first Moon walk', 'Complete', s.hour >= 126.2 ? 100 : s.hour >= 119.655 ? Math.round((s.hour - 119.655) / (126.2 - 119.655) * 100) : 0, 'cyan'],
        ['EVA-2: Hadley Rille traverse', 'Complete', s.hour >= 149.45 ? 100 : s.hour >= 142.247 ? Math.round((s.hour - 142.247) / (149.45 - 142.247) * 100) : 0, 'teal'],
        ['EVA-3: Hadley Delta', 'Complete', s.hour >= 168.134 ? 100 : s.hour >= 163.304 ? Math.round((s.hour - 163.304) / (168.134 - 163.304) * 100) : 0, 'violet'],
      ],
      chartTitle: 'Heart Rate During Activity', chartField: 'heart_rate_bpm', chartColor: 'orange',
      summary: () => `Irwin and Scott drove the Lunar Roving Vehicle ${27.9} km across all three EVAs — the first crewed use of the rover.`,
    },
    sleep: {
      metrics: (s) => {
        const sl = AHM.eventsUpTo(ENGINE.DATA.events, s.hour).filter((e) => e.category === 'sleep').pop();
        return [
          ['Sleep Quality (est.)', fmt0(s.modern.sleepQuality), 'SCORE', 'moon', s.modern.sleepQuality >= 70 ? 'good' : 'warn'],
          ['Most Recent Period', sl ? sl.title.replace(/^\d\w*\s/, '') : 'None logged yet', '', 'spark', 'good'],
          ['Schedule Shift', sl ? (sl.detail.match(/about ([\d.]+ hours?)/) || [, '—'])[1] : '—', 'VS EARTH-NORMAL', 'activity', 'warn'],
          ['Source', 'Real crew-reported', '', 'shield', 'good'],
        ];
      },
      sections: () => [
        ['1st lunar-surface sleep', 'Shifted ~2h', 78, 'violet'],
        ['2nd lunar-surface sleep', 'Cut short — O2 leak fix', 62, 'cyan'],
        ['3rd lunar-surface sleep', 'Shifted ~7h, cut to 6.5h', 54, 'teal'],
      ],
      chartTitle: 'Respiration During Rest', chartField: 'respiration_rate', chartColor: 'violet',
      summary: () => 'All three lunar-surface sleep periods were displaced from the planned schedule — documented in the mission timeline, not estimated.',
    },
    radiation: {
      metrics: (s) => {
        const doseMsv = s.modern.doseMrad * 0.01;
        const weekly = Math.min(s.modern.doseEndpointMrad, s.modern.doseMrad) * 0.01 * (168 / Math.max(1, s.hour));
        return [
          ['Accumulated Dose', fmt1(doseMsv), 'mSv', 'orbit', 'good'],
          ['Endpoint (real, postflight)', fmt1(s.modern.doseEndpointMrad * 0.01), 'mSv', 'orbit', 'good'],
          ['Weekly Rate (modeled)', fmt1(weekly), 'mSv / wk', 'activity', weekly > 4 ? 'warn' : 'good'],
          ['Passive Dosimeter', 'Read postflight only', '1971 HARDWARE', 'shield', 'good'],
        ];
      },
      sections: (s) => [
        ['Accumulated vs. real endpoint', `${Math.round(s.modern.doseMrad / s.modern.doseEndpointMrad * 100)}%`, Math.round(s.modern.doseMrad / s.modern.doseEndpointMrad * 100), 'cyan'],
        ['Deep-space transit exposure', 'Elevated vs. LEO', 46, 'orange'],
        ['Risk assessment', 'Low — within crew tolerance', 18, 'teal'],
      ],
      chartTitle: 'Modeled Dose Accumulation', chartField: null, chartColor: 'orange',
      summary: (s) => `Endpoints are real: 510 mrad (Irwin), 360 mrad (Scott), 300 mrad (Worden, crew passive average). The curve between launch and splashdown is modeled — Apollo dosimeters were passive.`,
    },
  };

  function MetricDetailPage(page) {
    const d = ASTRO_DETAIL[page] || ASTRO_DETAIL['health-status'];
    const s = ENGINE.crewSnapshot(ASTRO_CREW_DEFAULT, sim.hour);
    const metrics = d.metrics(s);
    const sections = d.sections(s);
    const chartBody = d.chartField
      ? LineChart({ color: d.chartTitle.includes('Rate') && page === 'health-status' ? 'cyan' : sections[0][3], points: ENGINE.series(ASTRO_CREW_DEFAULT, sim.hour, 72, d.chartField), eva: AHM.EVA_WINDOWS })
      : LineChart({ color: 'orange', points: Array.from({ length: 20 }, (_, i) => ({ x: i, y: Math.min(1, ((sim.hour / 20) * i) / TOTAL_HOURS) * s.modern.doseEndpointMrad })) });
    return `<div class="insight-banner"><div class="insight-icon">${I('spark')}</div><div><span>ASTRONOMICAN INSIGHT</span><strong>${esc(d.summary(s))}</strong></div>${StatusPill('GET ' + AHM.formatGet(sim.hour), 'good')}</div>
      <section class="metric-grid four">${metrics.map(([label, value, unit, icon, status]) => MetricCard({ label, value, unit, icon, status, change: 'Within replay baseline' })).join('')}</section>
      <section class="detail-layout">
        <div class="card detail-sections">
          <div class="card-head"><div><span class="card-kicker">DETAILED METRICS</span><strong>Performance breakdown</strong></div><span class="chart-meta">LIVE</span></div>
          ${sections.map(([label, value, pct, color]) => `<div class="progress-row"><div><strong>${esc(label)}</strong><span>${esc(value)}</span></div><div class="progress ${color}"><span style="width:${Math.max(0, Math.min(100, pct))}%"></span></div><small>${Math.round(pct)}%</small></div>`).join('')}
        </div>
        ${ChartCard({ label: d.chartTitle, meta: 'REAL DATA', body: chartBody })}
      </section>
      ${HistoryTimeline(page)}`;
  }

  function HistoryTimeline(page) {
    const cats = page === 'health-status' ? ['medical', 'milestone'] : page === 'activity' ? ['eva'] : page === 'sleep' ? ['sleep'] : ['postflight', 'mission-control-decision'];
    const items = ENGINE.eventsUpTo(sim.hour).filter((e) => cats.includes(e.category)).slice(-5).reverse();
    return `<div class="card timeline-card">
      <div class="card-head"><div><span class="card-kicker">HISTORY</span><strong>${page === 'health-status' ? 'Health History Timeline' : 'Recent Events'}</strong></div></div>
      <div class="timeline wrap">
        ${items.map((e) => `<div class="timeline-item"><span class="timeline-dot ${e.severity ? 'danger' : ''}"></span><small>GET ${AHM.formatGet(e.get_hours)}</small><strong>${esc(e.title)}</strong><span class="event-tag event-tag--${e.category}">${esc(ENGINE.EVENT_TAG_LABEL[e.category] || e.category)}</span><span>${esc(e.detail)}</span><span class="event-source">Source: ${esc(e.source)}</span></div>`).join('') || `<div class="empty">Nothing recorded yet at GET ${AHM.formatGet(sim.hour)}.</div>`}
      </div>
    </div>`;
  }

  /* ------------------------------------------------------------------ *
   * Reports & Settings (shared shape, astronaut/control)
   * ------------------------------------------------------------------ */

  function reportRows(control) {
    const base = [
      ['Comprehensive Health Summary', 'MED-HLTH-A15', 'Aug 07, 1971', 'Medical', 'Ready'],
      ['Cardiovascular Assessment — Irwin', 'MED-CARD-A15', 'Aug 07, 1971', 'Health', 'Ready'],
      ['Apollo 15 Mission Report (MSC-07230)', 'NASA-MSC-07230', 'Sep 1971', 'Mission', 'Ready'],
      ['Radiation Exposure Record (M-078)', 'MED-RAD-A15', 'Aug 1971', 'Safety', 'Archived'],
      ['Postflight Physical Exam Summary', 'MED-WELL-A15', 'Aug 07, 1971', 'Medical', 'Ready'],
    ];
    return base;
  }

  function ReportsPage(control) {
    const stats = [
      [control ? 'Crew Reports' : 'Health Reports', '5', 'report'],
      ['Mission Reports', ENGINE.DATA.events.length.toString(), 'orbit'],
      [control ? 'Performance Reports' : 'PDF Reports', '3', 'activity'],
      ['Cited Sources', '5+', 'download'],
    ];
    return `<section class="report-stats">${stats.map(([label, value, icon]) => `<div class="card report-stat"><div class="metric-icon good">${I(icon)}</div><div><span>${esc(label)}</span><strong>${esc(value)}</strong><small>FILES</small></div></div>`).join('')}</section>
      <div class="card reports-table">
        <div class="table-toolbar"><div><span class="card-kicker">DOCUMENT CENTER</span><strong>${control ? 'Mission & Crew Reports' : 'Health & Mission Reports'}</strong></div><div><button class="btn filter-btn" type="button">All categories</button><button class="btn primary compact" type="button">${I('download')} Export summary</button></div></div>
        <div class="table-scroll"><div class="data-table">
          <div class="table-row table-head cols-4" style="grid-template-columns:2.2fr 1fr 1fr .9fr .8fr 30px;"><span>REPORT NAME</span><span>REFERENCE</span><span>DATE</span><span>CATEGORY</span><span>STATUS</span><span></span></div>
          ${reportRows(control).map((row) => `<div class="table-row" style="grid-template-columns:2.2fr 1fr 1fr .9fr .8fr 30px;"><span class="report-name">${I('report')}<div><strong>${esc(row[0])}</strong></div></span><span>${esc(row[1])}</span><span>${esc(row[2])}</span><span>${esc(row[3])}</span><span>${StatusPill(row[4], row[4] === 'Archived' ? 'info' : 'good')}</span><button class="btn download-btn" type="button">${I('download')}</button></div>`).join('')}
        </div></div>
      </div>
      <div class="data-note">Dates and references reflect the real Apollo 15 mission report and its 1971 documentation, standing in for the modern report set this dashboard is designed around.</div>`;
  }

  function SettingsPage(control) {
    const groups = control
      ? [['Operator Profile', 'Flight Director • Houston Control', 'user'], ['Notification Settings', 'Critical and mission alerts', 'alert'], ['Access Control', 'Level 4 mission clearance', 'shield'], ['Security', 'Multi-factor authentication', 'shield'], ['System Preferences', 'UTC • GET convention', 'settings'], ['Dashboard Customization', 'Mission operations layout', 'activity']]
      : [['Profile Information', 'James B. Irwin • Lunar Module Pilot', 'user'], ['Account Settings', 'Mission credential management', 'settings'], ['Notification Preferences', 'Health and mission alerts', 'alert'], ['Security Settings', 'Biometric authentication enabled', 'shield'], ['Appearance Settings', 'Dark interface • High contrast', 'spark'], ['Replay Settings', `Rate: ${sim.speed} GET-hours / second`, 'activity']];
    return `<div class="settings-profile card">
        <div class="large-avatar">${I('user', 34)}</div>
        <div><span class="card-kicker">${control ? 'OPERATOR PROFILE' : 'CREW PROFILE'}</span><strong>${control ? 'Flight Director' : 'James B. Irwin'}</strong><p>${control ? 'Flight Director • Houston Control' : 'Lunar Module Pilot • Apollo 15'}</p></div>
        ${StatusPill('Identity verified', 'good')}
        <button class="btn secondary" type="button">Edit profile</button>
      </div>
      <section class="settings-grid">${groups.map(([title, copy, icon], i) => `<div class="card setting-card"><div class="setting-icon">${I(icon)}</div><div><strong>${esc(title)}</strong><span>${esc(copy)}</span></div><button class="toggle ${i !== 4 ? 'active' : ''}" type="button"><span></span></button></div>`).join('')}</section>
      <div class="card system-panel"><div><span class="card-kicker">SYSTEM INFORMATION</span><strong>Astronomican Health Network</strong><p>Version 4.2.1 • Apollo 15 dataset build • ${ENGINE.DATA.events.length} cited events loaded</p></div>${StatusPill('All systems operational', 'good')}</div>`;
  }

  function AstronautPage(page) {
    if (page === 'dashboard') return AstronautDashboard();
    if (page === 'reports') return ReportsPage(false);
    if (page === 'settings') return SettingsPage(false);
    return MetricDetailPage(ASTRO_DETAIL[page] ? page : 'health-status');
  }

  /* ------------------------------------------------------------------ *
   * Mission Control pages
   * ------------------------------------------------------------------ */

  function CrewRow(s, c) {
    return `<div class="crew-row">
      <div class="crew-avatar">${c.photo_initials}</div>
      <div class="crew-name"><strong>${esc(c.name)}</strong><span>${esc(c.role)}</span></div>
      <div class="crew-reading"><small>HEALTH</small><strong>${s.score}</strong></div>
      <div class="crew-reading"><small>HEART RATE</small><strong>${fmt0(s.assess.row.heart_rate_bpm)}<span> bpm</span></strong></div>
      <div class="crew-reading"><small>OXYGEN</small><strong>${fmt1(s.modern.spo2)}%</strong></div>
      <div class="crew-reading"><small>RADIATION</small><strong>${fmt1(s.modern.doseMrad * 0.01)}<span> mSv</span></strong></div>
      ${StatusPill(s.assess.overall === 'NOMINAL' ? 'Nominal' : s.assess.overall === 'ATTENTION' ? 'Review' : 'Critical', s.assess.overall === 'NOMINAL' ? 'good' : s.assess.overall === 'ATTENTION' ? 'warn' : 'danger')}
    </div>`;
  }

  function ControlDashboard() {
    const snaps = ENGINE.allCrewSnapshots(sim.hour);
    const avgScore = Math.round(snaps.reduce((s, x) => s + x.score, 0) / snaps.length);
    const critical = ENGINE.DATA.events.filter((e) => e.severity && sim.hour >= e.get_hours && sim.hour <= (e.active_until_hours ?? e.get_hours + 3));
    const feed = ENGINE.recentEvents(sim.hour, 4);
    const mciSeries = ENGINE.series('LMP', sim.hour, 48, 'heart_rate_bpm');
    return `<section class="metric-grid four control-kpis">
        ${MetricCard({ label: 'Active Crew', value: '03', unit: 'TRANSMITTING', icon: 'crew', status: 'good', change: 'All telemetry current' })}
        ${MetricCard({ label: 'Mission Progress', value: `${Math.round(sim.hour / TOTAL_HOURS * 100)}%`, unit: `DAY ${ENGINE.missionDay(sim.hour)}`, icon: 'orbit', status: 'good', change: `GET ${AHM.formatGet(sim.hour)}` })}
        ${MetricCard({ label: 'Open Notices', value: String(critical.length).padStart(2, '0'), unit: 'ACTIVE', icon: 'alert', status: critical.length ? 'warn' : 'good', change: critical.length ? `${critical.length} require review` : 'None active' })}
        ${MetricCard({ label: 'Average Health Score', value: fmt1(avgScore), unit: '/ 100', icon: 'heart', status: 'good', change: 'Across all crew' })}
      </section>
      <section class="control-main-grid">
        <div class="card crew-overview">
          <div class="card-head"><div><span class="card-kicker">LIVE CREW FEED</span><strong>Crew Overview</strong></div>${StatusPill('3 online', 'good')}</div>
          <div class="crew-list">${snaps.map((s) => CrewRow(s, ENGINE.CREW.find((c) => c.id === s.crewId))).join('')}</div>
        </div>
        ${ChartCard({ label: 'Mission Health Index', meta: `AVG ${avgScore}`, body: LineChart({ color: 'teal', points: mciSeries, eva: AHM.EVA_WINDOWS }) })}
        <div class="card activity-feed">
          <div class="card-head"><div><span class="card-kicker">MISSION LOG</span><strong>Recent Activity</strong></div></div>
          ${feed.map((e) => `<div class="feed-item"><span class="feed-marker ${e.severity ? 'danger' : ''}"></span><small>GET ${AHM.formatGet(e.get_hours)}</small><div><strong>${esc(e.title)}</strong><span>${esc(e.crew_id ? ENGINE.CREW.find((c) => c.id === e.crew_id).name : 'Flight systems')}</span></div></div>`).join('') || '<div class="empty">Mission log will populate as GET advances.</div>'}
        </div>
      </section>`;
  }

  function CrewMonitoring() {
    const snaps = ENGINE.allCrewSnapshots(sim.hour);
    return `<div class="crew-filter"><div>${StatusPill('3 connected', 'good')}<span>All crew telemetry current at GET ${AHM.formatGet(sim.hour)}</span></div><div><button class="btn filter-btn active" type="button">All crew</button><button class="btn filter-btn" type="button">Health score</button></div></div>
      <section class="crew-card-grid">
        ${snaps.map((s) => {
          const c = ENGINE.CREW.find((x) => x.id === s.crewId);
          const tone = s.assess.overall === 'NOMINAL' ? 'good' : s.assess.overall === 'ATTENTION' ? 'warn' : 'danger';
          return `<div class="card crew-card ${s.assess.overall !== 'NOMINAL' ? 'is-selected' : ''}">
            <div class="crew-card-head"><div class="crew-avatar">${c.photo_initials}</div><div><strong>${esc(c.name)}</strong><span>${esc(c.role)}</span></div>${StatusPill(s.assess.overall === 'NOMINAL' ? 'Nominal' : s.assess.overall === 'ATTENTION' ? 'Review' : 'Critical', tone)}</div>
            <div class="crew-score"><div><span>HEALTH SCORE</span><strong>${s.score}</strong><small>/ 100</small></div><div class="mini-ring" style="--ring-p:${s.score};${s.score < 90 ? '--ring-c:var(--orange)' : ''}"><span>${s.score}%</span></div></div>
            <div class="crew-vitals">
              <div>${I('heart')}<small>HEART RATE</small><strong>${fmt0(s.assess.row.heart_rate_bpm)}<span> BPM</span></strong></div>
              <div>${I('spark')}<small>OXYGEN</small><strong>${fmt1(s.modern.spo2)}%</strong></div>
              <div>${I('orbit')}<small>RADIATION</small><strong>${fmt1(s.modern.doseMrad * 0.01)}<span> mSv</span></strong></div>
            </div>
            <button class="btn secondary full" data-nav="control-health-analytics" type="button">View health profile ${I('arrow')}</button>
          </div>`;
        }).join('')}
      </section>
      <div class="card comparison-card">
        <div class="card-head"><div><span class="card-kicker">CREW COMPARISON</span><strong>Health Score Overview</strong></div><span class="chart-meta">GET ${AHM.formatGet(sim.hour)}</span></div>
        ${snaps.map((s) => `<div class="comparison-row"><span>${esc(ENGINE.crewShortName(ENGINE.CREW.find((c) => c.id === s.crewId)))}</span><div class="progress cyan"><span style="width:${s.score}%"></span></div><strong>${s.score}</strong></div>`).join('')}
      </div>`;
  }

  function HealthAnalytics() {
    const rows = [
      ['Crew Health Trends (avg)', 'cyan', 'heart_rate_bpm', 'CDR'],
      ['Cardiovascular — Irwin (LMP)', 'teal', 'heart_rate_bpm', 'LMP'],
      ['Respiration — Worden (CMP)', 'violet', 'respiration_rate', 'CMP'],
      ['Radiation dose accumulation', 'orange', null, null],
      ['Sleep-period respiration — Irwin', 'cyan', 'respiration_rate', 'LMP'],
    ];
    return `<div class="analytics-toolbar"><div>${['All crew', ...ENGINE.CREW.map((c) => ENGINE.crewShortName(c))].map((n, i) => `<button class="btn filter-btn ${i === 0 ? 'active' : ''}" type="button">${esc(n)}</button>`).join('')}</div>${StatusPill('Replay engine live', 'good')}</div>
      <section class="analytics-grid">
        ${rows.map(([label, color, field, crewId], i) => {
          const body = field ? LineChart({ color, points: ENGINE.series(crewId, sim.hour, 72, field), eva: AHM.EVA_WINDOWS }) : LineChart({ color, points: Array.from({ length: 20 }, (_, k) => ({ x: k, y: (sim.hour / 20) * k })) });
          const meta = field ? `${fmt1(ENGINE.avg(ENGINE.series(crewId, sim.hour, 72, field)))} AVG` : `${fmt1(sim.hour / TOTAL_HOURS * 5.1)} mSv EST`;
          return `<div class="analytics-chart ${i === 0 ? 'wide' : ''}">${ChartCard({ label, meta, body })}</div>`;
        }).join('')}
      </section>`;
  }

  function MissionStatus() {
    const legs = [
      ['Launch', 'Jul 26, 1971', 0], ['Lunar landing', 'Jul 30, 1971', 104.708], ['EVA-3 complete', 'Aug 02, 1971', 168.134], ['Current position', AHM.formatGetLong(sim.hour), sim.hour], ['Splashdown', 'Aug 07, 1971', TOTAL_HOURS],
    ];
    return `<section class="mission-overview"><div class="card mission-orbit-card">
        <div class="planet-large"><div class="planet-glow"></div><div class="trajectory"></div><div class="spacecraft"></div></div>
        <div class="orbit-copy"><span class="card-kicker">APOLLO 15 • ${sim.hour < 104.7 ? 'TRANSLUNAR COAST' : sim.hour < 240 ? 'LUNAR SURFACE / ORBIT' : 'TRANSEARTH COAST'}</span><strong>Mission progressing on the real 1971 timeline</strong><p>Replaying flight systems, crew health indicators and Mission Control's actual decisions from launch through splashdown.</p>${StatusPill(sim.hour >= TOTAL_HOURS ? 'Mission complete' : 'Mission nominal', 'good')}</div>
        <div class="day-counter"><span>MISSION DAY</span><strong>${ENGINE.missionDay(sim.hour)}</strong><small>OF ${ENGINE.missionTotalDays()}</small></div>
      </div></section>
      <section class="environment-grid">
        ${MetricCard({ label: 'Cabin Atmosphere', value: '5.0', unit: 'PSIA', icon: 'orbit', status: 'good', change: '100% O₂ (1971 hardware)' })}
        ${MetricCard({ label: 'GET Elapsed', value: AHM.formatGet(sim.hour), unit: 'H:MM', icon: 'activity', status: 'good', change: `${Math.round(sim.hour / TOTAL_HOURS * 100)}% complete` })}
        ${MetricCard({ label: 'EVA Surface Time', value: fmt1(AHM.EVA_WINDOWS.slice(1, 4).filter((w) => w.start <= sim.hour).reduce((s, w) => s + (Math.min(w.end, sim.hour) - w.start), 0)), unit: 'HOURS', icon: 'thermometer', status: 'good', change: '3 EVAs total' })}
        ${MetricCard({ label: 'Rover Distance', value: sim.hour >= 168.134 ? '27.9' : sim.hour >= 119.655 ? '~15' : '0', unit: 'KM', icon: 'spark', status: 'good', change: 'First crewed lunar rover' })}
      </section>
      <div class="card mission-timeline">
        <div class="card-head"><div><span class="card-kicker">MISSION TIMELINE</span><strong>Apollo 15 Flight Plan</strong></div><span class="chart-meta">${Math.round(sim.hour / TOTAL_HOURS * 100)}% COMPLETE</span></div>
        <div class="flight-line">${legs.map(([title, date, h]) => `<div class="${h <= sim.hour ? (title === 'Current position' ? 'now' : 'done') : ''}"><span></span><strong>${esc(title)}</strong><small>${esc(date)}</small></div>`).join('')}</div>
      </div>`;
  }

  function AlertsPage() {
    const items = ENGINE.DATA.events.filter((e) => e.severity && e.get_hours <= sim.hour).slice(-10).reverse();
    const counts = { CRITICAL: 0, ATTENTION: 0, INFO: 0 };
    items.forEach((e) => { counts[e.severity] = (counts[e.severity] || 0) + 1; });
    const toneOf = (sev) => sev === 'CRITICAL' ? 'danger' : sev === 'ATTENTION' ? 'warn' : 'info';
    return `<div class="alert-filters"><div>
        <button class="btn filter-btn active" type="button">All alerts <span>${items.length}</span></button>
        <button class="btn filter-btn" type="button">Critical <span>${counts.CRITICAL || 0}</span></button>
        <button class="btn filter-btn" type="button">Warnings <span>${counts.ATTENTION || 0}</span></button>
        <button class="btn filter-btn" type="button">Information <span>${counts.INFO || 0}</span></button>
      </div><button class="btn secondary" type="button">${I('check')} Mark all reviewed</button></div>
      <div class="card alert-management"><div class="alert-timeline-line"></div>
        ${items.map((e) => `<div class="management-alert ${toneOf(e.severity)} ${e.get_hours < sim.hour - 24 ? 'reviewed' : ''}"><div class="alert-priority">${I(e.severity === 'INFO' ? 'spark' : 'alert')}</div><div class="alert-content">${StatusPill(e.severity === 'CRITICAL' ? 'Critical' : e.severity === 'ATTENTION' ? 'Warning' : 'Information', toneOf(e.severity))}<strong>${esc(e.title)}</strong><span>${esc(e.crew_id ? ENGINE.CREW.find((c) => c.id === e.crew_id).name + ' • ' : '')}${esc(e.detail)}</span></div><small>GET ${AHM.formatGet(e.get_hours)}</small><button class="btn secondary compact" type="button">Review</button></div>`).join('') || `<div class="empty">No alerts raised yet — GET ${AHM.formatGet(sim.hour)}.</div>`}
      </div>`;
  }

  function ControlPage(page) {
    if (page === 'dashboard') return ControlDashboard();
    if (page === 'crew-monitoring') return CrewMonitoring();
    if (page === 'health-analytics') return HealthAnalytics();
    if (page === 'mission-status') return MissionStatus();
    if (page === 'alerts') return AlertsPage();
    if (page === 'reports') return ReportsPage(true);
    return SettingsPage(true);
  }

  function pageRouter(role, page) {
    return role === 'astronaut' ? AstronautPage(page) : ControlPage(page);
  }

  /* ------------------------------------------------------------------ *
   * Render + event wiring
   * ------------------------------------------------------------------ */

  const root = document.getElementById('app');
  let current = { screen: null, role: null, page: null };

  function render() {
    const r = parseHash();
    current = r;
    if (r.screen === 'role') root.innerHTML = tplRoleSelect();
    else if (r.screen === 'astronaut-login') root.innerHTML = tplLogin('astronaut');
    else if (r.screen === 'control-login') root.innerHTML = tplLogin('control');
    else root.innerHTML = tplShell(r.role, r.page);
    AHM_ICONS.hydrate(root);
    wire(r);
    document.body.classList.toggle('reduce-motion', window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  }

  // Re-render only the live content (sim tick / nav switch inside the shell) — keeps sidebar/topbar stable.
  function renderContent() {
    const r = parseHash();
    if (r.screen !== 'app') return;
    current = r;
    const body = document.getElementById('page-body');
    const readout = document.getElementById('sim-readout');
    if (readout) readout.textContent = AHM.formatGet(sim.hour);
    if (body) { body.innerHTML = pageRouter(r.role, r.page); AHM_ICONS.hydrate(body); }
    const range = document.getElementById('sim-range');
    if (range && document.activeElement !== range) range.value = sim.hour;
    const playBtn = document.getElementById('sim-play');
    if (playBtn) playBtn.innerHTML = `${I(sim.playing ? 'pause' : 'play', 14)}${sim.playing ? 'Pause' : 'Simulate'}`;
    const sync = document.querySelector('.sync-status');
    if (sync) sync.innerHTML = `<span class="status-dot ${sim.playing ? 'live' : ''}"></span> ${sim.playing ? 'REPLAYING' : 'PAUSED'} <strong>GET ${AHM.formatGet(sim.hour)}</strong>`;
    const missionBar = document.querySelector('.side-mission');
    if (missionBar) {
      missionBar.querySelector('.mission-progress span').style.width = `${Math.min(100, sim.hour / TOTAL_HOURS * 100).toFixed(1)}%`;
      missionBar.querySelectorAll('.side-mission-meta span')[0].textContent = `DAY ${ENGINE.missionDay(sim.hour)}`;
      missionBar.querySelectorAll('.side-mission-meta span')[1].textContent = `${Math.min(100, Math.round(sim.hour / TOTAL_HOURS * 100))}%`;
    }
  }

  function setHour(h) {
    sim.hour = Math.max(0, Math.min(TOTAL_HOURS, h));
    renderContent();
  }

  function play() {
    if (sim.playing) return;
    sim.playing = true;
    renderContent();
    sim.timer = setInterval(() => {
      if (sim.hour >= TOTAL_HOURS) { pause(); return; }
      setHour(sim.hour + sim.speed * (TICK_MS / 1000));
    }, TICK_MS);
  }
  function pause() {
    sim.playing = false;
    if (sim.timer) clearInterval(sim.timer);
    sim.timer = null;
    renderContent();
  }

  function wire(r) {
    const back = document.getElementById('btn-back');
    if (back) back.addEventListener('click', () => {
      if (r.screen === 'app') navigate('#role');
      else if (r.screen !== 'role') navigate('#role');
    });

    if (r.screen === 'role') {
      root.querySelectorAll('.role-card').forEach((btn) => btn.addEventListener('click', () => { selectedRole = btn.dataset.role; render(); }));
      document.getElementById('btn-continue').addEventListener('click', () => navigate(`#${selectedRole}-login`));
      const aboutLink = document.getElementById('link-about');
      if (aboutLink) aboutLink.addEventListener('click', (e) => { e.preventDefault(); document.getElementById('about').scrollIntoView({ behavior: 'smooth' }); });
    }

    if (r.screen === 'astronaut-login' || r.screen === 'control-login') {
      const role = r.screen === 'astronaut-login' ? 'astronaut' : 'control';
      document.getElementById('login-form').addEventListener('submit', (e) => { e.preventDefault(); navigate(`#${role}-dashboard`); });
      document.getElementById('btn-login-back').addEventListener('click', () => navigate('#role'));
    }

    if (r.screen === 'app') {
      root.querySelectorAll('[data-nav]').forEach((btn) => btn.addEventListener('click', () => navigate(`#${btn.dataset.nav}`)));
      const exportBtn = document.getElementById('btn-export');
      if (exportBtn) exportBtn.addEventListener('click', () => window.print());
      wireSimBar();
    }
  }

  function wireSimBar() {
    const playBtn = document.getElementById('sim-play');
    if (!playBtn) return;
    playBtn.addEventListener('click', () => (sim.playing ? pause() : play()));
    document.getElementById('sim-back').addEventListener('click', () => { pause(); setHour(sim.hour - 6); });
    document.getElementById('sim-fwd').addEventListener('click', () => { pause(); setHour(sim.hour + 6); });
    document.getElementById('sim-reset').addEventListener('click', () => { pause(); setHour(0); });
    document.getElementById('sim-range').addEventListener('input', (e) => { pause(); setHour(Number(e.target.value)); });
    document.getElementById('sim-jump').addEventListener('change', (e) => { if (!e.target.value) return; pause(); setHour(Number(e.target.value)); e.target.value = ''; });
  }

  window.addEventListener('hashchange', render);
  render();
})();
