// data/sensor-feed.js - PLACEHOLDER vital-sign datasheet (not real sensor data).
//
// The app plays one row every `intervalMs` (3 s) per crew member and loops forever.
// It exists so the vitals tiles, the live alert system and the crew notices can be built and shown
// before real sensors are available. Each crew member reads the same sheet from a different start row
// (`offsets`), so the three astronauts are never in the same phase.
//
// Row format: [heart rate bpm, systolic mmHg, diastolic mmHg, breathing per min, temperature C, activity]
//   activity is 'rest' or 'exercise'. While exercising, heart rate and blood pressure are not alarmed.
//
// To use real sensors later: keep this file as a fallback and call
//   LIVE.push('LMP', { hr: 72, sys: 118, dia: 76, resp: 14, temp: 36.7, activity: 'rest' })
// each time a reading arrives (see assets/js/live.js). Nothing else has to change.
window.AHM_FEED = {
  intervalMs: 3000,
  offsets: { CDR: 0, CMP: 16, LMP: 32 },
  columns: ['hr', 'sys', 'dia', 'resp', 'temp', 'activity'],
  rows: [
    [72, 116, 75, 14.5, 36.7, 'rest'],
    [73, 118, 76, 14.5, 36.7, 'rest'],
    [72, 117, 76, 14.5, 36.7, 'rest'],
    [71, 118, 77, 14.5, 36.7, 'rest'],
    [72, 116, 75, 14.5, 36.7, 'rest'],
    [73, 117, 76, 14.5, 36.7, 'rest'],
    [76, 124, 79, 15.0, 36.8, 'rest'],
    [79, 130, 84, 15.0, 36.8, 'rest'],
    [83, 136, 86, 15.0, 36.8, 'rest'],
    [88, 141, 90, 15.0, 36.8, 'rest'],
    [92, 146, 92, 15.0, 36.8, 'rest'],
    [95, 149, 95, 15.0, 36.8, 'rest'],
    [93, 148, 94, 15.0, 36.8, 'rest'],
    [90, 145, 92, 15.0, 36.8, 'rest'],
    [86, 141, 90, 15.0, 36.8, 'rest'],
    [82, 137, 88, 15.0, 36.8, 'rest'],
    [78, 131, 84, 15.0, 36.8, 'rest'],
    [75, 126, 80, 15.0, 36.8, 'rest'],
    [73, 121, 77, 15.0, 36.8, 'rest'],
    [72, 118, 76, 15.0, 36.8, 'rest'],
    [72, 117, 75, 15.0, 36.8, 'rest'],
    [120, 117, 76, 19.0, 36.8, 'rest'],
    [119, 117, 76, 19.0, 36.8, 'rest'],
    [118, 117, 76, 18.5, 36.8, 'rest'],
    [116, 117, 76, 18.0, 36.8, 'rest'],
    [113, 117, 76, 17.5, 36.8, 'rest'],
    [110, 117, 76, 17.0, 36.8, 'rest'],
    [106, 117, 76, 16.5, 36.8, 'rest'],
    [102, 117, 76, 16.0, 36.8, 'rest'],
    [98, 117, 76, 15.5, 36.8, 'rest'],
    [94, 117, 76, 15.0, 36.8, 'rest'],
    [90, 117, 76, 14.8, 36.8, 'rest'],
    [86, 117, 76, 14.6, 36.8, 'rest'],
    [80, 117, 76, 14.5, 36.8, 'rest'],
    [75, 117, 76, 14.5, 36.8, 'rest'],
    [76, 118, 77, 14.8, 37.3, 'rest'],
    [76, 118, 77, 14.8, 37.5, 'rest'],
    [76, 118, 77, 14.8, 37.6, 'rest'],
    [76, 118, 77, 14.8, 37.4, 'rest'],
    [76, 118, 77, 14.8, 37.1, 'rest'],
    [128, 126, 78, 22.0, 36.9, 'exercise'],
    [134, 128, 79, 22.0, 36.9, 'exercise'],
    [126, 124, 78, 22.0, 36.9, 'exercise'],
    [74, 118, 76, 22.5, 36.8, 'rest'],
    [75, 118, 76, 23.0, 36.8, 'rest'],
    [72, 117, 76, 14.5, 36.7, 'rest'],
    [72, 117, 76, 14.5, 36.7, 'rest'],
    [72, 117, 76, 14.5, 36.7, 'rest']
  ]
};
