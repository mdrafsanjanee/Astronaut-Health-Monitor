/* ==========================================================================
   icons.js
   Inline SVG icon set. The first block is the exact icon set from the Figma
   design; the second block adds the few icons the replay controls need.
   Static HTML uses <i data-icon="heart" data-size="18"></i> and shell.js
   swaps those for real <svg> elements. (Inline SVG instead of an external
   sprite so the site still works when opened straight from disk.)
   ========================================================================== */

const AHM_ICONS = (() => {
  const paths = {
    /* --- from the Figma design --------------------------------------- */
    activity: ['M3 12h4l2.5-7 5 14 2.5-7H21'],
    alert: ['M12 9v4m0 4h.01', 'M10.3 3.5 2.1 1.7 9 16H3l7.3-12.5Z'],
    arrow: ['m15 18-6-6 6-6', 'M9 12h11'],
    bolt: ['m13 2-9 12h7l-1 8 9-12h-7l1-8Z'],
    check: ['m5 12 4 4L19 6'],
    crew: ['M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2', 'M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z', 'M22 21v-2a4 4 0 0 0-3-3.87'],
    download: ['M12 3v12', 'm7 10 5 5 5-5', 'M5 21h14'],
    heart: ['M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8l1.1 1.1L12 21l7.7-7.5a5.5 5.5 0 0 0 1.1-8.9Z'],
    home: ['m3 11 9-8 9 8', 'M5 10v11h14V10', 'M9 21v-6h6v6'],
    moon: ['M21 12.8A9 9 0 1 1 11.2 3 7 7 0 0 0 21 12.8Z'],
    orbit: ['M12 12m-2 0a2 2 0 1 0 4 0 2 2 0 1 0-4 0', 'M4.9 4.9c-2.7 2.7.5 10.3 7.2 17', 'M19.1 19.1c2.7-2.7-.5-10.3-7.2-17', 'M2 12c0 3.8 7.6 7 17 7', 'M22 12c0-3.8-7.6-7-17-7'],
    report: ['M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z', 'M14 2v6h6', 'M8 13h8', 'M8 17h8'],
    settings: [
      'M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z',
      'M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2.1 3.6-.2-.1a1.7 1.7 0 0 0-2 .1l-.4.2a1.7 1.7 0 0 0-1 1.5V22H10v-.2a1.7 1.7 0 0 0-1-1.5l-.4-.2a1.7 1.7 0 0 0-2 .1l-.2.1L4.3 17l.1-.1a1.7 1.7 0 0 0 .3-1.9l-.2-.4A1.7 1.7 0 0 0 3 13.5H3v-4h.1a1.7 1.7 0 0 0 1.5-1.1l.2-.4a1.7 1.7 0 0 0-.3-1.9L4.4 6l2.1-3.6.2.1a1.7 1.7 0 0 0 2-.1l.4-.2a1.7 1.7 0 0 0 1-1.5V.5h4v.2a1.7 1.7 0 0 0 1 1.5l.4.2a1.7 1.7 0 0 0 2-.1l.2-.1L19.8 6l-.1.1a1.7 1.7 0 0 0-.3 1.9l.2.4A1.7 1.7 0 0 0 21 9.5h.1v4H21a1.7 1.7 0 0 0-1.5 1.1Z',
    ],
    shield: ['M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z', 'm9 12 2 2 4-4'],
    spark: ['m12 3 1.6 4.4L18 9l-4.4 1.6L12 15l-1.6-4.4L6 9l4.4-1.6L12 3Z', 'M5 16l.8 2.2L8 19l-2.2.8L5 22l-.8-2.2L2 19l2.2-.8L5 16Z'],
    thermometer: ['M14 14.8V5a2 2 0 0 0-4 0v9.8a4 4 0 1 0 4 0Z'],
    user: ['M20 21a8 8 0 0 0-16 0', 'M12 13a5 5 0 1 0 0-10 5 5 0 0 0 0 10Z'],

    /* --- added for the replay controls / extras ---------------------- */
    play: ['M7 4.5v15l12-7.5-12-7.5Z'],
    pause: ['M7 4h3.5v16H7z', 'M13.5 4H17v16h-3.5z'],
    reset: ['M3 12a9 9 0 1 0 3-6.7', 'M3 4v5h5'],
    chevron: ['m6 9 6 6 6-6'],
    send: ['m22 2-11 11', 'M22 2 15 22l-4-9-9-4 20-7Z'],
    book: ['M4 19.5A2.5 2.5 0 0 1 6.5 17H20', 'M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2Z'],
    clock: ['M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z', 'M12 7v5l3 2'],
  };

  function svg(name, size = 18) {
    const p = paths[name] || paths.spark;
    return `<svg aria-hidden="true" class="icon" fill="none" height="${size}" viewBox="0 0 24 24" width="${size}">` +
      p.map((d) => `<path d="${d}"/>`).join('') + '</svg>';
  }

  // Replace every <i data-icon="…"> placeholder under `root` with its SVG.
  function hydrate(root = document) {
    root.querySelectorAll('i[data-icon]').forEach((el) => {
      const size = Number(el.dataset.size) || 18;
      el.outerHTML = svg(el.dataset.icon, size);
    });
  }

  return { svg, hydrate, names: Object.keys(paths) };
})();
