import * as THREE from 'three';
import { DISTRICTS, RIVER, TRANSIT, REGIONS, CBD, haversine, mulberry32, loadSettings, saveSettings, IS_MOBILE } from './data.js';

const settings = loadSettings();
const Q = { low: { pr: 0.75, bld: 220, tex: 1024 }, medium: { pr: 1, bld: 600, tex: 2048 }, high: { pr: Math.min(devicePixelRatio, 2), bld: 1200, tex: 2048 } }[settings.quality];

// ---------- quality buttons ----------
document.querySelectorAll('#q-seg button').forEach(b => {
  b.classList.toggle('on', b.dataset.q === settings.quality);
  b.onclick = () => { settings.quality = b.dataset.q; saveSettings(settings); location.reload(); };
});

// ---------- projection ----------
const S = 10, C0 = { lng: 100.56, lat: 13.79 }, KX = Math.cos(13.75 * Math.PI / 180);
const px = lng => (lng - C0.lng) * S * KX;
const pz = lat => -(lat - C0.lat) * S;

// ---------- geography (simplified, stylised) ----------
const THAI = [[99.95,20.45],[100.55,20.15],[100.45,19.5],[101.2,19.6],[101.25,18.9],[101.05,18.4],[101.55,17.8],[102.1,18.2],[102.65,17.85],[103.3,18.4],[104.0,18.3],[104.75,17.45],[104.8,16.6],[105.4,16.0],[105.6,15.4],[105.5,14.4],[104.6,14.35],[103.6,14.4],[102.9,14.2],[102.6,13.6],[102.35,13.0],[102.6,12.4],[102.95,11.7],[102.3,12.2],[101.7,12.65],[100.95,12.7],[100.95,13.4],[100.6,13.5],[100.2,13.45],[99.95,13.2],[100.0,12.6],[99.95,12.1],[99.6,11.5],[99.3,10.6],[99.15,10.0],[99.25,9.3],[99.85,9.25],[100.1,8.5],[100.35,7.6],[100.6,7.2],[101.3,6.9],[102.1,6.2],[101.75,5.8],[101.1,6.25],[100.35,6.5],[100.1,6.45],[99.75,6.85],[99.4,7.4],[98.95,7.95],[98.3,7.8],[98.25,8.5],[98.3,9.2],[98.5,9.9],[98.75,10.7],[99.2,11.3],[99.4,12.2],[99.15,13.0],[99.1,13.8],[98.6,14.6],[98.2,15.2],[98.6,16.0],[98.6,16.6],[97.8,17.6],[97.6,18.4],[97.35,18.9],[97.8,19.8],[98.5,19.75],[99.3,20.1]];
const ANDAMAN = [[80,24],[94,19.5],[94.3,16],[95.5,15.8],[97.6,16.6],[97.8,15],[98.2,13.5],[98.6,12],[98.5,10.2],[98.5,9.9],[98.3,9.2],[98.25,8.5],[98.3,7.8],[98.95,7.95],[99.4,7.4],[99.75,6.85],[100.1,6.45],[100.3,5.5],[100.4,4],[101,2.5],[80,0]];
const GULF = [[100.6,13.5],[100.95,13.4],[100.95,12.7],[101.7,12.65],[102.3,12.2],[102.95,11.7],[103.1,11.0],[103.6,10.5],[104.4,10.4],[105,9],[106.5,9.5],[109,11.5],[109.3,14],[109.5,24],[120,24],[120,0],[104,1.3],[103.5,4],[103.4,5],[102.1,6.2],[101.3,6.9],[100.6,7.2],[100.35,7.6],[100.1,8.5],[99.85,9.25],[99.25,9.3],[99.15,10.0],[99.3,10.6],[99.6,11.5],[99.95,12.1],[100.0,12.6],[99.95,13.2],[100.2,13.45]];
const METRO = [[100.24,13.55],[100.40,13.50],[100.62,13.50],[100.78,13.56],[100.92,13.70],[100.90,13.92],[100.80,14.08],[100.60,14.12],[100.42,14.04],[100.26,13.90],[100.22,13.72]];

