import { CRAGS } from "./crags.js";
import { assess } from "./model.js";

const HOURLY = [
  "precipitation",
  "soil_moisture_0_to_1cm",
  "shortwave_radiation",
  "wind_speed_10m",
  "temperature_2m",
  "relative_humidity_2m",
].join(",");

const LABEL = {
  green: { status: "Climbable", verdict: "Good to climb" },
  amber: { status: "Borderline", verdict: "Probably OK — inspect carefully" },
  red: { status: "Too wet", verdict: "Too wet for sandstone" },
};
const ORDER = { green: 0, amber: 1, red: 2 };

// One request for every crag (comma-separated coords) — Open-Meteo returns an
// array in the same order. Avoids hammering the API with 9 parallel calls (429s).
function apiUrl() {
  const p = new URLSearchParams({
    latitude: CRAGS.map((c) => c.lat).join(","),
    longitude: CRAGS.map((c) => c.lon).join(","),
    hourly: HOURLY,
    past_days: 3,
    forecast_days: 7,
    timezone: "Europe/London",
  });
  return `https://api.open-meteo.com/v1/forecast?${p}`;
}

// the hour key Open-Meteo uses for "now" in Europe/London, e.g. 2026-06-27T14:00
function currentHourIso() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/London",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hour12: false,
  }).formatToParts(new Date());
  const g = (t) => parts.find((x) => x.type === t).value;
  return `${g("year")}-${g("month")}-${g("day")}T${g("hour").padStart(2, "0")}:00`;
}

// Verdict for each upcoming day, judged at that day's 13:00 by running the same
// model forward over the forecast. Returns up to 6 days starting today.
function buildOutlook(hourly, todayKey, dryFactor) {
  const middays = hourly.time.filter((t) => t.endsWith("T13:00"));
  const out = [];
  for (const iso of middays) {
    const day = iso.slice(0, 10);
    if (day < todayKey) continue; // skip past days in the window
    const r = assess(hourly, iso, dryFactor);
    const d = new Date(iso);
    out.push({
      day,
      level: r.level,
      isToday: day === todayKey,
      weekday: d.toLocaleDateString("en-GB", { timeZone: "Europe/London", weekday: "short" }),
      weekendName: d.toLocaleDateString("en-GB", { timeZone: "Europe/London", weekday: "long" }),
      weekend: [0, 6].includes(d.getDay()),
    });
    if (out.length >= 6) break;
  }
  return out;
}

async function fetchAll() {
  const res = await fetch(apiUrl());
  if (!res.ok) throw new Error(`weather fetch failed (${res.status})`);
  const data = await res.json();
  return Array.isArray(data) ? data : [data]; // single-crag responses aren't arrays
}

function assessCrag(hourly, crag, nowIso) {
  return {
    now: assess(hourly, nowIso, crag.dryFactor),
    outlook: buildOutlook(hourly, nowIso.slice(0, 10), crag.dryFactor),
  };
}

const fmtSince = (h) => (h == null ? "—" : h >= 48 ? `${Math.floor(h / 24)} days` : `${h}h`);
const fmtNum = (n, s) => (n == null ? "—" : `${Math.round(n)}${s}`);

// "How fast is it drying right now" — purely the current drying rate (sun, wind,
// dry air). Forecast rain is the outlook's job, not this field. If it's actually
// raining, the rate collapses to ~0 and this reads "Stalled".
function dryingTrend(r) {
  const x = r.dryingRate ?? 0;
  if (x >= 0.55) return "Quickly";
  if (x >= 0.33) return "Steadily";
  if (x >= 0.15) return "Slowly";
  return "Stalled";
}

function pill(level, text) {
  return `<span class="pill ${level}"><span class="pip"></span>${text}</span>`;
}

function outlookBlock(outlook) {
  if (!outlook?.length) return "";
  const days = outlook
    .map(
      (d) => `
      <div class="day ${d.level}${d.weekend ? " wknd" : ""}${d.isToday ? " today" : ""}">
        <span class="pip"></span>
        <span class="dow">${d.isToday ? "Now" : d.weekday}</span>
      </div>`
    )
    .join("");
  return `<div class="outlook-wrap">
    <p class="outlook-label">Next days · verdict at midday</p>
    <div class="outlook">${days}</div>
  </div>`;
}

