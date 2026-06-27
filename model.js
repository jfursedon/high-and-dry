// Strict wet/dry model for Southern Sandstone.
//
// The Southern Sandstone ethic is conservative: the rock is soft and porous,
// holds break and wear when damp, and the community rule of thumb is "give it
// at least a couple of dry days, longer in winter". This model errs toward
// caution and shows its working so a human can override it.

const RAIN_HOUR_MM = 0.2; // an hour counts as "rain" at/above this
const SOIL_WET = 0.34; // m3/m3 surface soil moisture treated as still-wet
const SOIL_DAMP = 0.30; // borderline

// Minimum dry hours before green is even possible (strict: 2 days).
const MIN_DRY_HOURS_GREEN = 48;
const MIN_DRY_HOURS_AMBER = 24;

// Accumulated drying-index thresholds (a warm, sunny, breezy day adds ~12-16).
const GREEN_INDEX = 20;
const AMBER_INDEX = 9;

// Per-hour drying potential from sun, wind, temperature and dryness of the air.
// Returns roughly 0 (cold, still, humid, dark) .. ~1.0 (hot, sunny, windy, dry).
function hourlyDrying(radiation, windKmh, tempC, rh) {
  if (radiation == null || windKmh == null || tempC == null || rh == null) return 0;
  const sun = Math.min(radiation / 600, 1); // W/m^2
  const wind = Math.min(windKmh / 22, 1); // km/h
  const warmth = Math.max(0, Math.min(tempC / 16, 1.2)); // cold air dries slowly
  const dryAir = Math.max(0, 1 - rh / 100); // vapour-pressure-deficit proxy
  // weighted blend; warmth & dry air gate evaporation
  const e = (0.35 * sun + 0.25 * wind + 0.40 * dryAir) * (0.4 + 0.6 * warmth);
  return Math.max(0, e);
}

// `h` is the Open-Meteo hourly object (parallel arrays). `nowIso` is the current
// hour key. Returns the verdict plus all the supporting numbers for display.
export function assess(h, nowIso, dryFactor = 1) {
  const t = h.time;
  let nowIdx = t.indexOf(nowIso);
  if (nowIdx === -1) {
    // fall back to the latest past-or-present hour
    const now = Date.now();
    nowIdx = t.reduce((acc, iso, i) => (new Date(iso).getTime() <= now ? i : acc), 0);
  }

  const precip = h.precipitation;
  const soil = h.soil_moisture_0_to_1cm || [];

  // --- recent rainfall (looking back from now) ---
  let hoursSinceRain = Infinity;
  let rain24 = 0;
  let rain48 = 0;
  for (let i = nowIdx; i >= 0; i--) {
    const back = nowIdx - i;
    const p = precip[i] || 0;
    if (back < 24) rain24 += p;
    if (back < 48) rain48 += p;
    if (p >= RAIN_HOUR_MM && hoursSinceRain === Infinity) hoursSinceRain = back;
  }
  if (hoursSinceRain === Infinity) hoursSinceRain = nowIdx + 1; // no rain in window

  // --- drying accumulated since rain last stopped ---
  let dryingIndex = 0;
  const dryStart = nowIdx - Math.min(hoursSinceRain, nowIdx);
  for (let i = dryStart; i <= nowIdx; i++) {
    if ((precip[i] || 0) >= RAIN_HOUR_MM) {
      dryingIndex = 0; // a rain hour resets the clock
      continue;
    }
    dryingIndex += hourlyDrying(
      h.shortwave_radiation?.[i],
      h.wind_speed_10m?.[i],
      h.temperature_2m?.[i],
      h.relative_humidity_2m?.[i]
    );
  }
  // crags that dry slowly need more accumulated drying to count as dry
  const effIndex = dryingIndex / dryFactor;

  // --- current / imminent conditions ---
  const rainingNow = (precip[nowIdx] || 0) >= RAIN_HOUR_MM;
  let rainNext6 = 0;
  for (let i = nowIdx + 1; i <= nowIdx + 6 && i < precip.length; i++) rainNext6 += precip[i] || 0;
  const soilNow = soil[nowIdx];

  // current drying RATE: mean hourly drying over the next ~6h (rain hours = 0).
  // This is "how fast is it drying right now", separate from the accumulated total.
  let rateSum = 0, rateN = 0;
  for (let i = nowIdx; i <= nowIdx + 5 && i < t.length; i++) {
    rateN++;
    if ((precip[i] || 0) >= RAIN_HOUR_MM) continue;
    rateSum += hourlyDrying(
      h.shortwave_radiation?.[i],
      h.wind_speed_10m?.[i],
      h.temperature_2m?.[i],
      h.relative_humidity_2m?.[i]
    );
  }
  const dryingRate = rateN ? rateSum / rateN : 0;

  // --- verdict (strict) ---
  let level = "red";
  const reasons = [];

  if (rainingNow) {
    reasons.push("It is raining now.");
  } else if (hoursSinceRain < MIN_DRY_HOURS_AMBER) {
    reasons.push(`Only ${hoursSinceRain}h since the last rain (need 48h+ for sandstone).`);
  } else if (soilNow != null && soilNow >= SOIL_WET) {
    reasons.push("Ground is still saturated — the rock will be too.");
  } else if (
    hoursSinceRain >= MIN_DRY_HOURS_GREEN &&
    effIndex >= GREEN_INDEX &&
    rain48 < 1 &&
    (soilNow == null || soilNow < SOIL_DAMP)
  ) {
    level = "green";
    reasons.push(`${hoursSinceRain}h dry with strong drying since the last rain.`);
  } else if (hoursSinceRain >= MIN_DRY_HOURS_AMBER && effIndex >= AMBER_INDEX) {
    level = "amber";
    reasons.push(
      hoursSinceRain < MIN_DRY_HOURS_GREEN
        ? `Dry for ${hoursSinceRain}h, but under the 48h sandstone guideline.`
        : "Has dried, but not strongly — check shaded/seepy lines by hand."
    );
  } else {
    reasons.push(`Limited drying since rain (${hoursSinceRain}h ago) — likely still damp.`);
  }

  // downgrade green if heavy rain is imminent
  if (level === "green" && rainNext6 >= 1) {
    level = "amber";
    reasons.push("Rain forecast within 6h — go early.");
  }

  return {
    level,
    reasons,
    hoursSinceRain: Number.isFinite(hoursSinceRain) ? hoursSinceRain : null,
    rain24: round(rain24),
    rain48: round(rain48),
    dryingIndex: round(dryingIndex),
    dryingRate: round(dryingRate, 2),
    rainNext6: round(rainNext6),
    soilNow: soilNow != null ? round(soilNow, 2) : null,
    tempNow: h.temperature_2m?.[nowIdx],
    windNow: h.wind_speed_10m?.[nowIdx],
    rhNow: h.relative_humidity_2m?.[nowIdx],
    sunNow: h.shortwave_radiation?.[nowIdx],
  };
}

function round(n, dp = 1) {
  const f = Math.pow(10, dp);
  return Math.round((n || 0) * f) / f;
}