// ---------- renderer ----------
const canvas = document.getElementById('home-canvas');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: settings.quality !== 'low', powerPreference: 'low-power' });
renderer.setPixelRatio(Q.pr);
renderer.outputColorSpace = THREE.SRGBColorSpace;
const scene = new THREE.Scene();
scene.background = new THREE.Color('#dfe9f3');
scene.fog = new THREE.Fog('#dfe9f3', 60, 170);
const camera = new THREE.PerspectiveCamera(IS_MOBILE ? 48 : 36, 1, 0.5, 400);

scene.add(new THREE.HemisphereLight('#ffffff', '#b9c7d6', 1.6));
const sun = new THREE.DirectionalLight('#fff6e8', 1.6); sun.position.set(-30, 60, 25); scene.add(sun);

// ---------- map texture ----------
const MAPB = { w: 92, e: 112, s: 2, n: 22 };
function mapTexture(size) {
  const c = document.createElement('canvas'); c.width = c.height = size; const g = c.getContext('2d');
  const X = lng => (lng - MAPB.w) / (MAPB.e - MAPB.w) * size, Y = lat => (MAPB.n - lat) / (MAPB.n - MAPB.s) * size;
  const poly = (pts, fill, stroke, lw = 2) => { g.beginPath(); pts.forEach(([a, b], i) => i ? g.lineTo(X(a), Y(b)) : g.moveTo(X(a), Y(b))); g.closePath(); if (fill) { g.fillStyle = fill; g.fill(); } if (stroke) { g.strokeStyle = stroke; g.lineWidth = lw; g.stroke(); } };
  g.fillStyle = '#e9e4d6'; g.fillRect(0, 0, size, size);                      // neighbour land
  // sea with depth gradient
  const sea = g.createLinearGradient(0, 0, size, size); sea.addColorStop(0, '#9cc6e4'); sea.addColorStop(1, '#7fb2d9');
  poly(ANDAMAN, sea); poly(GULF, sea);
  // graticule
  g.strokeStyle = 'rgba(255,255,255,.35)'; g.lineWidth = 1;
  for (let lng = 92; lng <= 112; lng += 2) { g.beginPath(); g.moveTo(X(lng), 0); g.lineTo(X(lng), size); g.stroke(); }
  for (let lat = 2; lat <= 22; lat += 2) { g.beginPath(); g.moveTo(0, Y(lat)); g.lineTo(size, Y(lat)); g.stroke(); }
  // Thailand
  g.shadowColor = 'rgba(30,60,90,.25)'; g.shadowBlur = size / 200;
  poly(THAI, '#f6f1e3', '#c9b98f', size / 1100); g.shadowBlur = 0;
  // texture dots on Thailand (low-poly feel)
  const rnd = mulberry32(7);
  for (let i = 0; i < size * 1.2; i++) { const lng = 97 + rnd() * 9, lat = 5.5 + rnd() * 15; g.fillStyle = `rgba(150,175,120,${rnd() * 0.12})`; g.beginPath(); g.arc(X(lng), Y(lat), size / 400 * (1 + rnd() * 3), 0, 7); g.fill(); }
  // metro highlight footprint
  poly(METRO, 'rgba(47,107,255,.18)', 'rgba(47,107,255,.85)', size / 700);
  // labels
  g.fillStyle = 'rgba(40,90,140,.55)'; g.textAlign = 'center';
  g.font = `italic 600 ${size / 55}px "IBM Plex Sans Thai", sans-serif`;
  g.fillText('อ่าวไทย', X(101.3), Y(10.6)); g.fillText('ทะเลอันดามัน', X(96.0), Y(10.5)); g.fillText('ทะเลจีนใต้', X(108), Y(8));
  g.fillStyle = 'rgba(110,100,80,.55)'; g.font = `600 ${size / 70}px "IBM Plex Sans Thai", sans-serif`;
  g.fillText('เมียนมา', X(95.8), Y(19.5)); g.fillText('ลาว', X(103.2), Y(19.6)); g.fillText('กัมพูชา', X(104.6), Y(13.0)); g.fillText('เวียดนาม', X(107.3), Y(15.2)); g.fillText('มาเลเซีย', X(102.3), Y(4.2));
  g.fillStyle = 'rgba(120,100,60,.75)'; g.font = `700 ${size / 50}px "IBM Plex Sans Thai", sans-serif`; g.fillText('ประเทศไทย', X(101.6), Y(16.4));
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}
const mapW = (MAPB.e - MAPB.w) * S * KX, mapH = (MAPB.n - MAPB.s) * S;
let mapMat = new THREE.MeshLambertMaterial({ color: '#ffffff' });
const mapPlane = new THREE.Mesh(new THREE.PlaneGeometry(mapW, mapH), mapMat);
mapPlane.rotation.x = -Math.PI / 2;
mapPlane.position.set(px((MAPB.w + MAPB.e) / 2), 0, pz((MAPB.n + MAPB.s) / 2));
scene.add(mapPlane);
document.fonts.ready.then(() => { mapMat.map = mapTexture(Q.tex); mapMat.needsUpdate = true; });