function card(crag, data) {
  const r = data.now;
  const el = document.createElement("article");
  el.className = `crag ${r.level}`;
  el.innerHTML = `
    <div class="crag-head">
      <h2>${crag.name}</h2>
      ${pill(r.level, LABEL[r.level].status)}
    </div>
    <p class="reason">${r.reasons.join(" ")}</p>
    <dl class="stats">
      <div><dt>Dry for</dt><dd>${fmtSince(r.hoursSinceRain)}</dd></div>
      <div><dt>Rain 48h</dt><dd>${r.rain48} mm</dd></div>
      <div><dt>Drying</dt><dd>${dryingTrend(r)}</dd></div>
      <div><dt>Temp</dt><dd>${fmtNum(r.tempNow, "°")}</dd></div>
      <div><dt>Wind</dt><dd>${fmtNum(r.windNow, " km/h")}</dd></div>
      <div><dt>Humidity</dt><dd>${fmtNum(r.rhNow, "%")}</dd></div>
    </dl>
    ${outlookBlock(data.outlook)}
    <p class="crag-note">${crag.note}</p>
  `;
  return el;
}

function errorCard(crag, msg) {
  const el = document.createElement("article");
  el.className = "crag err";
  el.innerHTML = `
    <div class="crag-head">
      <h2>${crag.name}</h2>
      ${pill("err", "No data")}
    </div>
    <p class="reason">Couldn't load weather — ${msg}</p>`;
  return el;
}

const GLYPH = { green: "✓", amber: "!", red: "✕" };

// Earliest upcoming day (today excluded) where some crag reaches `level`.
function nextDay(rows, level) {
  let best = null;
  for (const { crag, data } of rows) {
    if (!data) continue;
    for (const d of data.outlook) {
      if (d.isToday || d.level !== level) continue;
      if (!best || d.day < best.day) best = { ...d, crag: crag.name };
    }
  }
  return best;
}

function renderHero(rows) {
  const hero = document.getElementById("hero");
  const loaded = rows.filter((r) => r.data);
  if (!loaded.length) {
    hero.className = "hero empty";
    hero.textContent = "No conditions available right now.";
    return;
  }
  const best = loaded.reduce((a, b) =>
    ORDER[b.data.now.level] < ORDER[a.data.now.level] ? b : a
  );
  const level = best.data.now.level;
  let title, sub;

  if (level === "green") {
    const n = loaded.filter((r) => r.data.now.level === "green").length;
    title = "Good to climb";
    sub = `${n} crag${n > 1 ? "s" : ""} dry now — driest is <span class="accent">${best.crag.name}</span>.`;
  } else if (level === "amber") {
    title = "Borderline — climb with care";
    sub = `No fully dry crags. <span class="accent">${best.crag.name}</span> is closest; inspect by hand before committing.`;
  } else {
    title = "Too wet to climb";
    const nx = nextDay(rows, "green") || nextDay(rows, "amber");
    sub = nx
      ? `Everything's saturated. Next likely window: <span class="accent">${nx.weekendName}</span> (${nx.crag}).`
      : "Everything's saturated, with no clear drying window in the next few days.";
  }

  hero.className = "hero";
  hero.innerHTML = `
    <div class="hero-glyph ${level}">${GLYPH[level]}</div>
    <div class="hero-body">
      <h2>${title}</h2>
      <p>${sub}</p>
    </div>`;
}

async function render() {
  const grid = document.getElementById("grid");
  const status = document.getElementById("status");
  const btn = document.getElementById("refresh");
  const nowIso = currentHourIso();
  btn.classList.add("spin");
  status.textContent = "Checking the latest weather…";

  let weather;
  try {
    weather = await fetchAll();
  } catch (err) {
    btn.classList.remove("spin");
    status.textContent = "Couldn't reach the weather service — try Refresh.";
    document.getElementById("hero").className = "hero empty";
    document.getElementById("hero").textContent = "Weather service unavailable.";
    grid.innerHTML = "";
    for (const crag of CRAGS) grid.appendChild(errorCard(crag, err.message));
    return;
  }

  const rows = CRAGS.map((crag, i) => {
    try {
      return { crag, data: assessCrag(weather[i].hourly, crag, nowIso) };
    } catch (err) {
      return { crag, error: err.message || "no data" };
    }
  });
  rows.sort((a, b) => (a.data ? ORDER[a.data.now.level] : 3) - (b.data ? ORDER[b.data.now.level] : 3));

  renderHero(rows);
  grid.innerHTML = "";
  for (const { crag, data, error } of rows) {
    grid.appendChild(data ? card(crag, data) : errorCard(crag, error));
  }

  const t = new Date().toLocaleTimeString("en-GB", {
    timeZone: "Europe/London",
    hour: "2-digit",
    minute: "2-digit",
  });
  btn.classList.remove("spin");
  status.textContent = `Updated ${t} · data from Open-Meteo`;
}

document.getElementById("refresh").addEventListener("click", render);
render();

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("./sw.js").catch(() => {});
}
