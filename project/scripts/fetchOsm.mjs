import { mkdirSync, writeFileSync } from 'node:fs';

const CENTER = { lat: -20.31082, lon: -40.314452 };
const HALF = 400; // metros (recorte de 800 m)

const R = 6378137;
const dLat = (HALF / R) * (180 / Math.PI);
const dLon = dLat / Math.cos((CENTER.lat * Math.PI) / 180);
const bbox = [CENTER.lat - dLat, CENTER.lon - dLon, CENTER.lat + dLat, CENTER.lon + dLon].join(',');

const query = `[out:json][timeout:60];
(
  way["highway"](${bbox});
  way["building"](${bbox});
);
out geom;`;

const endpoints = ['https://overpass-api.de/api/interpreter', 'https://overpass.kumi.systems/api/interpreter'];
let data;
for (const url of endpoints) {
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': 'urbsys-hack/1.0' },
      body: 'data=' + encodeURIComponent(query),
    });
    if (!res.ok) throw new Error(res.status);
    data = await res.json();
    break;
  } catch (e) {
    console.error(url, 'falhou:', e.message);
  }
}
if (!data) process.exit(1);

const mPerLat = (Math.PI / 180) * R;
const mPerLon = mPerLat * Math.cos((CENTER.lat * Math.PI) / 180);
// x = leste, z = sul (convenção three.js com Y para cima)
const project = (p) => [
  +((p.lon - CENTER.lon) * mPerLon).toFixed(1),
  +(-(p.lat - CENTER.lat) * mPerLat).toFixed(1),
];

const roads = [];
const buildings = [];
for (const el of data.elements) {
  if (el.type !== 'way' || !el.geometry) continue;
  const pts = el.geometry.map(project);
  const t = el.tags ?? {};
  if (t.highway) {
    roads.push({ name: t.name ?? null, kind: t.highway, oneway: t.oneway === 'yes', pts });
  } else if (t.building) {
    const levels = parseFloat(t['building:levels']);
    const height = parseFloat(t.height);
    buildings.push({
      h: !isNaN(height) ? height : !isNaN(levels) ? levels * 3.2 : null,
      pts,
    });
  }
}

const out = new URL('../src/data/', import.meta.url);
mkdirSync(out, { recursive: true });
writeFileSync(new URL('vitoria.json', out), JSON.stringify({ half: HALF, roads, buildings }));
console.log('vias:', roads.length, 'prédios:', buildings.length);
console.log([...new Set(roads.map((r) => r.kind))].join(', '));
