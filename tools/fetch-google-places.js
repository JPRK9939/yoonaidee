// ดึงที่พัก (หอพัก/อพาร์ตเมนต์/แมนชั่น/คอนโด/ห้องเช่า) ทั่ว กทม.+ปริมณฑล จาก Google Places API (New) → data/places-google.json
//
// ตั้งค่า key (ห้ามแปะ key ลงในโค้ด):  สร้างไฟล์ .env ที่โฟลเดอร์โปรเจกต์ แล้วใส่บรรทัด
//     GOOGLE_MAPS_API_KEY=xxxxxxxx
//
//   node tools/fetch-google-places.js --estimate         ประเมินจำนวนคำขอ (ไม่ยิงจริง ไม่เสียเงิน)
//   node tools/fetch-google-places.js --test "ชื่อสถานที่" ค้นชื่อเดียว (1 คำขอ) ไว้ทดสอบว่า key ใช้ได้
//   node tools/fetch-google-places.js                    ดึงจริง (หยุดเมื่อครบงบ --budget, ค่าเริ่มต้น 4500 คำขอ/รอบ)
//   node tools/fetch-google-places.js --budget 2000      กำหนดงบจำนวนคำขอเอง
//   node tools/fetch-google-places.js --reset            เริ่มใหม่ทั้งหมด (ล้างความคืบหน้า)
//
// ทำงานต่อจากจุดเดิมได้: ความคืบหน้าเก็บที่ data/google-cache/state.json → รันซ้ำเดือนถัดไปเพื่อใช้โควตาฟรีรอบใหม่
// วิธีกวาด: แบ่งพื้นที่เป็นช่อง ~4 กม. ค้นทีละคำค้น ถ้าช่องไหนผลเต็ม 60 รายการ (เพดานของ Google) จะแบ่งช่องเป็น 4 แล้วค้นซ้ำ
// ข้อกำหนด Google: เก็บพิกัดได้ไม่เกิน 30 วัน (เว็บจะเลิกใช้ไฟล์นี้อัตโนมัติเมื่อเกิน) · ต้องแสดงเครดิต Google Maps
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'data', 'places-google.json');
const STATE = path.join(ROOT, 'data', 'google-cache', 'state.json');
const BBOX = { s: 13.48, w: 100.22, n: 14.12, e: 100.95 };
const CELL = 0.04;            // ช่องเริ่มต้น ~4.4 กม.
const MIN_CELL = 0.004;       // เล็กสุด ~450 ม.
const KEYWORDS = ['หอพัก', 'อพาร์ทเม้นท์', 'แมนชั่น', 'คอนโด', 'ห้องเช่า'];
const FIELDS = ['places.id', 'places.displayName', 'places.location', 'places.formattedAddress', 'places.primaryType', 'places.types', 'places.businessStatus', 'places.googleMapsUri'].join(',');
const LODGING_TYPES = /apartment|condominium|housing|lodging|hostel|guest_house|dormitory|hotel|motel|extended_stay|inn|resort/;
const NAME_RE = /หอ|อพาร์ท|อพาร์ต|แมนชั่น|แมนชัน|คอนโด|ห้องเช่า|ห้องพัก|เรสซิเดน|เพลส|เฮาส์|เฮ้าส์|ลอฟท์|condo|apartment|mansion|dorm|residence|place|suite|room|house|loft|court|living|tower|ville|home|hostel/i;

const args = process.argv.slice(2);
const arg = (k, d) => { const i = args.indexOf(k); return i >= 0 ? (args[i + 1] ?? true) : d; };
const sleep = ms => new Promise(r => setTimeout(r, ms));

function loadKey() {
  if (process.env.GOOGLE_MAPS_API_KEY) return process.env.GOOGLE_MAPS_API_KEY.trim();
  const f = path.join(ROOT, '.env');
  if (fs.existsSync(f)) { const m = fs.readFileSync(f, 'utf8').match(/^\s*GOOGLE_MAPS_API_KEY\s*=\s*"?([^"\r\n]+)"?/m); if (m) return m[1].trim(); }
  return null;
}

function baseCells() {
  const cells = [];
  for (let s = BBOX.s; s < BBOX.n - 1e-9; s += CELL) for (let w = BBOX.w; w < BBOX.e - 1e-9; w += CELL)
    cells.push({ s: +s.toFixed(5), w: +w.toFixed(5), n: +Math.min(s + CELL, BBOX.n).toFixed(5), e: +Math.min(w + CELL, BBOX.e).toFixed(5) });
  return cells;
}

let requests = 0;
async function searchText(key, body) {
  requests++;
  for (let attempt = 0; attempt < 4; attempt++) {
    const r = await fetch('https://places.googleapis.com/v1/places:searchText', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Goog-Api-Key': key, 'X-Goog-FieldMask': FIELDS + ',nextPageToken' },
      body: JSON.stringify(body),
    });
    const j = await r.json().catch(() => ({}));
    if (r.ok) return j;
    const msg = j.error?.message || r.statusText;
    if (r.status === 429 || r.status >= 500) { console.warn('  retry', r.status, msg); await sleep(3000 * (attempt + 1)); continue; }
    throw new Error(`Google ${r.status}: ${msg}`);
  }
  throw new Error('Google: too many retries');
}

