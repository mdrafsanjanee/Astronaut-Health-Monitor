// Writes data/telemetry.csv: hourly HR + respiration for Apollo 15's crew, GET 0-295h.
// Only figures in Apollo 15 Mission Report §10 are "reported"; other anchors are "estimated",
// in-between hours "interpolated", respiration always "estimated" (HR x RESP_RATIO).
// Run: node tools/generate-telemetry.js
const fs = require('fs'), path = require('path');
const R = 'reported', E = 'estimated';
const A = (h, v, l, b) => ({ h, v, l, b });
const ANCHORS = {
  CDR: [ // Scott
    A(0.2, 110, 'Launch (typical Apollo commander range; not individually reported)', E),
    A(104.7, 90, 'Lunar descent (range reported: 81-98 bpm)', R),
    A(119.7, 92, 'EVA-1 average', R), A(126.2, 88, 'EVA-1 end', R),
    A(142.3, 84, 'EVA-2 average', R), A(149.4, 82, 'EVA-2 end', R),
    A(163.3, 85, 'EVA-3 average', R), A(168.1, 80, 'EVA-3 end', R),
    A(171.6, 76, 'Lunar ascent (range reported: 65-88 bpm)', R),
    A(295.2, 100, 'Splashdown / entry (typical Apollo range; not individually reported)', E),
  ],
  CMP: [ // Worden: no EVA-period figures published; modeled resting range + real deep-space EVA at ~241h
    A(0.2, 105, 'Launch (typical Apollo range; not individually reported)', E),
    A(60, 68, 'Lunar-orbit coast (typical resting range; not individually reported)', E),
    A(173.6, 70, 'Docking with Falcon (typical range; not individually reported)', E),
    A(223.8, 68, 'Transearth injection (typical range; not individually reported)', E),
    A(241.0, 105, 'Deep-space EVA — first in history (elevated exertion typical of EVA; not individually reported)', E),
    A(245.0, 70, 'Post-EVA rest (typical range; not individually reported)', E),
    A(295.2, 100, 'Splashdown / entry (typical Apollo range; not individually reported)', E),
  ],
  LMP: [ // Irwin. The bigeminy is a rhythm event (see events.json), not a rate spike; its rate anchor stays plausible.
    A(0.2, 115, 'Launch (typical Apollo range; not individually reported)', E),
    A(104.7, 90, 'Lunar descent (shared cabin range with CDR; not separately reported)', E),
    A(119.7, 125, 'EVA-1 average', R), A(126.2, 115, 'EVA-1 end', R),
    A(142.3, 107, 'EVA-2 average', R), A(149.4, 100, 'EVA-2 end', R),
    A(163.3, 105, 'EVA-3 average', R), A(168.1, 95, 'EVA-3 end', R),
    A(171.6, 80, 'Lunar ascent (typical range; not individually reported)', E),
    A(178.0, 88, 'Cardiac event window — bigeminy rhythm on EKG (see medical event; rate alone doesn\'t show this)', R),
    A(181.5, 75, 'Post-event recovery (typical range; not individually reported)', E),
    A(295.2, 100, 'Splashdown / entry (typical Apollo range; not individually reported)', E),
  ],
};
const RESP_RATIO = 0.16, TOTAL_HOURS = 296;
const r1 = (x) => { const t = x * 10, f = Math.floor(t); return (t - f === 0.5 ? f + (f % 2) : Math.round(t)) / 10; }; // half-even, like the original

function at(a, hour) {
  const first = a[0], last = a[a.length - 1];
  if (hour <= first.h) return first;
  if (hour >= last.h) return last;
  const i = a.findIndex((p, k) => hour <= a[k + 1].h), p = a[i], q = a[i + 1];
  if (Math.abs(hour - p.h) < 0.05) return p;
  if (Math.abs(hour - q.h) < 0.05) return q;
  return A(0, r1(p.v + (hour - p.h) / (q.h - p.h) * (q.v - p.v)), '', 'interpolated');
}

const q = (s) => (/[",\n]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s);
const rows = ['get_hours,crew_id,heart_rate_bpm,heart_rate_basis,heart_rate_label,respiration_rate,respiration_basis'];
for (let h = 0; h < TOTAL_HOURS; h++)
  for (const [id, a] of Object.entries(ANCHORS)) {
    const p = at(a, h);
    rows.push([h, id, p.v, p.b, q(p.l), r1(p.v * RESP_RATIO), E].join(','));
  }
const out = path.join(__dirname, '..', 'data', 'telemetry.csv');
fs.writeFileSync(out, rows.join('\n') + '\n');
console.log(`Wrote ${rows.length - 1} rows to ${out}`);