// ---------- floating low-poly island (metro area) ----------
const F = 3.1, ISL_Y = 2.6, THICK = 0.9;
const IC = { lng: 100.57, lat: 13.80 };
const ix = lng => (lng - IC.lng) * S * KX * F, iz = lat => -(lat - IC.lat) * S * F;
const island = new THREE.Group();
island.position.set(px(IC.lng), ISL_Y, pz(IC.lat));
scene.add(island);

const shape = new THREE.Shape(METRO.map(([lng, lat]) => new THREE.Vector2(ix(lng), -iz(lat))));
const ext = new THREE.ExtrudeGeometry(shape, { depth: THICK, bevelEnabled: true, bevelThickness: 0.15, bevelSize: 0.25, bevelSegments: 1 });
ext.rotateX(-Math.PI / 2); ext.translate(0, -THICK, 0);
const islandMesh = new THREE.Mesh(ext, [new THREE.MeshLambertMaterial({ color: '#e4ecd8', flatShading: true }), new THREE.MeshLambertMaterial({ color: '#c3b493', flatShading: true })]);
island.add(islandMesh);

// soil layers under island (low poly rock)
const rock = new THREE.Mesh(new THREE.ConeGeometry(8.5, 4.5, 7, 1), new THREE.MeshLambertMaterial({ color: '#b9a57e', flatShading: true }));
rock.rotation.x = Math.PI; rock.scale.set(1.25, 1, 1.05); rock.position.y = -THICK - 2.3; island.add(rock);

// river ribbon
function ribbon(pts, width, color, y) {
  const verts = [], idx = [];
  for (let i = 0; i < pts.length; i++) {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)];
    const dx = b.x - a.x, dz = b.z - a.z, l = Math.hypot(dx, dz) || 1, nx = -dz / l * width / 2, nz = dx / l * width / 2;
    verts.push(pts[i].x + nx, y, pts[i].z + nz, pts[i].x - nx, y, pts[i].z - nz);
    if (i) { const k = i * 2; idx.push(k - 2, k - 1, k, k - 1, k + 1, k); }
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3)); g.setIndex(idx); g.computeVertexNormals();
  return new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide }));
}
island.add(ribbon(RIVER.filter(([lat]) => lat > 13.51 && lat < 14.1).map(([lat, lng]) => ({ x: ix(lng), z: iz(lat) })), 0.45, '#6fa8dc', 0.02));
for (const line of TRANSIT) island.add(ribbon(line.stations.map(s => ({ x: ix(s.lng), z: iz(s.lat) })), 0.12, line.color, 0.04));

// point in polygon
function inPoly(lng, lat, poly) { let c = false; for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) { const [xi, yi] = poly[i], [xj, yj] = poly[j]; if ((yi > lat) !== (yj > lat) && lng < (xj - xi) * (lat - yi) / (yj - yi) + xi) c = !c; } return c; }

