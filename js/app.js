import {
  DATA_SOURCE, DATA_INFO, myPlaces, REGIONS, DISTRICTS, TRANSIT, STATIONS, LISTINGS, LISTING_BY_ID, WORK_PRESETS, BBOX, TYPE_LABEL, TYPE_COLOR, SCORE_KEYS,
  elevationAt, floodDepthAt, densityAt, trafficTimeFactor, estimateCommute, estimateShops, loadShopIndex, shopsNear, scoreListing,
  DataProvider, loadSettings, saveSettings, store, fmtBaht, fmtMoneyShort, IS_MOBILE, haversine, clamp, isRiver,
} from './data.js';

const $ = s => document.querySelector(s);
const settings = loadSettings();
// ระดับซูมที่เริ่มเห็น 'ทุกจุด' (ต่ำกว่านี้รวมเป็นกลุ่ม) ตามคุณภาพที่ตั้ง
const DETAIL_ZOOM_BY_Q = { low: 15, medium: 14, high: 13 };
const QUALITY = { low: { pr: 0.75, cell: 0.02 }, medium: { pr: 1, cell: 0.012 }, high: { pr: Math.min(devicePixelRatio, 2), cell: 0.008 } };
const params = new URLSearchParams(location.search);
const DETAIL_ZOOM = DETAIL_ZOOM_BY_Q[settings.quality] || 14;

// ---------------- state ----------------
const S = {
  dim: IS_MOBILE ? '2d' : '3d',
  style: store('ynd-style') || 'clean',
  mode: 'rent', types: new Set(['condo', 'apartment', 'dorm', 'house']), maxPrice: null, sort: 'score', q: '',
  selected: null, addingWp: false,
  workplaces: store('ynd-workplaces') || [],
  compare: (store('ynd-compare') || []).filter(id => LISTING_BY_ID[id]), // ล้าง id เก่าที่ไม่มีแล้ว
  flood: { level: 0, rain: 0 }, floodOn: false, elevOn: false,
  hour: new Date().getHours() + (new Date().getMinutes() >= 30 ? 0.5 : 0), weekend: [0, 6].includes(new Date().getDay()),
  shops: {}, // id -> shop result (OSM)
};
const WP_COLORS = ['#e5484d', '#8e4ec6', '#0090ff', '#f76b15', '#30a46c', '#d6409f', '#ffb224'];
const scen = () => (S.floodOn ? S.flood : null);
const ctx = () => ({ mode: S.mode, workplaces: S.workplaces, hour: S.hour, flood: scen(), shops: S.shops });

// ---------------- styles (texture) ----------------
const OFM = 'https://tiles.openfreemap.org';
const STYLES = {
  clean: { label: 'เรียบ', url: OFM + '/styles/positron' },
  color: { label: 'สีสัน', url: OFM + '/styles/liberty' },
  dark: { label: 'มืด', url: OFM + '/styles/dark' },
  sat: { label: 'ดาวเทียม', url: null },
};
const satStyle = () => ({
  version: 8, glyphs: OFM + '/fonts/{fontstack}/{range}.pbf',
  sources: { esri: { type: 'raster', tileSize: 256, maxzoom: 19, attribution: 'Imagery © Esri, Maxar, Earthstar Geographics',
    tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'] } },
  layers: [{ id: 'bg', type: 'background', paint: { 'background-color': '#1b2430' } }, { id: 'esri', type: 'raster', source: 'esri' }],
});
const styleOf = k => (k === 'sat' ? satStyle() : STYLES[k].url);

// ---------------- map ----------------
const region = REGIONS[0];
const map = new maplibregl.Map({
  container: 'map', style: styleOf(S.style), center: region.center, zoom: IS_MOBILE ? 10 : region.zoom,
  pitch: S.dim === '3d' ? 55 : 0, bearing: S.dim === '3d' ? -18 : 0, maxPitch: 75, hash: false,
  pixelRatio: QUALITY[settings.quality].pr, antialias: settings.antialias, attributionControl: { compact: true },
  maxBounds: [[99.6, 13.1], [101.5, 14.6]],
});
window.__map = map;
map.on('load', () => { map.resize(); map.triggerRepaint(); });
map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), IS_MOBILE ? 'top-right' : 'bottom-right');
map.on('error', e => {
  if (String(e?.error?.message || '').match(/styles\/dark/)) { setStyle('clean'); toast('สไตล์มืดโหลดไม่ได้ สลับเป็นแบบเรียบ'); }
});

// ---------------- geo data builders ----------------
const fc = features => ({ type: 'FeatureCollection', features });
const pt = (lng, lat, props) => ({ type: 'Feature', geometry: { type: 'Point', coordinates: [lng, lat] }, properties: props });
function squareAround(lng, lat, m) {
  const dLat = m / 111000, dLng = m / (111000 * Math.cos(lat * Math.PI / 180));
  return [[[lng - dLng, lat - dLat], [lng + dLng, lat - dLat], [lng + dLng, lat + dLat], [lng - dLng, lat + dLat], [lng - dLng, lat - dLat]]];
}
function listingFeatures(rows) {
  return fc(rows.map(l => pt(l.lng, l.lat, { id: l.id, type: l.type, color: TYPE_COLOR[l.type], name: l.name, h: l.floors * 3.2 })));
}
function listingBoxes(rows) {
  return fc(rows.map(l => ({ type: 'Feature', geometry: { type: 'Polygon', coordinates: squareAround(l.lng, l.lat, l.type === 'house' ? 14 : 22) },
    properties: { id: l.id, color: TYPE_COLOR[l.type], h: Math.max(8, l.floors * 3.2) } })));
}
const stationsFC = fc(STATIONS.map(s => pt(s.lng, s.lat, { name: s.name, line: s.line, color: s.color })));
const linesFC = fc(TRANSIT.map(l => ({ type: 'Feature', geometry: { type: 'LineString', coordinates: l.stations.map(s => [s.lng, s.lat]) }, properties: { color: l.color, name: l.name } })));
function densityFC() {
  const out = [];
  for (const d of DISTRICTS) for (let i = 0; i < 14; i++) {
    const a = i / 14 * Math.PI * 2, r = i % 2 ? 0.012 : 0.022;
    const lat = d.lat + Math.sin(a) * r, lng = d.lng + Math.cos(a) * r;
    out.push(pt(lng, lat, { w: densityAt(lat, lng) / 20000 }));
  }
  return fc(out);
}
// grid for elevation / flood
let GRID = null;
function buildGrid() {
  const c = QUALITY[settings.quality].cell, feats = [];
  for (let lat = BBOX.minLat; lat < BBOX.maxLat; lat += c) for (let lng = BBOX.minLng; lng < BBOX.maxLng; lng += c) {
    const cl = lat + c / 2, cg = lng + c / 2;
    if (cl < 13.52 + (cg > 100.66 ? 0.02 : 0)) continue; // ทะเล
    const e = elevationAt(cl, cg);
    feats.push({ type: 'Feature', geometry: { type: 'Polygon', coordinates: [[[lng, lat], [lng + c, lat], [lng + c, lat + c], [lng, lat + c], [lng, lat]]] },
      properties: { e: +e.toFixed(2), d: 0, r: isRiver(cl, cg) ? 1 : 0, lat: cl, lng: cg } });
  }
  GRID = fc(feats);
}
function updateGridDepth() {
  if (!GRID) buildGrid();
  const sc = S.flood;
  for (const f of GRID.features) { const p = f.properties; p.d = p.r ? 0 : +floodDepthAt(p.lat, p.lng, sc).toFixed(2); }
  map.getSource('grid')?.setData(GRID);
}

