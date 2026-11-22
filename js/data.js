// =============================================================
//  ชั้นข้อมูล (Data layer) — อยู่ไหนดี
//  * ตำแหน่งเขต/สถานีรถไฟฟ้า = พิกัดโดยประมาณ
//  * ประกาศที่พัก/ราคา = ข้อมูลจำลอง (seeded) + ตัวจำลองราคาเรียลไทม์
//    ต่อ API จริงได้ที่ DataProvider.fetchListings()
// =============================================================

export const REGIONS = [
  { id: 'bkk', name: 'กรุงเทพฯ และปริมณฑล', active: true, center: [100.56, 13.76], zoom: 10.6 },
  { id: 'cnx', name: 'เชียงใหม่', active: false, center: [98.99, 18.79] },
  { id: 'hkt', name: 'ภูเก็ต', active: false, center: [98.39, 7.88] },
  { id: 'kkc', name: 'ขอนแก่น', active: false, center: [102.83, 16.44] },
  { id: 'cbi', name: 'ชลบุรี / พัทยา', active: false, center: [100.88, 12.93] },
  { id: 'hdy', name: 'หาดใหญ่', active: false, center: [100.47, 7.01] },
];

export const CBD = { lat: 13.7456, lng: 100.5341 }; // สยาม

// name, en, province, lat, lng, ความหนาแน่น(คน/ตร.กม.), ระดับพื้นดิน(ม.รทก. โดยประมาณ), drainage 0-1
export const DISTRICTS = [
  ['พระนคร','Phra Nakhon','กทม.',13.756,100.499,8000,1.5,.8],
  ['ดุสิต','Dusit','กทม.',13.777,100.520,9000,1.5,.8],
  ['หนองจอก','Nong Chok','กทม.',13.855,100.862,700,0.6,.35],
  ['บางรัก','Bang Rak','กทม.',13.730,100.524,8500,1.2,.75],
  ['บางเขน','Bang Khen','กทม.',13.873,100.596,4500,1.4,.55],
  ['บางกะปิ','Bang Kapi','กทม.',13.765,100.647,5500,0.8,.5],
  ['ปทุมวัน','Pathum Wan','กทม.',13.744,100.522,5800,1.3,.8],
  ['ป้อมปราบฯ','Pom Prap','กทม.',13.758,100.513,20000,1.4,.75],
  ['พระโขนง','Phra Khanong','กทม.',13.702,100.601,6500,0.8,.55],
  ['มีนบุรี','Min Buri','กทม.',13.814,100.748,2300,0.6,.4],
  ['ลาดกระบัง','Lat Krabang','กทม.',13.722,100.759,1400,0.4,.4],
  ['ยานนาวา','Yan Nawa','กทม.',13.696,100.543,5800,0.9,.6],
  ['สัมพันธวงศ์','Samphanthawong','กทม.',13.731,100.514,13000,1.2,.7],
  ['พญาไท','Phaya Thai','กทม.',13.780,100.543,7000,1.4,.75],
  ['ธนบุรี','Thon Buri','กทม.',13.725,100.486,13000,1.0,.6],
  ['บางกอกใหญ่','Bangkok Yai','กทม.',13.723,100.476,11000,0.9,.6],
  ['ห้วยขวาง','Huai Khwang','กทม.',13.777,100.579,5500,1.1,.65],
  ['คลองสาน','Khlong San','กทม.',13.731,100.509,13000,1.0,.65],
  ['ตลิ่งชัน','Taling Chan','กทม.',13.777,100.457,3300,0.9,.45],
  ['บางกอกน้อย','Bangkok Noi','กทม.',13.771,100.468,9000,1.0,.55],
  ['บางขุนเทียน','Bang Khun Thian','กทม.',13.660,100.436,1600,0.3,.3],
  ['ภาษีเจริญ','Phasi Charoen','กทม.',13.715,100.437,7000,0.8,.5],
  ['หนองแขม','Nong Khaem','กทม.',13.705,100.349,4500,0.7,.4],
  ['ราษฎร์บูรณะ','Rat Burana','กทม.',13.682,100.506,5800,0.7,.5],
  ['บางพลัด','Bang Phlat','กทม.',13.794,100.505,8000,1.1,.55],
  ['ดินแดง','Din Daeng','กทม.',13.770,100.553,15000,1.2,.7],
  ['บึงกุ่ม','Bueng Kum','กทม.',13.785,100.669,5800,0.8,.5],
  ['สาทร','Sathon','กทม.',13.708,100.526,9000,1.0,.7],
  ['บางซื่อ','Bang Sue','กทม.',13.809,100.537,10000,1.4,.65],
  ['จตุจักร','Chatuchak','กทม.',13.828,100.560,5000,1.5,.65],
  ['บางคอแหลม','Bang Kho Laem','กทม.',13.693,100.503,8000,0.8,.55],
  ['ประเวศ','Prawet','กทม.',13.717,100.694,3600,0.5,.4],
  ['คลองเตย','Khlong Toei','กทม.',13.708,100.584,8000,0.9,.6],
  ['สวนหลวง','Suan Luang','กทม.',13.730,100.651,5000,0.6,.45],
  ['จอมทอง','Chom Thong','กทม.',13.677,100.484,6000,0.6,.45],
  ['ดอนเมือง','Don Mueang','กทม.',13.910,100.594,4400,2.0,.6],
  ['ราชเทวี','Ratchathewi','กทม.',13.759,100.534,10000,1.3,.75],
  ['ลาดพร้าว','Lat Phrao','กทม.',13.803,100.607,5800,1.0,.5],
  ['วัฒนา','Watthana','กทม.',13.742,100.585,6700,1.0,.65],
  ['บางแค','Bang Khae','กทม.',13.696,100.409,4700,0.7,.45],
  ['หลักสี่','Lak Si','กทม.',13.887,100.579,5600,1.8,.6],
  ['สายไหม','Sai Mai','กทม.',13.919,100.646,4500,1.6,.45],
  ['คันนายาว','Khan Na Yao','กทม.',13.827,100.678,3600,0.8,.45],
  ['สะพานสูง','Saphan Sung','กทม.',13.769,100.684,3500,0.7,.4],
  ['วังทองหลาง','Wang Thonglang','กทม.',13.780,100.606,7500,0.9,.5],
  ['คลองสามวา','Khlong Sam Wa','กทม.',13.860,100.704,1800,0.9,.35],
  ['บางนา','Bang Na','กทม.',13.680,100.592,5000,0.6,.5],
  ['ทวีวัฒนา','Thawi Watthana','กทม.',13.773,100.354,1600,0.8,.35],
  ['ทุ่งครุ','Thung Khru','กทม.',13.611,100.494,3600,0.4,.35],
  ['บางบอน','Bang Bon','กทม.',13.663,100.369,3500,0.4,.35],
  ['เมืองนนทบุรี','Mueang Nonthaburi','นนทบุรี',13.861,100.514,4500,1.6,.55],
  ['ปากเกร็ด','Pak Kret','นนทบุรี',13.912,100.498,3700,1.8,.5],
  ['บางใหญ่','Bang Yai','นนทบุรี',13.870,100.405,1500,1.1,.35],
  ['บางบัวทอง','Bang Bua Thong','นนทบุรี',13.909,100.425,1800,1.2,.35],
  ['เมืองสมุทรปราการ','Mueang Samut Prakan','สมุทรปราการ',13.599,100.597,2800,0.3,.4],
  ['บางพลี','Bang Phli','สมุทรปราการ',13.606,100.707,1100,0.4,.35],
  ['พระประแดง','Phra Pradaeng','สมุทรปราการ',13.659,100.533,2600,0.5,.4],
  ['ธัญบุรี (รังสิต)','Thanyaburi','ปทุมธานี',13.990,100.680,2000,1.7,.45],
  ['คลองหลวง','Khlong Luang','ปทุมธานี',14.065,100.646,700,2.0,.4],
  ['ลำลูกกา','Lam Luk Ka','ปทุมธานี',13.931,100.749,1000,1.2,.35],
  ['เมืองปทุมธานี','Mueang Pathum Thani','ปทุมธานี',14.020,100.525,800,2.1,.45],
  ['พุทธมณฑล (ศาลายา)','Phutthamonthon','นครปฐม',13.796,100.326,1100,1.0,.4],
  ['เมืองสมุทรสาคร','Mueang Samut Sakhon','สมุทรสาคร',13.547,100.274,1200,0.3,.35],
  ['กระทุ่มแบน','Krathum Baen','สมุทรสาคร',13.651,100.259,1000,0.5,.35],
].map(([name, en, prov, lat, lng, density, elev, drain], i) => ({ id: i, name, en, prov, lat, lng, density, elev, drain }));

