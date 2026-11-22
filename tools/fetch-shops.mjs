// ดึงร้านค้า / ร้านสะดวกซื้อ / 7-Eleven ทั้ง กทม.+ปริมณฑล จาก Overture Maps (ฟรี) → data/shops.json
//   node tools/fetch-shops.mjs
// รูปแบบไฟล์ (บีบให้เล็ก): lat/lng เป็นจำนวนเต็ม ×1e5, k = สตริงตัวอักษรต่อร้าน: 7 = 7-Eleven, c = ร้านสะดวกซื้ออื่น, s = ร้านค้า/ร้านอาหารทั่วไป
import { DuckDBInstance } from '@duckdb/node-api';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const BBOX = { s: 13.48, w: 100.22, n: 14.12, e: 100.95 };
const j = await (await fetch('https://stac.overturemaps.org/catalog.json')).json();
const rel = j.links.filter(l => l.rel === 'child').map(l => l.href.split('/').at(-2)).sort().at(-1);
console.log('Overture release', rel);

const db = await DuckDBInstance.create(':memory:');
const con = await db.connect();
await con.run("INSTALL httpfs; LOAD httpfs; INSTALL spatial; LOAD spatial; SET s3_region='us-west-2';");
const SEVEN = "7-?eleven|เซเว่น|7 eleven|เซเว่นอีเลฟเว่น";
const CONV = "family ?mart|แฟมิลี่มาร์ท|lawson|ลอว์สัน|cj (more|express|supermarket)|ซีเจ|tops daily|ท็อปส์ เดลี่|mini big ?c|มินิบิ๊กซี|lotus.?s go fresh|โลตัส โกเฟรช|108 ?shop|jiffy|จิฟฟี่";
const SHOP_CAT = "store|shop|market|mart|grocery|supermarket|pharmacy|drugstore|bakery|restaurant|cafe|coffee|food|bar|laundr|salon|barber|noodle|deli|dessert|tea|bistro|eatery|kiosk";
const t0 = Date.now();
const r = await con.runAndReadAll(`
  SELECT round(ST_Y(geometry) * 1e5)::INT AS la, round(ST_X(geometry) * 1e5)::INT AS lo,
    CASE WHEN regexp_matches(lower(names.primary), '${SEVEN}') THEN '7'
         WHEN coalesce(taxonomy.primary, '') = 'convenience_store' OR regexp_matches(lower(names.primary), '${CONV}') THEN 'c'
         ELSE 's' END AS k
  FROM read_parquet('s3://overturemaps-us-west-2/release/${rel}/theme=places/type=place/*', hive_partitioning=1)
  WHERE bbox.xmin BETWEEN ${BBOX.w} AND ${BBOX.e} AND bbox.ymin BETWEEN ${BBOX.s} AND ${BBOX.n}
    AND names.primary IS NOT NULL AND coalesce(operating_status, 'open') <> 'permanently_closed'
    AND (regexp_matches(lower(names.primary), '${SEVEN}|${CONV}') OR coalesce(taxonomy.primary, '') = 'convenience_store'
         OR regexp_matches(coalesce(taxonomy.primary, '') || ',' || coalesce(basic_category, ''), '${SHOP_CAT}'))
  ORDER BY la, lo`);
const rows = r.getRowObjectsJson();
const la = [], lo = [], k = [];
for (const x of rows) { la.push(+x.la); lo.push(+x.lo); k.push(x.k); }
const out = path.join(ROOT, 'data', 'shops.json');
fs.writeFileSync(out, JSON.stringify({ source: 'Overture Maps Foundation — Places (CDLA-Permissive-2.0)', release: rel, fetchedAt: new Date().toISOString(), count: rows.length, scale: 1e5, lat: la, lng: lo, k: k.join('') }));
const cnt = k.reduce((m, c) => (m[c] = (m[c] || 0) + 1, m), {});
console.log(`saved ${rows.length} shops in ${((Date.now() - t0) / 1000).toFixed(0)}s → ${out} (${(fs.statSync(out).size / 1e6).toFixed(1)} MB)`, { seven: cnt['7'], convenience: cnt.c, other: cnt.s });
