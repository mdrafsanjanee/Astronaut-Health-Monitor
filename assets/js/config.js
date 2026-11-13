/*
  What happens:
     - Key is empty ('')  -> the app still works. It asks NASA with the shared DEMO_KEY, which allows
                             very few requests, and falls back to clearly labelled SAMPLE data if NASA
                             refuses or the network is down.
     - Key is filled in   -> the app uses your key. The space-weather card says "LIVE · your key".
*/

window.AHM_CONFIG = {
  NASA_API_KEY: 'dQKzQptRFqQKBfRDdW9fRD8jmqWMKwCF7rJkmfRF',

  // Space weather (NASA DONKI, through api.nasa.gov)
  DONKI_BASE: 'https://api.nasa.gov/DONKI',
  DONKI_DAYS: 7,             // how many past days of events to load
  DONKI_REFRESH_MIN: 30,     // how often to ask NASA again (keep it high: DEMO_KEY allows very few requests)
  DONKI_TIMEOUT_MS: 12000    // give up on a request after this long and use the sample data
};