// buildings (instanced, low poly)
const rnd = mulberry32(42);
const bGeo = new THREE.BoxGeometry(1, 1, 1); bGeo.translate(0, 0.5, 0);
const bMat = new THREE.MeshLambertMaterial({ color: '#ffffff', flatShading: true });
const blds = new THREE.InstancedMesh(bGeo, bMat, Q.bld);
const PAL = ['#f8fafc', '#e2e8f0', '#cbd5e1', '#bfd3ff', '#9db9ff', '#a7e3d8', '#ffd8a8', '#ffffff'];
const m4 = new THREE.Matrix4(), col = new THREE.Color();
let n = 0, guard = 0;
while (n < Q.bld && guard++ < Q.bld * 40) {
  const d = DISTRICTS[Math.floor(rnd() * DISTRICTS.length)];
  if (rnd() > d.density / 9000 + 0.15) continue;
  const lng = d.lng + (rnd() - 0.5) * 0.05, lat = d.lat + (rnd() - 0.5) * 0.05;
  if (!inPoly(lng, lat, METRO)) continue;
  const u = Math.max(0, 1 - haversine({ lat, lng }, CBD) / 18);
  const h = 0.12 + Math.pow(u, 2.5) * (0.6 + rnd() * 3.2) + rnd() * 0.2;
  const w = 0.16 + rnd() * 0.22 + u * 0.12;
  m4.compose(new THREE.Vector3(ix(lng), 0, iz(lat)), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), rnd() * 0.4), new THREE.Vector3(w, h, w * (0.7 + rnd() * 0.6)));
  blds.setMatrixAt(n, m4); blds.setColorAt(n, col.set(PAL[Math.floor(rnd() * PAL.length)]).multiplyScalar(u > 0.55 ? 1 : 0.97)); n++;
}
blds.count = n; island.add(blds);

// trees (green cones) for outer areas
const tGeo = new THREE.ConeGeometry(0.12, 0.35, 5); tGeo.translate(0, 0.17, 0);
const trees = new THREE.InstancedMesh(tGeo, new THREE.MeshLambertMaterial({ color: '#8cc084', flatShading: true }), Math.round(Q.bld * 0.6));
let tn = 0;
for (let i = 0; i < trees.count * 6 && tn < trees.count; i++) {
  const lng = 100.22 + rnd() * 0.7, lat = 13.5 + rnd() * 0.62;
  if (!inPoly(lng, lat, METRO) || haversine({ lat, lng }, CBD) < 9) continue;
  m4.compose(new THREE.Vector3(ix(lng), 0, iz(lat)), new THREE.Quaternion(), new THREE.Vector3(1, 0.7 + rnd() * 0.8, 1));
  trees.setMatrixAt(tn++, m4);
}
trees.count = tn; island.add(trees);

// "pop-out" guide lines from map footprint to island
const guideMat = new THREE.LineDashedMaterial({ color: '#2f6bff', dashSize: 0.3, gapSize: 0.25, transparent: true, opacity: 0.55 });
for (const [lng, lat] of METRO.filter((_, i) => i % 2 === 0)) {
  const g = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(px(lng), 0.02, pz(lat)), new THREE.Vector3(island.position.x + ix(lng), ISL_Y - THICK, island.position.z + iz(lat))]);
  const l = new THREE.Line(g, guideMat); l.computeLineDistances(); scene.add(l);
}
// soft shadow blob under island
const sc = document.createElement('canvas'); sc.width = sc.height = 128; const sg = sc.getContext('2d');
const rg = sg.createRadialGradient(64, 64, 4, 64, 64, 64); rg.addColorStop(0, 'rgba(20,40,70,.35)'); rg.addColorStop(1, 'rgba(20,40,70,0)'); sg.fillStyle = rg; sg.fillRect(0, 0, 128, 128);
const shadow = new THREE.Mesh(new THREE.PlaneGeometry(26, 24), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(sc), transparent: true, depthWrite: false }));
shadow.rotation.x = -Math.PI / 2; shadow.position.set(island.position.x + 1, 0.03, island.position.z + 1); scene.add(shadow);

