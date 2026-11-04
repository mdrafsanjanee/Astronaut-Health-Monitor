// data/resources.js - the NASA Space Apps challenge resources.
// HAND-EDITABLE: no build step. After the resources are published (15 November 2026), add one object
// per resource to `items` and refresh the page. The Resources page lists them automatically.
//
// Example entry (copy, fill in, and paste inside `items`):
//   {
//     id: 'hrp-evidence-report',
//     title: 'Human Research Program evidence report',
//     publisher: 'NASA Human Research Program',
//     type: 'Article',            // Dataset | Article | Guide | Tool | Video | Standard | Other
//     url: 'https://...',
//     apa: 'National Aeronautics and Space Administration. (2026). <i>Title</i>. https://...',
//     usedFor: 'One sentence: which part of the app uses it (for example "normal ranges on the Astronaut page").',
//     status: 'planned'           // planned | in progress | used in app
//   }
//
// Also add the matching APA entry to data/references.js (references + cite) so it shows on the References page.
window.AHM_RESOURCES = {
  publishDate: '2026-11-15',
  publishLabel: '15 November 2026',
  items: [],

  // Where each kind of resource plugs into the app (shown as empty slots until items are added).
  slots: [
    { kind: 'Health datasets', example: 'Measurements, ranges or example records', plugsInto: 'data/telemetry.csv and data/events.json, then run: node tools/build-data.js' },
    { kind: 'Articles and evidence reports', example: 'NASA Human Research Program pages and papers', plugsInto: 'data/references.js (add to references, cite and dataUsed)' },
    { kind: 'Standards and normal ranges', example: 'Limits for heart rate, CO2, sleep, radiation', plugsInto: 'data/nasa-references.json and assets/js/engine.js' },
    { kind: 'Guides, images and tools', example: 'Measurement how-tos, body diagrams, calculators', plugsInto: 'assets/img/ or a new card on the Astronaut page' }
  ]
};
