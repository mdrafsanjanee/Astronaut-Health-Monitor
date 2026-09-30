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

  const astronautNav = [['Dashboard', 'home'], ['Health Status', 'heart'], ['Activity', 'activity'], ['Sleep', 'moon'], ['Radiation', 'orbit'], ['Check-in', 'check'], ['Reports', 'report'], ['Settings', 'settings']];
  const controlNav = [['Dashboard', 'home'], ['Crew Monitoring', 'crew'], ['Health Analytics', 'activity'], ['Mission Status', 'orbit'], ['Alerts', 'alert'], ['Reports', 'report'], ['Settings', 'settings']];
  const slug = (label) => label.toLowerCase().replaceAll(' ', '-');

  /* ------------------------------------------------------------------ *
   * Accounts + session (demo-grade, client-side only)
   * crew-1 / crew-2 / crew-3 map to the three real Apollo 15 crew members.
   * Change passwords here. Set SHOW_DEMO_HINT = false to hide the
   * "Need access?" demo-credential hint on the login screen.
   * ------------------------------------------------------------------ */

  const ACCOUNTS = {
    'crew-1': { password: '123', crewId: 'CDR' },   // David R. Scott
    'crew-2': { password: '123', crewId: 'CMP' },   // Alfred M. Worden
    'crew-3': { password: '123', crewId: 'LMP' },   // James B. Irwin
  };
  const SHOW_DEMO_HINT = true;
  const SESSION_KEY = 'ahm.session';
  let session = null;
  try { session = JSON.parse(sessionStorage.getItem(SESSION_KEY)); } catch (e) { session = null; }
  function saveSession(next) {
    session = next;
    try { if (next) sessionStorage.setItem(SESSION_KEY, JSON.stringify(next)); else sessionStorage.removeItem(SESSION_KEY); } catch (e) { /* storage blocked: in-memory only */ }
  }
  const myCrew = () => (session && session.crewId) || 'LMP';
  const myCrewMember = () => ENGINE.CREW.find((c) => c.id === myCrew()) || ENGINE.CREW[2];

  // Small UI state that must survive the live re-renders while the replay runs.
  let trail = [];               // app pages visited this session (drives the Back button)
  let flash = '';               // one-shot message on the login screen (e.g. after log out)
  let alertFilter = 'all';
  let crewSort = 'default';
  let analyticsCrew = 'all';
  let reportCat = 'All';
  const reviewed = new Set();
  const toggles = {};

  function toast(msg) {
    let t = document.getElementById('toast');
    if (!t) { t = document.createElement('div'); t.id = 'toast'; t.className = 'toast'; t.setAttribute('role', 'status'); document.body.appendChild(t); }
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => t.classList.remove('show'), 2600);
  }

  function downloadFile(name, text, type) {
    const url = URL.createObjectURL(new Blob([text], { type: `${type};charset=utf-8` }));
    const a = document.createElement('a');
    a.href = url; a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  /* ------------------------------------------------------------------ *
   * Shared state: route + the GET replay clock
   * ------------------------------------------------------------------ */

  const TOTAL_HOURS = ENGINE.TOTAL_HOURS;
  const sim = { hour: 0, playing: false, timer: null, speed: 8 };            // 8 GET-hours per real second
  const TICK_MS = 200;

  const visibleEvents = (role) => role === 'control' ? ENGINE.DATA.events : ENGINE.DATA.events.filter((e) => !e.crew_id || e.crew_id === myCrew());
  const eventsSoFar = (role) => visibleEvents(role).filter((e) => e.get_hours <= sim.hour);
  const activeNotices = (role) => visibleEvents(role).filter((e) => e.severity && sim.hour >= e.get_hours && sim.hour <= (e.active_until_hours ?? e.get_hours + 3));

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

  // `hidden` renders an empty spacer instead of a dead/disabled button (keeps the header grid aligned).
  function BackButton(hidden) {
    if (hidden) return '<span class="back-spacer" aria-hidden="true"></span>';
    return `<button class="btn back-btn" data-act="back" type="button">${I('arrow')}Back</button>`;
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
      <button class="role-card ${active ? 'active' : ''}" aria-pressed="${active ? 'true' : 'false'}" data-role="${label === 'ASTRONAUT' ? 'astronaut' : 'control'}" type="button">
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
    const notice = flash; flash = '';
    const help = isA
      ? `Crew accounts are issued by flight operations.${SHOW_DEMO_HINT ? ' Demo accounts: <strong>crew-1</strong> (Scott), <strong>crew-2</strong> (Worden), <strong>crew-3</strong> (Irwin) — password <strong>123</strong>.' : ''}`
      : 'Operator accounts are issued by flight operations. In this replay, any Operator ID and password will work.';
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
        <form class="login-panel" id="login-form" novalidate>
          <div class="eyebrow">${isA ? 'CREW IDENTITY VERIFICATION' : 'OPERATIONS AUTHORIZATION'}</div>
          <div class="login-title">${isA ? 'Astronaut' : 'Mission Control'} Login</div>
          <p>Enter your secure credentials to access the Astronomican health network.</p>
          ${notice ? `<div class="login-flash" role="status">${I('check', 14)}<span>${esc(notice)}</span></div>` : ''}
          <div class="form-stack">
            <label class="field"><span>${isA ? 'Astronaut ID' : 'Operator ID'}</span><input name="username" autocomplete="username" autocapitalize="none" spellcheck="false" placeholder="${isA ? 'crew-1' : 'MCO-7741'}" type="text" required></label>
            <label class="field"><span>Password</span><input name="password" autocomplete="current-password" placeholder="Enter secure password" type="password" required></label>
          </div>
          <div class="login-error" id="login-error" role="alert" hidden></div>
          <div class="login-options"><span><span class="status-dot"></span>Biometric verification ready</span><button class="link-btn" data-act="need-access" type="button">Need access?</button></div>
          <div class="login-note" id="login-help" hidden>${help}</div>
          <button class="btn primary login-submit" type="submit">Authenticate &amp; Enter${I('arrow')}</button>
          <button class="btn secondary login-back" data-act="back" type="button">${I('arrow')}Back to role selection</button>
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
    const title = (nav.find(([l]) => slug(l) === page) || (page === 'alerts' ? ['Alerts'] : nav[0]))[0];
    const me = myCrewMember();
    const openAlerts = activeNotices(role).length;
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
          <div><strong>${role === 'astronaut' ? esc(me.name) : 'Flight Director'}</strong><span>${role === 'astronaut' ? esc(me.role) : 'Mission Control, Houston'}</span></div>
          <span class="status-dot"></span>
        </div>
        <button class="btn secondary side-logout" data-act="logout" type="button">${I('logout', 15)}<span>Log out</span></button>
      </aside>
      <section class="workspace">
        <header class="topbar">
          <div>${BackButton(trail.length < 2)}${Breadcrumb([role === 'astronaut' ? 'Astronaut' : 'Mission Control', title])}</div>
          <div class="topbar-actions">
            <div class="sync-status"><span class="status-dot ${sim.playing ? 'live' : ''}"></span> ${sim.playing ? 'REPLAYING' : 'PAUSED'} <strong>GET ${AHM.formatGet(sim.hour)}</strong></div>
            <button class="btn icon-btn" data-nav="${role}-alerts" title="Alerts" aria-label="Alerts${openAlerts ? ` (${openAlerts} active)` : ''}" type="button">${I('alert')}${openAlerts ? '<span class="notification-ping"></span>' : ''}</button>
            <button class="btn icon-btn" data-nav="${role}-settings" title="Settings" aria-label="Settings" type="button">${I('settings')}</button>
            <button class="btn logout-btn" data-act="logout" title="Log out" type="button">${I('logout', 15)}<span>Log out</span></button>
          </div>
        </header>
        <div class="workspace-content" id="workspace-content">${tplPageWrap(role, page, title)}</div>
      </section>
    </main>`;
  }

  function tplPageWrap(role, page, title) {
    return `<div class="page-heading">
        <div><div class="eyebrow">${role === 'astronaut' ? 'PERSONAL HEALTH SYSTEM' : 'MISSION OPERATIONS'} // ${title.toUpperCase()}</div><div class="page-title">${title}</div></div>
        <div class="page-tools"><span class="range-label">GET REPLAY</span><span class="range-chip">Apollo 15 · full mission</span><button class="btn export-btn" data-act="print" title="Print or save this page as PDF" type="button">${I('download')} Export</button></div>
      </div>
      ${usesSimBar(page) ? tplSimBar() : ''}
      <div id="page-body">${pageRouter(role, page)}</div>`;
  }

  /* ------------------------------------------------------------------ *
   * Astronaut pages
   * ------------------------------------------------------------------ */


  function AstronautDashboard() {
    const s = ENGINE.crewSnapshot(myCrew(), sim.hour);
    const [title, copy] = ENGINE.scoreCopy(s.score);
    const alerts = activeNotices('astronaut');
    const hrSeries = ENGINE.series(myCrew(), sim.hour, 48, 'heart_rate_bpm');
    const rrSeries = ENGINE.series(myCrew(), sim.hour, 48, 'respiration_rate');
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
      <div class="section-title"><span>LIVE VITALS — ${esc(myCrewMember().name.toUpperCase())} (${myCrew()})</span><small>GET ${AHM.formatGet(sim.hour)}</small></div>
      <section class="metric-grid six">
        ${MetricCard({ label: 'Heart Rate', value: fmt0(s.assess.row.heart_rate_bpm), unit: 'BPM', icon: 'heart', status: s.assess.hrLevel === 'NOMINAL' ? 'good' : s.assess.hrLevel === 'ATTENTION' ? 'warn' : 'danger', change: s.assess.eva ? 'EVA exertion — expected' : `${s.assess.row.heart_rate_basis}` })}
        ${MetricCard({ label: 'Blood Pressure (est.)', value: `${fmt0(s.modern.systolicBp)}/${fmt0(s.modern.systolicBp - 40)}`, unit: 'mmHg', icon: 'activity', status: 'good', change: 'Modern-monitor estimate' })}
        ${MetricCard({ label: 'Oxygen Saturation (est.)', value: fmt1(s.modern.spo2), unit: 'SpO₂', icon: 'spark', status: 'good', change: '100% O₂ cabin' })}
        ${MetricCard({ label: 'Skin Temperature (est.)', value: fmt1(s.modern.skinTemp), unit: '°C', icon: 'thermometer', status: 'good', change: 'Stable' })}
        ${MetricCard({ label: 'Bone Density', value: `${fmt1(ENGINE.boneDensityPct(sim.hour))}%`, unit: 'MODELED', icon: 'activity', status: ENGINE.boneDensityPct(sim.hour) < -1 ? 'warn' : 'good', change: 'Endpoint real: −4% by splashdown' })}
        ${MetricCard({ label: 'Respiration Rate', value: fmt1(s.assess.row.respiration_rate), unit: 'br/min', icon: 'bolt', status: s.assess.rrLevel === 'NOMINAL' ? 'good' : 'warn', change: s.assess.row.respiration_basis })}
      </section>
      ${DecisionSupport(s)}
      <section class="dashboard-bottom">
        ${ChartCard({ label: 'Heart Rate — last 48h', meta: `AVG ${fmt0(ENGINE.avg(hrSeries))} BPM`, body: LineChart({ color: 'cyan', points: hrSeries, eva: AHM.EVA_WINDOWS }) })}
        ${ChartCard({ label: 'Respiration — last 48h', meta: `AVG ${fmt1(ENGINE.avg(rrSeries))} br/min`, body: LineChart({ color: 'teal', points: rrSeries, eva: AHM.EVA_WINDOWS }) })}
        ${AlertSummaryCard()}
      </section>`;
  }

  const isArrhythmia = (s) => s.assess.alerts.some((a) => /arrhythmia/i.test(a.title));

  // Autonomy layer: latency argument (only during the cardiac event) + rule-based suggested actions.
  function DecisionSupport(s) {
    const acts = ENGINE.advise(s, ENGINE.latestCheckin(sim.hour, myCrew()));
    const banner = (cls, icon, kicker, body) => `<div class="insight-banner ${cls}"><div class="insight-icon">${I(icon)}</div><div><span>${kicker}</span><strong>${body}</strong></div></div>`;
    return (isArrhythmia(s) ? banner('', 'orbit', 'WHY ONBOARD DECISION SUPPORT',
        'Houston was ~1.3 s away for this call, so flight surgeons could weigh in live. A Mars crew facing the same event would wait up to ~22 min each way and have to decide alone.') : '')
      + banner(acts.length ? 'is-message' : '', 'spark', 'SUGGESTED ACTION · ONBOARD RULES',
        acts.length ? acts.map(esc).join('<br>') : 'No action needed. Vitals and check-ins are within range.');
  }

  // Duration-dependent risks a 12-day replay can't show: stated qualitatively, no invented data.
  function LimitsCard() {
    const rows = [['SANS (eye/brain pressure)', 'Builds over months; about 1 in 3 long-duration ISS astronauts show a finding. Not plausible in 12 days.'],
      ['Bone loss', 'Only the real Apollo endpoint (about −4%) is shown; the curve is modeled, and multi-month loss is far larger.'],
      ['Immune dysregulation', 'Needs weeks to months of exposure and lab work; Apollo 15 has no usable in-flight record.'],
      ['Isolation and confinement', 'Psychological effects grow with duration; a 12-day mission with a 1.3 s link barely tests them.']];
    return `<div class="card timeline-card"><div class="card-head"><div><span class="card-kicker">SCOPE OF THIS REPLAY</span><strong>Beyond 13 days: risks this dataset cannot show</strong></div></div>
      ${rows.map(([t, d]) => `<div class="progress-row"><div><strong>${t}</strong><span>${d}</span></div></div>`).join('')}</div>`;
  }

  // Crew self-report (symptoms, mood, dosimeter). Saved to the demo log, kept apart from the real event record.
  function CheckinPage() {
    const rows = AHM.readDemoLog().filter((e) => e.type === 'checkin' && (!e.crewId || e.crewId === myCrew())).slice(-5).reverse();
    const slider = (f, label) => `<div class="slider-row"><span>${label}</span><input type="range" min="1" max="5" value="3" data-f="${f}"><span class="val">3</span></div>`;
    return `<div class="card composer"><div class="card-head"><div><span class="card-kicker">SELF-REPORT · GET ${AHM.formatGet(sim.hour)}</span><strong>Crew check-in</strong></div></div>
        ${slider('mood', 'Mood (1 low – 5 high)')}${slider('fatigue', 'Fatigue (1–5)')}
        <div class="field"><span>Symptoms (optional)</span><textarea id="ci-sym" placeholder="e.g. palpitations, headache, nausea"></textarea></div>
        <div class="field"><span>Dosimeter reading (mSv, optional)</span><input id="ci-dose" type="number" min="0" step="0.1"></div>
        <button class="btn primary" id="ci-save" type="button">${I('check', 14)} Log check-in</button></div>
      <div class="card timeline-card"><div class="card-head"><div><span class="card-kicker">HISTORY</span><strong>Recent check-ins</strong></div></div>
        ${rows.map((e) => `<div class="timeline-item"><small>GET ${AHM.formatGet(e.get_hours)}</small><strong>Mood ${e.mood}/5 · Fatigue ${e.fatigue}/5${e.dose != null ? ` · ${e.dose} mSv` : ''}</strong>${e.symptoms ? `<span>${esc(e.symptoms)}</span>` : ''}</div>`).join('') || '<div class="empty">No check-ins logged yet.</div>'}</div>`;
  }

  function AlertSummaryCard() {
    const items = eventsSoFar('astronaut').slice(-4).reverse();
    const iconFor = (cat) => ({ medical: 'alert', eva: 'orbit', 'mission-control-decision': 'crew', milestone: 'spark', sleep: 'moon', postflight: 'check' }[cat] || 'spark');
    const toneFor = (e) => e.severity === 'CRITICAL' ? 'warning' : e.severity === 'ATTENTION' ? 'warning' : e.category === 'medical' ? 'warning' : 'info';
    return `<div class="card alert-summary">
      <div class="card-head"><div><span class="card-kicker">SYSTEM FEED</span><strong>Real Mission Events</strong></div><span class="alert-count">${eventsSoFar('astronaut').length}</span></div>
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
          ['Cumulative EVA Time', fmt1(AHM.EVA_WINDOWS.filter((w) => w.crew.includes(myCrew()) && w.start <= s.hour).reduce((sum, w) => sum + (Math.min(w.end, s.hour) - w.start), 0)), 'HOURS', 'orbit', 'good'],
        ];
      },
      sections: (s) => {
        const prog = (a, b) => s.hour >= b ? 100 : s.hour >= a ? Math.round((s.hour - a) / (b - a) * 100) : 0;
        const label = (p) => p >= 100 ? 'Complete' : p > 0 ? 'In progress' : 'Not started';
        const row = (t, p, c) => [t, label(p), p, c];
        if (myCrew() === 'CMP') {
          return [row('Solo lunar-orbit operations (SIM bay)', prog(104.708, 171.623), 'cyan'), row('Deep-space EVA on the return trip', prog(240.85, 241.15), 'violet')];
        }
        return [row('EVA-1: first Moon walk', prog(119.655, 126.2), 'cyan'), row('EVA-2: Hadley Rille traverse', prog(142.247, 149.45), 'teal'), row('EVA-3: Hadley Delta', prog(163.304, 168.134), 'violet')];
      },
      chartTitle: 'Heart Rate During Activity', chartField: 'heart_rate_bpm', chartColor: 'orange',
      summary: () => myCrew() === 'CMP' ? 'Worden stayed in lunar orbit aboard Endeavour running the SIM-bay instruments, then made the first deep-space EVA on the trip home.' : `Irwin and Scott drove the Lunar Roving Vehicle ${27.9} km across all three EVAs — the first crewed use of the rover.`,
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
      sections: (s) => [['1st lunar-surface sleep', 'Shifted ~2h', 78, 'violet', 107.5], ['2nd lunar-surface sleep', 'Cut short — O2 leak fix', 62, 'cyan', 130], ['3rd lunar-surface sleep', 'Shifted ~7h, cut to 6.5h', 54, 'teal', 155]]
        .map(([t, v, p, c, at]) => s.hour >= at ? [t, v, p, c] : [t, 'Not reached yet', 0, c]),
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
    const s = ENGINE.crewSnapshot(myCrew(), sim.hour);
    const metrics = d.metrics(s);
    const sections = d.sections(s);
    const chartBody = d.chartField
      ? LineChart({ color: d.chartTitle.includes('Rate') && page === 'health-status' ? 'cyan' : sections[0][3], points: ENGINE.series(myCrew(), sim.hour, 72, d.chartField), eva: AHM.EVA_WINDOWS })
      : LineChart({ color: 'orange', points: Array.from({ length: 20 }, (_, i) => ({ x: i, y: Math.min(1, ((sim.hour / 20) * i) / TOTAL_HOURS) * s.modern.doseEndpointMrad })) });
    return `<div class="insight-banner"><div class="insight-icon">${I('spark')}</div><div><span>ASTRONOMICAN INSIGHT</span><strong>${esc(d.summary(s))}</strong></div>${StatusPill('GET ' + AHM.formatGet(sim.hour), 'good')}</div>
      <section class="metric-grid four">${metrics.map(([label, value, unit, icon, status]) => MetricCard({ label, value, unit, icon, status, change: status === 'danger' ? 'Flagged — under review' : status === 'warn' ? 'Outside expected band' : 'Within replay baseline' })).join('')}</section>
      <section class="detail-layout">
        <div class="card detail-sections">
          <div class="card-head"><div><span class="card-kicker">DETAILED METRICS</span><strong>Performance breakdown</strong></div><span class="chart-meta">LIVE</span></div>
          ${sections.map(([label, value, pct, color]) => `<div class="progress-row"><div><strong>${esc(label)}</strong><span>${esc(value)}</span></div><div class="progress ${color}"><span style="width:${Math.max(0, Math.min(100, pct))}%"></span></div><small>${Math.round(pct)}%</small></div>`).join('')}
        </div>
        ${ChartCard({ label: d.chartTitle, meta: 'REAL DATA', body: chartBody })}
      </section>
      ${HistoryTimeline(page)}
      ${page === 'health-status' ? DecisionSupport(s) + LimitsCard() : ''}`;
  }

  function HistoryTimeline(page) {
    const cats = page === 'health-status' ? ['medical', 'milestone'] : page === 'activity' ? ['eva'] : page === 'sleep' ? ['sleep'] : ['postflight', 'mission-control-decision'];
    const items = eventsSoFar('astronaut').filter((e) => cats.includes(e.category)).slice(-5).reverse();
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
      [`Cardiovascular Assessment — ${control ? 'Irwin' : ENGINE.crewShortName(myCrewMember())}`, 'MED-CARD-A15', 'Aug 07, 1971', 'Health', 'Ready'],
      ['Apollo 15 Mission Report (MSC-07230)', 'NASA-MSC-07230', 'Sep 1971', 'Mission', 'Ready'],
      ['Radiation Exposure Record (M-078)', 'MED-RAD-A15', 'Aug 1971', 'Safety', 'Archived'],
      ['Postflight Physical Exam Summary', 'MED-WELL-A15', 'Aug 07, 1971', 'Medical', 'Ready'],
    ];
    return base;
  }

  function ReportsPage(control) {
    const all = reportRows(control);
    const cats = ['All', ...new Set(all.map((r) => r[3]))];
    const cat = cats.includes(reportCat) ? reportCat : 'All';
    const rows = all.filter((r) => cat === 'All' || r[3] === cat);
    const stats = [
      [control ? 'Crew Reports' : 'Health Reports', '5', 'report'],
      ['Mission Reports', ENGINE.DATA.events.length.toString(), 'orbit'],
      [control ? 'Performance Reports' : 'PDF Reports', '3', 'activity'],
      ['Cited Sources', '5+', 'download'],
    ];
    const cols = 'grid-template-columns:2.2fr 1fr 1fr .9fr .8fr 30px;';
    return `<section class="report-stats">${stats.map(([label, value, icon]) => `<div class="card report-stat"><div class="metric-icon good">${I(icon)}</div><div><span>${esc(label)}</span><strong>${esc(value)}</strong><small>FILES</small></div></div>`).join('')}</section>
      <div class="card reports-table">
        <div class="table-toolbar"><div><span class="card-kicker">DOCUMENT CENTER</span><strong>${control ? 'Mission & Crew Reports' : 'Health & Mission Reports'}</strong></div><div>
          <select class="select-ctl" data-change="report-cat" aria-label="Filter reports by category">${cats.map((c) => `<option value="${esc(c)}"${c === cat ? ' selected' : ''}>${c === 'All' ? 'All categories' : esc(c)}</option>`).join('')}</select>
          <button class="btn primary compact" data-act="export-csv" type="button">${I('download')} Export summary</button></div></div>
        <div class="table-scroll"><div class="data-table">
          <div class="table-row table-head cols-4" style="${cols}"><span>REPORT NAME</span><span>REFERENCE</span><span>DATE</span><span>CATEGORY</span><span>STATUS</span><span></span></div>
          ${rows.map((row) => `<div class="table-row" style="${cols}"><span class="report-name">${I('report')}<div><strong>${esc(row[0])}</strong></div></span><span>${esc(row[1])}</span><span>${esc(row[2])}</span><span>${esc(row[3])}</span><span>${StatusPill(row[4], row[4] === 'Archived' ? 'info' : 'good')}</span><button class="btn download-btn" data-act="dl-report" data-ref="${esc(row[1])}" title="Download summary" aria-label="Download summary of ${esc(row[0])}" type="button">${I('download')}</button></div>`).join('') || '<div class="empty">No reports in this category.</div>'}
        </div></div>
      </div>
      <div class="data-note">Dates and references reflect the real Apollo 15 mission report and its 1971 documentation, standing in for the modern report set this dashboard is designed around.</div>`;
  }

  function exportReportsCsv() {
    const control = current.role === 'control';
    const rows = reportRows(control).filter((r) => reportCat === 'All' || r[3] === reportCat);
    const q = (v) => `"${String(v).replace(/"/g, '""')}"`;
    const csv = [['Report name', 'Reference', 'Date', 'Category', 'Status'], ...rows].map((r) => r.map(q).join(',')).join('\n');
    downloadFile('apollo15-report-summary.csv', csv, 'text/csv');
    toast(`Exported ${rows.length} report${rows.length === 1 ? '' : 's'} to CSV`);
  }

  function downloadReport(ref) {
    const row = reportRows(current.role === 'control').find((r) => r[1] === ref);
    if (!row) return;
    const txt = `${row[0]}\nReference: ${row[1]}\nDate: ${row[2]}\nCategory: ${row[3]}\nStatus: ${row[4]}\n\nSummary card generated by the Astronomican Apollo 15 replay.\nThe full source documents are cited in README.md (Primary data sources).\n`;
    downloadFile(`${ref}.txt`, txt, 'text/plain');
    toast(`Downloaded ${ref}`);
  }

  function SettingsPage(control) {
    const groups = control
      ? [['Operator Profile', 'Flight Director • Houston Control', 'user'], ['Notification Settings', 'Critical and mission alerts', 'alert'], ['Access Control', 'Level 4 mission clearance', 'shield'], ['Security', 'Multi-factor authentication', 'shield'], ['System Preferences', 'UTC • GET convention', 'settings'], ['Dashboard Customization', 'Mission operations layout', 'activity']]
      : [['Profile Information', `${myCrewMember().name} • ${myCrewMember().role}`, 'user'], ['Account Settings', 'Mission credential management', 'settings'], ['Notification Preferences', 'Health and mission alerts', 'alert'], ['Security Settings', 'Biometric authentication enabled', 'shield'], ['Appearance Settings', 'Dark interface • High contrast', 'spark'], ['Replay Settings', `Rate: ${sim.speed} GET-hours / second`, 'activity']];
    return `<div class="settings-profile card">
        <div class="large-avatar">${I('user', 34)}</div>
        <div><span class="card-kicker">${control ? 'OPERATOR PROFILE' : 'CREW PROFILE'}</span><strong>${control ? 'Flight Director' : esc(myCrewMember().name)}</strong><p>${control ? 'Flight Director • Houston Control' : `${myCrewMember().role} • Apollo 15`}</p></div>
        ${StatusPill('Identity verified', 'good')}
        <button class="btn secondary" data-act="edit-profile" type="button">Edit profile</button>
      </div>
      <section class="settings-grid">${groups.map(([title, copy, icon], i) => `<div class="card setting-card"><div class="setting-icon">${I(icon)}</div><div><strong>${esc(title)}</strong><span>${esc(copy)}</span></div>${(() => { const key = `${control ? 'c' : 'a'}:${title}`; const on = key in toggles ? toggles[key] : i !== 4; return `<button class="toggle ${on ? 'active' : ''}" data-act="toggle" data-key="${esc(key)}" role="switch" aria-checked="${on}" aria-label="${esc(title)}" type="button"><span></span></button>`; })()}</div>`).join('')}</section>
      <div class="card system-panel"><div><span class="card-kicker">SYSTEM INFORMATION</span><strong>Astronomican Health Network</strong><p>Version 4.2.1 • Apollo 15 dataset build • ${ENGINE.DATA.events.length} cited events loaded</p></div>${StatusPill('All systems operational', 'good')}</div>`;
  }

  function AstronautPage(page) {
    if (page === 'dashboard') return AstronautDashboard();
    if (page === 'check-in') return CheckinPage();
    if (page === 'reports') return ReportsPage(false);
    if (page === 'settings') return SettingsPage(false);
    if (page === 'alerts') return AlertsPage('astronaut');
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
    const critical = activeNotices('control');
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
    if (crewSort === 'score') snaps.sort((a, b) => a.score - b.score);
    return `<div class="crew-filter"><div>${StatusPill('3 connected', 'good')}<span>All crew telemetry current at GET ${AHM.formatGet(sim.hour)}</span></div><div><button class="btn filter-btn ${crewSort === 'default' ? 'active' : ''}" data-act="crew-sort" data-val="default" type="button">Mission order</button><button class="btn filter-btn ${crewSort === 'score' ? 'active' : ''}" data-act="crew-sort" data-val="score" title="Show the lowest health score first" type="button">Lowest score first</button></div></div>
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
            <button class="btn secondary full" data-act="view-profile" data-crew="${c.id}" type="button">View health profile ${I('arrow')}</button>
          </div>`;
        }).join('')}
      </section>
      <div class="card comparison-card">
        <div class="card-head"><div><span class="card-kicker">CREW COMPARISON</span><strong>Health Score Overview</strong></div><span class="chart-meta">GET ${AHM.formatGet(sim.hour)}</span></div>
        ${snaps.map((s) => `<div class="comparison-row"><span>${esc(ENGINE.crewShortName(ENGINE.CREW.find((c) => c.id === s.crewId)))}</span><div class="progress cyan"><span style="width:${s.score}%"></span></div><strong>${s.score}</strong></div>`).join('')}
      </div>`;
  }

  function avgSeries(field) {
    const ss = ENGINE.CREW.map((c) => ENGINE.series(c.id, sim.hour, 72, field));
    return ss[0].map((p, i) => ({ x: p.x, y: ss.reduce((sum, a) => sum + (a[i] ? a[i].y : p.y), 0) / ss.length }));
  }

  function HealthAnalytics() {
    const crew = ENGINE.CREW.find((c) => c.id === analyticsCrew) || null;          // null = all crew
    const nm = (id) => ENGINE.crewShortName(ENGINE.CREW.find((c) => c.id === id));
    const doseAt = (h) => { const ids = crew ? [crew.id] : ENGINE.CREW.map((c) => c.id); return ids.reduce((sum, id) => sum + AHM.simulateModernVitals(id, h, ENGINE.DATA.events).doseMrad, 0) / ids.length * 0.01; };
    const rows = crew ? [
      { label: `Heart rate — ${nm(crew.id)} (${crew.id})`, color: 'cyan', field: 'heart_rate_bpm', id: crew.id },
      { label: `Respiration — ${nm(crew.id)} (${crew.id})`, color: 'violet', field: 'respiration_rate', id: crew.id },
      { label: 'Radiation dose accumulation', color: 'orange', field: null },
    ] : [
      { label: 'Crew heart-rate trend (average)', color: 'cyan', field: 'heart_rate_bpm', avg: true },
      { label: 'Cardiovascular — Irwin (LMP)', color: 'teal', field: 'heart_rate_bpm', id: 'LMP' },
      { label: 'Respiration — Worden (CMP)', color: 'violet', field: 'respiration_rate', id: 'CMP' },
      { label: 'Radiation dose accumulation (crew average)', color: 'orange', field: null },
      { label: 'Sleep-period respiration — Irwin', color: 'cyan', field: 'respiration_rate', id: 'LMP' },
    ];
    const filters = [['all', 'All crew'], ...ENGINE.CREW.map((c) => [c.id, ENGINE.crewShortName(c)])];
    return `<div class="analytics-toolbar"><div>${filters.map(([id, name]) => `<button class="btn filter-btn ${analyticsCrew === id || (!crew && id === 'all') ? 'active' : ''}" data-act="analytics-crew" data-val="${id}" type="button">${esc(name)}</button>`).join('')}</div>${StatusPill('Replay engine live', 'good')}</div>
      <section class="analytics-grid">
        ${rows.map((row, i) => {
          let body, meta;
          if (row.field) {
            const pts = row.avg ? avgSeries(row.field) : ENGINE.series(row.id, sim.hour, 72, row.field);
            body = LineChart({ color: row.color, points: pts, eva: AHM.EVA_WINDOWS });
            meta = `${fmt1(ENGINE.avg(pts))} AVG`;
          } else {
            body = LineChart({ color: row.color, points: Array.from({ length: 20 }, (_, k) => ({ x: k, y: doseAt(sim.hour * k / 19) })) });
            meta = `${fmt1(doseAt(sim.hour))} mSv EST`;
          }
          return `<div class="analytics-chart ${i === 0 ? 'wide' : ''}">${ChartCard({ label: row.label, meta, body })}</div>`;
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

  const alertKey = (e) => String(e.get_hours);

  function AlertsPage(role) {
    const all = visibleEvents(role).filter((e) => e.severity && e.get_hours <= sim.hour);
    const counts = { CRITICAL: 0, ATTENTION: 0, INFO: 0 };
    all.forEach((e) => { counts[e.severity] = (counts[e.severity] || 0) + 1; });
    const items = all.filter((e) => alertFilter === 'all' || e.severity === alertFilter).slice(-10).reverse();
    const toneOf = (sev) => sev === 'CRITICAL' ? 'danger' : sev === 'ATTENTION' ? 'warn' : 'info';
    const fbtn = (val, label, n) => `<button class="btn filter-btn ${alertFilter === val ? 'active' : ''}" data-act="alert-filter" data-val="${val}" type="button">${label} <span>${n}</span></button>`;
    const isDone = (e) => reviewed.has(alertKey(e)) || e.get_hours < sim.hour - 24;
    return `<div class="alert-filters"><div>
        ${fbtn('all', 'All alerts', all.length)}${fbtn('CRITICAL', 'Critical', counts.CRITICAL || 0)}${fbtn('ATTENTION', 'Warnings', counts.ATTENTION || 0)}${fbtn('INFO', 'Information', counts.INFO || 0)}
      </div><button class="btn secondary" data-act="alert-review-all" type="button">${I('check')} Mark all reviewed</button></div>
      <div class="card alert-management"><div class="alert-timeline-line"></div>
        ${items.map((e) => `<div class="management-alert ${toneOf(e.severity)} ${isDone(e) ? 'reviewed' : ''}"><div class="alert-priority">${I(e.severity === 'INFO' ? 'spark' : 'alert')}</div><div class="alert-content">${StatusPill(e.severity === 'CRITICAL' ? 'Critical' : e.severity === 'ATTENTION' ? 'Warning' : 'Information', toneOf(e.severity))}<strong>${esc(e.title)}</strong><span>${esc(e.crew_id ? ENGINE.CREW.find((c) => c.id === e.crew_id).name + ' • ' : '')}${esc(e.detail)}</span></div><small>GET ${AHM.formatGet(e.get_hours)}</small>${isDone(e) ? `<button class="btn secondary compact" disabled type="button">${I('check', 13)} Reviewed</button>` : `<button class="btn secondary compact" data-act="alert-review" data-key="${alertKey(e)}" type="button">Review</button>`}</div>`).join('') || `<div class="empty">${all.length ? 'No alerts match this filter.' : `No alerts raised yet — GET ${AHM.formatGet(sim.hour)}.`}</div>`}
      </div>`;
  }

  function ControlPage(page) {
    if (page === 'dashboard') return ControlDashboard();
    if (page === 'crew-monitoring') return CrewMonitoring();
    if (page === 'health-analytics') return HealthAnalytics();
    if (page === 'mission-status') return MissionStatus();
    if (page === 'alerts') return AlertsPage('control');
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

  const validPages = (role) => (role === 'astronaut' ? astronautNav : controlNav).map(([l]) => slug(l)).concat(role === 'astronaut' ? ['alerts'] : []);

  // Where should this route really go? (null = fine as is). Keeps signed-out visitors out of the app.
  function guardRoute(r) {
    if (r.screen === 'app') {
      if (!session || session.role !== r.role) return `#${r.role}-login`;
      if (!validPages(r.role).includes(r.page)) return `#${r.role}-dashboard`;
    }
    if (r.screen === 'astronaut-login' && session && session.role === 'astronaut') return '#astronaut-dashboard';
    if (r.screen === 'control-login' && session && session.role === 'control') return '#control-dashboard';
    return null;
  }

  function render() {
    const r = parseHash();
    const redirect = guardRoute(r);
    if (redirect) { location.replace(redirect); return; }
    current = r;
    // The replay clock only makes sense on pages that show its controls — never leave it running invisibly.
    if (r.screen !== 'app' || !usesSimBar(r.page)) stopClock();
    if (r.screen === 'app') {
      const key = `${r.role}-${r.page}`;
      if (trail[trail.length - 1] !== key) { trail.push(key); if (trail.length > 20) trail.shift(); }
    } else trail = [];
    if (r.screen === 'role') root.innerHTML = tplRoleSelect();
    else if (r.screen === 'astronaut-login') root.innerHTML = tplLogin('astronaut');
    else if (r.screen === 'control-login') root.innerHTML = tplLogin('control');
    else root.innerHTML = tplShell(r.role, r.page);
    AHM_ICONS.hydrate(root);
    wire(r);
    document.body.classList.toggle('reduce-motion', window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  }

  // Re-render only the live content (sim tick / filter change inside the shell) — keeps sidebar/topbar stable.
  function renderContent() {
    const r = parseHash();
    if (r.screen !== 'app') return;
    current = r;
    const body = document.getElementById('page-body');
    const readout = document.getElementById('sim-readout');
    if (readout) readout.textContent = AHM.formatGet(sim.hour);
    if (body && r.page !== 'check-in') { body.innerHTML = pageRouter(r.role, r.page); AHM_ICONS.hydrate(body); }
    const range = document.getElementById('sim-range');
    if (range && document.activeElement !== range) range.value = sim.hour;
    const playBtn = document.getElementById('sim-play');
    if (playBtn) { playBtn.innerHTML = `${I(sim.playing ? 'pause' : 'play', 14)}${sim.playing ? 'Pause' : 'Simulate'}`; playBtn.classList.toggle('is-playing', sim.playing); AHM_ICONS.hydrate(playBtn); }
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

  function stopClock() {
    sim.playing = false;
    if (sim.timer) clearInterval(sim.timer);
    sim.timer = null;
  }

  function play() {
    if (sim.playing) return;
    if (sim.hour >= TOTAL_HOURS) sim.hour = 0;            // at splashdown, Simulate replays from launch
    sim.playing = true;
    renderContent();
    sim.timer = setInterval(() => {
      if (sim.hour >= TOTAL_HOURS) { pause(); return; }
      setHour(sim.hour + sim.speed * (TICK_MS / 1000));
    }, TICK_MS);
  }
  function pause() {
    stopClock();
    renderContent();
  }

  function goBack() {
    if (current.screen === 'app' && trail.length > 1) { trail.pop(); navigate(`#${trail[trail.length - 1]}`); }
    else navigate('#role');
  }

  function logout() {
    const role = (session && session.role) || current.role || 'astronaut';
    stopClock();
    saveSession(null);
    trail = [];
    flash = 'You have been logged out.';
    navigate(`#${role}-login`);
  }

  function wire(r) {
    if (r.screen === 'role') {
      root.querySelectorAll('.role-card').forEach((btn) => btn.addEventListener('click', () => { selectedRole = btn.dataset.role; render(); }));
      document.getElementById('btn-continue').addEventListener('click', () => navigate(`#${selectedRole}-login`));
      const aboutLink = document.getElementById('link-about');
      if (aboutLink) aboutLink.addEventListener('click', (e) => { e.preventDefault(); document.getElementById('about').scrollIntoView({ behavior: 'smooth' }); });
    }

    if (r.screen === 'astronaut-login' || r.screen === 'control-login') {
      const role = r.screen === 'astronaut-login' ? 'astronaut' : 'control';
      const form = document.getElementById('login-form');
      const err = document.getElementById('login-error');
      const showError = (msg) => { err.textContent = msg; err.hidden = false; };
      form.addEventListener('input', () => { err.hidden = true; });
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        const id = form.elements.username.value.trim();
        const pw = form.elements.password.value;
        if (!id || !pw) { showError(`Enter your ${role === 'astronaut' ? 'Astronaut' : 'Operator'} ID and password.`); (id ? form.elements.password : form.elements.username).focus(); return; }
        if (role === 'astronaut') {
          const key = id.toLowerCase();
          const acct = Object.prototype.hasOwnProperty.call(ACCOUNTS, key) ? ACCOUNTS[key] : null;
          if (!acct || acct.password !== pw) { showError('Incorrect Astronaut ID or password. Please try again.'); form.elements.password.value = ''; form.elements.password.focus(); return; }
          saveSession({ role, user: key, crewId: acct.crewId });
        } else {
          saveSession({ role, user: id });
        }
        trail = [];
        navigate(`#${role}-dashboard`);
      });
      form.elements.username.focus();
    }

    if (r.screen === 'app') {
      wireSimBar();
      const save = document.getElementById('ci-save');
      if (save) save.addEventListener('click', () => {
        const v = (f) => Number(root.querySelector(`[data-f="${f}"]`).value), dose = document.getElementById('ci-dose').value;
        AHM.logDemoEvent({ type: 'checkin', crewId: myCrew(), get_hours: sim.hour, mood: v('mood'), fatigue: v('fatigue'),
          symptoms: document.getElementById('ci-sym').value.trim(), dose: dose === '' ? null : Number(dose) });
        render();
        toast(`Check-in logged at GET ${AHM.formatGet(sim.hour)}`);
      });
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

  // One delegated handler for everything inside the app. Page content is re-rendered on every replay
  // tick, so per-element listeners would silently die after the first tick.
  root.addEventListener('click', (ev) => {
    const el = ev.target.closest('[data-nav],[data-act]');
    if (!el || !root.contains(el)) return;
    if (el.dataset.nav) { navigate(`#${el.dataset.nav}`); return; }
    const val = el.dataset.val;
    switch (el.dataset.act) {
      case 'back': goBack(); break;
      case 'logout': logout(); break;
      case 'print': window.print(); break;
      case 'need-access': { const h = document.getElementById('login-help'); if (h) h.hidden = !h.hidden; break; }
      case 'toggle': { const on = !el.classList.contains('active'); el.classList.toggle('active', on); el.setAttribute('aria-checked', String(on)); toggles[el.dataset.key] = on; break; }
      case 'edit-profile': toast('Profile editing is locked during the Apollo 15 replay.'); break;
      case 'alert-filter': alertFilter = val; renderContent(); break;
      case 'alert-review': reviewed.add(el.dataset.key); renderContent(); break;
      case 'alert-review-all': visibleEvents(current.role).filter((e) => e.severity && e.get_hours <= sim.hour).forEach((e) => reviewed.add(alertKey(e))); renderContent(); toast('All alerts marked as reviewed'); break;
      case 'crew-sort': crewSort = val; renderContent(); break;
      case 'analytics-crew': analyticsCrew = val; renderContent(); break;
      case 'view-profile': analyticsCrew = el.dataset.crew; navigate('#control-health-analytics'); break;
      case 'export-csv': exportReportsCsv(); break;
      case 'dl-report': downloadReport(el.dataset.ref); break;
      default: break;
    }
  });
  root.addEventListener('change', (ev) => {
    const el = ev.target.closest('[data-change]');
    if (el && el.dataset.change === 'report-cat') { reportCat = el.value; renderContent(); }
  });
  root.addEventListener('input', (ev) => {
    if (ev.target.matches('.slider-row input')) ev.target.nextElementSibling.textContent = ev.target.value;
  });

  window.addEventListener('hashchange', render);
  render();
})();