// coming-soon pins
const pinGeo = new THREE.ConeGeometry(0.35, 1.1, 6); pinGeo.rotateX(Math.PI); pinGeo.translate(0, 0.55, 0);
const labelsEl = document.getElementById('labels');
const labels = [];
for (const r of REGIONS) {
  let pos;
  if (r.active) pos = new THREE.Vector3(island.position.x, ISL_Y + 4.2, island.position.z);
  else {
    const pin = new THREE.Mesh(pinGeo, new THREE.MeshLambertMaterial({ color: '#94a3b8', flatShading: true }));
    pin.position.set(px(r.center[0]), 0, pz(r.center[1])); scene.add(pin);
    const ball = new THREE.Mesh(new THREE.SphereGeometry(0.38, 8, 6), pin.material); ball.position.set(pin.position.x, 1.25, pin.position.z); scene.add(ball);
    pos = new THREE.Vector3(pin.position.x, 1.8, pin.position.z);
  }
  const el = document.createElement('div'); el.className = 'map-label ' + (r.active ? 'active' : 'soon'); el.textContent = r.active ? '📍 ' + r.name + ' →' : r.name;
  if (r.active) el.onclick = () => location.href = 'app.html';
  labelsEl.appendChild(el); labels.push({ el, pos });
}

// ---------- interaction ----------
const ray = new THREE.Raycaster(), mouse = new THREE.Vector2(); let hover = false, tx = 0, ty = 0;
addEventListener('pointermove', e => {
  mouse.set(e.clientX / innerWidth * 2 - 1, -e.clientY / innerHeight * 2 + 1); tx = mouse.x; ty = mouse.y;
  ray.setFromCamera(mouse, camera); hover = ray.intersectObjects([islandMesh, blds], false).length > 0;
  document.body.style.cursor = hover ? 'pointer' : '';
});
canvas.addEventListener('click', () => { if (hover) location.href = 'app.html'; });

function resize() {
  renderer.setSize(innerWidth, innerHeight, false); camera.aspect = innerWidth / innerHeight;
  // เลื่อนเฟรมให้เกาะอยู่ด้านขวาของหน้าจอ (เว้นที่ให้ข้อความ hero) / มือถือเลื่อนลงล่าง
  if (innerWidth > 760) camera.setViewOffset(innerWidth, innerHeight, -innerWidth * 0.2, 0, innerWidth, innerHeight);
  else camera.setViewOffset(innerWidth, innerHeight, 0, -innerHeight * 0.22, innerWidth, innerHeight);
  camera.updateProjectionMatrix();
}
addEventListener('resize', resize); resize();

// ---------- loop ----------
const target = new THREE.Vector3(island.position.x, ISL_Y - 1, island.position.z + (IS_MOBILE ? 3 : 0));
const clock = new THREE.Clock(); let acc = 0; const frameT = 1 / settings.fpsCap;
const v = new THREE.Vector3();
function loop() {
  requestAnimationFrame(loop);
  if (document.hidden) return;
  const dt = clock.getDelta(); acc += dt; if (acc < frameT * 0.9) return; acc = 0;
  const t = clock.elapsedTime;
  const ang = -0.55 + Math.sin(t * 0.08) * 0.22 + tx * 0.08;
  const R = IS_MOBILE ? 44 : 31;
  camera.position.set(target.x + Math.sin(ang) * R, 19 + ty * 3 + (IS_MOBILE ? 14 : 0), target.z + Math.cos(ang) * R);
  camera.lookAt(target);
  island.position.y = ISL_Y + Math.sin(t * 0.9) * 0.12;
  island.rotation.y = Math.sin(t * 0.25) * 0.02;
  islandMesh.material[0].color.set(hover ? '#dbe7ff' : '#e4ecd8');
  renderer.render(scene, camera);
  for (const l of labels) {
    v.copy(l.pos); if (l.el.classList.contains('active')) v.y = island.position.y + 4.2;
    v.project(camera);
    const vis = v.z < 1 && Math.abs(v.x) < 1.1 && Math.abs(v.y) < 1.1;
    l.el.style.display = vis ? '' : 'none';
    l.el.style.left = ((v.x + 1) / 2 * innerWidth) + 'px'; l.el.style.top = ((1 - v.y) / 2 * innerHeight) + 'px';
  }
}
loop();
