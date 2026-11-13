// data/space-weather-sample.js - OFFLINE FALLBACK for the space-weather card.
// These are INVENTED EXAMPLE EVENTS, not real NASA records. They exist only so the card and its
// radiation advice can be shown when NASA cannot be reached (no network, bad key, rate limit).
// The app labels this data "SAMPLE" wherever it is shown.
//
// Times are written as hours BEFORE the moment the page loads, so the sample always looks recent.
window.AHM_SPACEWX_SAMPLE = {
  flares:  [{ hoursAgo: 5,  cls: 'M2.1', region: '4001', note: 'Sample flare' },
            { hoursAgo: 30, cls: 'C5.4', region: '4001', note: 'Sample flare' }],
  sep:     [],
  storms:  [{ hoursAgo: 14, kp: 5, note: 'Sample geomagnetic storm' }],
  cmes:    [{ hoursAgo: 20, speed: 780, note: 'Sample coronal mass ejection' }]
};