const UNI_DISTRICTS = new Set(['Pathum Wan','Chatuchak','Bang Kapi','Lat Krabang','Phutthamonthon','Thanyaburi','Khlong Luang','Thung Khru','Phaya Thai','Lak Si','Bang Sue']);

// ---------- รถไฟฟ้า (พิกัดโดยประมาณ) ----------
const L = (name, color, elevated, pts) => ({ name, color, elevated, stations: pts.map(([n, lat, lng]) => ({ name: n, lat, lng })) });
export const TRANSIT = [
  L('BTS สุขุมวิท', '#7cb342', true, [
    ['คูคต',13.933,100.644],['สะพานใหม่',13.898,100.608],['วัดพระศรีฯ',13.877,100.597],['บางบัว',13.849,100.587],['ม.เกษตรศาสตร์',13.842,100.577],
    ['รัชโยธิน',13.830,100.570],['ห้าแยกลาดพร้าว',13.817,100.562],['หมอชิต',13.803,100.554],['สะพานควาย',13.794,100.550],['อารีย์',13.780,100.545],
    ['สนามเป้า',13.773,100.542],['อนุสาวรีย์ชัยฯ',13.763,100.537],['พญาไท',13.757,100.534],['ราชเทวี',13.752,100.532],['สยาม',13.746,100.534],
    ['ชิดลม',13.744,100.543],['เพลินจิต',13.743,100.549],['นานา',13.741,100.555],['อโศก',13.737,100.560],['พร้อมพงษ์',13.731,100.570],
    ['ทองหล่อ',13.724,100.578],['เอกมัย',13.719,100.585],['พระโขนง',13.715,100.592],['อ่อนนุช',13.706,100.601],['บางจาก',13.697,100.605],
    ['ปุณณวิถี',13.689,100.609],['อุดมสุข',13.680,100.609],['บางนา',13.668,100.605],['แบริ่ง',13.661,100.602],['สำโรง',13.646,100.596],
    ['ช้างเอราวัณ',13.622,100.589],['ปากน้ำ',13.601,100.605],['เคหะฯ',13.585,100.611]]),
  L('BTS สีลม', '#00796b', true, [
    ['สนามกีฬาฯ',13.747,100.529],['สยาม',13.746,100.534],['ราชดำริ',13.740,100.539],['ศาลาแดง',13.729,100.535],['ช่องนนทรี',13.724,100.529],
    ['สุรศักดิ์',13.719,100.522],['สะพานตากสิน',13.719,100.514],['กรุงธนบุรี',13.721,100.503],['วงเวียนใหญ่',13.721,100.495],['โพธิ์นิมิตร',13.719,100.485],
    ['ตลาดพลู',13.714,100.476],['วุฒากาศ',13.713,100.469],['บางหว้า',13.721,100.458]]),
  L('MRT สีน้ำเงิน', '#1e5aa8', false, [
    ['หลักสอง',13.711,100.409],['บางแค',13.712,100.428],['เพชรเกษม 48',13.713,100.438],['ภาษีเจริญ',13.714,100.447],['บางหว้า',13.721,100.458],
    ['ท่าพระ',13.730,100.474],['จรัญฯ 13',13.739,100.471],['ไฟฉาย',13.755,100.471],['บางขุนนนท์',13.766,100.472],['บางยี่ขัน',13.777,100.488],
    ['สิรินธร',13.783,100.493],['บางพลัด',13.793,100.505],['บางโพ',13.806,100.521],['เตาปูน',13.806,100.531],['บางซื่อ',13.803,100.539],
    ['กำแพงเพชร',13.798,100.549],['สวนจตุจักร',13.803,100.553],['พหลโยธิน',13.813,100.561],['ลาดพร้าว',13.806,100.573],['รัชดาภิเษก',13.799,100.574],
    ['สุทธิสาร',13.789,100.574],['ห้วยขวาง',13.778,100.574],['ศูนย์วัฒนธรรมฯ',13.766,100.570],['พระราม 9',13.758,100.565],['เพชรบุรี',13.749,100.563],
    ['สุขุมวิท',13.738,100.561],['ศูนย์ฯสิริกิติ์',13.723,100.560],['คลองเตย',13.722,100.554],['ลุมพินี',13.726,100.545],['สีลม',13.729,100.537],
    ['สามย่าน',13.732,100.530],['หัวลำโพง',13.738,100.517],['วัดมังกร',13.743,100.510],['สามยอด',13.747,100.502],['สนามไชย',13.744,100.494],['อิสรภาพ',13.738,100.485]]),
  L('MRT สีม่วง', '#7b1fa2', true, [
    ['คลองบางไผ่',13.893,100.409],['ตลาดบางใหญ่',13.876,100.411],['สามแยกบางใหญ่',13.871,100.427],['บางพลู',13.864,100.441],['บางรักใหญ่',13.871,100.454],
    ['ท่าอิฐ',13.871,100.468],['ไทรม้า',13.872,100.488],['สะพานพระนั่งเกล้า',13.855,100.499],['แยกนนทบุรี 1',13.855,100.509],['บางกระสอ',13.857,100.519],
    ['ศูนย์ราชการนนท์',13.858,100.524],['กระทรวงสาธารณสุข',13.847,100.526],['แยกติวานนท์',13.832,100.531],['วงศ์สว่าง',13.825,100.530],['บางซ่อน',13.819,100.530],['เตาปูน',13.806,100.531]]),
  L('Airport Rail Link', '#c62828', true, [
    ['พญาไท',13.757,100.535],['ราชปรารภ',13.755,100.542],['มักกะสัน',13.751,100.561],['รามคำแหง',13.743,100.600],['หัวหมาก',13.738,100.645],
    ['บ้านทับช้าง',13.733,100.692],['ลาดกระบัง',13.727,100.748],['สุวรรณภูมิ',13.698,100.752]]),
  L('MRT สีเหลือง', '#f9a825', true, [
    ['ลาดพร้าว',13.806,100.574],['ภาวนา',13.799,100.590],['โชคชัย 4',13.794,100.597],['ลาดพร้าว 71',13.789,100.607],['มหาดไทย',13.780,100.624],
    ['บางกะปิ',13.766,100.643],['ลำสาลี',13.758,100.646],['หัวหมาก',13.738,100.646],['กลันตัน',13.723,100.652],['ศรีนุช',13.706,100.651],
    ['ศรีอุดม',13.686,100.650],['ศรีเอี่ยม',13.674,100.649],['ทิพวัล',13.658,100.632],['สำโรง',13.646,100.596]]),
  L('MRT สีชมพู', '#ec407a', true, [
    ['ศูนย์ราชการนนท์',13.858,100.524],['แคราย',13.860,100.536],['แจ้งวัฒนะ',13.886,100.552],['หลักสี่',13.887,100.578],['วัดพระศรีฯ',13.877,100.597],
    ['รามอินทรา 3',13.868,100.612],['ลาดปลาเค้า',13.862,100.624],['วัชรพล',13.851,100.650],['คู้บอน',13.842,100.664],['นพรัตน์',13.825,100.700],['มีนบุรี',13.812,100.730]]),
];
export const STATIONS = TRANSIT.flatMap(l => l.stations.map(s => ({ ...s, line: l.name, color: l.color, elevated: l.elevated })));

