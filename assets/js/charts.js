/* ==========================================================================
   charts.js
   A tiny, dependency-free line-chart renderer. Returns an SVG string sized
   to fill its container (set width/height via CSS on the wrapper).

   Supports marking specific points as "reported" (a real, cited figure
   from the Apollo 15 Mission Report) vs. the default interpolated line —
   see the design note in tools/generate_telemetry.py for why that
   distinction matters here.
   ========================================================================== */

const AHM_CHARTS = (() => {

  /**
   * @param {number[]} values
   * @param {object} opts - { width, height, color, evaShading: [{startIdx,endIdx}], reportedIdx: number[], reportedLabels: string[] }
   */
  function sparkline(values, opts = {}) {
    const width = opts.width || 300;
    const height = opts.height || 90;
    const padding = 8;
    const color = opts.color || '#c9a24b';

    if (!values || values.length < 2) {
      return `<svg viewBox="0 0 ${width} ${height}"></svg>`;
    }

    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = (max - min) || 1;

    const xStep = (width - padding * 2) / (values.length - 1);
    const toX = (i) => padding + i * xStep;
    const toY = (v) => height - padding - ((v - min) / range) * (height - padding * 2);

    const points = values.map((v, i) => `${toX(i)},${toY(v)}`).join(' ');
    const areaPoints = `${padding},${height - padding} ${points} ${width - padding},${height - padding}`;

    let evaBands = '';
    (opts.evaShading || []).forEach((band) => {
      const x0 = toX(band.startIdx);
      const x1 = toX(band.endIdx);
      evaBands += `<rect x="${x0}" y="0" width="${Math.max(1, x1 - x0)}" height="${height}" fill="#c9a24b" opacity="0.08" />`;
    });

    let reportedMarkers = '';
    const reportedIdx = opts.reportedIdx || [];
    reportedIdx.forEach((i) => {
      if (i < 0 || i >= values.length) return;
      const x = toX(i);
      const y = toY(values[i]);
      const label = (opts.reportedLabels && opts.reportedLabels[i]) || '';
      reportedMarkers += `<circle cx="${x}" cy="${y}" r="4.5" fill="#f2c86b" stroke="#05070d" stroke-width="1.5"><title>${escapeXml(label)}</title></circle>`;
    });

    const lastX = toX(values.length - 1);
    const lastY = toY(values[values.length - 1]);

    return `
      <svg viewBox="0 0 ${width} ${height}" preserveAspectRatio="none">
        ${evaBands}
        <polygon points="${areaPoints}" fill="${color}" opacity="0.10" />
        <polyline points="${points}" fill="none" stroke="${color}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" opacity="0.85" />
        ${reportedMarkers}
        <circle cx="${lastX}" cy="${lastY}" r="3" fill="${color}" />
      </svg>
    `;
  }

  function escapeXml(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  return { sparkline };
})();
