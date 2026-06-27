// Southern Sandstone crags.
// coords are approximate (the whole cluster sits within ~15km, so weather is
// near-identical between crags). `dryFactor` scales how much drying a crag needs
// before it's safe: <1 = open/sunny, dries fast; >1 = shaded/seepy, dries slow.
// These reflect community knowledge of aspect & seepage and are easy to tune.
export const CRAGS = [
  {
    id: "harrisons",
    name: "Harrison's Rocks",
    lat: 51.0983,
    lon: 0.1866,
    dryFactor: 1.1,
    note: "Woodland, mixed aspect. Faces dry reasonably; crag base stays damp.",
  },
  {
    id: "highrocks",
    name: "High Rocks",
    lat: 51.113,
    lon: 0.226,
    dryFactor: 1.4,
    note: "Notoriously seepy and tree-shaded — slowest of all to dry.",
  },
  {
    id: "bowles",
    name: "Bowles Rocks",
    lat: 51.0756,
    lon: 0.2001,
    dryFactor: 0.8,
    note: "Open and sunny on the activity-centre slope — dries fastest.",
  },
  {
    id: "eridge",
    name: "Eridge Rocks",
    lat: 51.1,
    lon: 0.218,
    dryFactor: 1.3,
    note: "Wooded, north-facing, SSSI — holds damp for a long time.",
  },
  {
    id: "stonefarm",
    name: "Stone Farm Rocks",
    lat: 51.106,
    lon: 0.045,
    dryFactor: 0.9,
    note: "Fairly open above Weir Wood — dries reasonably quickly.",
  },
  {
    id: "bullshollow",
    name: "Bull's Hollow",
    lat: 51.137,
    lon: 0.232,
    dryFactor: 1.1,
    note: "Small quarried bowl near Rusthall; can stay shady. (coords approx)",
  },
  {
    id: "bassetts",
    name: "Bassett's Farm Rocks",
    lat: 51.088,
    lon: 0.17,
    dryFactor: 1.0,
    note: "Quieter outcrop; mixed exposure. (coords approx)",
  },
  {
    id: "underrockes",
    name: "Under Rockes",
    lat: 51.103,
    lon: 0.195,
    dryFactor: 1.2,
    note: "Wooded and shady — on the slow side. (coords approx)",
  },
  {
    id: "toadrocks",
    name: "Toad Rock (Rusthall Common)",
    lat: 51.139,
    lon: 0.246,
    dryFactor: 1.0,
    note: "Open common; dries about average. (coords approx)",
  },
];
