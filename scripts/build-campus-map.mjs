// Converts an Overpass API JSON export into the compact GeoJSON used for the
// stylized game map (public/map/campus-map.json).
//
// Usage: node scripts/build-campus-map.mjs <overpass-export.json>
//
// The Overpass query used (bbox around Bucknell's main campus):
//   [out:json];(way["building"](40.9495,-76.8935,40.9630,-76.8730);
//   way["highway"](...);way["landuse"~"grass|forest|recreation_ground"](...);
//   way["leisure"~"park|pitch|track|garden|stadium"](...);
//   way["natural"~"water|wood|scrub"](...);way["amenity"="parking"](...););
//   out geom tags;
//
// Map data © OpenStreetMap contributors, available under the ODbL.
// Building names are intentionally dropped so the map never reveals a hidden
// destination before its clue is solved.
import fs from "node:fs";

const input = process.argv[2];
if (!input) {
  console.error("Usage: node scripts/build-campus-map.mjs <overpass-export.json>");
  process.exit(1);
}

const ROADS = new Set([
  "primary", "secondary", "tertiary", "residential", "unclassified",
  "service", "living_street", "primary_link", "secondary_link", "tertiary_link",
]);
const PATHS = new Set(["footway", "path", "pedestrian", "steps", "cycleway", "track"]);

const round = (n) => Math.round(n * 1e6) / 1e6;

function classify(tags) {
  if (tags.building) return "building";
  if (tags.highway && ROADS.has(tags.highway)) return tags.area === "yes" ? null : "road";
  if (tags.highway && PATHS.has(tags.highway)) return tags.area === "yes" ? "plaza" : "path";
  if (tags.amenity === "parking") return "parking";
  if (tags.natural === "water") return "water";
  if (tags.leisure === "pitch" || tags.leisure === "track" || tags.leisure === "stadium") return "pitch";
  if (tags.landuse || tags.leisure || tags.natural) return "green";
  return null;
}

const raw = JSON.parse(fs.readFileSync(input, "utf8"));
const features = [];
for (const el of raw.elements) {
  if (el.type !== "way" || !el.geometry) continue;
  const kind = classify(el.tags ?? {});
  if (!kind) continue;
  const coords = el.geometry.filter(Boolean).map((p) => [round(p.lon), round(p.lat)]);
  if (coords.length < 2) continue;
  const closed =
    coords.length > 3 &&
    coords[0][0] === coords.at(-1)[0] &&
    coords[0][1] === coords.at(-1)[1];
  const isArea = ["building", "green", "pitch", "parking", "water", "plaza"].includes(kind);
  if (isArea && !closed) continue;
  features.push({
    type: "Feature",
    properties: { k: kind },
    geometry: isArea
      ? { type: "Polygon", coordinates: [coords] }
      : { type: "LineString", coordinates: coords },
  });
}

const order = { green: 0, pitch: 1, water: 2, parking: 3, plaza: 4, road: 5, path: 6, building: 7 };
features.sort((a, b) => order[a.properties.k] - order[b.properties.k]);

const out = {
  type: "FeatureCollection",
  attribution: "© OpenStreetMap contributors (ODbL)",
  generated: new Date().toISOString().slice(0, 10),
  features,
};
fs.writeFileSync(new URL("../public/map/campus-map.json", import.meta.url), JSON.stringify(out));
const counts = features.reduce((m, f) => ((m[f.properties.k] = (m[f.properties.k] ?? 0) + 1), m), {});
console.log("Wrote", features.length, "features", counts);
