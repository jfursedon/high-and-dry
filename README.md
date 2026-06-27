# High & Dry

*Southern Sandstone climbing conditions.*

A single-purpose PWA that gives a **traffic-light wet/dry verdict** for Southern
Sandstone climbing crags (Harrison's, High Rocks, Bowles, Eridge, Stone Farm…).

Southern Sandstone is soft and porous: climbing it wet breaks holds and does
permanent damage. The community rule is "give it a couple of dry days, longer in
winter". This tool automates that judgement and shows its working.

## How it works

- **No backend, no API key.** Pure static site. Each crag's weather comes live
  from [Open-Meteo](https://open-meteo.com/) (free, CORS-enabled), queried at the
  crag's coordinates with `past_days=3` so it can see recent rain.
- **Strict drying model** (`model.js`):
  - Red if it's raining, < 24h since rain, or the ground is still saturated.
  - Green needs **48h+ dry** *and* a strong accumulated drying index *and* low
    soil moisture *and* no imminent rain.
  - Amber is everything in between.
  - Each crag has a `dryFactor` (aspect/seepage) so slow-drying crags like High
    Rocks need more drying before they go green.
- Signals used: hourly precipitation, surface soil moisture, shortwave radiation
  (sun), wind, temperature, humidity.

## Run locally

Any static server works (ES modules need http, not `file://`):

```sh
python3 -m http.server 8000
# then open http://localhost:8000
```

## Deploy

Cloudflare Pages (drop the folder, or `wrangler pages deploy .`) — same as Cwilt.
No build step.

## Tuning

- Crag coords, notes and `dryFactor` live in `crags.js`.
- Thresholds (drying index, dry-hours, soil-moisture cutoffs) are constants at
  the top of `model.js`.

## Disclaimer

Guidance only. Always feel the rock yourself and follow the
[Sandstone Code of Practice](http://www.southernsandstoneclimbs.co.uk/).