// แม่น้ำเจ้าพระยา (โดยประมาณ) [lat,lng]
export const RIVER = [[14.06,100.53],[13.95,100.50],[13.91,100.50],[13.86,100.50],[13.82,100.51],[13.80,100.515],[13.77,100.50],[13.755,100.492],
  [13.735,100.505],[13.72,100.513],[13.705,100.512],[13.69,100.52],[13.70,100.545],[13.68,100.555],[13.66,100.545],[13.635,100.56],[13.60,100.58],[13.55,100.59],[13.50,100.60]];

export const WORK_PRESETS = [
  { name: 'สยาม', lat: 13.7456, lng: 100.5341 }, { name: 'อโศก', lat: 13.7370, lng: 100.5603 },
  { name: 'สีลม/สาทร', lat: 13.7259, lng: 100.5300 }, { name: 'พระราม 9', lat: 13.7580, lng: 100.5650 },
  { name: 'บางซื่อ', lat: 13.8030, lng: 100.5390 }, { name: 'สุวรรณภูมิ', lat: 13.6900, lng: 100.7501 },
];

export const BBOX = { minLat: 13.50, maxLat: 14.10, minLng: 100.24, maxLng: 100.90 };

// ---------- utils ----------
export function mulberry32(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export function haversine(a, b) {
  const R = 6371, toR = Math.PI / 180;
  const dLat = (b.lat - a.lat) * toR, dLng = (b.lng - a.lng) * toR;
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * toR) * Math.cos(b.lat * toR) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}
function hash2(x, y) { const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return s - Math.floor(s); }
function vnoise(x, y) {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const a = hash2(xi, yi), b = hash2(xi + 1, yi), c = hash2(xi, yi + 1), d = hash2(xi + 1, yi + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
function distToPolylineKm(p, line) {
  let best = 1e9;
  for (let i = 0; i < line.length - 1; i++) {
    const a = { lat: line[i][0], lng: line[i][1] }, b = { lat: line[i + 1][0], lng: line[i + 1][1] };
    // ประมาณในระนาบ (ระยะสั้นพอ)
    const kx = 108.0, ky = 111.0;
    const ax = a.lng * kx, ay = a.lat * ky, bx = b.lng * kx, by = b.lat * ky, px = p.lng * kx, py = p.lat * ky;
    const dx = bx - ax, dy = by - ay; const t = clamp(((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy), 0, 1);
    best = Math.min(best, Math.hypot(px - (ax + t * dx), py - (ay + t * dy)));
  }
  return best;
}

// ---------- แบบจำลองเชิงพื้นที่ ----------
function idw(lat, lng, key, power = 2) {
  let num = 0, den = 0;
  for (const d of DISTRICTS) {
    const dist = Math.hypot((d.lat - lat) * 111, (d.lng - lng) * 108) + 0.4;
    const w = 1 / Math.pow(dist, power); num += w * d[key]; den += w;
  }
  return num / den;
}
const _elevCache = new Map();
/** ระดับพื้นดินโดยประมาณ (ม. รทก.) — แบบจำลอง ไม่ใช่ DEM จริง */
export function elevationAt(lat, lng) {
  const k = (lat * 2000 | 0) + ':' + (lng * 2000 | 0);
  if (_elevCache.has(k)) return _elevCache.get(k);
  let e = idw(lat, lng, 'elev', 2.2);
  e += (vnoise(lng * 60, lat * 60) - 0.5) * 0.55 + (vnoise(lng * 220, lat * 220) - 0.5) * 0.25;
  const r = distToPolylineKm({ lat, lng }, RIVER);
  if (r < 0.35) e = Math.min(e, -1.5 + r * 3); // ร่องน้ำ
  else if (r < 1.2) e += 0.25 * (1.2 - r);      // คันดินริมแม่น้ำ (ยกสูงเล็กน้อย)
  if (_elevCache.size > 200000) _elevCache.clear();
  _elevCache.set(k, e); return e;
}
export const drainageAt = (lat, lng) => idw(lat, lng, 'drain', 2);
export const densityAt = (lat, lng) => idw(lat, lng, 'density', 2.6);
export function isRiver(lat, lng) { return distToPolylineKm({ lat, lng }, RIVER) < 0.35; }

/** ความลึกน้ำที่จุดหนึ่งตามสถานการณ์ (เมตร) */
export function floodDepthAt(lat, lng, scen) {
  if (!scen || (!scen.level && !scen.rain)) return 0;
  const e = elevationAt(lat, lng);
  let depth = Math.max(0, (scen.level || 0) - e);
  if (scen.rain) {
    const local = elevationAt(lat + 0.004, lng) + elevationAt(lat - 0.004, lng) + elevationAt(lat, lng + 0.004) + elevationAt(lat, lng - 0.004);
    const hollow = Math.max(0, local / 4 - e); // แอ่ง
    const runoff = scen.rain / 1000 * 1.6;     // มม. -> ม. (รวมน้ำไหลบ่า)
    const pond = Math.max(0, runoff * (1 + hollow * 3) - drainageAt(lat, lng) * 0.12);
    depth = Math.max(depth, pond);
  }
  return depth;
}

export function nearestStation(p) {
  let best = null, bd = 1e9;
  for (const s of STATIONS) { const d = haversine(p, s); if (d < bd) { bd = d; best = s; } }
  return { ...best, distKm: bd };
}

export const DISTRICT_BY_ID = Object.fromEntries(DISTRICTS.map(d => [d.id, d]));
export function nearestDistrict(p) {
  let best = DISTRICTS[0], bd = 1e9;
  for (const d of DISTRICTS) { const dd = haversine(p, d); if (dd < bd) { bd = dd; best = d; } }
  return best;
}

// ---------- จราจร ----------
/** 0 (โล่ง) .. 1 (ติดหนัก) ตามชั่วโมง */
export function trafficTimeFactor(hour, weekend = false) {
  const h = ((hour % 24) + 24) % 24;
  const g = (c, w) => Math.exp(-((h - c) ** 2) / (2 * w * w));
  let f = 0.18 + 0.82 * g(8, 1.1) + 0.9 * g(17.8, 1.4) + 0.35 * g(12.5, 1.5);
  if (h < 5) f = 0.08;
  if (weekend) f *= 0.65;
  return clamp(f, 0.05, 1);
}
export function urbanness(p) { return clamp(1 - haversine(p, CBD) / 22, 0.15, 1); }

// ---------- เวลาเดินทาง ----------
/** ประมาณเวลาเดินทาง (นาที) รถยนต์ / ขนส่งสาธารณะ พร้อมผลกระทบน้ำท่วม */
export function estimateCommute(from, to, opts = {}) {
  const hour = opts.hour ?? 8, scen = opts.flood;
  const d = haversine(from, to), road = d * 1.32;
  const mid = { lat: (from.lat + to.lat) / 2, lng: (from.lng + to.lng) / 2 };
  const cong = trafficTimeFactor(hour) * (0.45 + 0.55 * urbanness(mid));
  let carSpeed = Math.max(11, 48 - 36 * cong);
  // น้ำท่วมตามแนวเส้นทาง
  let maxDepth = 0, wetShare = 0; const N = 14;
  for (let i = 0; i <= N; i++) {
    const t = i / N, lat = from.lat + (to.lat - from.lat) * t, lng = from.lng + (to.lng - from.lng) * t;
    const dep = floodDepthAt(lat, lng, scen); maxDepth = Math.max(maxDepth, dep); if (dep > 0.1) wetShare++;
  }
  wetShare /= (N + 1);
  const carBlocked = maxDepth > 0.5;
  if (maxDepth > 0.15) carSpeed *= (1 - 0.7 * wetShare);
  const carMin = road / carSpeed * 60 + 4;

  const s1 = nearestStation(from), s2 = nearestStation(to);
  const access = (km, dep) => (km <= 1.2 ? km / 4.5 * 60 : 5 + km / 14 * 60) * (dep > 0.3 ? 2.2 : dep > 0.1 ? 1.4 : 1);
  const depFrom = floodDepthAt(from.lat, from.lng, scen), depTo = floodDepthAt(to.lat, to.lng, scen);
  const railKm = haversine(s1, s2) * 1.2;
  let transitMin = access(s1.distKm, depFrom) + railKm / 33 * 60 + (s1.line !== s2.line ? 7 : 4) + access(s2.distKm, depTo);
  const railUseful = railKm > Math.max(1.5, d * 0.4) && s1.distKm < 3 && s2.distKm < 3;
  if (!railUseful) transitMin = d < 1.5 ? d / 4.5 * 60 : road / Math.max(9, carSpeed * 0.8) * 60 + 10; // รถเมล์/เดิน
  const walkOnly = d < 1.2;
  const best = Math.min(carBlocked ? 1e9 : carMin, transitMin);
  return {
    km: d, roadKm: road, carMin: Math.round(carMin), transitMin: Math.round(transitMin), best: Math.round(best),
    mode: walkOnly ? 'เดิน' : (carBlocked || transitMin < carMin) ? (railUseful ? 'รถไฟฟ้า' : 'รถเมล์/เดิน') : 'รถยนต์',
    fromStation: s1, toStation: s2, railUseful, maxDepth, carBlocked, congestion: cong,
  };
}

// ---------- สร้างประกาศที่พัก (จำลอง) ----------
const N1 = ['Aster','Bloom','Cielo','Dusk','Ember','Fern','Grove','Haven','Iris','Juno','Kite','Luma','Mira','Nova','Opal','Pine','Quill','Riva','Sora','Tara','Urbana','Vela','Willow','Zen','Atria','Brisa','Coral','Lumen','Maple','Sienna'];
const N2 = { condo: ['Residence','Condo','Place','Suites','Ville','Park','Loft','Heights','Tower'], apartment: ['Apartment','Mansion','Court','House'], dorm: [''], house: ['Home','Village','Townhome'] };
const DORM = ['หอพักบ้านสุข','หอพักใบเตย','หอพักร่มไม้','หอพักฟ้าใส','หอพักสุขใจ','หอพักชบา','หอพักนิลุบล','หอพักพิมพ์ใจ','หอพักลีลาวดี','หอพักกุหลาบ','หอพักรวงข้าว','หอพักบัวขาว'];
export const TYPE_LABEL = { condo: 'คอนโด', apartment: 'อพาร์ตเมนต์/แมนชั่น', dorm: 'หอพัก', house: 'บ้าน/หมู่บ้าน', hotel: 'โรงแรม/เกสต์เฮาส์' };
export const TYPE_COLOR = { condo: '#2f6bff', apartment: '#12a594', dorm: '#f59e0b', house: '#e5484d', hotel: '#8e4ec6' };

function buildListings() {
  const rnd = mulberry32(20261122);
  const out = []; let id = 1;
  for (const d of DISTRICTS) {
    const cent = urbanness(d);
    const n = Math.round(4 + cent * 14 + Math.sqrt(d.density) / 18);
    for (let i = 0; i < n; i++) {
      const ang = rnd() * Math.PI * 2, rad = Math.sqrt(rnd()) * (0.012 + (1 - cent) * 0.03);
      let lat = d.lat + Math.sin(ang) * rad, lng = d.lng + Math.cos(ang) * rad * 1.03;
      if (isRiver(lat, lng)) lng += 0.008;
      const p = { lat, lng };
      const st = nearestStation(p);
      const r = rnd(), uni = UNI_DISTRICTS.has(d.en);
      const type = r < (uni ? 0.38 : 0.5) * (0.4 + cent) ? 'condo' : r < 0.62 ? 'apartment' : r < (uni ? 0.88 : 0.78) ? 'dorm' : 'house';
      const dCbd = haversine(p, CBD);
      const transitBoost = st.distKm < 0.5 ? 1.32 : st.distKm < 1 ? 1.15 : st.distKm < 2 ? 1.0 : 0.88;
      const base = (130 + 720 * Math.exp(-dCbd / 8)) * transitBoost * (0.85 + rnd() * 0.3); // บาท/ตร.ม./เดือน (คอนโด)
      const size = type === 'condo' ? Math.round(24 + rnd() * rnd() * 70) : type === 'apartment' ? Math.round(22 + rnd() * 18)
        : type === 'dorm' ? Math.round(16 + rnd() * 12) : Math.round(70 + rnd() * 130);
      const mult = { condo: 1, apartment: 0.62, dorm: 0.45, house: 0.48 }[type];
      const rentMarket = Math.max(1800, Math.round(base * mult * size / 100) * 100);
      const rentAsk = Math.round(rentMarket * (1.03 + rnd() * 0.14) / 100) * 100;
      const ppsm = type === 'condo' ? Math.round((base * 190 + 25000) / 1000) * 1000 : type === 'house' ? Math.round((base * 75 + 18000) / 1000) * 1000 : null;
      const salePrice = ppsm ? Math.round(ppsm * size / 10000) * 10000 : null;
      const year = 1995 + Math.floor(rnd() * 31);
      let name;
      if (type === 'dorm') name = DORM[Math.floor(rnd() * DORM.length)] + ' ' + d.name.split(' ')[0];
      else { const a = N1[Math.floor(rnd() * N1.length)], b = N2[type][Math.floor(rnd() * N2[type].length)]; name = `${a} ${b} ${d.en.split(' ')[0]}`; }
      out.push({
        id: 'L' + (id++), name, type, district: d.name, districtEn: d.en, prov: d.prov, lat, lng, size,
        floors: type === 'condo' ? 8 + Math.floor(rnd() * 38) : type === 'house' ? 2 + Math.floor(rnd() * 2) : 4 + Math.floor(rnd() * 5),
        year, rentMarket, rentAsk, salePrice, ppsm,
        station: { name: st.name, line: st.line, color: st.color, distKm: st.distKm },
        density: Math.round(densityAt(lat, lng)), elev: +elevationAt(lat, lng).toFixed(2),
        occupancy: Math.round(70 + rnd() * 28), petFriendly: rnd() < 0.3,
        history: [],
      });
    }
  }
  return out;
}
// ---------- ที่พักจริงจาก OpenStreetMap (data/places.json สร้างด้วย tools/fetch-places.js) ----------
// ราคาของที่พักจริงยังเป็น "ประมาณการ" จากทำเล/ระยะรถไฟฟ้า/ประเภท เพราะไม่มีแหล่งราคาสาธารณะฟรี
function strHash(str) { let h = 2166136261; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
const clean = s => String(s).replace(/[<>&"`]/g, '').trim();
function buildFromPlaces(places) {
  const out = [];
  for (const pl of places) {
    const rnd = mulberry32(strHash(pl.id));
    const p = { lat: pl.lat, lng: pl.lng }, type = pl.type;
    const st = nearestStation(p), d = nearestDistrict(p), dCbd = haversine(p, CBD);
    const transitBoost = st.distKm < 0.5 ? 1.32 : st.distKm < 1 ? 1.15 : st.distKm < 2 ? 1.0 : 0.88;
    const base = (130 + 720 * Math.exp(-dCbd / 8)) * transitBoost * (0.9 + rnd() * 0.2);
    const size = type === 'condo' ? Math.round(28 + rnd() * 20) : type === 'apartment' ? Math.round(24 + rnd() * 10) : type === 'dorm' ? Math.round(18 + rnd() * 8)
      : type === 'hotel' ? Math.round(22 + rnd() * 10) : Math.round(100 + rnd() * 80);
    const mult = { condo: 1, apartment: 0.62, dorm: 0.45, house: 0.48, hotel: 1.6 }[type];
    const known = pl.rent > 0; // มีราคาจริง (จากผู้ใช้/เจ้าของ)
    const rentMarket = known ? pl.rent : Math.max(1800, Math.round(base * mult * size / 100) * 100);
    const rentAsk = known ? pl.rent : Math.round(rentMarket * (1.05 + rnd() * 0.08) / 100) * 100;
    const ppsm = type === 'condo' ? Math.round((base * 190 + 25000) / 1000) * 1000 : type === 'house' ? Math.round((base * 75 + 18000) / 1000) * 1000 : null;
    out.push({
      id: pl.id, osm: pl.osm, source: pl.source || 'osm', gmaps: pl.gmaps || null, real: true, priceEstimated: !known, salePriceEstimated: true,
      deposit: pl.deposit || null, amenities: pl.amenities || null, highlights: pl.highlights || null, priceNote: pl.priceNote || null, locationApprox: !!pl.locationApprox,
      name: clean(pl.name), nameEn: pl.nameEn && clean(pl.nameEn), type,
      district: pl.district || d.name, districtEn: d.en, prov: pl.province || d.prov, lat: pl.lat, lng: pl.lng, size,
      floors: pl.levels || (type === 'condo' ? 8 : type === 'house' ? 2 : 5), floorsKnown: !!pl.levels,
      year: null, rentMarket, rentAsk, salePrice: ppsm ? Math.round(ppsm * size / 10000) * 10000 : null, ppsm,
      station: { name: st.name, line: st.line, color: st.color, distKm: st.distKm },
      density: Math.round(densityAt(pl.lat, pl.lng)), elev: +elevationAt(pl.lat, pl.lng).toFixed(2),
      occupancy: null, petFriendly: null, street: pl.street, phone: pl.phone, website: pl.website, rooms: pl.rooms,
      history: [],
    });
  }
  return out;
}
export let DATA_SOURCE = 'simulated', DATA_INFO = null;
const normName = s => String(s || '').toLowerCase().replace(/[^a-z0-9฀-๿]/g, '').replace(/(หอพัก|อพาร์ทเม้นท์|อพาร์ตเมนต์|แมนชั่น|คอนโด|apartment|mansion|condo|residence|dormitory)/g, '');
/** รวมหลายแหล่ง: แหล่งที่มาก่อนในลิสต์ = สำคัญกว่า; ตัดซ้ำถ้าชื่อคล้ายกันและอยู่ห่างกัน < 150 ม. */
function mergeSources(lists) {
  const out = [], grid = new Map(), key = (a, b) => a + ',' + b;
  for (const list of lists) for (const pl of list) {
    const gx = Math.floor(pl.lat / 0.002), gy = Math.floor(pl.lng / 0.002), n = normName(pl.name) || normName(pl.nameEn);
    let dup = false;
    for (let i = -1; i <= 1 && !dup; i++) for (let j = -1; j <= 1 && !dup; j++) for (const o of grid.get(key(gx + i, gy + j)) || []) {
      if (!n || !o.n) continue;
      if ((o.n === n || (n.length > 3 && o.n.includes(n)) || (o.n.length > 3 && n.includes(o.n))) && haversine(pl, o.pl) < 0.15) { dup = true; break; }
    }
    if (dup) continue;
    out.push(pl); const k = key(gx, gy); if (!grid.has(k)) grid.set(k, []); grid.get(k).push({ n, pl });
  }
  return out;
}
const getJSON = async f => { try { const r = await fetch(new URL(f, import.meta.url)); return r.ok ? await r.json() : null; } catch { return null; } };
export function myPlaces() { try { return JSON.parse(localStorage.getItem('ynd-myplaces') || '[]'); } catch { return []; } }
async function loadListings() {
  const [osm, manualPub, manualLocal, google, overture] = await Promise.all([getJSON('../data/places.json'), getJSON('../data/places-manual.json'), getJSON('../data/places-manual.local.json'), getJSON('../data/places-google.json'), getJSON('../data/places-overture.json')]);
  // places-manual.local.json = ข้อมูลส่วนตัว อยู่เฉพาะในเครื่อง (ไม่อัปขึ้น GitHub)
  const manual = { places: [...(manualLocal?.places || []), ...(manualPub?.places || [])] };
  if (!osm && !manual && !google && !overture) { console.warn('no place data, using simulated listings'); return buildListings(); }
  const tag = (arr, source) => (arr || []).map(p => ({ ...p, source }));
  let g = google?.places || [];
  const googleAgeDays = google ? (Date.now() - Date.parse(google.fetchedAt)) / 864e5 : null;
  // เงื่อนไข Google: เก็บพิกัดได้ไม่เกิน 30 วัน → เกินแล้วไม่ใช้ ต้องดึงใหม่
  if (googleAgeDays > 30) { console.warn('places-google.json อายุเกิน 30 วัน — รัน tools/fetch-google-places.js ใหม่'); g = []; }
  const merged = mergeSources([tag(myPlaces(), 'mine'), tag(manual?.places, 'manual'), tag(g, 'google'), tag(overture?.places, 'overture'), tag(osm?.places, 'osm')]);
  DATA_SOURCE = 'osm';
  DATA_INFO = { count: merged.length, osm: osm?.count || 0, google: g.length, overture: overture?.count || 0, googleExpired: googleAgeDays > 30, manual: (manual?.places || []).length, mine: myPlaces().length, fetchedAt: osm?.fetchedAt };
  return buildFromPlaces(merged);
}
export const LISTINGS = await loadListings();
export const LISTING_BY_ID = Object.fromEntries(LISTINGS.map(l => [l.id, l]));

/** ประมาณจำนวนร้านค้า/7-11 ในรัศมี 800 ม. เมื่อยังไม่ได้ดึงข้อมูล OSM จริง */
export function estimateShops(p) {
  const den = densityAt(p.lat, p.lng), u = urbanness(p);
  const seed = Math.floor(hash2(p.lat * 999, p.lng * 999) * 1000);
  const shops = Math.round(den / 55 * (0.6 + u) + (seed % 25));
  return { shops, convenience: Math.max(1, Math.round(shops / 14)), seven: Math.max(1, Math.round(shops / 22)), source: 'estimate' };
}

// ---------- Data provider + ราคาเรียลไทม์ (จำลอง) ----------
export const DataProvider = {
  source: 'simulated',
  listeners: new Set(),
  lastUpdate: Date.now(),
  /** แทนที่ฟังก์ชันนี้เพื่อดึงจาก API จริง: ต้องคืน array รูปแบบเดียวกับ LISTINGS */
  async fetchListings() { return LISTINGS; },
  onTick(fn) { this.listeners.add(fn); return () => this.listeners.delete(fn); },
  start(intervalMs = 4000) {
    if (this._t) return;
    const rnd = mulberry32(Date.now() & 0xffff);
    for (const l of LISTINGS) if (!l.history.length) {
      // ย้อนหลัง 30 จุด
      let v = l.rentMarket; const h = [];
      for (let i = 0; i < 30; i++) { v *= 1 + (rnd() - 0.5) * 0.012; h.unshift(Math.round(v)); }
      h[h.length - 1] = l.rentMarket; l.history = h;
    }
    this._t = setInterval(() => {
      const changed = [];
      const n = 8 + Math.floor(rnd() * 14);
      for (let i = 0; i < n; i++) {
        const l = LISTINGS[Math.floor(rnd() * LISTINGS.length)];
        const pct = (rnd() - 0.48) * 0.018;
        l.rentMarket = Math.max(1500, Math.round(l.rentMarket * (1 + pct) / 50) * 50);
        l.rentAsk = Math.max(l.rentMarket, Math.round(l.rentAsk * (1 + pct + (rnd() - 0.5) * 0.004) / 50) * 50);
        if (l.salePrice) { l.salePrice = Math.round(l.salePrice * (1 + pct * 0.35) / 10000) * 10000; l.ppsm = Math.round(l.salePrice / l.size); }
        l.history.push(l.rentMarket); if (l.history.length > 40) l.history.shift();
        l.lastChange = pct; l.changedAt = Date.now();
        changed.push(l);
      }
      this.lastUpdate = Date.now();
      this.listeners.forEach(fn => fn(changed));
    }, intervalMs);
  },
};

// ---------- ร้านค้าจริงจาก OpenStreetMap (Overpass) ----------
const _shopCache = new Map();
export async function fetchShopsOSM(p, radius = 800) {
  const key = p.lat.toFixed(4) + ',' + p.lng.toFixed(4);
  if (_shopCache.has(key)) return _shopCache.get(key);
  const q = `[out:json][timeout:20];(node["shop"](around:${radius},${p.lat},${p.lng});way["shop"](around:${radius},${p.lat},${p.lng}););out center tags;`;
  const ctrl = new AbortController(); const to = setTimeout(() => ctrl.abort(), 15000);
  try {
    const r = await fetch('https://overpass-api.de/api/interpreter', { method: 'POST', body: 'data=' + encodeURIComponent(q), signal: ctrl.signal });
    if (!r.ok) throw new Error('overpass ' + r.status);
    const j = await r.json();
    const pts = j.elements.map(e => {
      const t = e.tags || {}; const lat = e.lat ?? e.center?.lat, lng = e.lon ?? e.center?.lon;
      const isSeven = /7-?eleven|เซเว่น/i.test((t.brand || '') + ' ' + (t.name || '') + ' ' + (t['name:en'] || ''));
      return { lat, lng, name: t.name || t.brand || t.shop, kind: isSeven ? 'seven' : t.shop === 'convenience' ? 'convenience' : 'shop' };
    }).filter(x => x.lat);
    const res = { shops: pts.length, convenience: pts.filter(x => x.kind !== 'shop').length, seven: pts.filter(x => x.kind === 'seven').length, points: pts, source: 'osm' };
    _shopCache.set(key, res); return res;
  } finally { clearTimeout(to); }
}

// ---------- ร้านค้าจริงทั้งเมือง (data/shops.json จาก Overture — ฟรี, โหลดครั้งเดียว ใช้ได้ทันทีทุกที่) ----------
let SHOP_IDX = null, _shopLoading = null;
const SHOP_CELL = 0.01; // ~1.1 กม.
const KIND = { '7': 'seven', c: 'convenience', s: 'shop' };
export function loadShopIndex() {
  if (!_shopLoading) _shopLoading = getJSON('../data/shops.json').then(j => {
    if (!j) return null;
    const G = new Map(), sc = j.scale;
    for (let i = 0; i < j.count; i++) {
      const k = Math.floor(j.lat[i] / sc / SHOP_CELL) + ',' + Math.floor(j.lng[i] / sc / SHOP_CELL);
      let a = G.get(k); if (!a) G.set(k, a = []); a.push(i);
    }
    SHOP_IDX = { j, G, sc }; _shopMemo.clear(); return SHOP_IDX;
  });
  return _shopLoading;
}
export const shopIndexReady = () => !!SHOP_IDX;
const _shopMemo = new Map();
/** นับร้านในรัศมี (ม.) จากข้อมูลจริง — คืน null ถ้ายังโหลดไม่เสร็จ */
export function shopsNear(p, radius = 800, withPoints = false) {
  if (!SHOP_IDX) return null;
  const mk = p.lat.toFixed(4) + ',' + p.lng.toFixed(4) + ',' + radius;
  if (!withPoints && _shopMemo.has(mk)) return _shopMemo.get(mk);
  const { j, G, sc } = SHOP_IDX, r = radius / 1000;
  const cy = Math.floor(p.lat / SHOP_CELL), cx = Math.floor(p.lng / SHOP_CELL), span = Math.ceil(r / 1.1) + 0;
  const kx = 111.32 * Math.cos(p.lat * Math.PI / 180), ky = 110.57;
  let shops = 0, conv = 0, seven = 0; const points = withPoints ? [] : null;
  for (let y = cy - span; y <= cy + span; y++) for (let x = cx - span; x <= cx + span; x++) {
    const a = G.get(y + ',' + x); if (!a) continue;
    for (const i of a) {
      const la = j.lat[i] / sc, lo = j.lng[i] / sc;
      if (Math.hypot((la - p.lat) * ky, (lo - p.lng) * kx) > r) continue;
      const k = j.k[i]; shops++; if (k !== 's') conv++; if (k === '7') seven++;
      if (points) points.push({ lat: la, lng: lo, kind: KIND[k] });
    }
  }
  const res = { shops, convenience: conv, seven, points, source: 'overture' };
  if (!withPoints) _shopMemo.set(mk, res);
  return res;
}

// ---------- คะแนน ----------
// arr ต้องเรียงจากน้อยไปมาก (binary search — เร็วพอสำหรับที่พักหลายหมื่นแห่ง)
export function percentileRank(arr, v) { let lo = 0, hi = arr.length; while (lo < hi) { const m = (lo + hi) >> 1; if (arr[m] < v) lo = m + 1; else hi = m; } return lo / Math.max(1, arr.length - 1); }
const _priceSets = {};
function priceSet(type, mode) {
  const k = type + mode;
  if (!_priceSets[k]) _priceSets[k] = LISTINGS.filter(l => l.type === type).map(l => mode === 'buy' ? (l.ppsm || 0) : l.rentMarket / l.size).filter(Boolean).sort((a, b) => a - b);
  return _priceSets[k];
}

export const SCORE_KEYS = [
  { key: 'price', label: 'ราคา (คุ้มค่า)' }, { key: 'commute', label: 'การเดินทาง' }, { key: 'transit', label: 'ใกล้รถไฟฟ้า' },
  { key: 'flood', label: 'ปลอดภัยน้ำท่วม' }, { key: 'amenity', label: 'ร้านค้า/สะดวกซื้อ' }, { key: 'quiet', label: 'ความสงบ (ไม่แออัด)' },
  { key: 'invest', label: 'ผลตอบแทนลงทุน' },
];

export function scoreListing(l, ctx = {}) {
  const mode = ctx.mode || 'rent';
  const pVal = mode === 'buy' && l.ppsm ? l.ppsm : l.rentMarket / l.size;
  const price = Math.round(100 * (1 - percentileRank(priceSet(l.type, mode === 'buy' && l.ppsm ? 'buy' : 'rent'), pVal)));
  const transit = Math.round(clamp(100 - (l.station.distKm - 0.15) * 62, 0, 100));
  let commute, commutes = [];
  const wps = ctx.workplaces || [];
  if (wps.length) {
    commutes = wps.map(w => ({ w, c: estimateCommute(l, w, { hour: ctx.hour ?? 8, flood: ctx.flood }) }));
    const avg = commutes.reduce((s, x) => s + Math.min(x.c.best, 150), 0) / commutes.length;
    commute = Math.round(clamp(100 - (avg - 12) * 1.25, 0, 100));
  } else commute = Math.round(clamp(100 - haversine(l, CBD) * 4.2, 0, 100));
  const depth = floodDepthAt(l.lat, l.lng, ctx.flood);
  let flood = Math.round(clamp((l.elev + 0.1) / 2.1 * 100, 3, 100));
  if (depth > 0) flood = Math.round(flood * clamp(1 - depth / 0.8, 0, 1));
  const sh = ctx.shops?.[l.id] || shopsNear(l) || estimateShops(l);
  const amenity = Math.round(clamp(sh.shops / 1.6 + sh.seven * 4, 0, 100));
  const quiet = Math.round(clamp(100 - l.density / 160, 5, 100));
  const yieldPct = l.salePrice ? l.rentMarket * 12 / l.salePrice * 100 : 0;
  const invest = l.salePrice ? Math.round(clamp((yieldPct - 2.5) / 4 * 100, 0, 100)) : 0;
  const s = { price, commute, transit, flood, amenity, quiet, invest };
  const w = ctx.weights || { price: 1.2, commute: 1.3, transit: 1, flood: 1, amenity: 0.7, quiet: 0.5, invest: mode === 'buy' ? 0.8 : 0 };
  let tot = 0, ws = 0;
  for (const k in w) { if (k === 'invest' && !l.salePrice) continue; tot += s[k] * w[k]; ws += w[k]; }
  s.overall = Math.round(tot / Math.max(ws, 0.001));
  return { scores: s, commutes, depth, shops: sh, yieldPct };
}

// ---------- การตั้งค่า (shared) ----------
export const IS_MOBILE = matchMedia('(max-width: 760px), (pointer: coarse)').matches;
const DEF_SETTINGS = { quality: IS_MOBILE ? 'low' : 'medium', buildings3d: !IS_MOBILE, antialias: !IS_MOBILE, fpsCap: IS_MOBILE ? 30 : 60, shadows: false, livePrices: true };
export function loadSettings() { try { return { ...DEF_SETTINGS, ...JSON.parse(localStorage.getItem('ynd-settings') || '{}') }; } catch { return { ...DEF_SETTINGS }; } }
export function saveSettings(s) { try { localStorage.setItem('ynd-settings', JSON.stringify(s)); } catch {} }
export function store(key, val) { try { if (val === undefined) return JSON.parse(localStorage.getItem(key) || 'null'); localStorage.setItem(key, JSON.stringify(val)); } catch { return null; } }

export const fmtBaht = n => n == null ? '—' : '฿' + Math.round(n).toLocaleString('th-TH');
export const fmtMoneyShort = n => n == null ? '—' : n >= 1e6 ? '฿' + (n / 1e6).toFixed(2) + ' ล.' : '฿' + Math.round(n).toLocaleString('th-TH');
