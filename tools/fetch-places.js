// ดึงที่พักจริงทั้งหมดใน กทม. + ปริมณฑล จาก OpenStreetMap (Overpass API) แล้วบันทึกเป็น data/places.json
//   node tools/fetch-places.js            -> ดึงทั้งหมด (แบ่งเป็นตาราง ๆ เพื่อไม่ให้ timeout)
//   node tools/fetch-places.js --test condo-> ค้นชื่อทดสอบ
// ข้อมูล © OpenStreetMap contributors (ODbL) — ต้องใส่เครดิตเมื่อแสดงผล
const fs = require('fs');
const path = require('path');

const ENDPOINTS = ['https://overpass-api.de/api/interpreter', 'https://overpass.private.coffee/api/interpreter', 'https://maps.mail.ru/osm/tools/overpass/api/interpreter'];
const BBOX = { s: 13.48, w: 100.22, n: 14.12, e: 100.95 }; // กทม. นนทบุรี ปทุมธานี สมุทรปราการ บางส่วนของนครปฐม สมุทรสาคร
const NAME_RE = 'คอนโด|อพาร์ท|อพาร์ต|แมนชั่น|แมนชัน|หอพัก|ห้องเช่า|ห้องพัก|เรสซิเดนซ์|เรสซิเดนท์|เพลส|ทาวน์เฮาส์|ทาวน์โฮม|หมู่บ้าน|แฟลต|คอร์ท|โฮม|เฮ้าส์|เฮาส์|ลอฟท์|condo|apartment|apartement|mansion|dorm|residence|residences|place|suite|court|loft|flat|lodge|home|house|ville|village|tower|room|living|hostel';

const UA = 'yoonaidee-condo-map/0.1 (local dev)';
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function overpass(q) {
  for (let attempt = 0; attempt < 6; attempt++) {
    const ep = ENDPOINTS[attempt % ENDPOINTS.length];
    try {
      const r = await fetch(ep, { method: 'POST', headers: { 'User-Agent': UA, 'Content-Type': 'application/x-www-form-urlencoded' }, body: 'data=' + encodeURIComponent(q) });
      const txt = await r.text();
      if (!r.ok || txt.startsWith('<')) throw new Error(ep + ' ' + r.status + ' ' + txt.slice(0, 120).replace(/\s+/g, ' '));
      return JSON.parse(txt);
    } catch (e) { console.warn('  retry', attempt + 1, e.message); await sleep(4000 * (attempt + 1)); }
  }
  throw new Error('overpass failed');
}

function query(b) {
  const bb = `${b.s},${b.w},${b.n},${b.e}`;
  return `[out:json][timeout:180];
(
  nwr["building"~"^(apartments|dormitory|condominium|residential|terrace|hotel)$"]["name"](${bb});
  nwr["tourism"~"^(apartment|hostel|guest_house|hotel|motel)$"](${bb});
  nwr["amenity"="dormitory"](${bb});
  nwr["residential"~"condominium|apartment"](${bb});
  nwr["landuse"="residential"]["name"](${bb});
  nwr["name"~"${NAME_RE}",i]["building"](${bb});
  nwr["name"~"${NAME_RE}",i]["addr:street"](${bb});
);
out center tags;`;
}

function classify(t) {
  const n = ((t.name || '') + ' ' + (t['name:en'] || '') + ' ' + (t['name:th'] || '')).toLowerCase();
  if (/หอพัก|dorm|hostel/.test(n) || t.building === 'dormitory' || t.amenity === 'dormitory' || t.tourism === 'hostel') return 'dorm';
  if (/คอนโด|condo/.test(n) || t.building === 'condominium' || /condominium/.test(t.residential || '')) return 'condo';
  if (/อพาร์ท|อพาร์ต|apartment|apartement|แมนชั่น|แมนชัน|mansion|ห้องเช่า|ห้องพัก|room|แฟลต|flat|court|คอร์ท/.test(n) || t.tourism === 'apartment') return 'apartment';
  if (/หมู่บ้าน|village|ทาวน์|town|home|โฮม|house|เฮาส์|เฮ้าส์|ville/.test(n) || t.landuse === 'residential' || t.building === 'terrace') return 'house';
  if (t.tourism === 'hotel' || t.tourism === 'guest_house' || t.tourism === 'motel' || t.building === 'hotel') return 'hotel';
  if (t.building === 'apartments' || t.building === 'residential') return /tower|residence|เรสซิ|place|เพลส|suite|loft|ลอฟท์/.test(n) ? 'condo' : 'apartment';
  return 'apartment';
}

function toPlace(e) {
  const t = e.tags || {}; const lat = e.lat ?? e.center?.lat, lng = e.lon ?? e.center?.lon;
  if (lat == null || !t.name && !t['name:en'] && !t['name:th']) return null;
  const type = classify(t);
  return {
    id: e.type[0] + e.id, osm: `${e.type}/${e.id}`, name: t.name || t['name:th'] || t['name:en'], nameEn: t['name:en'] || null, type,
    lat: +lat.toFixed(6), lng: +lng.toFixed(6),
    levels: t['building:levels'] ? +t['building:levels'] || null : null,
    street: [t['addr:housenumber'], t['addr:street'] || t['addr:place']].filter(Boolean).join(' ') || null,
    subdistrict: t['addr:subdistrict'] || null, district: t['addr:district'] || null, province: t['addr:province'] || null,
    website: t.website || t['contact:website'] || null,
    rooms: t.rooms ? +t.rooms || null : null, operator: t.operator || null,
  };
}

async function main() {
  const out = path.join(__dirname, '..', 'data', 'places.json');
  const test = process.argv.indexOf('--test');
  if (test > 0) {
    const kw = process.argv[test + 1] || 'condo';
    const j = await overpass(`[out:json][timeout:60];nwr["name"~"${kw}",i](${BBOX.s},${BBOX.w},${BBOX.n},${BBOX.e});out center tags;`);
    console.log(j.elements.map(e => `${e.type}/${e.id} ${JSON.stringify(e.tags)}`).join('\n') || '(ไม่พบ)');
    return;
  }
  // แบ่ง bbox เป็นตาราง 4x4 กัน timeout
  const N = 4, dLat = (BBOX.n - BBOX.s) / N, dLng = (BBOX.e - BBOX.w) / N;
  const map = new Map();
  for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) {
    const b = { s: BBOX.s + i * dLat, n: BBOX.s + (i + 1) * dLat, w: BBOX.w + j * dLng, e: BBOX.w + (j + 1) * dLng };
    process.stdout.write(`cell ${i * N + j + 1}/${N * N} ... `);
    const res = await overpass(query(b));
    let added = 0;
    for (const e of res.elements) { const p = toPlace(e); if (p && !map.has(p.id)) { map.set(p.id, p); added++; } }
    console.log(added, 'places');
    await sleep(1500);
  }
  const places = [...map.values()];
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, JSON.stringify({ source: 'OpenStreetMap contributors (ODbL) via Overpass API', fetchedAt: new Date().toISOString(), bbox: BBOX, count: places.length, places }));
  const byType = places.reduce((m, p) => (m[p.type] = (m[p.type] || 0) + 1, m), {});
  console.log('saved', places.length, 'places ->', out, byType);
}
main().catch(e => { console.error(e); process.exit(1); });
