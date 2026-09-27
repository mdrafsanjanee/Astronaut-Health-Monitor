/* ==========================================================================
   charts.js
   A tiny, dependency-free line-chart renderer. Returns an SVG string sized
   to fill its container (set width/height via CSS on the wrapper).
   Not a general charting library — just enough for trend sparklines.
   ========================================================================== */

const AHM_CHARTS = (() => {

  /**
   * Renders a single-series line chart as an SVG string.
   * @param {number[]} values
   * @param {object} opts - { width, height, color, thresholdLine, baselineLine }
   */
  function sparkline(values, opts = {}) {
    const width = opts.width || 300;
    const height = opts.height || 90;
    const padding = 6;
    const color = opts.color || '#39c2c9';

    if (!values || values.length < 2) {
      return `<svg viewBox="0 0 ${width} ${height}"></svg>`;
    }

    const min = Math.min(...values, opts.thresholdLine ?? Infinity, opts.baselineLine ?? Infinity);
    const max = Math.max(...values, opts.thresholdLine ?? -Infinity, opts.baselineLine ?? -Infinity);
    const range = max - min || 1;

    const xStep = (width - padding * 2) / (values.length - 1);
    const toX = (i) => padding + i * xStep;
    const toY = (v) => height - padding - ((v - min) / range) * (height - padding * 2);

    const points = values.map((v, i) => `${toX(i)},${toY(v)}`).join(' ');
    const areaPoints = `${padding},${height - padding} ${points} ${width - padding},${height - padding}`;

    let extras = '';
    if (opts.thresholdLine !== undefined) {
      const y = toY(opts.thresholdLine);
      extras += `<line x1="${padding}" y1="${y}" x2="${width - padding}" y2="${y}" stroke="#fc3d21" stroke-width="1" stroke-dasharray="3,3" opacity="0.7" />`;
    }
    if (opts.baselineLine !== undefined) {
      const y = toY(opts.baselineLine);
      extras += `<line x1="${padding}" y1="${y}" x2="${width - padding}" y2="${y}" stroke="#8a93a8" stroke-width="1" stroke-dasharray="2,3" opacity="0.6" />`;
    }

    const lastX = toX(values.length - 1);
    const lastY = toY(values[values.length - 1]);

    return `
      <svg viewBox="0 0 ${width} ${height}" preserveAspectRatio="none">
        <polygon points="${areaPoints}" fill="${color}" opacity="0.12" />
        <polyline points="${points}" fill="none" stroke="${color}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" />
        ${extras}
        <circle cx="${lastX}" cy="${lastY}" r="3" fill="${color}" />
      </svg>
    `;
  }

  return { sparkline };
})();