function classify(p) {
  const n = (p.displayName?.text || '').toLowerCase(), t = (p.types || []).join(' ') + ' ' + (p.primaryType || '');
  if (/หอ(พัก)?|dorm|hostel/.test(n) || /hostel|dormitory/.test(t)) return 'dorm';
  if (/คอนโด|condo/.test(n) || /condominium/.test(t)) return 'condo';
  if (/hotel|resort|motel|โรงแรม|รีสอร์ท/.test(n) || /^hotel|resort|motel/.test(p.primaryType || '')) return 'hotel';
  if (/หมู่บ้าน|village|ทาวน์|townhome/.test(n)) return 'house';
  return 'apartment';
}
function keep(p) {
  if (!p.location || p.businessStatus === 'CLOSED_PERMANENTLY') return false;
  const t = (p.types || []).join(' ') + ' ' + (p.primaryType || '');
  return LODGING_TYPES.test(t) || NAME_RE.test(p.displayName?.text || '');
}

async function main() {
  if (arg('--reset')) { fs.rmSync(STATE, { force: true }); console.log('ล้างความคืบหน้าแล้ว'); }
  const cells = baseCells();
  if (arg('--estimate')) {
    const base = cells.length * KEYWORDS.length;
    console.log(`ช่องเริ่มต้น ${cells.length} ช่อง × ${KEYWORDS.length} คำค้น = ${base} คำขอขั้นต่ำ`);
    console.log(`รวมการแบ่งช่องย่อยในเขตเมือง + การขอหน้าถัดไป คาดว่า ~${Math.round(base * 2.5).toLocaleString()}–${Math.round(base * 5).toLocaleString()} คำขอ`);
    console.log('ตั้งงบต่อรอบด้วย --budget (ค่าเริ่มต้น 4500) แล้วรันซ้ำได้ สคริปต์ทำต่อจากจุดเดิม');
    return;
  }
  const key = loadKey();
  if (!key) { console.error('ไม่พบ GOOGLE_MAPS_API_KEY — สร้างไฟล์ .env ที่โฟลเดอร์โปรเจกต์ แล้วใส่ GOOGLE_MAPS_API_KEY=...'); process.exit(1); }

  if (arg('--test')) {
    const q = arg('--test');
    const j = await searchText(key, { textQuery: q, languageCode: 'th', regionCode: 'TH', pageSize: 5,
      locationBias: { rectangle: { low: { latitude: BBOX.s, longitude: BBOX.w }, high: { latitude: BBOX.n, longitude: BBOX.e } } } });
    for (const p of j.places || []) console.log('-', p.displayName?.text, '|', p.formattedAddress, '|', p.location?.latitude, p.location?.longitude, '|', p.primaryType);
    if (!j.places?.length) console.log('(ไม่พบ)');
    return;
  }

  const budget = +arg('--budget', 4500);
  fs.mkdirSync(path.dirname(STATE), { recursive: true });
  let st = fs.existsSync(STATE) ? JSON.parse(fs.readFileSync(STATE, 'utf8')) : null;
  if (!st) st = { queue: cells.flatMap(c => KEYWORDS.map(k => ({ ...c, k }))), places: {}, startedAt: new Date().toISOString(), requests: 0 };
  console.log(`งานค้าง ${st.queue.length} ช่อง·คำค้น · ได้แล้ว ${Object.keys(st.places).length} แห่ง · งบรอบนี้ ${budget} คำขอ`);
  const save = () => {
    fs.writeFileSync(STATE, JSON.stringify(st));
    const places = Object.values(st.places);
    fs.writeFileSync(OUT, JSON.stringify({ source: 'Google Maps Platform — Places API (New)', attribution: 'Google Maps', fetchedAt: new Date().toISOString(),
      complete: st.queue.length === 0, count: places.length, places }));
  };

  while (st.queue.length && requests < budget) {
    const job = st.queue.shift();
    let token = null, total = 0, page = 0;
    do {
      const j = await searchText(key, { textQuery: job.k, languageCode: 'th', regionCode: 'TH', pageSize: 20, pageToken: token || undefined,
        locationRestriction: { rectangle: { low: { latitude: job.s, longitude: job.w }, high: { latitude: job.n, longitude: job.e } } } });
      for (const p of j.places || []) {
        total++;
        if (!keep(p) || st.places[p.id]) continue;
        st.places[p.id] = { id: 'g-' + p.id, placeId: p.id, name: p.displayName?.text, type: classify(p), lat: p.location.latitude, lng: p.location.longitude,
          street: p.formattedAddress || null, gmaps: p.googleMapsUri || null, gtypes: p.types || [] };
      }
      token = j.nextPageToken; page++;
      if (token) await sleep(400);
    } while (token && requests < budget);
    // ผลชนเพดาน 60 → แบ่งช่องย่อย
    if (total >= 60 && job.n - job.s > MIN_CELL) {
      const ms = (job.s + job.n) / 2, mw = (job.w + job.e) / 2;
      st.queue.unshift(...[[job.s, job.w, ms, mw], [job.s, mw, ms, job.e], [ms, job.w, job.n, mw], [ms, mw, job.n, job.e]].map(([s, w, n, e]) => ({ s, w, n, e, k: job.k })));
    }
    st.requests += page;
    if (requests % 25 < page) { save(); process.stdout.write(`\r  คำขอ ${requests}/${budget} · ที่พัก ${Object.keys(st.places).length} · งานค้าง ${st.queue.length}   `); }
  }
  save();
  console.log(`\nเสร็จรอบนี้: ใช้ ${requests} คำขอ · ที่พักทั้งหมด ${Object.keys(st.places).length} แห่ง · งานค้าง ${st.queue.length}` + (st.queue.length ? ' (รันซ้ำเพื่อทำต่อ)' : ' ✅ กวาดครบแล้ว'));
}
main().catch(e => { console.error('\n' + e.message); process.exit(1); });
