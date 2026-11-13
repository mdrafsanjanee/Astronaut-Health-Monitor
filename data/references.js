// data/references.js - every source used by the app, in APA 7th edition.
// HAND-EDITABLE: no build step. Add a new entry to `references` (and `cite`) and it appears on the
// References page. Events in data/events.json point to these keys through their "refs" field.
//
// group: "nasa"      = NASA / NASA-hosted primary documents
//        "clinical"  = medical reference ranges (not NASA)
//        "secondary" = non-NASA accounts used only for narrative details; shown with a badge in the app
window.AHM_REFS = {
  references: {
    apollo15_mr: {
      group: 'nasa',
      apa: 'National Aeronautics and Space Administration. (1971). <i>Apollo 15 mission report</i> (MSC-05161; NASA TM X-68394). Manned Spacecraft Center. https://ntrs.nasa.gov/citations/19720021182',
      note: 'Section 10 (Biomedical Evaluation) is the main source for heart rate, sleep, medication, radiation, food, post-flight exams and bone measurements. HTML copy: https://www.nasa.gov/history/alsj/a15/a15mr.htm'
    },
    sp368: {
      group: 'nasa',
      apa: 'Johnston, R. S., Dietlein, L. F., &amp; Berry, C. A. (Eds.). (1975). <i>Biomedical results of Apollo</i> (NASA SP-368). National Aeronautics and Space Administration. https://history.nasa.gov/SP-368/sp368.htm',
      note: 'Cited for the in-flight heart-rhythm event. The exact chapter and page still have to be confirmed by the team.'
    },
    alsj_sun: {
      group: 'nasa',
      apa: 'Apollo Lunar Surface Journal. (n.d.). <i>Sun angles</i>. National Aeronautics and Space Administration. Retrieved October 29, 2026, from https://www.nasa.gov/history/alsj/sunangles.html'
    },
    afj_worden: {
      group: 'nasa',
      apa: 'Woods, D., &amp; O\'Brien, F. (Eds.). (2020). Day 11, part 2: Worden\'s EVA. In <i>The Apollo 15 flight journal</i>. National Aeronautics and Space Administration. https://www.nasa.gov/history/afj/ap15fj/23b-day11_worden_eva.html'
    },
    hrp_hazards: {
      group: 'nasa',
      apa: 'National Aeronautics and Space Administration. (n.d.). <i>Five hazards of human spaceflight</i> [Web page]. Human Research Program. Retrieved October 29, 2026, from https://www.nasa.gov/hrp/hazards',
      note: 'Confirm the exact page title when you finalise the citation.'
    },
    ochmo_co2: {
      group: 'nasa',
      apa: 'NASA Office of the Chief Health and Medical Officer. (2023a). <i>Carbon dioxide (CO2)</i> (OCHMO-TB-004, Rev C) [Technical brief]. National Aeronautics and Space Administration. https://www.nasa.gov/wp-content/uploads/2023/12/ochmo-tb-004-carbon-dioxide.pdf',
      note: 'Confirm the publication year of the brief.'
    },
    law2016: {
      group: 'nasa',
      apa: 'Law, J., &amp; Alexander, D. (2016). <i>CO2 on the International Space Station: An operations update</i> [Conference abstract]. NASA Johnson Space Center. https://ntrs.nasa.gov/archive/nasa/casi.ntrs.nasa.gov/20150019624.pdf'
    },
    aha_hr: {
      group: 'clinical',
      apa: 'American Heart Association. (n.d.-a). <i>All about heart rate (pulse)</i>. Retrieved October 29, 2026, from https://www.heart.org/en/health-topics/high-blood-pressure/the-facts-about-high-blood-pressure/all-about-heart-rate-pulse'
    },
    aha_bp: {
      group: 'clinical',
      apa: 'American Heart Association. (n.d.-b). <i>Understanding blood pressure readings</i>. Retrieved October 29, 2026, from https://www.heart.org/bplevels'
    },
    sleep: {
      group: 'clinical',
      apa: 'Watson, N. F., Badr, M. S., Belenky, G., Bliwise, D. L., Buxton, O. M., Buysse, D., Dinges, D. F., Gangwisch, J., Grandner, M. A., Kushida, C., Malhotra, R. K., Martin, J. L., Patel, S. R., Quan, S. F., &amp; Tasali, E. (2015). Recommended amount of sleep for a healthy adult: A joint consensus statement of the American Academy of Sleep Medicine and Sleep Research Society. <i>Sleep, 38</i>(6), 843-844. https://doi.org/10.5665/sleep.4716'
    },
    nlm_temp: {
      group: 'clinical',
      apa: 'MedlinePlus. (n.d.). <i>Body temperature norms</i>. National Library of Medicine. Retrieved October 29, 2026, from https://medlineplus.gov/ency/article/001982.htm',
      note: 'Confirm the exact thresholds quoted on the page.'
    },
    wiki_return15: {
      group: 'secondary',
      apa: 'Wikipedia contributors. (n.d.-a). <i>Return of Apollo 15 to Earth</i>. In <i>Wikipedia</i>. Retrieved October 29, 2026, from https://en.wikipedia.org/wiki/Return_of_Apollo_15_to_Earth',
      note: 'Secondary account of the heart-rhythm event and Mission Control\'s decisions. Replace with a primary NASA source when one is confirmed.'
    },
    wiki_a15: {
      group: 'secondary',
      apa: 'Wikipedia contributors. (n.d.-b). <i>Apollo 15</i>. In <i>Wikipedia</i>. Retrieved October 29, 2026, from https://en.wikipedia.org/wiki/Apollo_15',
      note: 'Used only for the transearth-injection time.'
    },
    collectspace_thread: {
      group: 'secondary',
      apa: 'collectSPACE. (2014). <i>Apollo 15: Mission Control and Irwin\'s heart issues</i> [Online forum thread]. https://www.collectspace.com/ubb/Forum29/HTML/001552.html',
      note: 'Forum discussion; used only as a pointer to the flight directors\' accounts.'
    },
    donki: {
      group: 'nasa',
      apa: 'NASA Community Coordinated Modeling Center. (n.d.). <i>Space Weather Database Of Notifications, Knowledge, Information (DONKI)</i> [Database]. National Aeronautics and Space Administration. https://ccmc.gsfc.nasa.gov/tools/DONKI/',
      note: 'Read live through api.nasa.gov (flares, solar energetic particle events, geomagnetic storms, coronal mass ejections). Confirm endpoint names and key limits on the api.nasa.gov documentation before submission.'
    },
    ochmo_radiation: {
      group: 'nasa',
      apa: 'NASA Office of the Chief Health and Medical Officer. (2023b). <i>Radiation protection</i> [Technical brief]. National Aeronautics and Space Administration. https://www.nasa.gov/wp-content/uploads/2023/03/radiation-protection-technical-brief-ochmo.pdf',
      note: 'Confirm the exact title and year on the PDF. Source of the 600 mSv career limit, the 250 mSv solar-particle-event limit and the shelter shielding figures.'
    },
    jpl_rad: {
      group: 'nasa',
      apa: 'Jet Propulsion Laboratory. (n.d.). <i>Data from NASA rover\'s voyage to Mars aids planning</i>. National Aeronautics and Space Administration. https://www.jpl.nasa.gov/news/data-from-nasa-rovers-voyage-to-mars-aids-planning/',
      note: 'Curiosity RAD cruise average of 1.8 mSv/day. Add the publication year from the page. The measurement itself is from the Radiation Assessment Detector (RAD) on the Mars Science Laboratory.'
    },
    osdr: {
      group: 'nasa',
      apa: 'NASA Open Science Data Repository. (n.d.). <i>Open Science Data Repository</i> [Database]. National Aeronautics and Space Administration. https://osdr.nasa.gov/',
      note: 'Holds the Inspiration4 human dataset (blood, skin biopsies, swabs). Not loaded into the app; listed as the source for a future biomarker layer.'
    },
    challenge2026: {
      group: 'nasa',
      apa: 'NASA Space Apps Challenge. (2026). <i>Create health monitoring software for astronauts on space missions</i> [Challenge description]. National Aeronautics and Space Administration.',
      note: 'Add the challenge page URL here.'
    }
  },

  // Short in-text citations (APA parenthetical form)
  cite: {
    apollo15_mr: 'NASA, 1971',
    sp368: 'Johnston et al., 1975',
    alsj_sun: 'Apollo Lunar Surface Journal, n.d.',
    afj_worden: 'Woods & O\'Brien, 2020',
    hrp_hazards: 'NASA, n.d.',
    ochmo_co2: 'NASA OCHMO, 2023a',
    law2016: 'Law & Alexander, 2016',
    aha_hr: 'American Heart Association, n.d.-a',
    aha_bp: 'American Heart Association, n.d.-b',
    sleep: 'Watson et al., 2015',
    nlm_temp: 'MedlinePlus, n.d.',
    wiki_return15: 'Wikipedia contributors, n.d.-a',
    wiki_a15: 'Wikipedia contributors, n.d.-b',
    collectspace_thread: 'collectSPACE, 2014',
    donki: 'NASA CCMC, n.d.',
    ochmo_radiation: 'NASA OCHMO, 2023b',
    jpl_rad: 'JPL, n.d.',
    osdr: 'NASA OSDR, n.d.',
    challenge2026: 'NASA Space Apps Challenge, 2026'
  },

  // What data is used, where it comes from, and where it appears in the app.
  dataUsed: [
    { what: 'Heart-rate averages and ranges by mission phase', values: 'Commander 92 / 84 / 85 bpm and Lunar Module Pilot 125 / 107 / 105 bpm averaged over EVA 1 / 2 / 3; Commander 81-98 bpm at lunar descent and 65-88 bpm at ascent', where: 'Section 10.1', ref: 'apollo15_mr', used: 'Gold "reported" points on the heart-rate chart' },
    { what: 'Biosensors flown', values: 'Electrocardiogram and impedance pneumogram (breathing) only', where: 'Section 10.1', ref: 'apollo15_mr', used: 'Explains why Worden has no reported heart rate' },
    { what: 'Moonwalk and landing times', values: 'Landing, EVA 1-3 start and end, lunar liftoff', where: 'Table 4-I; Sun Angles page', ref: 'apollo15_mr', refs2: ['alsj_sun'], used: 'Replay timeline and EVA bands on charts' },
    { what: 'Sleep disruption on the Moon', values: 'Three surface sleep periods shifted or shortened', where: 'Section 10.2.3', ref: 'apollo15_mr', used: 'Sleep events' },
    { what: 'Medication use', values: 'Commander: 14 aspirin for shoulder pain; Command Module Pilot: nose drops before entry', where: 'Section 10.2.2', ref: 'apollo15_mr', used: 'Medical events' },
    { what: 'Radiation dose', values: '360 mrad (Commander), 510 mrad (Lunar Module Pilot), 300 mrad passive average', where: 'Section 10.2.4', ref: 'apollo15_mr', used: 'Radiation card and event' },
    { what: 'Food intake', values: '2,801 / 2,372 / 2,568 kcal per day (Commander / Command Module Pilot / Lunar Module Pilot)', where: 'Section 10.2.7', ref: 'apollo15_mr', used: 'Crew details' },
    { what: 'Post-flight exam', values: 'Weight loss 2.75 / 3 / 5.5 lb; exercise tests took about a week to return to baseline', where: 'Section 10.3', ref: 'apollo15_mr', used: 'Post-flight events' },
    { what: 'Bone mineral measurement (experiment M-078)', values: 'Radius essentially unchanged; heel-bone (os calcis) changes discussed; no percentage is quoted', where: 'Section 10.4', ref: 'apollo15_mr', used: 'Bone card (qualitative only)' },
    { what: 'In-flight heart-rhythm event (bigeminy)', values: 'Time approximate (about GET 178 h). The Mission Report\'s medical section does not describe it.', where: 'Chapter to be confirmed', ref: 'sp368', refs2: ['wiki_return15'], used: 'Critical alert in Mission Control' },
    { what: 'Mission Control decisions after the rhythm event', values: 'Decision not to tell the Commander; sedative suggestion', where: 'Secondary accounts', ref: 'wiki_return15', refs2: ['collectspace_thread'], used: 'Decision events (marked secondary)' },
    { what: 'Command Module Pilot\'s deep-space EVA', values: 'Film-cassette retrieval on the trip home', where: 'Day 11, part 2', ref: 'afj_worden', used: 'Event' },
    { what: 'Food intake and post-flight weight loss', values: '2,801 / 2,372 / 2,568 kcal per day and 2.75 / 3 / 5.5 lb lost (Commander / Command Module Pilot / Lunar Module Pilot)', where: 'Sections 10.2.7 and 10.3', ref: 'apollo15_mr', used: 'Body map: stomach and gut' },
    { what: 'In-suit drinking-water failures', values: 'The Lunar Module Pilot\'s device did not deliver water; the Commander lost water on one moonwalk', where: 'Section 10.2.6', ref: 'apollo15_mr', used: 'Body map: kidneys and hydration' },
    { what: 'Five spaceflight hazards', values: 'Radiation; isolation and confinement; distance from Earth; gravity fields; hostile/closed environments', where: 'Hazards page', ref: 'hrp_hazards', used: 'Project page' },
    { what: 'Resting heart-rate reference range', values: 'App band 50-100 bpm (the American Heart Association states 60-100 bpm; the lower edge allows for fit astronauts)', where: 'Heart-rate page', ref: 'aha_hr', used: 'Status score outside EVA windows' },
    { what: 'Blood-pressure categories for the live alert rules', values: 'Normal below 120/80; elevated; stage 1 from 130/80; stage 2 from 140/90; crisis above 180/120 mmHg', where: 'Blood pressure levels page', ref: 'aha_bp', used: 'Live vitals tiles and alerts' },
    { what: 'Body-temperature bands for the live alert rules', values: 'Normal 36.1-37.2 \u00B0C; fever from 38.0 \u00B0C', where: 'Body temperature norms article', ref: 'nlm_temp', used: 'Live vitals tiles and alerts' },
    { what: 'Space weather events (live)', values: 'Solar flares, solar energetic particle events, geomagnetic storms and coronal mass ejections from the last 7 days. The watch/alert thresholds are this app\'s own rules.', where: 'DONKI via api.nasa.gov', ref: 'donki', used: 'Space-weather card (Astronaut and Mission Control pages) and the whole-body radiation region of the body map' },
    { what: 'Radiation limits', values: 'Career limit 600 mSv; single solar particle event design limit under 250 mSv; storm-shelter shielding +10 cm (1-in-100 event) or +20 cm (1-in-1000 event) water-equivalent', where: 'Radiation protection technical brief', ref: 'ochmo_radiation', used: 'Mission environment card' },
    { what: 'Deep-space radiation dose rate', values: 'Curiosity RAD cruise average about 1.8 mSv/day (about 3% from solar particles); surface environment about 0.5 mSv/day', where: 'JPL article; radiation technical brief', ref: 'jpl_rad', refs2: ['ochmo_radiation'], used: 'Mission environment card (transit and Mars surface)' },
    { what: 'One-way signal delay to Earth', values: 'Moon about 1.3 s; Mars about 3 to 22 min. Calculated from distance divided by the speed of light, not quoted from a source.', where: 'data/radiation-reference.json', ref: 'jpl_rad', used: 'Mission environment card' },
    { what: 'Human spaceflight biomedical data (not loaded)', values: 'Inspiration4 blood, skin and swab samples', where: 'NASA OSDR', ref: 'osdr', used: 'Not loaded into the app. Listed as the source for a future biomarker layer.' },
    { what: 'Cabin CO2 guidance (modern comparison only)', values: 'ISS limit 3 mmHg (1-hour average); symptoms reported from about 2.3 mmHg', where: 'Technical brief; operations update', ref: 'ochmo_co2', refs2: ['law2016'], used: 'Modern-monitoring comparison (not part of the Apollo replay)' }
  ],

  // Generated or modeled by the app. Never presented as measured data.
  generated: [
    'Live vitals (heart rate, blood pressure, breathing, temperature): a PLACEHOLDER datasheet (data/sensor-feed.js) replayed in a loop, one row every 3 seconds. It is not from sensors.',
    'Live alerts, the steps they show and the crew notices: rule-based text written for this prototype (assets/js/live.js), not medical advice.',
    'Interpolated heart-rate line between the reported points (tagged "interpolated" in data/telemetry.csv).',
    'Estimated values where no figure was reported, such as Worden\'s heart rate (tagged "estimated").',
    'Health score: computed from heart-rate and breathing bands plus active events (see assets/js/engine.js).',
    'Modern monitoring layer (blood pressure, oxygen saturation, skin temperature, sleep quality): simulated and labelled SIMULATED wherever shown.',
    'Space-weather watch/alert levels and the shelter steps: rule-based text written for this prototype (assets/js/space-weather.js), not a NASA operational standard and not medical advice. When NASA cannot be reached the card shows INVENTED sample events (data/space-weather-sample.js), labelled SAMPLE.',
    'Wellbeing check-in: a demo input; Apollo crews did not fill in a daily survey.'
  ],

  // Items the team still needs to confirm before submission.
  toVerify: [
    'Confirm the body-temperature thresholds on the MedlinePlus page, and add a source for the breathing-rate band (12-20 per minute).',
    'Have a flight surgeon or clinician review the wording of the live alert steps before any real use.',
    'Chapter and page of NASA SP-368 that describes the in-flight heart-rhythm event (and replace the secondary sources).',
    'Source for the breathing-rate reference range (12-20 per minute) used by the engine.',
    'The "5 premature ventricular contractions in 30 seconds" count and the potassium-loss explanation from the earlier README (cited there to an arXiv paper that could not be verified). They were removed from the event text until a source is confirmed.',
    'The 1.3 s Earth-Moon and roughly 22 minute Mars signal delays are calculated (distance divided by the speed of light). Add a NASA source or JPL Horizons values if you want them quoted.',
    'Check on api.nasa.gov that the DONKI endpoints used (FLR, SEP, GST, CME) and the key limits are as described, and confirm the radiation technical brief title and year, and that its 0.5 mSv/day surface figure refers to Mars.',
    'ISS and lunar dose rates are not set in data/radiation-reference.json. Add them once the team picks a NASA source.',
    'Exact page title of the NASA hazards page and the publication year of the CO2 technical brief.'
  ]
};