// ---------------- layers ----------------
function firstSymbolId() { return map.getStyle().layers.find(l => l.type === 'symbol')?.id; }
function addAppLayers() {
  const before = firstSymbolId();
  // hide style's own 3D buildings (we add ours)
  for (const l of map.getStyle().layers) if (l.type === 'fill-extrusion') map.setLayoutProperty(l.id, 'visibility', 'none');
  if (!map.getSource('omt')) map.addSource('omt', { type: 'vector', url: OFM + '/planet' });

  if (!GRID) buildGrid();
  map.addSource('grid', { type: 'geojson', data: GRID });
  map.addLayer({ id: 'elev-fill', type: 'fill', source: 'grid', layout: { visibility: 'none' }, paint: {
    'fill-color': ['interpolate', ['linear'], ['get', 'e'], -1.5, '#1d4ed8', 0, '#60a5fa', 0.5, '#a7f3d0', 1.0, '#fde68a', 1.6, '#f59e0b', 2.4, '#b45309'],
    'fill-opacity': 0.55 } }, before);
  map.addLayer({ id: 'elev-3d', type: 'fill-extrusion', source: 'grid', layout: { visibility: 'none' }, paint: {
    'fill-extrusion-color': ['interpolate', ['linear'], ['get', 'e'], -1.5, '#1d4ed8', 0, '#60a5fa', 0.5, '#a7f3d0', 1.0, '#fde68a', 1.6, '#f59e0b', 2.4, '#b45309'],
    'fill-extrusion-height': ['*', ['+', ['get', 'e'], 1.6], 90], 'fill-extrusion-opacity': 0.75 } });
  map.addLayer({ id: 'flood-fill', type: 'fill', source: 'grid', filter: ['>', ['get', 'd'], 0.02], layout: { visibility: 'none' }, paint: {
    'fill-color': ['interpolate', ['linear'], ['get', 'd'], 0, '#bae6fd', 0.3, '#38bdf8', 0.8, '#0284c7', 1.5, '#1e3a8a'],
    'fill-opacity': ['interpolate', ['linear'], ['get', 'd'], 0, 0.35, 1, 0.75] } }, before);
  map.addLayer({ id: 'flood-3d', type: 'fill-extrusion', source: 'grid', filter: ['>', ['get', 'd'], 0.02], layout: { visibility: 'none' }, paint: {
    'fill-extrusion-color': ['interpolate', ['linear'], ['get', 'd'], 0, '#7dd3fc', 0.8, '#0284c7', 1.5, '#1e3a8a'],
    'fill-extrusion-base': 0, 'fill-extrusion-height': ['*', ['get', 'd'], 160], 'fill-extrusion-opacity': 0.6 } });

  map.addSource('density', { type: 'geojson', data: densityFC() });
  map.addLayer({ id: 'density', type: 'heatmap', source: 'density', layout: { visibility: 'none' }, paint: {
    'heatmap-weight': ['get', 'w'], 'heatmap-intensity': ['interpolate', ['linear'], ['zoom'], 9, 0.7, 13, 1.4],
    'heatmap-radius': ['interpolate', ['linear'], ['zoom'], 9, 22, 12, 60, 15, 140], 'heatmap-opacity': 0.65,
    'heatmap-color': ['interpolate', ['linear'], ['heatmap-density'], 0, 'rgba(0,0,0,0)', 0.15, '#c7e9b4', 0.35, '#7fcdbb', 0.55, '#fed976', 0.75, '#fd8d3c', 1, '#bd0026'] } }, before);

  map.addLayer({ id: 'traffic', type: 'line', source: 'omt', 'source-layer': 'transportation', minzoom: 11,
    filter: ['match', ['get', 'class'], ['motorway', 'trunk', 'primary', 'secondary', 'tertiary'], true, false],
    layout: { visibility: 'none', 'line-cap': 'round', 'line-join': 'round' },
    paint: { 'line-width': ['interpolate', ['linear'], ['zoom'], 9, 1, 13, 3.5, 16, 7], 'line-color': trafficColorExpr(), 'line-opacity': 0.9 } }, before);

  map.addLayer({ id: 'bld3d', type: 'fill-extrusion', source: 'omt', 'source-layer': 'building', minzoom: Math.max(14.5, DETAIL_ZOOM), layout: { visibility: 'none' }, paint: {
    'fill-extrusion-color': S.style === 'dark' ? '#3a4556' : '#dfe4ec',
    'fill-extrusion-height': ['coalesce', ['get', 'render_height'], 9], 'fill-extrusion-base': ['coalesce', ['get', 'render_min_height'], 0],
    'fill-extrusion-opacity': 0.85 } });

  map.addSource('transit', { type: 'geojson', data: linesFC });
  map.addLayer({ id: 'transit-line', type: 'line', source: 'transit', layout: { 'line-cap': 'round' }, paint: { 'line-color': ['get', 'color'], 'line-width': ['interpolate', ['linear'], ['zoom'], 9, 2, 14, 5], 'line-opacity': 0.85 } });
  map.addSource('stations', { type: 'geojson', data: stationsFC });
  map.addLayer({ id: 'stations', type: 'circle', source: 'stations', minzoom: 10.5, paint: { 'circle-color': '#fff', 'circle-stroke-color': ['get', 'color'], 'circle-stroke-width': 2.5, 'circle-radius': ['interpolate', ['linear'], ['zoom'], 11, 3, 15, 6] } });

  map.addSource('routes', { type: 'geojson', data: fc([]) });
  map.addLayer({ id: 'routes-casing', type: 'line', source: 'routes', layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': '#fff', 'line-width': 8, 'line-opacity': 0.9 } });
  map.addLayer({ id: 'routes', type: 'line', source: 'routes', layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': ['get', 'color'], 'line-width': 4.5, 'line-dasharray': ['case', ['get', 'approx'], ['literal', [1, 1.5]], ['literal', [1, 0]]] } });

  map.addSource('shops', { type: 'geojson', data: fc([]) });
  map.addLayer({ id: 'shops-ring', type: 'line', source: 'shops', filter: ['==', ['get', 'kind'], 'ring'], layout: { visibility: 'none' },
    paint: { 'line-color': '#16a34a', 'line-width': 2, 'line-dasharray': [2, 2], 'line-opacity': 0.8 } });
  map.addLayer({ id: 'shops', type: 'circle', source: 'shops', minzoom: 12, filter: shopFilter(),
    layout: { visibility: 'none', 'circle-sort-key': ['match', ['get', 'kind'], 'seven', 3, 'convenience', 2, 1] }, paint: {
    'circle-color': ['match', ['get', 'kind'], 'seven', '#16a34a', 'convenience', '#f97316', '#a855f7'],
    'circle-radius': ['interpolate', ['linear'], ['zoom'], 12, ['match', ['get', 'kind'], 'seven', 4, 'convenience', 3.5, 1.5], 16, ['match', ['get', 'kind'], 'seven', 8, 'convenience', 7, 3.5]],
    'circle-opacity': ['match', ['get', 'kind'], 'shop', 0.5, 1],
    'circle-stroke-color': ['match', ['get', 'kind'], 'shop', '#fff', '#0f172a'], 'circle-stroke-width': ['match', ['get', 'kind'], 'shop', 0.5, 2.5] } });

  // ซูมออก = รวมเป็นกลุ่ม (cluster) ไม่วาดทุกจุด → ลื่นขึ้นมาก / ซูมถึง DETAIL_ZOOM = เห็นทุกจุด
  map.addSource('listings', { type: 'geojson', data: listingFeatures(lastRows || filtered()), cluster: true, clusterMaxZoom: DETAIL_ZOOM - 1, clusterRadius: 55 });
  map.addSource('listing-boxes', { type: 'geojson', data: fc([]) });
  map.addLayer({ id: 'listings-3d', type: 'fill-extrusion', source: 'listing-boxes', minzoom: DETAIL_ZOOM, layout: { visibility: 'none' }, paint: {
    'fill-extrusion-color': ['case', ['==', ['get', 'id'], S.selected?.id || ''], '#ffd60a', ['get', 'color']],
    'fill-extrusion-height': ['get', 'h'], 'fill-extrusion-opacity': 0.92 } });
  map.addLayer({ id: 'listing-clusters', type: 'circle', source: 'listings', filter: ['has', 'point_count'], paint: {
    'circle-color': ['step', ['get', 'point_count'], '#93c5fd', 50, '#60a5fa', 300, '#3b82f6', 1500, '#1d4ed8'],
    'circle-radius': ['step', ['get', 'point_count'], 14, 50, 18, 300, 23, 1500, 29],
    'circle-stroke-color': '#fff', 'circle-stroke-width': 2, 'circle-opacity': 0.88 } });
  map.addLayer({ id: 'listing-cluster-count', type: 'symbol', source: 'listings', filter: ['has', 'point_count'],
    layout: { 'text-field': ['get', 'point_count_abbreviated'], 'text-font': ['Noto Sans Regular'], 'text-size': 12, 'text-allow-overlap': true },
    paint: { 'text-color': '#fff' } });
  map.addLayer({ id: 'listings', type: 'circle', source: 'listings', filter: ['!', ['has', 'point_count']], paint: {
    'circle-color': ['get', 'color'], 'circle-radius': ['interpolate', ['linear'], ['zoom'], 9, 3, 12, 6, 15, 9],
    'circle-stroke-color': '#fff', 'circle-stroke-width': 1.5, 'circle-opacity': 0.95 } });
  map.addLayer({ id: 'listing-sel', type: 'circle', source: 'listings', filter: selFilter(S.selected?.id), paint: {
    'circle-color': 'rgba(0,0,0,0)', 'circle-radius': 16, 'circle-stroke-color': '#ffd60a', 'circle-stroke-width': 4 } });
  updateBoxes();

  map.moveLayer('shops-ring'); map.moveLayer('shops'); // ร้านค้าอยู่บนสุด
  applyLayerVisibility(); applyDim(false); updateGridDepth(); refreshRoutes(); showShopsOnMap();
}
function trafficColorExpr() {
  const tf = trafficTimeFactor(S.hour, S.weekend);
  const cls = ['match', ['get', 'class'], 'motorway', 1.05, 'trunk', 1.15, 'primary', 1.1, 'secondary', 0.9, 'tertiary', 0.7, 0.5];
  const vary = ['+', 0.72, ['*', 0.56, ['/', ['%', ['to-number', ['coalesce', ['id'], ['get', 'brunnel'], 0], 0], 89], 89]]];
  return ['interpolate', ['linear'], ['*', cls, vary, tf], 0, '#22c55e', 0.42, '#a3e635', 0.58, '#facc15', 0.75, '#f97316', 0.92, '#dc2626'];
}
const vis = (id, on) => map.getLayer(id) && map.setLayoutProperty(id, 'visibility', on ? 'visible' : 'none');
function applyLayerVisibility() {
  const three = S.dim === '3d';
  vis('listings', $('#ly-listings').checked); vis('listing-sel', $('#ly-listings').checked);
  vis('listing-clusters', $('#ly-listings').checked); vis('listing-cluster-count', $('#ly-listings').checked);
  vis('listings-3d', $('#ly-listings').checked && three);
  vis('transit-line', $('#ly-transit').checked); vis('stations', $('#ly-transit').checked);
  vis('bld3d', $('#ly-bld').checked && three);
  vis('density', $('#ly-density').checked);
  vis('shops', $('#ly-shops').checked); vis('shops-ring', $('#ly-shops').checked);
  if (map.getLayer('listings')) map.setPaintProperty('listings', 'circle-opacity', $('#ly-shops').checked ? 0.35 : 0.95); // จางลงให้เห็นร้านชัด
  if (map.getLayer('listings-3d')) map.setPaintProperty('listings-3d', 'fill-extrusion-opacity', $('#ly-shops').checked ? 0.3 : 0.92);
  vis('elev-fill', S.elevOn && !three); vis('elev-3d', S.elevOn && three);
  vis('flood-fill', S.floodOn && !three); vis('flood-3d', S.floodOn && three);
  vis('traffic', $('#ly-traffic').checked);
  renderLegend();
}
function applyDim(animate = true) {
  const three = S.dim === '3d';
  document.querySelectorAll('#dim button').forEach(b => b.classList.toggle('on', b.dataset.v === S.dim));
  const o = { pitch: three ? 55 : 0, bearing: three ? -18 : 0, duration: animate ? 900 : 0 };
  animate ? map.easeTo(o) : map.jumpTo(o);
  if (map.getLayer('bld3d')) applyLayerVisibility();
  setTimeout(updateBoxes, animate ? 950 : 0);
}

// ---------------- style switcher ----------------
function setStyle(k) {
  S.style = k; store('ynd-style', k);
  document.querySelectorAll('#styles button').forEach(b => b.classList.toggle('on', b.dataset.v === k));
  $('#styles-m').value = k;
  map.setStyle(styleOf(k), { diff: false });
}
map.on('style.load', addAppLayers);

// ---------------- filtering & list ----------------
const priceOf = l => (S.mode === 'buy' ? l.salePrice : l.rentMarket);
function filtered() {
  const q = S.q.trim().toLowerCase();
  return LISTINGS.filter(l => S.types.has(l.type) && (S.mode === 'rent' || l.salePrice) &&
    (!S.maxPrice || priceOf(l) <= S.maxPrice) &&
    (!q || (l.name + ' ' + l.district + ' ' + l.districtEn + ' ' + l.station.name + ' ' + l.prov + ' ' + (l.nameEn || '') + ' ' + (l.street || '')).toLowerCase().includes(q)));
}
function setupPriceSlider() {
  const r = $('#maxp');
  if (S.mode === 'rent') { r.min = 2000; r.max = 80000; r.step = 500; } else { r.min = 500000; r.max = 20000000; r.step = 100000; }
  S.maxPrice = null; r.value = r.max; $('#maxp-v').textContent = 'ไม่จำกัด';
}
let scoreCache = new Map();
function scoreOf(l) { if (!scoreCache.has(l.id)) scoreCache.set(l.id, scoreListing(l, ctx())); return scoreCache.get(l.id); }
function invalidateScores() { scoreCache = new Map(); }

function renderList() {
  const rows = filtered();
  const key = { score: l => -scoreOf(l).scores.overall, asc: l => priceOf(l), desc: l => -priceOf(l), transit: l => l.station.distKm,
    flood: l => -scoreOf(l).scores.flood, commute: l => -scoreOf(l).scores.commute }[S.sort];
  rows.sort((a, b) => key(a) - key(b));
  $('#count').textContent = `พบ ${rows.length.toLocaleString()} แห่ง` + (rows.length > 120 ? ' (แสดง 120 อันดับแรก)' : '')
    + (DATA_SOURCE === 'osm' ? ` · ที่พักจริงทั้งหมด ${DATA_INFO.count.toLocaleString()} แห่ง` : ' · ข้อมูลจำลอง');
  $('#list').innerHTML = rows.slice(0, 120).map(l => {
    const sc = scoreOf(l).scores.overall;
    return `<div class="item${S.selected?.id === l.id ? ' sel' : ''}" data-id="${l.id}">
      <div class="bar" style="background:${TYPE_COLOR[l.type]}"></div>
      <div><div class="t">${l.name}</div><div class="m">${TYPE_LABEL[l.type]} · ${l.district} · ${l.size} ตร.ม. · 🚇 ${fmtKm(l.station.distKm)}</div></div>
      <div class="p" data-price>${S.mode === 'buy' ? fmtMoneyShort(l.salePrice) : fmtBaht(l.rentMarket)}<small>${S.mode === 'buy' ? '' : '/เดือน · '}คะแนน ${sc}</small></div></div>`;
  }).join('');
  lastRows = rows;
  map.getSource('listings')?.setData(listingFeatures(rows));
  updateBoxes();
}
// กล่อง 3D ของที่พัก: สร้างเฉพาะที่อยู่บนจอ และเฉพาะตอนซูมใกล้ (ประหยัด GPU/RAM)
let lastRows = null;
function updateBoxes() {
  const src = map.getSource('listing-boxes'); if (!src) return;
  if (S.dim !== '3d' || map.getZoom() < DETAIL_ZOOM || !lastRows) { src.setData(fc([])); return; }
  const b = map.getBounds().toArray(); // [[w,s],[e,n]]
  const pad = 0.003, inView = lastRows.filter(l => l.lng > b[0][0] - pad && l.lng < b[1][0] + pad && l.lat > b[0][1] - pad && l.lat < b[1][1] + pad);
  src.setData(listingBoxes(inView.slice(0, 3000)));
}
const selFilter = id => ['all', ['!', ['has', 'point_count']], ['==', ['get', 'id'], id || '']];
const fmtKm = km => km < 1 ? Math.round(km * 1000) + ' ม.' : km.toFixed(1) + ' กม.';

// ---------------- detail panel ----------------
function spark(arr, w = 300, h = 46) {
  const mn = Math.min(...arr), mx = Math.max(...arr), r = mx - mn || 1;
  const p = arr.map((v, i) => `${(i / (arr.length - 1) * w).toFixed(1)},${(h - 4 - (v - mn) / r * (h - 8)).toFixed(1)}`).join(' ');
  const up = arr[arr.length - 1] >= arr[0];
  return `<svg viewBox="0 0 ${w} ${h}" width="100%" height="${h}" preserveAspectRatio="none"><polyline fill="none" stroke="${up ? '#16a34a' : '#e5484d'}" stroke-width="2" points="${p}"/></svg>`;
}
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
function realInfo(l) {
  const parts = [];
  if (l.floorsKnown) parts.push(l.floors + ' ชั้น');
  if (l.rooms) parts.push(l.rooms + ' ห้อง');
  if (l.street) parts.push('📮 ' + esc(l.street));
  if (l.phone) parts.push('☎ ' + esc(l.phone));
  if (l.osm) parts.push(`<a href="https://www.openstreetmap.org/${l.osm}" target="_blank" rel="noopener">ดูบน OSM</a>`);
  const gq = l.locationApprox ? l.name + ' ' + (l.street || '') : l.lat + ',' + l.lng;
  parts.push(`<a href="${l.gmaps && /^https:\/\//.test(l.gmaps) ? esc(l.gmaps) : 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(gq)}" target="_blank" rel="noopener">เปิดใน Google Maps</a>`);
  if (l.website && /^https?:\/\//.test(l.website)) parts.push(`<a href="${esc(l.website)}" target="_blank" rel="noopener">${/facebook/.test(l.website) ? 'Facebook' : 'เว็บไซต์'}</a>`);
  const SRC = { osm: 'OpenStreetMap', overture: 'Overture Maps', google: 'Google Maps', manual: 'ข้อมูลที่เพิ่มด้วยมือ', mine: 'คุณเพิ่มเอง' };
  let html = parts.join(' · ') + `<br><span class="chip">แหล่งข้อมูล: ${SRC[l.source] || l.source}</span>${l.locationApprox ? ' <span class="chip">📍 ตำแหน่งโดยประมาณ</span>' : ''}`;
  if (l.deposit) html += `<br>💰 เงินประกัน ${fmtBaht(l.deposit)}`;
  if (l.highlights) html += `<br>⭐ ${esc(l.highlights)}`;
  if (l.amenities?.length) html += `<div class="row" style="margin-top:6px">${l.amenities.map(a => `<span class="chip">${esc(a)}</span>`).join('')}</div>`;
  if (l.priceNote) html += `<div class="small">ℹ️ ${esc(l.priceNote)}</div>`;
  if (l.source === 'mine') html += `<div><button class="btn sm" onclick="window.__removeMyPlace('${l.id}')">🗑 ลบที่พักนี้</button></div>`;
  return html;
}
const scoreColor = v => v >= 75 ? '#16a34a' : v >= 55 ? '#65a30d' : v >= 40 ? '#f59e0b' : '#e5484d';

function renderDetail() {
  const l = S.selected; const el = $('#detail');
  if (!l) { el.classList.add('hidden'); return; }
  el.classList.remove('hidden');
  const r = scoreListing(l, ctx()); const s = r.scores;
  const inCmp = S.compare.includes(l.id);
  const sh = S.shops[l.id];
  const shopTxt = sh ? shopText(sh) : '<span class="small">กำลังโหลด…</span>';
  const floodLv = S.flood.level || 0;
  const depthNow = floodDepthAt(l.lat, l.lng, scen());
  const firstFloodLv = Math.max(0, l.elev).toFixed(2);
  const yieldTxt = l.salePrice ? (l.rentMarket * 12 / l.salePrice * 100).toFixed(2) + '%' : '—';
  const chg = l.history.length > 1 ? (l.rentMarket / l.history[0] - 1) * 100 : 0;

  let commuteHtml = '';
  if (S.workplaces.length) {
    const rows = S.workplaces.map((w, i) => {
      const n = estimateCommute(l, w, { hour: S.hour });
      const f = S.floodOn ? estimateCommute(l, w, { hour: S.hour, flood: S.flood }) : null;
      const route = routeInfo[w.id];
      const carMin = route ? Math.round(route.duration / 60 * (1 + n.congestion * 1.4)) : n.carMin;
      const km = route ? route.distance / 1000 : n.roadKm;
      return `<tr><td><span style="color:${w.color}">●</span> ${w.name}</td><td>${km.toFixed(1)} กม.</td>
        <td>🚗 ${carMin}′</td><td>🚇 ${n.transitMin}′</td>
        ${f ? `<td>${f.carBlocked ? '<b class="down">รถผ่านไม่ได้</b>' : '🚗 ' + f.carMin + '′'}${f.maxDepth > 0.05 ? `<div class="small">น้ำลึกสุด ${f.maxDepth.toFixed(2)} ม.</div>` : ''}</td>` : ''}</tr>`;
    }).join('');
    commuteHtml = `<h4>🧭 เดินทางไปที่ทำงาน (${fmtHour(S.hour)})</h4>
      <table class="ctable"><tr><th>ปลายทาง</th><th>ระยะ</th><th>รถยนต์</th><th>รถไฟฟ้า</th>${S.floodOn ? '<th>ตอนน้ำท่วม</th>' : ''}</tr>${rows}</table>
      <div class="small">เวลารถยนต์ = เส้นทางจริงจาก OSRM × ปัจจัยรถติดตามเวลา (เส้นประ = เส้นตรงโดยประมาณ)</div>`;
  } else commuteHtml = `<div class="info">📍 ปักหมุดที่ทำงานในแท็บ “ที่ทำงาน” เพื่อดูเวลาเดินทางและเส้นทาง</div>`;

  el.innerHTML = `
    <button class="btn sm ghost close" id="d-close">✕</button>
    <span class="chip" style="background:${TYPE_COLOR[l.type]}1a;color:${TYPE_COLOR[l.type]}">${TYPE_LABEL[l.type]}</span>
    <span class="chip">${l.district}, ${l.prov}</span>
    <h2>${l.name}</h2>
    ${l.nameEn && l.nameEn !== l.name ? `<div class="small">${l.nameEn}</div>` : ''}
    <div class="small">${l.real ? realInfo(l) : `${l.size} ตร.ม. · ${l.floors} ชั้น · ปี ${l.year} · อัตราเข้าพัก ${l.occupancy}% ${l.petFriendly ? '· 🐾 เลี้ยงสัตว์ได้' : ''}`}</div>
    ${l.priceEstimated ? '<div class="warn">💡 ราคาด้านล่างเป็น<b>ค่าประมาณการ</b> คำนวณจากทำเล ระยะรถไฟฟ้า และประเภทที่พัก เพราะยังไม่มีแหล่งราคาจริงของที่นี่ โปรดเช็กราคากับเจ้าของอีกครั้ง</div>' : ''}
    <div class="price-grid">
      <div><div class="lb">${l.priceEstimated ? 'ค่าเช่าโดยประมาณ' : 'ค่าเช่าตลาด (ที่คนเช่าจ่ายจริง)'}</div><div class="v" id="d-rm">${fmtBaht(l.rentMarket)}</div>${l.real ? `<div class="small">${l.priceEstimated ? 'ประมาณการ' : 'ราคาจากผู้ใช้/เจ้าของ'}</div>` : `<div class="small ${chg >= 0 ? 'up' : 'down'}">${chg >= 0 ? '▲' : '▼'} ${Math.abs(chg).toFixed(1)}% ช่วงนี้</div>`}</div>
      <div><div class="lb">${l.priceEstimated ? 'ราคาตั้งโดยประมาณ' : 'ราคาที่ผู้ให้เช่าตั้ง'}</div><div class="v" id="d-ra">${fmtBaht(l.rentAsk)}</div><div class="small">ต่อรองได้ ~${Math.round((1 - l.rentMarket / l.rentAsk) * 100)}%</div></div>
      <div><div class="lb">ราคาขาย</div><div class="v" id="d-sp">${l.salePrice ? fmtMoneyShort(l.salePrice) : 'ไม่ขาย'}</div><div class="small">${l.ppsm ? fmtBaht(l.ppsm) + '/ตร.ม.' : ''}</div></div>
      <div><div class="lb">ผลตอบแทนค่าเช่า</div><div class="v">${yieldTxt}</div><div class="small">ต่อปี (gross)</div></div>
    </div>
    ${l.real ? '' : `<div class="row" style="justify-content:space-between"><span class="small">ค่าเช่าย้อนหลัง</span><span class="badge-live">LIVE</span></div>
    <div id="d-spark">${spark(l.history)}</div>`}
    <div class="overall"><div class="ring" style="background:conic-gradient(${scoreColor(s.overall)} ${s.overall * 3.6}deg,#eef2f7 0)"><div style="background:#fff;width:46px;height:46px;border-radius:50%;display:grid;place-items:center">${s.overall}</div></div>
      <div><b>คะแนนความเหมาะสมรวม</b><div class="small">ถ่วงน้ำหนัก ราคา · เดินทาง · รถไฟฟ้า · น้ำท่วม · ร้านค้า · ความสงบ</div></div></div>
    ${SCORE_KEYS.filter(k => k.key !== 'invest' || l.salePrice).map(k => `<div class="score-row"><span>${k.label}</span><div class="score-bar"><i style="width:${s[k.key]}%;background:${scoreColor(s[k.key])}"></i></div><b>${s[k.key]}</b></div>`).join('')}
    <h4>🏙️ รอบที่พัก</h4>
    <div class="small" style="color:var(--ink)">🚇 ${l.station.name} (${l.station.line}) — ${fmtKm(l.station.distKm)}<br>
    👥 ความหนาแน่น ~${l.density.toLocaleString()} คน/ตร.กม.<br>🏪 รัศมี 800 ม.: <span id="d-shops">${shopTxt}</span><br>
    ⛰️ ระดับพื้น ~${l.elev.toFixed(2)} ม. รทก. · เริ่มท่วมเมื่อน้ำสูง ~${firstFloodLv} ม.</div>
    ${S.floodOn && depthNow > 0.02 ? `<div class="warn">🌊 สถานการณ์ปัจจุบัน (น้ำ ${floodLv.toFixed(2)} ม. / ฝน ${S.flood.rain} มม.) — น้ำบริเวณนี้ลึก ~${depthNow.toFixed(2)} ม.</div>` : ''}
    ${commuteHtml}
    <div class="actions">
      <button class="btn" id="d-cmp">${inCmp ? '✓ อยู่ในรายการเปรียบเทียบ' : '⚖️ เพิ่มเปรียบเทียบ'}</button>
      <button class="btn" id="d-flood">🌊 ถ้าน้ำท่วมที่นี่?</button>
      <button class="btn cat" id="d-cat">🐈 ลงไปเดินสำรวจแบบแมว</button>
    </div>`;
  $('#d-close').onclick = () => select(null);
  $('#d-cmp').onclick = () => toggleCompare(l.id);
  $('#d-flood').onclick = () => {
    $('#ly-flood').checked = true; S.floodOn = true; S.flood.level = Math.max(S.flood.level, +(l.elev + 0.3).toFixed(2));
    $('#lv').value = S.flood.level; onFloodChange(); switchTab('layers');
  };
  $('#d-cat').onclick = () => startCat(l);
}

function select(l, fly = true) {
  S.selected = l;
  document.querySelectorAll('.item').forEach(e => e.classList.toggle('sel', e.dataset.id === l?.id));
  if (map.getLayer('listing-sel')) map.setFilter('listing-sel', selFilter(l?.id));
  if (map.getLayer('listings-3d')) map.setPaintProperty('listings-3d', 'fill-extrusion-color', ['case', ['==', ['get', 'id'], l?.id || ''], '#ffd60a', ['get', 'color']]);
  renderDetail(); refreshRoutes();
  if (!l) { showShopsOnMap(); showShopsInView(); return; }
  if (fly) map.flyTo({ center: [l.lng, l.lat], zoom: Math.max(map.getZoom(), DETAIL_ZOOM + 0.3), duration: 1100, padding: IS_MOBILE ? { bottom: innerHeight * 0.5 } : { right: 380, left: 350 } });
  if (IS_MOBILE) $('#side').classList.add('collapsed');
  loadShops(l);
}
async function loadShops(l) {
  // ใช้ข้อมูลร้านค้าทั้งเมืองที่เก็บไว้ในเครื่อง (data/shops.json) — ขึ้นทันที ไม่ต้องรอเซิร์ฟเวอร์ภายนอก
  if (!S.shops[l.id] || !S.shops[l.id].points) {
    await loadShopIndex();
    S.shops[l.id] = shopsNear(l, 800, true) || estimateShops(l);
  }
  if (S.selected?.id === l.id) {
    const sh = S.shops[l.id]; const el = $('#d-shops');
    if (el) el.innerHTML = shopText(sh);
    showShopsOnMap();
  }
}
function shopFilter() {
  const only = document.querySelector('#ly-conv-only')?.checked;
  return only ? ['match', ['get', 'kind'], ['seven', 'convenience'], true, false] : ['!=', ['get', 'kind'], 'ring'];
}
// เปิดเลเยอร์ร้านค้าโดยยังไม่เลือกที่พัก → แสดงร้านทั้งหมดรอบกลางจอ (ซูม ≥ 14)
async function showShopsInView() {
  if (S.selected || !$('#ly-shops').checked) return;
  if (map.getZoom() < 14) { map.getSource('shops')?.setData(fc([])); $('#shops-note').textContent = 'ซูมเข้า (ระดับ 14+) เพื่อดูร้านค้าทั้งหมดบนจอ หรือเลือกที่พักเพื่อดูร้านในรัศมี 800 ม.'; return; }
  await loadShopIndex();
  const c = map.getCenter(), b = map.getBounds();
  const r = Math.min(2500, haversine({ lat: c.lat, lng: c.lng }, { lat: b.getNorth(), lng: b.getEast() }) * 1000);
  const sh = shopsNear({ lat: c.lat, lng: c.lng }, r, true);
  map.getSource('shops')?.setData(fc((sh?.points || []).map(p => pt(p.lng, p.lat, { kind: p.kind }))));
  if (sh) $('#shops-note').innerHTML = `บนจอนี้: ${sh.shops.toLocaleString()} ร้าน · <span style="color:#16a34a">● 7-Eleven ${sh.seven}</span> · <span style="color:#f97316">● สะดวกซื้ออื่น ${sh.convenience - sh.seven}</span> · <span style="color:#a855f7">● ร้านทั่วไป</span>`;
}
map.on('moveend', showShopsInView);
$('#ly-conv-only').onchange = () => { if (map.getLayer('shops')) map.setFilter('shops', shopFilter()); if (!$('#ly-shops').checked) $('#ly-shops').click(); };
const shopText = sh => `${sh.shops.toLocaleString()} ร้าน · สะดวกซื้อ ${sh.convenience} · 7-Eleven ${sh.seven} <span class="chip">${sh.source === 'overture' ? 'ข้อมูลจริง' : 'ประมาณ'}</span>`;
function showShopsOnMap() {
  const l = S.selected, sh = l && S.shops[l.id];
  const pts = (sh?.points || []).map(p => pt(p.lng, p.lat, { kind: p.kind }));
  // วงรัศมี 800 ม.
  if (l && sh?.points) {
    const ring = []; for (let i = 0; i <= 64; i++) { const a = i / 64 * Math.PI * 2; ring.push([l.lng + Math.cos(a) * 0.8 / (111.32 * Math.cos(l.lat * Math.PI / 180)), l.lat + Math.sin(a) * 0.8 / 110.57]); }
    pts.push({ type: 'Feature', geometry: { type: 'LineString', coordinates: ring }, properties: { kind: 'ring' } });
  }
  map.getSource('shops')?.setData(fc(pts));
  $('#shops-note').innerHTML = !l ? 'เลือกที่พักก่อน แล้วจะเห็นร้านค้าจริงทุกร้านในรัศมี 800 ม.'
    : sh?.source === 'overture' ? `รอบ <b>${esc(l.name)}</b>: ${sh.shops.toLocaleString()} ร้าน · <span style="color:#16a34a">● 7-Eleven ${sh.seven}</span> · <span style="color:#f97316">● สะดวกซื้ออื่น ${sh.convenience - sh.seven}</span> · <span style="color:#a855f7">● ร้านทั่วไป</span>`
    : 'กำลังโหลดข้อมูลร้านค้า…';
}

// ---------------- workplaces & routes ----------------
const wpMarkers = {};
let routeInfo = {};
function saveWps() { store('ynd-workplaces', S.workplaces); }
function addWorkplace(lng, lat, name) {
  const w = { id: 'W' + Date.now().toString(36), name: name || 'ที่ทำงาน ' + (S.workplaces.length + 1), lng, lat, color: WP_COLORS[S.workplaces.length % WP_COLORS.length] };
  S.workplaces.push(w); saveWps(); drawWpMarker(w); renderWps(); invalidateScores(); renderList(); renderDetail(); refreshRoutes();
}
function drawWpMarker(w) {
  const el = document.createElement('div'); el.className = 'mk-wp'; el.style.background = w.color; el.innerHTML = '<span>💼</span>'; el.title = w.name;
  const m = new maplibregl.Marker({ element: el, draggable: true, anchor: 'bottom' }).setLngLat([w.lng, w.lat]).addTo(map);
  m.on('dragend', () => { const p = m.getLngLat(); w.lng = p.lng; w.lat = p.lat; saveWps(); invalidateScores(); renderList(); renderDetail(); refreshRoutes(); });
  wpMarkers[w.id] = m;
}
function removeWp(id) {
  S.workplaces = S.workplaces.filter(w => w.id !== id); wpMarkers[id]?.remove(); delete wpMarkers[id];
  saveWps(); renderWps(); invalidateScores(); renderList(); renderDetail(); refreshRoutes();
}
function renderWps() {
  $('#wp-list').innerHTML = S.workplaces.length ? S.workplaces.map(w => `<div class="item" style="grid-template-columns:6px 1fr auto"><div class="bar" style="background:${w.color}"></div>
    <div><input class="field" value="${w.name}" data-wp-name="${w.id}" style="padding:3px 6px"><div class="m">${w.lat.toFixed(4)}, ${w.lng.toFixed(4)} · ลากหมุดเพื่อย้าย</div></div>
    <button class="btn sm ghost" data-wp-del="${w.id}">🗑</button></div>`).join('') : '<div class="small">ยังไม่มีหมุด</div>';
}
let routeSeq = 0;
async function refreshRoutes() {
  const l = S.selected; const seq = ++routeSeq;
  if (!l || !S.workplaces.length) { routeInfo = {}; map.getSource('routes')?.setData(fc([])); return; }
  const straight = w => ({ type: 'Feature', geometry: { type: 'LineString', coordinates: [[l.lng, l.lat], [w.lng, w.lat]] }, properties: { color: w.color, approx: true } });
  map.getSource('routes')?.setData(fc(S.workplaces.map(straight)));
  const feats = await Promise.all(S.workplaces.map(async w => {
    try {
      const ctrl = new AbortController(); setTimeout(() => ctrl.abort(), 8000);
      const r = await fetch(`https://router.project-osrm.org/route/v1/driving/${l.lng},${l.lat};${w.lng},${w.lat}?overview=simplified&geometries=geojson`, { signal: ctrl.signal });
      const j = await r.json(); const rt = j.routes?.[0]; if (!rt) throw 0;
      routeInfo[w.id] = { distance: rt.distance, duration: rt.duration };
      return { type: 'Feature', geometry: rt.geometry, properties: { color: w.color, approx: false } };
    } catch { delete routeInfo[w.id]; return straight(w); }
  }));
  if (seq !== routeSeq) return;
  map.getSource('routes')?.setData(fc(feats));
  renderDetail();
  const b = new maplibregl.LngLatBounds([l.lng, l.lat], [l.lng, l.lat]);
  feats.forEach(f => f.geometry.coordinates.forEach(c => b.extend(c)));
  map.fitBounds(b, { padding: IS_MOBILE ? { top: 80, bottom: innerHeight * 0.55, left: 30, right: 30 } : { top: 100, bottom: 60, left: 380, right: 410 }, duration: 900, maxZoom: 15, pitch: map.getPitch() });
}

// ---------------- compare ----------------
function toggleCompare(id) {
  if (S.compare.includes(id)) S.compare = S.compare.filter(x => x !== id);
  else { if (S.compare.length >= 6) { toast('เปรียบเทียบได้สูงสุด 6 แห่ง'); return; } S.compare.push(id); toast('เพิ่มในรายการเปรียบเทียบแล้ว — กดปุ่ม ⚖️ ด้านบนเพื่อเปิดแท็บเปรียบเทียบ'); }
  store('ynd-compare', S.compare); $('#cmp-n').textContent = S.compare.length; renderDetail(); pushLive();
}
function pushLive() {
  // ส่งค่าราคาล่าสุด + สถานการณ์ ให้แท็บเปรียบเทียบ
  const snap = {}; for (const id of S.compare) { const l = LISTING_BY_ID[id]; snap[id] = { rentMarket: l.rentMarket, rentAsk: l.rentAsk, salePrice: l.salePrice, ppsm: l.ppsm, history: l.history }; }
  store('ynd-live', { t: Date.now(), snap, flood: scen(), hour: S.hour, mode: S.mode, shops: Object.fromEntries(S.compare.filter(id => S.shops[id]).map(id => [id, { ...S.shops[id], points: undefined }])) });
}

// ---------------- flood ----------------
function onFloodChange() {
  S.flood.level = +$('#lv').value; S.flood.rain = +$('#rain').value;
  $('#lv-v').textContent = S.flood.level.toFixed(2); $('#rain-v').textContent = S.flood.rain;
  $('#flood-ctl').classList.toggle('hidden', !S.floodOn);
  updateGridDepth(); applyLayerVisibility(); renderFloodOrder(); invalidateScores(); renderList(); renderDetail(); pushLive();
}
function renderFloodOrder() {
  const lv = S.flood.level;
  const rows = DISTRICTS.map(d => ({ d, at: Math.max(0, d.elev - 0.15) })).sort((a, b) => a.at - b.at);
  $('#flood-order').innerHTML = rows.map(({ d, at }, i) => {
    const wet = lv >= at || floodDepthAt(d.lat, d.lng, scen()) > 0.05;
    return `<div style="display:flex;justify-content:space-between;padding:2px 0;${wet ? 'color:#0369a1;font-weight:600' : ''}"><span>${i + 1}. ${wet ? '🌊' : '·'} ${d.name}</span><span>${at.toFixed(2)} ม.</span></div>`;
  }).join('');
}
let playT = null;
function playFlood() {
  if (playT) { clearInterval(playT); playT = null; $('#flood-play').textContent = '▶ เล่น'; return; }
  $('#flood-play').textContent = '⏸ หยุด';
  let v = 0; $('#lv').value = 0;
  playT = setInterval(() => {
    v += 0.05; $('#lv').value = v; onFloodChange();
    if (v >= 2.6) { clearInterval(playT); playT = null; $('#flood-play').textContent = '▶ เล่น'; }
  }, settings.quality === 'low' ? 380 : 260);
}

// ---------------- traffic ----------------
const fmtHour = h => `${String(Math.floor(h)).padStart(2, '0')}:${h % 1 ? '30' : '00'} น.`;
function onTraffic() {
  S.hour = +$('#hr').value; S.weekend = $('#weekend').checked; $('#hr-v').textContent = fmtHour(S.hour) + ' · ' + trafficLabel(trafficTimeFactor(S.hour, S.weekend));
  if (map.getLayer('traffic')) map.setPaintProperty('traffic', 'line-color', trafficColorExpr());
  invalidateScores(); renderDetail(); renderLegend(); pushLive();
}
const trafficLabel = f => f > 0.8 ? 'ติดหนัก' : f > 0.6 ? 'ติดขัด' : f > 0.4 ? 'หนาแน่น' : 'คล่องตัว';

// ---------------- legend ----------------
function renderLegend() {
  const parts = [`<div><b>ประเภทที่พัก</b></div><div class="row" style="margin:4px 0 0">${Object.keys(TYPE_LABEL).map(t => `<span class="chip"><i style="width:8px;height:8px;border-radius:50%;background:${TYPE_COLOR[t]}"></i>${TYPE_LABEL[t]}</span>`).join('')}</div>`];
  if (S.floodOn) parts.push(`<div style="margin-top:8px"><b>ความลึกน้ำ</b><div class="grad" style="background:linear-gradient(90deg,#bae6fd,#38bdf8,#0284c7,#1e3a8a)"></div><div class="ends"><span>0</span><span>0.3</span><span>0.8</span><span>1.5+ ม.</span></div></div>`);
  else if (S.elevOn) parts.push(`<div style="margin-top:8px"><b>ระดับพื้นดิน (ม. รทก.)</b><div class="grad" style="background:linear-gradient(90deg,#60a5fa,#a7f3d0,#fde68a,#f59e0b,#b45309)"></div><div class="ends"><span>0</span><span>1.0</span><span>2.4+</span></div></div>`);
  if ($('#ly-traffic').checked) parts.push(`<div style="margin-top:8px"><b>จราจร ${fmtHour(S.hour)}</b><div class="grad" style="background:linear-gradient(90deg,#22c55e,#facc15,#f97316,#dc2626)"></div><div class="ends"><span>คล่อง</span><span>ติดหนัก</span></div></div>`);
  if ($('#ly-shops').checked) parts.push(`<div style="margin-top:8px"><b>ร้านค้า</b><div class="row" style="margin:4px 0 0">
    <span class="chip"><i style="width:10px;height:10px;border-radius:50%;background:#16a34a;border:2px solid #0f172a"></i>7-Eleven</span>
    <span class="chip"><i style="width:10px;height:10px;border-radius:50%;background:#f97316;border:2px solid #0f172a"></i>สะดวกซื้ออื่น</span>
    <span class="chip"><i style="width:8px;height:8px;border-radius:50%;background:#a855f7;opacity:.6"></i>ร้านทั่วไป</span></div></div>`);
  if ($('#ly-density').checked) parts.push(`<div style="margin-top:8px"><b>ความหนาแน่นประชากร</b><div class="grad" style="background:linear-gradient(90deg,#c7e9b4,#7fcdbb,#fed976,#fd8d3c,#bd0026)"></div><div class="ends"><span>น้อย</span><span>มาก</span></div></div>`);
  $('#legend').innerHTML = parts.join('');
}

// ---------------- live prices ----------------
DataProvider.onTick(changed => {
  const ids = new Set(changed.map(c => c.id));
  document.querySelectorAll('.item[data-id]').forEach(el => {
    if (!ids.has(el.dataset.id)) return;
    const l = LISTING_BY_ID[el.dataset.id];
    el.querySelector('[data-price]').firstChild.textContent = S.mode === 'buy' ? fmtMoneyShort(l.salePrice) : fmtBaht(l.rentMarket);
    el.classList.remove('flash-up', 'flash-down'); void el.offsetWidth; el.classList.add(l.lastChange >= 0 ? 'flash-up' : 'flash-down');
  });
  if (S.selected && ids.has(S.selected.id)) {
    const l = S.selected;
    $('#d-rm') && ($('#d-rm').textContent = fmtBaht(l.rentMarket)); $('#d-ra') && ($('#d-ra').textContent = fmtBaht(l.rentAsk));
    $('#d-sp') && l.salePrice && ($('#d-sp').textContent = fmtMoneyShort(l.salePrice)); $('#d-spark') && ($('#d-spark').innerHTML = spark(l.history));
  }
  const c = changed[0];
  $('#ticker').innerHTML = changed.slice(0, 3).map(l => `${l.name.split(' ').slice(0, 2).join(' ')} <b class="${l.lastChange >= 0 ? 'up' : 'down'}">${l.lastChange >= 0 ? '▲' : '▼'}${Math.abs(l.lastChange * 100).toFixed(1)}%</b>`).join(' · ')
    + ` <span class="small">· ${new Date().toLocaleTimeString('th-TH')}</span>`;
  if (S.compare.some(id => ids.has(id))) pushLive();
});
if (DATA_SOURCE === 'osm') {
  // ที่พักจริง: ไม่จำลองราคาวิ่ง เพื่อไม่ให้เข้าใจผิดว่าเป็นราคาสดจริง
  DataProvider.start(1e9);
  $('#live-badge').textContent = 'ราคาประมาณการ'; $('#live-badge').style.color = '#b45309';
  $('#ticker').textContent = `ที่พักจริง ${DATA_INFO.count.toLocaleString()} แห่ง (Overture ${DATA_INFO.overture.toLocaleString()} · OSM ${DATA_INFO.osm.toLocaleString()} · Google ${DATA_INFO.google.toLocaleString()} · เพิ่มเอง ${DATA_INFO.manual + DATA_INFO.mine})${DATA_INFO.googleExpired ? ' · ⚠️ ข้อมูล Google เกิน 30 วัน ต้องดึงใหม่' : ''}`;
}
else if (settings.livePrices) DataProvider.start(IS_MOBILE ? 7000 : 4000);
else { $('#live-badge').textContent = 'หยุดอัปเดต'; $('#ticker').textContent = 'ปิดการอัปเดตราคาสดในตั้งค่า'; DataProvider.start(1e9); }

// ---------------- settings modal ----------------
function openSettings() {
  const bg = document.createElement('div'); bg.className = 'modal-bg';
  bg.innerHTML = `<div class="modal glass"><h3>⚙️ ตั้งค่าการแสดงผล</h3>
    <h4 class="small">คุณภาพ (กิน RAM/GPU)</h4>
    <div class="seg" id="s-q"><button data-q="low">ประหยัด</button><button data-q="medium">ปกติ</button><button data-q="high">สวยสุด</button></div>
    <div class="small" style="margin:6px 0 10px">ประหยัด = ความละเอียดต่ำ, กริดน้ำท่วมหยาบ, ปิดขอบเรียบ — เหมาะกับมือถือ/โน้ตบุ๊ก</div>
    <label class="check"><input type="checkbox" id="s-aa" ${settings.antialias ? 'checked' : ''}> ขอบเรียบ (Antialias) <span class="small">— ต้องโหลดใหม่</span></label>
    <label class="check"><input type="checkbox" id="s-b3" ${settings.buildings3d ? 'checked' : ''}> แสดงอาคาร 3D อัตโนมัติในโหมด 3D</label>
    <label class="check"><input type="checkbox" id="s-live" ${settings.livePrices ? 'checked' : ''}> อัปเดตราคาสด</label>
    <label class="check"><input type="checkbox" id="s-sh" ${settings.shadows ? 'checked' : ''}> เงาในโหมดเดินสำรวจ (แมว)</label>
    <div class="row" style="margin-top:6px"><label>เฟรมเรตโหมดแมว</label><select class="field" id="s-fps" style="width:auto"><option>30</option><option>60</option></select></div>
    <div class="row" style="justify-content:flex-end;margin-top:12px"><button class="btn" id="s-cancel">ปิด</button><button class="btn primary" id="s-ok">บันทึก</button></div></div>`;
  document.body.appendChild(bg);
  let q = settings.quality;
  const sync = () => bg.querySelectorAll('#s-q button').forEach(b => b.classList.toggle('on', b.dataset.q === q));
  bg.querySelectorAll('#s-q button').forEach(b => b.onclick = () => { q = b.dataset.q; sync(); }); sync();
  bg.querySelector('#s-fps').value = String(settings.fpsCap);
  bg.querySelector('#s-cancel').onclick = () => bg.remove();
  bg.onclick = e => { if (e.target === bg) bg.remove(); };
  bg.querySelector('#s-ok').onclick = () => {
    const reload = q !== settings.quality || bg.querySelector('#s-aa').checked !== settings.antialias || bg.querySelector('#s-live').checked !== settings.livePrices;
    Object.assign(settings, { quality: q, antialias: bg.querySelector('#s-aa').checked, buildings3d: bg.querySelector('#s-b3').checked,
      livePrices: bg.querySelector('#s-live').checked, shadows: bg.querySelector('#s-sh').checked, fpsCap: +bg.querySelector('#s-fps').value });
    saveSettings(settings); bg.remove();
    if (reload) location.reload();
  };
}

// ---------------- cat explore ----------------
async function startCat(l) {
  toast('กำลังโหลดอาคาร ถนน และร้านค้ารอบ ๆ… (ใช้เวลาสักครู่)', 4000);
  // ต้องมีเลเยอร์ของแหล่ง omt แสดงอยู่ แผนที่ถึงจะโหลด tile อาคาร/ถนน → เปิดชั่วคราว แล้วซูม 15 ให้ครอบคลุมพื้นที่กว้าง
  vis('bld3d', true);
  map.jumpTo({ center: [l.lng, l.lat], zoom: 15, pitch: 0, bearing: 0 });
  await new Promise(r => map.once('idle', r));
  const feats = {
    buildings: map.querySourceFeatures('omt', { sourceLayer: 'building' }),
    roads: map.querySourceFeatures('omt', { sourceLayer: 'transportation' }),
    water: map.querySourceFeatures('omt', { sourceLayer: 'water' }),
    parks: map.querySourceFeatures('omt', { sourceLayer: 'park' }).concat(map.querySourceFeatures('omt', { sourceLayer: 'landcover' })),
  };
  applyLayerVisibility();
  const R = settings.quality === 'low' ? 0.4 : settings.quality === 'high' ? 0.9 : 0.65; // กม.
  const nearby = LISTINGS.filter(x => Math.abs(x.lat - l.lat) < R / 100 && Math.abs(x.lng - l.lng) < R / 100 && haversine(x, l) < R);
  await loadShopIndex();
  const shops = shopsNear(l, R * 1000, true);
  const mod = await import('./explore.js');
  mod.startExplore({
    center: l, listing: l, features: feats, flood: scen(), settings, nearby, shops,
    onSelect: id => setTimeout(() => select(LISTING_BY_ID[id]), 700),
    onExit: () => { applyDim(false); map.flyTo({ center: [l.lng, l.lat], zoom: 15, duration: 600 }); },
  });
}

// ---------------- UI wiring ----------------
function toast(msg, ms = 2600) {
  const t = document.createElement('div'); t.className = 'toast glass'; t.textContent = msg; document.body.appendChild(t);
  setTimeout(() => t.remove(), ms);
}
function switchTab(t) {
  document.querySelectorAll('#tabs button').forEach(b => b.classList.toggle('on', b.dataset.t === t));
  ['list', 'layers', 'work'].forEach(x => $('#pane-' + x).classList.toggle('hidden', x !== t));
  if (IS_MOBILE) $('#side').classList.remove('collapsed');
}

// regions
$('#region').innerHTML = REGIONS.map(r => `<option value="${r.id}" ${r.active ? '' : 'disabled'}>${r.name}${r.active ? '' : ' — Coming soon'}</option>`).join('');
// styles
$('#styles').innerHTML = Object.entries(STYLES).map(([k, v]) => `<button data-v="${k}" class="${k === S.style ? 'on' : ''}">${v.label}</button>`).join('');
$('#styles').onclick = e => e.target.dataset.v && setStyle(e.target.dataset.v);
$('#styles-m').innerHTML = Object.entries(STYLES).map(([k, v]) => `<option value="${k}">${v.label}</option>`).join('');
$('#styles-m').value = S.style; $('#styles-m').onchange = e => setStyle(e.target.value);
if (IS_MOBILE) $('#styles-m').style.display = '';
// dim
$('#dim').onclick = e => {
  if (!e.target.dataset.v) return; S.dim = e.target.dataset.v;
  if (S.dim === '3d' && settings.buildings3d && map.getZoom() > 13) $('#ly-bld').checked = true;
  applyDim();
};
$('#ly-bld').checked = settings.buildings3d && S.dim === '3d';
// tabs
$('#tabs').onclick = e => e.target.dataset.t && switchTab(e.target.dataset.t);
$('#grip').onclick = () => $('#side').classList.toggle('collapsed');
// list
$('#types').innerHTML = Object.entries(TYPE_LABEL).map(([k, v]) => `<label class="chip" style="cursor:pointer"><input type="checkbox" data-type="${k}" ${S.types.has(k) ? 'checked' : ''} style="accent-color:${TYPE_COLOR[k]}"> ${v}</label>`).join('');
$('#types').onchange = e => { const t = e.target.dataset.type; e.target.checked ? S.types.add(t) : S.types.delete(t); renderList(); };
$('#mode').onclick = e => {
  if (!e.target.dataset.v) return; S.mode = e.target.dataset.v;
  document.querySelectorAll('#mode button').forEach(b => b.classList.toggle('on', b.dataset.v === S.mode));
  setupPriceSlider(); invalidateScores(); renderList(); renderDetail(); pushLive();
};
$('#maxp').oninput = e => { const v = +e.target.value; S.maxPrice = v >= +e.target.max ? null : v; $('#maxp-v').textContent = S.maxPrice ? (S.mode === 'buy' ? fmtMoneyShort(v) : fmtBaht(v)) : 'ไม่จำกัด'; renderList(); };
$('#sort').onchange = e => { S.sort = e.target.value; renderList(); };
let qT; $('#q').oninput = e => { clearTimeout(qT); qT = setTimeout(() => { S.q = e.target.value; renderList(); switchTab('list'); }, 200); };
$('#list').onclick = e => { const it = e.target.closest('.item'); if (it) select(LISTING_BY_ID[it.dataset.id]); };
// layers
['ly-listings', 'ly-transit', 'ly-bld', 'ly-density', 'ly-shops'].forEach(id => $('#' + id).onchange = () => { applyLayerVisibility(); if (id === 'ly-shops') { if (S.selected) loadShops(S.selected); else showShopsInView(); } });
$('#ly-elev').onchange = e => { S.elevOn = e.target.checked; applyLayerVisibility(); };
$('#ly-flood').onchange = e => { S.floodOn = e.target.checked; onFloodChange(); };
$('#ly-traffic').onchange = e => { $('#traffic-ctl').classList.toggle('hidden', !e.target.checked); applyLayerVisibility(); onTraffic(); };
$('#lv').oninput = onFloodChange; $('#rain').oninput = onFloodChange; $('#flood-play').onclick = playFlood;
$('#hr').value = S.hour; $('#weekend').checked = S.weekend;
$('#hr').oninput = onTraffic; $('#weekend').onchange = onTraffic;
$('#hr-now').onclick = () => { const d = new Date(); $('#hr').value = d.getHours() + (d.getMinutes() >= 30 ? 0.5 : 0); $('#weekend').checked = [0, 6].includes(d.getDay()); onTraffic(); };
// workplaces
$('#add-wp').onclick = () => { S.addingWp = !S.addingWp; $('#add-wp').textContent = S.addingWp ? '✕ ยกเลิก (คลิกบนแผนที่เพื่อปักหมุด)' : '＋ ปักหมุดที่ทำงาน (คลิกบนแผนที่)'; map.getCanvas().style.cursor = S.addingWp ? 'crosshair' : ''; if (IS_MOBILE && S.addingWp) $('#side').classList.add('collapsed'); };
$('#wp-presets').innerHTML = WORK_PRESETS.map((p, i) => `<button class="btn sm" data-preset="${i}">${p.name}</button>`).join('');
$('#wp-presets').onclick = e => { const p = WORK_PRESETS[e.target.dataset.preset]; if (p) addWorkplace(p.lng, p.lat, p.name); };

// ---------------- ค้นหาสถานที่ทำงาน ----------------
// 1) สถานีรถไฟฟ้า + ย่านยอดนิยม (ในเครื่อง ทันที)  2) สถานที่ทั่วไปจาก Photon (ฟรี, ข้อมูล OpenStreetMap)
let wpResults = [], wpSeq = 0, wpT;
const PHOTON_ICON = { office: '🏢', building: '🏢', shop: '🛍️', amenity: '📍', tourism: '🏛️', railway: '🚆', highway: '🛣️', place: '🏘️', leisure: '🌳' };
function renderWpResults(loading) {
  $('#wp-results').innerHTML = wpResults.map((r, i) => `<div class="item" data-wpr="${i}" style="grid-template-columns:6px 1fr auto">
      <div class="bar" style="background:${r.local ? '#2f6bff' : '#94a3b8'}"></div>
      <div><div class="t">${r.icon || '📍'} ${esc(r.name)}</div><div class="m">${esc(r.sub || '')}</div></div>
      <div class="p" style="align-self:center"><span class="btn sm">＋ ปักหมุด</span></div></div>`).join('')
    + (loading ? '<div class="small">กำลังค้นหาสถานที่…</div>' : '')
    + (!loading && !wpResults.length && $('#wp-q').value.trim() ? '<div class="small">ไม่พบ — ลองพิมพ์ชื่ออื่น หรือกดปักหมุดบนแผนที่</div>' : '');
}
async function searchWorkplace(q) {
  q = q.trim(); const seq = ++wpSeq;
  if (q.length < 2) { wpResults = []; renderWpResults(); return; }
  const lq = q.toLowerCase();
  const seen = new Set();
  const local = [
    ...WORK_PRESETS.filter(p => p.name.toLowerCase().includes(lq)).map(p => ({ ...p, icon: '⭐', sub: 'ย่านธุรกิจ', local: true })),
    ...STATIONS.filter(s => s.name.toLowerCase().includes(lq) && !seen.has(s.name + s.line) && seen.add(s.name + s.line)).map(s => ({ name: 'สถานี' + s.name, lat: s.lat, lng: s.lng, icon: '🚇', sub: s.line, local: true })),
  ].slice(0, 6);
  wpResults = local; renderWpResults(true);
  try {
    const u = `https://photon.komoot.io/api/?q=${encodeURIComponent(q)}&limit=10&lat=13.75&lon=100.55&bbox=${BBOX.minLng},${BBOX.minLat},${BBOX.maxLng},${BBOX.maxLat}`;
    const j = await (await fetch(u)).json();
    if (seq !== wpSeq) return;
    const remote = (j.features || []).map(f => {
      const p = f.properties, [lng, lat] = f.geometry.coordinates;
      return { name: p.name || [p.housenumber, p.street].filter(Boolean).join(' '), lat, lng, icon: PHOTON_ICON[p.osm_key] || '📍',
        sub: [p.street, p.district || p.locality, p.city].filter(Boolean).filter((v, i, a) => a.indexOf(v) === i).join(', ') };
    }).filter(r => r.name);
    const key = r => r.name.toLowerCase() + '@' + r.lat.toFixed(2) + ',' + r.lng.toFixed(2);
    const have = new Set(local.map(key));
    wpResults = local.concat(remote.filter(r => !have.has(key(r)) && have.add(key(r))));
  } catch { if (seq !== wpSeq) return; }
  renderWpResults(false);
}
$('#wp-go').onclick = () => searchWorkplace($('#wp-q').value);
$('#wp-q').onkeydown = e => { if (e.key === 'Enter') searchWorkplace(e.target.value); };
$('#wp-q').oninput = e => { clearTimeout(wpT); wpT = setTimeout(() => searchWorkplace(e.target.value), 700); }; // หน่วงเวลา ไม่ยิงทุกตัวอักษร
$('#wp-results').onclick = e => {
  const it = e.target.closest('[data-wpr]'); if (!it) return;
  const r = wpResults[+it.dataset.wpr];
  addWorkplace(r.lng, r.lat, r.name.slice(0, 40));
  map.flyTo({ center: [r.lng, r.lat], zoom: Math.max(map.getZoom(), 13.5), duration: 800 });
  toast('ปักหมุด “' + r.name.slice(0, 30) + '” แล้ว');
  wpResults = []; $('#wp-q').value = ''; renderWpResults();
};
$('#wp-list').onclick = e => { if (e.target.dataset.wpDel) removeWp(e.target.dataset.wpDel); };
$('#wp-list').onchange = e => { const id = e.target.dataset.wpName; if (!id) return; const w = S.workplaces.find(x => x.id === id); w.name = e.target.value; wpMarkers[id].getElement().title = w.name; saveWps(); renderDetail(); };
$('#set-btn').onclick = openSettings;
$('#cmp-n').textContent = S.compare.length;
addEventListener('storage', e => { if (e.key === 'ynd-compare') { S.compare = (store('ynd-compare') || []).filter(id => LISTING_BY_ID[id]); $('#cmp-n').textContent = S.compare.length; renderDetail(); } });

// map interactions
const popup = new maplibregl.Popup({ closeButton: false, closeOnClick: false, offset: 10 });
map.on('mousemove', 'listings', e => {
  map.getCanvas().style.cursor = S.addingWp ? 'crosshair' : 'pointer';
  const l = LISTING_BY_ID[e.features[0].properties.id];
  popup.setLngLat([l.lng, l.lat]).setHTML(`<b>${l.name}</b><br><span class="small">${TYPE_LABEL[l.type]} · ${S.mode === 'buy' && l.salePrice ? fmtMoneyShort(l.salePrice) : fmtBaht(l.rentMarket) + '/ด.'}</span>`).addTo(map);
});
map.on('mouseleave', 'listings', () => { map.getCanvas().style.cursor = S.addingWp ? 'crosshair' : ''; popup.remove(); });
map.on('moveend', updateBoxes);
// กดที่กลุ่ม → ซูมเข้าไปจนกลุ่มแตก
map.on('click', 'listing-clusters', async e => {
  const f = e.features[0];
  const z = await map.getSource('listings').getClusterExpansionZoom(f.properties.cluster_id);
  map.easeTo({ center: f.geometry.coordinates, zoom: Math.min(z + 0.3, DETAIL_ZOOM + 0.5), duration: 600 });
});
map.on('mouseenter', 'listing-clusters', () => { map.getCanvas().style.cursor = 'pointer'; });
map.on('mouseleave', 'listing-clusters', () => { map.getCanvas().style.cursor = ''; });
map.on('mousemove', 'stations', e => { const p = e.features[0].properties; popup.setLngLat(e.lngLat).setHTML(`🚇 <b>${p.name}</b><br><span class="small">${p.line}</span>`).addTo(map); });
map.on('mouseleave', 'stations', () => popup.remove());
// ---------------- เพิ่มที่พักเอง (เก็บในเครื่องนี้) ----------------
let addingPlace = false;
$('#add-place').onclick = () => {
  addingPlace = !addingPlace;
  $('#add-place').textContent = addingPlace ? '✕ ยกเลิก — คลิกตำแหน่งที่พักบนแผนที่' : '＋ ไม่เจอที่พักของคุณ? เพิ่มเองบนแผนที่';
  map.getCanvas().style.cursor = addingPlace ? 'crosshair' : '';
  if (addingPlace) { toast('ซูมเข้าไปแล้วคลิกตำแหน่งของที่พักบนแผนที่'); if (IS_MOBILE) $('#side').classList.add('collapsed'); }
};
function openAddPlace(lngLat) {
  const bg = document.createElement('div'); bg.className = 'modal-bg';
  bg.innerHTML = `<div class="modal glass"><h3>＋ เพิ่มที่พัก</h3>
    <div class="small" style="margin-bottom:8px">📍 ${lngLat.lat.toFixed(5)}, ${lngLat.lng.toFixed(5)} · บันทึกไว้ในเบราว์เซอร์เครื่องนี้</div>
    <input class="field" id="ap-name" placeholder="ชื่อที่พัก *" style="margin-bottom:6px">
    <select class="field" id="ap-type" style="margin-bottom:6px">${Object.entries(TYPE_LABEL).map(([k, v]) => `<option value="${k}" ${k === 'apartment' ? 'selected' : ''}>${v}</option>`).join('')}</select>
    <div class="row"><input class="field" id="ap-rent" type="number" placeholder="ค่าเช่า/เดือน (บาท)" style="flex:1"><input class="field" id="ap-dep" type="number" placeholder="เงินประกัน" style="flex:1"></div>
    <input class="field" id="ap-addr" placeholder="ที่อยู่ / ซอย" style="margin:6px 0">
    <input class="field" id="ap-phone" placeholder="เบอร์โทร" style="margin-bottom:6px">
    <input class="field" id="ap-web" placeholder="ลิงก์ Facebook / เว็บไซต์" style="margin-bottom:6px">
    <input class="field" id="ap-am" placeholder="สิ่งอำนวยความสะดวก (คั่นด้วย ,)">
    <div class="row" style="justify-content:flex-end;margin-top:12px"><button class="btn" id="ap-cancel">ยกเลิก</button><button class="btn primary" id="ap-ok">บันทึก</button></div></div>`;
  document.body.appendChild(bg);
  bg.querySelector('#ap-cancel').onclick = () => bg.remove();
  bg.querySelector('#ap-ok').onclick = () => {
    const v = id => bg.querySelector(id).value.trim();
    if (!v('#ap-name')) { bg.querySelector('#ap-name').focus(); return; }
    const list = myPlaces();
    list.push({ id: 'u-' + Date.now().toString(36), name: v('#ap-name'), type: v('#ap-type'), lat: lngLat.lat, lng: lngLat.lng,
      rent: +v('#ap-rent') || null, deposit: +v('#ap-dep') || null, street: v('#ap-addr') || null, phone: v('#ap-phone') || null,
      website: v('#ap-web') || null, amenities: v('#ap-am') ? v('#ap-am').split(',').map(s => s.trim()).filter(Boolean) : null });
    store('ynd-myplaces', list); bg.remove(); toast('บันทึกแล้ว กำลังโหลดใหม่…'); setTimeout(() => location.reload(), 600);
  };
}
window.__removeMyPlace = id => removeMyPlace(id);
function removeMyPlace(id) { store('ynd-myplaces', myPlaces().filter(p => p.id !== id)); location.reload(); }

map.on('click', e => {
  if (addingPlace) { $('#add-place').click(); openAddPlace(e.lngLat); return; }
  if (S.addingWp) { addWorkplace(e.lngLat.lng, e.lngLat.lat); $('#add-wp').click(); switchTab('work'); return; }
  const f = map.queryRenderedFeatures(e.point, { layers: ['listings', 'listings-3d'].filter(id => map.getLayer(id)) })[0];
  if (f) { select(LISTING_BY_ID[f.properties.id]); return; }
  if (map.getLayer('grid') || S.floodOn || S.elevOn) {
    const e0 = elevationAt(e.lngLat.lat, e.lngLat.lng), d = floodDepthAt(e.lngLat.lat, e.lngLat.lng, scen());
    popup.setLngLat(e.lngLat).setHTML(`⛰️ ระดับพื้น ~${e0.toFixed(2)} ม.${S.floodOn ? `<br>🌊 น้ำลึก ~${d.toFixed(2)} ม.` : ''}`).addTo(map);
    setTimeout(() => popup.remove(), 2500);
  }
});

// init
setupPriceSlider(); renderWps(); S.workplaces.forEach(drawWpMarker); renderList(); renderFloodOrder(); onTraffic();
// โหลดร้านค้าทั้งเมืองเบื้องหลัง แล้วคำนวณคะแนน "ร้านค้า/สะดวกซื้อ" ใหม่ด้วยข้อมูลจริง
loadShopIndex().then(idx => { if (!idx) return; invalidateScores(); renderList(); if (S.selected) { delete S.shops[S.selected.id]; loadShops(S.selected); renderDetail(); } showShopsInView(); });
if (params.get('flood')) { $('#ly-flood').checked = true; S.floodOn = true; $('#lv').value = 1.2; switchTab('layers'); map.once('style.load', () => setTimeout(onFloodChange, 50)); }
if (IS_MOBILE) $('#side').classList.add('collapsed');
