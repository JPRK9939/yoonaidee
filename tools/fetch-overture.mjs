// ดึงที่พักจาก Overture Maps (ฟรี, CDLA-Permissive-2.0) → data/places-overture.json
//   node tools/fetch-overture.mjs                -> ดึง release ล่าสุด
//   node tools/fetch-overture.mjs --test condo   -> ค้นชื่อทดสอบ
// อ่านไฟล์ GeoParquet สาธารณะบน S3 แบบไม่ต้องล็อกอิน ไม่มีค่าใช้จ่าย (DuckDB อ่านเฉพาะส่วนที่อยู่ในกรอบพื้นที่)
//
// หมายเหตุ: ในข้อมูลไทยของ Overture อาคารที่พักจาก Facebook จำนวนมากถูกจัดหมวดเป็น "historic_site"
// จึงรวมหมวดนั้นด้วย แล้วกรองวัด/พิพิธภัณฑ์/ชื่อซอยออก
import { DuckDBInstance } from '@duckdb/node-api';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const BBOX = { s: 13.48, w: 100.22, n: 14.12, e: 100.95 };
const args = process.argv.slice(2);

async function latestRelease() {
  const j = await (await fetch('https://stac.overturemaps.org/catalog.json')).json();
  return j.links.filter(l => l.rel === 'child').map(l => l.href.split('/').at(-2)).sort().at(-1);
}

const LODGING_CATS = ['historic_site', 'lodging', 'hotel', 'hostel', 'lodge', 'service_apartment', 'condominium', 'apartment', 'guest_house',
  'university_housing', 'holiday_rental_home', 'motel', 'inn', 'resort', 'bed_and_breakfast'];
const STRONG_NAME = 'หอพัก|แมนชั่น|แมนชัน|อพาร์ท|อพาร์ต|อาพาร์ท|อาพาท|ห้องเช่า|ห้องพัก|คอนโด|apartment|mansion|dormitory|condo';
const NOT_LODGING = 'วัด|temple|พิพิธภัณฑ์|museum|อนุสาวรีย์|monument|พระราชวัง|palace|ศาลเจ้า|shrine|โบสถ์|church|มัสยิด|mosque|อุทยาน|ป้อม';
const ADDRESSY = '^(ซอย|ซ\\.|ถนน|ถ\\.|แยก|ชุมชน|soi |road)|^[0-9/ -]+$';

const rel = await latestRelease();
const src = `s3://overturemaps-us-west-2/release/${rel}/theme=places/type=place/*`;
console.log('Overture release', rel);
const db = await DuckDBInstance.create(':memory:');
const con = await db.connect();
await con.run("INSTALL httpfs; LOAD httpfs; INSTALL spatial; LOAD spatial; SET s3_region='us-west-2';");
const bboxWhere = `bbox.xmin BETWEEN ${BBOX.w} AND ${BBOX.e} AND bbox.ymin BETWEEN ${BBOX.s} AND ${BBOX.n}`;

const t = args.indexOf('--test');
if (t >= 0) {
  const kw = (args[t + 1] || 'condo').replace(/'/g, "''");
  const r = await con.runAndReadAll(`SELECT names.primary AS name, taxonomy.primary AS cat, ST_Y(geometry) lat, ST_X(geometry) lng, addresses[1].freeform AS addr
    FROM read_parquet('${src}', hive_partitioning=1) WHERE ${bboxWhere} AND names.primary ILIKE '%${kw}%' LIMIT 30`);
  console.table(r.getRowObjectsJson());
  process.exit(0);
}

const t0 = Date.now();
const res = await con.runAndReadAll(`SELECT id, names.primary AS name, coalesce(taxonomy.primary, basic_category) AS cat,
    ST_Y(geometry) AS lat, ST_X(geometry) AS lng, addresses[1].freeform AS addr, phones[1] AS phone, websites[1] AS website, socials[1] AS social, confidence
  FROM read_parquet('${src}', hive_partitioning=1)
  WHERE ${bboxWhere} AND names.primary IS NOT NULL AND coalesce(operating_status, 'open') <> 'permanently_closed'
    AND (coalesce(taxonomy.primary, basic_category) IN (${LODGING_CATS.map(c => `'${c}'`).join(',')})
         OR regexp_matches(lower(names.primary), '${STRONG_NAME}'))
    AND NOT regexp_matches(lower(names.primary), '${NOT_LODGING}')
    AND NOT regexp_matches(lower(trim(names.primary)), '${ADDRESSY}')`);
const rows = res.getRowObjectsJson();
console.log('rows', rows.length, 'in', ((Date.now() - t0) / 1000).toFixed(0) + 's');

const strong = new RegExp(STRONG_NAME, 'i');
function classify(r) {
  const n = (r.name || '').toLowerCase(), c = r.cat || '';
  if (/หอพัก|หอ |^หอ|dorm|hostel/.test(n) || /hostel|university_housing/.test(c)) return 'dorm';
  if (/คอนโด|condo/.test(n) || c === 'condominium') return 'condo';
  if (/แมนชั่น|แมนชัน|อพาร์ท|อพาร์ต|อาพาร์ท|อาพาท|apartment|mansion|ห้องเช่า|ห้องพัก|เรสซิเดน|residence|เพลส|place|ลอฟท์|loft|ทาวเวอร์|tower|court|คอร์ท/.test(n) || /service_apartment|apartment/.test(c)) return 'apartment';
  if (/โรงแรม|hotel|resort|รีสอร์ท|motel|โฮสเทล|guest ?house|เกสต์เฮาส์/.test(n) || /^(hotel|motel|resort|inn|bed_and_breakfast|guest_house)$/.test(c)) return 'hotel';
  if (/หมู่บ้าน|บ้าน|village|ville|วิลล์|วิลล่า|villa|ทาวน์|town|home|โฮม|house|เฮาส์|เฮ้าส์|เคหะ|ซิตี้|city/.test(n)) return 'house';
  return c === 'hotel' ? 'hotel' : 'apartment';
}
// หมวดที่ไม่ใช่ที่พักโดยตรง (เช่น บริษัทอสังหาฯ ร้านอาหาร) ต้องมีคำที่บอกชัดในชื่อเท่านั้น
const places = rows.filter(r => r.lat && (LODGING_CATS.includes(r.cat) || strong.test(r.name)) && !/restaurant|cafe|coffee|clinic|hospital|store|shop/.test(r.cat || ''))
  .map(r => {
    const web = r.website || r.social || null;
    return { id: 'ov-' + r.id.slice(0, 18), name: r.name, type: classify(r), lat: +(+r.lat).toFixed(6), lng: +(+r.lng).toFixed(6),
      street: r.addr || null, website: web && /^https?:\/\//.test(web) ? web : null, ovCat: r.cat };
  });
const out = path.join(ROOT, 'data', 'places-overture.json');
fs.writeFileSync(out, JSON.stringify({ source: 'Overture Maps Foundation — Places', license: 'CDLA-Permissive-2.0', release: rel, fetchedAt: new Date().toISOString(), count: places.length, places }));
const byType = places.reduce((m, p) => (m[p.type] = (m[p.type] || 0) + 1, m), {});
console.log('saved', places.length, '->', out, byType, (fs.statSync(out).size / 1e6).toFixed(1) + ' MB');
