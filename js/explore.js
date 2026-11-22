// =============================================================
//  โหมดเดินสำรวจแบบแมว (มุมมองบุคคลที่สาม)
//  - สร้างเมือง 3D จากข้อมูลอาคาร/ถนนจริงของ OpenStreetMap รอบที่พักที่เลือก
//    ตึกมีหน้าต่าง/หลังคา · ถนนมีทางเท้า+เส้นแบ่งเลน · ต้นไม้ริมทาง · ป้ายชื่อที่พักและ 7-Eleven จริง
//  - มินิแมพ · เดินเข้าใกล้ที่พักแล้วกด E เพื่อดูข้อมูล
//  - โมเดลแมว: assets/cat/cat.glb (ถ้าไม่มี จะใช้แมวโลว์โพลีในตัว)
// =============================================================
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { floodDepthAt, IS_MOBILE, TYPE_LABEL, TYPE_COLOR, fmtBaht } from './data.js';

// cat.local.glb = โมเดลส่วนตัวในเครื่อง (ไม่อัปขึ้น GitHub) · cat.glb = Toon Cat FREE (CC BY 4.0) ที่เผยแพร่ได้
const CAT_FILES = ['assets/cat/cat.local.glb', 'assets/cat/cat.glb', 'assets/cat/scene.gltf', 'assets/cat/scene.glb'];
const CAT_CREDITS = {
  'assets/cat/cat.glb': '<a href="https://sketchfab.com/3d-models/toon-cat-free-b2bd1ee7858444bda366110a2d960386" target="_blank">Toon Cat FREE</a> โดย Omabuarts Studio (CC BY 4.0)',
  'assets/cat/cat.local.glb': '<a href="https://sketchfab.com/3d-models/an-animated-cat-aec25699660043a29595f9572149d1e8" target="_blank">An Animated Cat</a> (Sketchfab, CC BY 4.0) — ไฟล์ในเครื่อง',
};
const CAT_YAW_OFFSET = 0;     // ปรับได้ถ้าโมเดลหันผิดทิศ (เรเดียน)
const CAT_LENGTH = 8;         // เมตร — แมวยักษ์ขนาดรถบรรทุก มองเมืองง่าย เดินสำรวจสนุก
const CAT_W = CAT_LENGTH * 0.28; // ความกว้างลำตัว (ใช้ตรวจการชน)
const STEP_UP = CAT_LENGTH * 0.2; // ก้าวขึ้นสิ่งกีดขวางเตี้ยกว่านี้ได้เลย (เช่น ตึกแถวชั้นเดียว)
const ROAD_W = { motorway: 16, trunk: 14, primary: 12, secondary: 10, tertiary: 8, minor: 6, service: 4, track: 3, path: 2, rail: 3, transit: 3 };
const TYPE_EMOJI = { condo: '🏢', apartment: '🏬', dorm: '🛏️', house: '🏠', hotel: '🏨' };

// ---------- textures (วาดด้วย canvas ไม่ต้องโหลดไฟล์) ----------
function canvasTex(w, h, draw, repeat = true) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; } t.anisotropy = 4; return t;
}
// หน้าต่าง 1 ช่อง = กว้าง 4 ม. × สูง 1 ชั้น (3.2 ม.)
const texResidential = () => canvasTex(128, 102, (g, w, h) => {
  g.fillStyle = '#ffffff'; g.fillRect(0, 0, w, h);
  g.fillStyle = '#e8e8e8'; g.fillRect(0, h - 10, w, 10);                       // ขอบพื้นชั้น/ระเบียง
  g.fillStyle = '#5b6b7d'; g.fillRect(22, 18, 84, 52);                         // กระจก
  g.fillStyle = '#8fa3b8'; g.fillRect(26, 22, 36, 44);                         // แสงสะท้อน
  g.strokeStyle = '#d8d8d8'; g.lineWidth = 4; g.strokeRect(22, 18, 84, 52); g.beginPath(); g.moveTo(64, 18); g.lineTo(64, 70); g.stroke();
  g.fillStyle = '#c9c9c9'; g.fillRect(18, 72, 92, 6);                          // ราวระเบียง
});
const texOffice = () => canvasTex(128, 102, (g, w, h) => {
  const gr = g.createLinearGradient(0, 0, w, h); gr.addColorStop(0, '#6f8fae'); gr.addColorStop(1, '#3f5a78');
  g.fillStyle = gr; g.fillRect(0, 0, w, h);
  g.fillStyle = 'rgba(255,255,255,.18)'; g.fillRect(8, 8, 50, h - 26);
  g.fillStyle = '#dfe6ee'; g.fillRect(0, h - 12, w, 12); g.fillRect(w / 2 - 2, 0, 4, h);
});
const texShophouse = () => canvasTex(128, 102, (g, w, h) => {
  g.fillStyle = '#ffffff'; g.fillRect(0, 0, w, h);
  g.fillStyle = '#7a8796'; g.fillRect(30, 20, 30, 46); g.fillRect(70, 20, 30, 46);
  g.fillStyle = '#d6d6d6'; g.fillRect(0, h - 8, w, 8);
  g.fillStyle = '#b8b8b8'; for (let x = 0; x < w; x += 8) g.fillRect(x, 74, 4, 18);   // ประตูเหล็กม้วน/ลูกกรง
});
const texPavement = () => canvasTex(128, 128, (g, w, h) => {
  g.fillStyle = '#d4d0c6'; g.fillRect(0, 0, w, h);
  g.strokeStyle = '#c2bdb1'; g.lineWidth = 2; for (let i = 0; i <= w; i += 32) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i, h); g.stroke(); g.beginPath(); g.moveTo(0, i); g.lineTo(w, i); g.stroke(); }
});
function labelTex(lines, bg = 'rgba(255,255,255,.94)', fg = '#0f172a', accent = null) {
  return canvasTex(512, 160, (g, w, h) => {
    g.fillStyle = bg; g.beginPath(); g.roundRect(6, 6, w - 12, h - 34, 26); g.fill();
    if (accent) { g.fillStyle = accent; g.beginPath(); g.roundRect(6, 6, 22, h - 34, [26, 0, 0, 26]); g.fill(); }
    g.beginPath(); g.moveTo(w / 2 - 16, h - 28); g.lineTo(w / 2 + 16, h - 28); g.lineTo(w / 2, h - 4); g.fillStyle = bg; g.fill();
    g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = fg;
    // ย่อขนาดตัวอักษรให้พอดีป้าย (ชื่อยาวก็ไม่โดนตัด)
    const fit = (txt, weight, size, maxW) => { let s = size; do { g.font = `${weight} ${s}px "IBM Plex Sans Thai", sans-serif`; } while (g.measureText(txt).width > maxW && --s > 18); if (g.measureText(txt).width > maxW) { while (txt.length > 4 && g.measureText(txt + '…').width > maxW) txt = txt.slice(0, -1); txt += '…'; } return txt; };
    const t1 = fit(lines[0], 700, 44, w - 70); g.fillText(t1, w / 2 + 8, lines[1] ? 46 : 66);
    if (lines[1]) { g.fillStyle = '#475569'; const t2 = fit(lines[1], 500, 34, w - 70); g.fillText(t2, w / 2 + 8, 96); }
  }, false);
}

/** แยก ExtrudeGeometry เป็น [หลังคา, ผนัง] ตาม groups */
function splitCapsSides(g) {
  const out = [];
  for (const gr of g.groups) {
    const s = new THREE.BufferGeometry();
    for (const k of ['position', 'normal', 'uv', 'color']) {
      const a = g.attributes[k]; if (!a) continue;
      s.setAttribute(k, new THREE.BufferAttribute(a.array.slice(gr.start * a.itemSize, (gr.start + gr.count) * a.itemSize), a.itemSize));
    }
    out[gr.materialIndex] = s;
  }
  return out;
}

// =============================================================
//  X-ray: ส่วนของตึกที่อยู่ระหว่างกล้องกับแมว (ทรงกรวยรอบแนวสายตา) จะโปร่งใส 70%
//  ทำใน shader → ไม่ต้องแยกตึกทีละหลัง ไม่เปลืองเครื่อง
// =============================================================
const XRAY = {
  uCam: { value: new THREE.Vector3() }, uCat: { value: new THREE.Vector3() },
  uRadius: { value: CAT_LENGTH * 1.1 }, uFade: { value: 0.3 },
};
function xray(mat) {
  mat.transparent = true; // ต้องเปิดไว้เพื่อให้ผสมสีได้ (ส่วนที่ไม่โดนจะทึบ 100% ตามปกติ)
  mat.onBeforeCompile = sh => {
    Object.assign(sh.uniforms, XRAY);
    sh.vertexShader = 'varying vec3 vXrWPos;\n' + sh.vertexShader.replace('#include <project_vertex>',
      '#include <project_vertex>\n  vXrWPos = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    sh.fragmentShader = 'varying vec3 vXrWPos;\nuniform vec3 uCam; uniform vec3 uCat; uniform float uRadius; uniform float uFade;\n' +
      sh.fragmentShader.replace('#include <opaque_fragment>', `#include <opaque_fragment>
  {
    vec3 ab = uCat - uCam; float L = length(ab); vec3 dir = ab / max(L, 0.001);
    float t = dot(vXrWPos - uCam, dir);
    if (t > 0.0 && t < L - uRadius * 0.15) {
      float d = length(vXrWPos - (uCam + dir * t));
      float r = uRadius * (0.45 + 0.75 * t / L);           // กรวย: กว้างขึ้นเมื่อใกล้แมว
      float k = 1.0 - smoothstep(r * 0.8, r, d);
      gl_FragColor.a *= mix(1.0, uFade, k);
    }
  }`);
  };
  mat.customProgramCacheKey = () => 'xray';
  return mat;
}

export async function startExplore({ center, listing, features, flood, settings, onExit, onSelect, nearby = [], shops = null }) {
  const quality = settings.quality;
  const RADIUS = quality === 'low' ? 400 : quality === 'high' ? 900 : 650;

  // ---------- DOM ----------
  const root = document.createElement('div'); root.id = 'explore';
  root.innerHTML = `
    <canvas></canvas>
    <div class="ex-hud glass">🐈 <b>${listing.name}</b><br>
      ${IS_MOBILE ? 'จอยซ้าย = เดิน · ลากจอ = หมุนกล้อง · ปุ่ม ℹ️ = ดูข้อมูลที่พักใกล้ ๆ' : '<kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> เดิน · เมาส์ หมุนกล้อง · <kbd>Shift</kbd> วิ่ง · <kbd>Space</kbd> กระโดด · ล้อเมาส์ ซูม/มุมสูง · <kbd>E</kbd> ดูข้อมูล · <kbd>M</kbd> แผนที่ · <kbd>Esc</kbd> ออก'}</div>
    <button class="btn ex-exit">✕ ออกจากการสำรวจ</button>
    <canvas class="ex-mini glass" width="200" height="200"></canvas>
    <div class="ex-prompt glass hidden" id="ex-prompt"></div>
    <div class="ex-card glass hidden" id="ex-card"></div>
    <div class="ex-status glass" id="ex-status">กำลังสร้างเมือง…</div>
    <div class="ex-start"><div class="card glass"><h2>🐾 พร้อมออกเดินแล้ว</h2>
      <p class="small">${IS_MOBILE ? 'แตะเพื่อเริ่ม' : 'คลิกเพื่อเริ่ม — เมาส์จะถูกล็อกไว้สำหรับหมุนกล้อง (ถ้าล็อกไม่ได้ ให้กดลากเมาส์) · กด Esc เพื่อออก'}</p>
      <p class="small">ป้ายลอยบนตึก = ที่พักจริงรอบ ๆ · ป้ายเขียว = 7-Eleven · ลำแสงสีเหลือง = ที่พักที่คุณเลือก</p>
      <div class="small" id="ex-catnote"></div></div></div>
    ${IS_MOBILE ? '<div class="joy"><i></i></div><div class="mbtns"><button data-b="info">ℹ️</button><button data-b="run">วิ่ง</button><button data-b="jump">โดด</button></div>' : ''}`;
  document.body.appendChild(root);
  const canvas = root.querySelector('canvas');
  const status = root.querySelector('#ex-status');
  const startEl = root.querySelector('.ex-start');
  const promptEl = root.querySelector('#ex-prompt'), cardEl = root.querySelector('#ex-card');
  const mini = root.querySelector('.ex-mini'), mg = mini.getContext('2d');
  await new Promise(r => setTimeout(r, 30)); // ให้ DOM วาดก่อนเริ่มงานหนัก

  // ---------- three ----------
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: quality !== 'low', powerPreference: quality === 'high' ? 'high-performance' : 'low-power' });
  renderer.setPixelRatio(quality === 'low' ? 0.75 : quality === 'high' ? Math.min(devicePixelRatio, 2) : 1);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = !!settings.shadows && !IS_MOBILE;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const scene = new THREE.Scene();
  const skyCol = new THREE.Color('#bcd7ef');
  scene.background = skyCol; scene.fog = new THREE.Fog(skyCol, RADIUS * 0.45, RADIUS * 1.25);
  const camera = new THREE.PerspectiveCamera(60, 1, 0.1, RADIUS * 3);
  scene.add(new THREE.HemisphereLight('#ffffff', '#8d8a7e', 1.35));
  const sun = new THREE.DirectionalLight('#fff1d6', 2.0); sun.position.set(-80, 140, 60);
  if (renderer.shadowMap.enabled) {
    sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048); sun.shadow.bias = -0.0005;
    Object.assign(sun.shadow.camera, { left: -60, right: 60, top: 60, bottom: -60, near: 1, far: 400 });
  }
  scene.add(sun, sun.target);

  // ---------- projection ----------
  const lat0 = center.lat, lng0 = center.lng, KX = 111320 * Math.cos(lat0 * Math.PI / 180), KY = 110540;
  const toXZ = ([lng, lat]) => [(lng - lng0) * KX, -(lat - lat0) * KY];
  const near = c => { const [x, z] = toXZ(c); return x * x + z * z < RADIUS * RADIUS * 1.3; };
  const seen = new Set();
  const dedupe = f => { const c = JSON.stringify(f.geometry.coordinates).slice(0, 90) + (f.properties?.class || ''); if (seen.has(c)) return false; seen.add(c); return true; };
  const rnd = (() => { let s = 12345; return () => (s = (s * 16807) % 2147483647) / 2147483647; })();

  // ---------- ground ----------
  const pave = texPavement(); pave.repeat.set(RADIUS * 3 / 6, RADIUS * 3 / 6);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(RADIUS * 3, RADIUS * 3), new THREE.MeshLambertMaterial({ map: pave }));
  ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; scene.add(ground);

  const miniLines = [], miniPolys = []; // สำหรับวาดมินิแมพ

  function flatPolys(feats, color, y, keyName) {
    const geos = [];
    for (const f of feats) {
      if (!dedupe(f)) continue;
      const polys = f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.type === 'MultiPolygon' ? f.geometry.coordinates : [];
      for (const poly of polys) {
        if (!poly[0]?.length || !poly[0].some(near)) continue;
        const outer = poly[0].map(toXZ);
        const shape = new THREE.Shape(outer.map(([x, z]) => new THREE.Vector2(x, -z)));
        for (const h of poly.slice(1)) shape.holes.push(new THREE.Path(h.map(toXZ).map(([x, z]) => new THREE.Vector2(x, -z))));
        const g = new THREE.ShapeGeometry(shape); g.rotateX(-Math.PI / 2); g.translate(0, y, 0); geos.push(g);
        miniPolys.push({ pts: outer, kind: keyName });
      }
    }
    if (!geos.length) return null;
    const m = new THREE.Mesh(mergeGeometries(geos), new THREE.MeshLambertMaterial({ color })); m.receiveShadow = true; scene.add(m); return m;
  }
  const parkFeats = features.parks.filter(f => !f.properties?.class || ['park', 'grass', 'wood', 'forest', 'meadow', 'garden', 'recreation_ground', 'pitch', 'farmland', 'scrub', 'cemetery'].includes(f.properties.class) || f.properties.subclass);
  flatPolys(parkFeats, '#9ccc7c', 0.03, 'park');
  flatPolys(features.water, '#5fa6d8', 0.05, 'water');

  // ---------- roads: ทางเท้า + ผิวถนน + เส้นแบ่งเลน ----------
  const roadLines = []; // ใช้วางต้นไม้ริมทาง
  {
    const asphalt = [], walk = [], marks = [];
    const ribbon = (pts, w, y) => {
      const pos = [], idx = [];
      for (let i = 0; i < pts.length; i++) {
        const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)];
        const dx = b[0] - a[0], dz = b[1] - a[1], l = Math.hypot(dx, dz) || 1, nx = -dz / l * w / 2, nz = dx / l * w / 2;
        pos.push(pts[i][0] + nx, y, pts[i][1] + nz, pts[i][0] - nx, y, pts[i][1] - nz);
        if (i) { const k = i * 2; idx.push(k - 2, k, k - 1, k - 1, k, k + 1); }
      }
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
      return g;
    };
    const colorize = (g, hex) => { const col = new THREE.Color(hex), n = g.attributes.position.count, c = new Float32Array(n * 3); for (let i = 0; i < n; i++) { c[i * 3] = col.r; c[i * 3 + 1] = col.g; c[i * 3 + 2] = col.b; } g.setAttribute('color', new THREE.BufferAttribute(c, 3)); return g; };
    for (const f of features.roads) {
      if (!dedupe(f)) continue;
      const cls = f.properties?.class || 'minor'; if (f.properties?.brunnel === 'tunnel') continue;
      const w = ROAD_W[cls] || 5, isRail = cls === 'rail' || cls === 'transit', isPath = cls === 'path' || cls === 'track';
      const lines = f.geometry.type === 'LineString' ? [f.geometry.coordinates] : f.geometry.type === 'MultiLineString' ? f.geometry.coordinates : [];
      for (const line of lines) {
        if (!line.some(near)) continue;
        const pts = line.map(toXZ);
        miniLines.push({ pts, w });
        if (isRail) { asphalt.push(colorize(ribbon(pts, w, 0.1), '#7d7466')); continue; }
        if (!isPath) walk.push(colorize(ribbon(pts, w + 3.2, 0.06), '#e2ddd2'));
        asphalt.push(colorize(ribbon(pts, w, 0.09), isPath ? '#c9b99a' : w >= 10 ? '#3f444c' : w >= 6 ? '#555a62' : '#6c7178'));
        if (w >= 8) roadLines.push({ pts, w });
        else if (w >= 4) roadLines.push({ pts, w, sparse: true });
        // เส้นประกลางถนน
        if (w >= 6 && !isPath) {
          for (let i = 0; i < pts.length - 1; i++) {
            const [ax, az] = pts[i], [bx, bz] = pts[i + 1], L = Math.hypot(bx - ax, bz - az);
            for (let t = 1.5; t < L - 1.5; t += 7) {
              const t2 = Math.min(L, t + 3.2);
              marks.push(colorize(ribbon([[ax + (bx - ax) * t / L, az + (bz - az) * t / L], [ax + (bx - ax) * t2 / L, az + (bz - az) * t2 / L]], 0.25, 0.11), w >= 10 ? '#f2c94c' : '#f1f1f1'));
            }
          }
        }
      }
    }
    const add = (arr, rec) => { if (!arr.length) return; const m = new THREE.Mesh(mergeGeometries(arr), new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -rec, polygonOffsetUnits: -rec })); m.receiveShadow = true; scene.add(m); };
    add(walk, 1); add(asphalt, 2); add(marks, 3);
  }

  // ---------- buildings ----------
  const footprints = []; const GRID = 20; const hash = new Map();
  const addHash = fp => {
    for (let gx = Math.floor(fp.minX / GRID); gx <= Math.floor(fp.maxX / GRID); gx++)
      for (let gz = Math.floor(fp.minZ / GRID); gz <= Math.floor(fp.maxZ / GRID); gz++) { const k = gx + ',' + gz; if (!hash.has(k)) hash.set(k, []); hash.get(k).push(fp); }
  };
  const inside = (x, z, pts) => { let c = false; for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) { const [xi, zi] = pts[i], [xj, zj] = pts[j]; if ((zi > z) !== (zj > z) && x < (xj - xi) * (z - zi) / (zj - zi) + xi) c = !c; } return c; };
  function footprintAt(x, z) {
    const list = hash.get(Math.floor(x / GRID) + ',' + Math.floor(z / GRID)); if (!list) return null;
    let best = null;
    for (const fp of list) if (x >= fp.minX && x <= fp.maxX && z >= fp.minZ && z <= fp.maxZ && inside(x, z, fp.pts)) if (!best || fp.h > best.h) best = fp;
    return best;
  }
  function blockedAt(x, z, y, step = 0.35) { const fp = footprintAt(x, z); return fp && fp.base <= y + 0.1 && fp.h > y + step ? fp : null; }
  // ลำตัวแมว: ตรวจหลายจุดรอบตัว (หัว/ก้น/ซ้าย/ขวา) ไม่ให้ตัวทะลุผนัง
  function bodyBlocked(x, z, y, hd) {
    const c = Math.cos(hd), s = Math.sin(hd), hl = CAT_LENGTH * 0.45, hw = CAT_W / 2;
    for (const [u, v] of [[0, 0], [hl, 0], [-hl, 0], [hl * 0.5, hw], [hl * 0.5, -hw], [-hl * 0.5, hw], [-hl * 0.5, -hw]])
      if (blockedAt(x + s * u + c * v, z + c * u - s * v, y, STEP_UP)) return true;
    return false;
  }
  const groundAt = (x, z, y) => { const fp = footprintAt(x, z); return fp && fp.h <= y + STEP_UP + 0.1 ? fp.h : 0; };

  let homeFP = null;
  {
    const WALL = ['#f5f1e8', '#eae4d8', '#e3e8ee', '#f3e6d3', '#e6ece4', '#efe7f1', '#f8efe2', '#dcd6cc', '#f0dcc8', '#d9e2ea'];
    const ROOF = ['#b5aea2', '#a39e95', '#9aa4ad', '#b9a38a', '#8f969c', '#c2b8a8'];
    const walls = { res: [], office: [], shop: [] }, roofs = [];
    const makeBuilding = (outer, holes, h, base, kind, wallHex, roofHex) => {
      const shape = new THREE.Shape(outer.map(([x, z]) => new THREE.Vector2(x, -z)));
      for (const hole of holes) shape.holes.push(new THREE.Path(hole.map(([x, z]) => new THREE.Vector2(x, -z))));
      const g = new THREE.ExtrudeGeometry(shape, { depth: h - base, bevelEnabled: false }); g.rotateX(-Math.PI / 2); g.translate(0, base, 0);
      const ng = g.index ? g.toNonIndexed() : g;
      ng.groups = g.groups; // toNonIndexed ของ Extrude ยังคง groups เดิม
      const [cap, side] = splitCapsSides(ng);
      const tint = (geo, hex) => { const col = new THREE.Color(hex), n = geo.attributes.position.count, c = new Float32Array(n * 3); for (let i = 0; i < n; i++) { c[i * 3] = col.r; c[i * 3 + 1] = col.g; c[i * 3 + 2] = col.b; } geo.setAttribute('color', new THREE.BufferAttribute(c, 3)); return geo; };
      if (side) {
        // UV ของผนังเป็นหน่วยเมตร (u ตามแนวผนัง, v ตามความสูง) → ใช้ texture.repeat ทำเป็นหน้าต่างทีละชั้น
        const uv = side.attributes.uv; if (uv) for (let i = 0; i < uv.count; i++) uv.setY(i, uv.getY(i) - base);
        walls[kind].push(tint(side, wallHex));
      }
      if (cap) { cap.deleteAttribute('uv'); roofs.push(tint(cap, roofHex)); }
    };
    for (const f of features.buildings) {
      if (!dedupe(f)) continue;
      const polys = f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.type === 'MultiPolygon' ? f.geometry.coordinates : [];
      for (const poly of polys) {
        if (!poly[0] || poly[0].length < 4 || !poly[0].some(near)) continue;
        const outer = poly[0].map(toXZ);
        let minX = 1e9, maxX = -1e9, minZ = 1e9, maxZ = -1e9; for (const [x, z] of outer) { minX = Math.min(minX, x); maxX = Math.max(maxX, x); minZ = Math.min(minZ, z); maxZ = Math.max(maxZ, z); }
        const area = (maxX - minX) * (maxZ - minZ);
        const seed = Math.abs(Math.sin(minX * 12.9 + minZ * 78.2)) % 1;
        let h = f.properties?.render_height || 0;
        if (h <= 6) h = area > 1500 ? 9 + seed * 30 : area > 300 ? 6.5 + seed * 9 : 3.4 + seed * 4; // OSM ไทยส่วนใหญ่ไม่มีความสูง → เดาจากขนาด
        const base = f.properties?.render_min_height || 0;
        if (h - base < 1) continue;
        const isHome = !homeFP && inside(0, 0, outer);
        if (isHome) h = Math.max(h, (listing.floors || 5) * 3.2);
        const kind = h > 45 ? 'office' : h < 12 && area < 400 ? 'shop' : 'res';
        makeBuilding(outer, poly.slice(1).map(hh => hh.map(toXZ)), h, base, kind, isHome ? '#ffd166' : WALL[Math.floor(seed * WALL.length)], isHome ? '#f4a259' : ROOF[Math.floor(seed * 7.3 % 1 * ROOF.length)]);
        const fp = { pts: outer, h, base, minX, maxX, minZ, maxZ }; footprints.push(fp); addHash(fp);
        if (isHome) homeFP = fp;
      }
    }
    // ===== เติมอาคารในจุดที่ OSM ยังไม่มีข้อมูล =====
    // ดัชนีถนน: กันไม่ให้ตึกที่เติมไปวางทับถนน/ทางเท้า
    const SEG = 16, segHash = new Map();
    for (const r of miniLines) for (let i = 0; i < r.pts.length - 1; i++) {
      const [ax, az] = r.pts[i], [bx, bz] = r.pts[i + 1], s = { ax, az, bx, bz, hw: r.w / 2 + 1.9, w: r.w };
      for (let gx = Math.floor(Math.min(ax, bx) / SEG); gx <= Math.floor(Math.max(ax, bx) / SEG); gx++)
        for (let gz = Math.floor(Math.min(az, bz) / SEG); gz <= Math.floor(Math.max(az, bz) / SEG); gz++) { const k = gx + ',' + gz; if (!segHash.has(k)) segHash.set(k, []); segHash.get(k).push(s); }
    }
    const segDist = (x, z, s) => { const dx = s.bx - s.ax, dz = s.bz - s.az, L2 = dx * dx + dz * dz || 1; const t = Math.max(0, Math.min(1, ((x - s.ax) * dx + (z - s.az) * dz) / L2)); return Math.hypot(x - s.ax - dx * t, z - s.az - dz * t); };
    const roadClear = (x, z) => { for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) for (const s of segHash.get((Math.floor(x / SEG) + i) + ',' + (Math.floor(z / SEG) + j)) || []) if (segDist(x, z, s) < s.hw) return false; return true; };
    const nearestRoad = (x, z, maxD = 60) => { let best = null, bd = maxD; for (const s of miniLines.length ? [...new Set([].concat(...[-3, -2, -1, 0, 1, 2, 3].flatMap(i => [-3, -2, -1, 0, 1, 2, 3].map(j => segHash.get((Math.floor(x / SEG) + i) + ',' + (Math.floor(z / SEG) + j)) || []))))] : []) { const d = segDist(x, z, s); if (d < bd) { bd = d; best = s; } } return best ? { ang: Math.atan2(best.bz - best.az, best.bx - best.ax), d: bd } : null; };
    const rect = (cx, cz, w, d, ang) => { const c = Math.cos(ang), s = Math.sin(ang), hw = w / 2, hd = d / 2; return [[-hw, -hd], [hw, -hd], [hw, hd], [-hw, hd]].map(([u, v]) => [cx + u * c - v * s, cz + u * s + v * c]); };
    const rectFree = (pts, cx, cz) => [...pts, [cx, cz], ...pts.map((p, i) => [(p[0] + pts[(i + 1) % 4][0]) / 2, (p[1] + pts[(i + 1) % 4][1]) / 2])]
      .every(([x, z]) => roadClear(x, z) && !footprintAt(x, z) && x * x + z * z < RADIUS * RADIUS);
    const addFP = (outer, h, kind, wall, roof) => {
      makeBuilding(outer, [], h, 0, kind, wall, roof);
      let minX = 1e9, maxX = -1e9, minZ = 1e9, maxZ = -1e9; for (const [x, z] of outer) { minX = Math.min(minX, x); maxX = Math.max(maxX, x); minZ = Math.min(minZ, z); maxZ = Math.max(maxZ, z); }
      const fp = { pts: outer, h, base: 0, minX, maxX, minZ, maxZ, gen: true }; footprints.push(fp); addHash(fp); return fp;
    };
    const DIMS = { condo: [26, 18, 8, 28], apartment: [16, 12, 4, 8], dorm: [15, 11, 4, 7], hotel: [22, 14, 6, 14], house: [9, 8, 2, 2] }; // กว้าง, ลึก, ชั้นต่ำสุด, ชั้นสูงสุด
    var listingFP = new Map(); // id ที่พัก → ตึกที่สร้างให้
    const placeListing = (l, x, z, wallHex, roofHex) => {
      const [w0, d0, f1, f2] = DIMS[l.type] || DIMS.apartment;
      const floors = l.floorsKnown ? l.floors : f1 + Math.floor(rnd() * (f2 - f1 + 1));
      const ang = nearestRoad(x, z)?.ang || 0;
      for (const sc of [1, 0.75, 0.55]) for (const [ox, oz] of [[0, 0], [6, 0], [-6, 0], [0, 6], [0, -6], [9, 9], [-9, -9]]) {
        const cx = x + ox, cz = z + oz, pts = rect(cx, cz, w0 * sc, d0 * sc, ang);
        if (rectFree(pts, cx, cz)) return addFP(pts, floors * 3.2, floors > 14 ? 'office' : 'res', wallHex, roofHex);
      }
      return null;
    };
    if (!homeFP) homeFP = placeListing(listing, 0, 0, '#ffd166', '#f4a259');
    if (!homeFP) { const pts = rect(0, 0, 14, 10, 0); homeFP = addFP(pts, (listing.floors || 5) * 3.2, 'res', '#ffd166', '#f4a259'); }
    // (1) ที่พักจริงทุกแห่งรอบ ๆ ที่ OSM ไม่มีอาคาร → สร้างตึกตามประเภท
    let genListing = 0;
    for (const l of nearby) {
      if (l.id === listing.id) continue;
      const [x, z] = toXZ([l.lng, l.lat]); if (x * x + z * z > RADIUS * RADIUS || footprintAt(x, z)) continue;
      const fp = placeListing(l, x, z, WALL[Math.floor(rnd() * WALL.length)], ROOF[Math.floor(rnd() * ROOF.length)]);
      if (fp) { genListing++; listingFP.set(l.id, fp); }
    }
    // (2) ตึกแถว/บ้านเรียงริมซอยในช่องที่ยังว่าง (ภาพรวมย่าน — ไม่ใช่ข้อมูลรายหลังจริง)
    const SHOP_WALL = ['#f3e3cf', '#e9d7c3', '#dfe7ef', '#f0e6d8', '#e7ddd0', '#f6efe0', '#d8e4dc', '#f2d9cf', '#e3d9ee'];
    const fillMax = quality === 'low' ? 1000 : quality === 'high' ? 6000 : 2800;
    let genFill = 0;
    // เติมจากถนนที่ใกล้ที่พักที่สุดก่อน ไล่ออกไป
    const roadsByDist = miniLines.filter(r => r.w >= 4 && r.w <= 12).map(r => ({ r, d: Math.min(...r.pts.map(([x, z]) => Math.hypot(x, z))) })).sort((a, b) => a.d - b.d).map(o => o.r);
    for (const r of roadsByDist) {
      if (genFill >= fillMax) break;
      const depth = r.w >= 9 ? 14 : 11, off = r.w / 2 + 2.1 + depth / 2;
      for (let i = 0; i < r.pts.length - 1 && genFill < fillMax; i++) {
        const [ax, az] = r.pts[i], [bx, bz] = r.pts[i + 1], L = Math.hypot(bx - ax, bz - az); if (L < 6) continue;
        const ang = Math.atan2(bz - az, bx - ax), nx = -(bz - az) / L, nz = (bx - ax) / L;
        let run = 0, floors = 2;
        for (let t = 3; t < L - 3; t += 4.4) {
          if (run-- <= 0) { run = 3 + Math.floor(rnd() * 6); floors = 2 + Math.floor(rnd() * 3); } // ตึกแถวเป็นช่วง ๆ ความสูงเท่ากัน
          for (const sg of [1, -1]) {
            if (rnd() < 0.12) continue;
            const cx = ax + (bx - ax) * t / L + nx * off * sg, cz = az + (bz - az) * t / L + nz * off * sg;
            const pts = rect(cx, cz, 4.2, depth, ang);
            if (!rectFree(pts, cx, cz)) continue;
            addFP(pts, floors * 3.4 + (rnd() < 0.3 ? 1.2 : 0), 'shop', SHOP_WALL[Math.floor(rnd() * SHOP_WALL.length)], ROOF[Math.floor(rnd() * ROOF.length)]);
            genFill++;
          }
        }
      }
    }
    var GEN_INFO = { genListing, genFill };
    const mats = {
      res: new THREE.MeshLambertMaterial({ map: texResidential(), vertexColors: true }),
      office: new THREE.MeshLambertMaterial({ map: texOffice(), vertexColors: true }),
      shop: new THREE.MeshLambertMaterial({ map: texShophouse(), vertexColors: true }),
    };
    for (const m of Object.values(mats)) { m.map.repeat.set(1 / 4, 1 / 3.2); xray(m); }
    for (const [k, arr] of Object.entries(walls)) if (arr.length) {
      const m = new THREE.Mesh(mergeGeometries(arr), mats[k]); m.castShadow = m.receiveShadow = renderer.shadowMap.enabled; scene.add(m);
    }
    if (roofs.length) { const m = new THREE.Mesh(mergeGeometries(roofs), xray(new THREE.MeshLambertMaterial({ vertexColors: true }))); m.castShadow = m.receiveShadow = renderer.shadowMap.enabled; scene.add(m); }
  }
  const homeC = { x: (homeFP.minX + homeFP.maxX) / 2, z: (homeFP.minZ + homeFP.maxZ) / 2 };
  // ลำแสงเหนือที่พักที่เลือก (มองเห็นจากไกล ใช้เป็นจุดหมาย)
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.2, 160, 12, 1, true), new THREE.MeshBasicMaterial({ color: '#ffd166', transparent: true, opacity: 0.35, depthWrite: false, side: THREE.DoubleSide }));
  beam.position.set(homeC.x, homeFP.h + 80, homeC.z); scene.add(beam);

  // ---------- ต้นไม้: ริมถนน + ในสวน ----------
  {
    const tCount = quality === 'low' ? 250 : quality === 'high' ? 1400 : 700;
    const trunk = new THREE.CylinderGeometry(0.15, 0.22, 2.4, 5); trunk.translate(0, 1.2, 0);
    const crown = new THREE.IcosahedronGeometry(1.8, 0); crown.translate(0, 3.6, 0);
    const im1 = new THREE.InstancedMesh(trunk, new THREE.MeshLambertMaterial({ color: '#7b5b3e' }), tCount);
    const im2 = new THREE.InstancedMesh(crown, new THREE.MeshLambertMaterial({ color: '#6fae5b', flatShading: true }), tCount);
    const m4 = new THREE.Matrix4(), col = new THREE.Color(); let n = 0;
    const place = (x, z, s) => { if (n >= tCount || blockedAt(x, z, 0) || Math.hypot(x - homeC.x, z - homeC.z) < 4 || x * x + z * z > RADIUS * RADIUS) return; m4.makeScale(s, s, s).setPosition(x, 0, z); im1.setMatrixAt(n, m4); im2.setMatrixAt(n, m4); im2.setColorAt(n, col.setHSL(0.27 + rnd() * 0.06, 0.45, 0.38 + rnd() * 0.12)); n++; };
    for (const { pts, w, sparse } of roadLines) {
      const step = sparse ? 22 : 13, off = w / 2 + 2.2;
      for (let i = 0; i < pts.length - 1 && n < tCount; i++) {
        const [ax, az] = pts[i], [bx, bz] = pts[i + 1], L = Math.hypot(bx - ax, bz - az); if (L < 1) continue;
        const nx = -(bz - az) / L, nz = (bx - ax) / L;
        for (let t = rnd() * step; t < L; t += step) for (const sgn of [1, -1]) if (rnd() < 0.8) place(ax + (bx - ax) * t / L + nx * off * sgn, az + (bz - az) * t / L + nz * off * sgn, 0.75 + rnd() * 0.5);
      }
    }
    for (const p of miniPolys) if (p.kind === 'park') {
      let minX = 1e9, maxX = -1e9, minZ = 1e9, maxZ = -1e9; for (const [x, z] of p.pts) { minX = Math.min(minX, x); maxX = Math.max(maxX, x); minZ = Math.min(minZ, z); maxZ = Math.max(maxZ, z); }
      const k = Math.min(40, Math.round((maxX - minX) * (maxZ - minZ) / 250));
      for (let i = 0; i < k; i++) { const x = minX + rnd() * (maxX - minX), z = minZ + rnd() * (maxZ - minZ); if (inside(x, z, p.pts)) place(x, z, 0.8 + rnd() * 0.7); }
    }
    im1.count = im2.count = n; im2.castShadow = renderer.shadowMap.enabled; scene.add(im1, im2);
  }

  // ---------- ป้ายที่พักจริงรอบ ๆ + 7-Eleven ----------
  const signs = [];
  const roofAt = (x, z) => { const fp = footprintAt(x, z); return fp ? fp.h : 0; };
  // ความสูงหลังคาสูงสุดในรัศมี r ม. (ป้ายจะได้ลอยพ้นตึกข้าง ๆ ไม่จมหาย)
  const maxRoofNear = (x, z, r = 14) => { let m = roofAt(x, z); for (let a = 0; a < 8; a++) for (const rr of [r * 0.5, r]) m = Math.max(m, roofAt(x + Math.cos(a * 0.785) * rr, z + Math.sin(a * 0.785) * rr)); return m; };
  const pins = nearby.filter(l => l.id !== listing.id).map(l => { const [x, z] = toXZ([l.lng, l.lat]); return { l, x, z, d: Math.hypot(x, z) }; })
    .filter(p => p.d < RADIUS).sort((a, b) => a.d - b.d).slice(0, quality === 'low' ? 60 : quality === 'high' ? 250 : 140);
  for (const p of pins) {
    const price = p.l.rentMarket ? fmtBaht(p.l.rentMarket) + '/ด.' + (p.l.priceEstimated ? ' (ประมาณ)' : '') : '';
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: labelTex([(TYPE_EMOJI[p.l.type] || '📍') + ' ' + p.l.name, price], 'rgba(255,255,255,.95)', '#0f172a', TYPE_COLOR[p.l.type]), depthWrite: false }));
    const gfp = listingFP.get(p.l.id); // ถ้าสร้างตึกให้ที่พักนี้ (อาจขยับจากจุดเดิม) ให้ป้ายอยู่กลางตึกนั้น
    if (gfp) { p.x = (gfp.minX + gfp.maxX) / 2; p.z = (gfp.minZ + gfp.maxZ) / 2; }
    sp.scale.set(14, 4.4, 1); sp.position.set(p.x, maxRoofNear(p.x, p.z) + 7, p.z); sp.renderOrder = 2; scene.add(sp);
    signs.push({ sp, x: p.x, z: p.z, l: p.l, kind: 'listing' });
  }
  {
    // ที่พักที่เลือกเอง
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: labelTex(['⭐ ' + listing.name, listing.rentMarket ? fmtBaht(listing.rentMarket) + '/ด.' : ''], '#ffd166', '#0f172a'), depthTest: false }));
    sp.scale.set(16, 5, 1); sp.position.set(homeC.x, homeFP.h + 7, homeC.z); sp.renderOrder = 3; scene.add(sp);
    signs.push({ sp, x: homeC.x, z: homeC.z, l: listing, kind: 'home' });
  }
  if (shops?.points) {
    const sevenTex = canvasTex(128, 128, (g) => { g.fillStyle = '#0f8a4a'; g.beginPath(); g.roundRect(8, 8, 112, 112, 22); g.fill(); g.fillStyle = '#f97316'; g.fillRect(8, 74, 112, 14); g.fillStyle = '#e11d48'; g.fillRect(8, 90, 112, 12); g.fillStyle = '#fff'; g.font = '900 60px sans-serif'; g.textAlign = 'center'; g.fillText('7', 64, 66); }, false);
    const convTex = canvasTex(128, 128, (g) => { g.fillStyle = '#f97316'; g.beginPath(); g.roundRect(8, 8, 112, 112, 22); g.fill(); g.fillStyle = '#fff'; g.font = '700 64px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('🏪', 64, 66); }, false);
    const sevenMat = new THREE.SpriteMaterial({ map: sevenTex }), convMat = new THREE.SpriteMaterial({ map: convTex });
    for (const s of shops.points) {
      if (s.kind === 'shop') continue;
      const [x, z] = toXZ([s.lng, s.lat]); if (x * x + z * z > RADIUS * RADIUS) continue;
      const sp = new THREE.Sprite(s.kind === 'seven' ? sevenMat : convMat); sp.scale.set(2.6, 2.6, 1); sp.position.set(x, 3.4, z); scene.add(sp);
      signs.push({ sp, x, z, kind: s.kind });
    }
  }

  // ---------- flood water ----------
  let water = null;
  const depth0 = floodDepthAt(center.lat, center.lng, flood);
  if (depth0 > 0.02) {
    water = new THREE.Mesh(new THREE.PlaneGeometry(RADIUS * 3, RADIUS * 3), new THREE.MeshLambertMaterial({ color: '#4f8fc0', transparent: true, opacity: 0.62 }));
    water.rotation.x = -Math.PI / 2; water.position.y = depth0; scene.add(water);
  }

  // ---------- มินิแมพ (วาดพื้นหลังครั้งเดียว) ----------
  const MS = 200, mscale = MS / (RADIUS * 2.1);
  const miniBase = document.createElement('canvas'); miniBase.width = miniBase.height = MS;
  {
    const g = miniBase.getContext('2d'), P = ([x, z]) => [MS / 2 + x * mscale, MS / 2 + z * mscale];
    g.fillStyle = '#ece8df'; g.fillRect(0, 0, MS, MS);
    for (const p of miniPolys) { g.fillStyle = p.kind === 'water' ? '#8fc3e6' : '#c3e0ad'; g.beginPath(); p.pts.forEach((pt, i) => { const [a, b] = P(pt); i ? g.lineTo(a, b) : g.moveTo(a, b); }); g.fill(); }
    g.strokeStyle = '#ffffff'; g.lineCap = 'round';
    for (const r of miniLines) { g.lineWidth = Math.max(1, r.w * mscale * 1.4); g.beginPath(); r.pts.forEach((pt, i) => { const [a, b] = P(pt); i ? g.lineTo(a, b) : g.moveTo(a, b); }); g.stroke(); }
    g.fillStyle = '#b9b3a6';
    for (const fp of footprints) { g.beginPath(); fp.pts.forEach((pt, i) => { const [a, b] = P(pt); i ? g.lineTo(a, b) : g.moveTo(a, b); }); g.fill(); }
    g.fillStyle = '#f4a259'; g.beginPath(); homeFP.pts.forEach((pt, i) => { const [a, b] = P(pt); i ? g.lineTo(a, b) : g.moveTo(a, b); }); g.fill();
    for (const s of signs) { const [a, b] = P([s.x, s.z]); g.fillStyle = s.kind === 'seven' ? '#0f8a4a' : s.kind === 'convenience' ? '#f97316' : s.kind === 'home' ? '#e11d48' : (TYPE_COLOR[s.l?.type] || '#2f6bff'); g.beginPath(); g.arc(a, b, s.kind === 'home' ? 4 : 2.2, 0, 7); g.fill(); }
  }
  let miniOn = !IS_MOBILE;
  mini.classList.toggle('hidden', !miniOn);

  // ---------- cat ----------
  const cat = new THREE.Group(); scene.add(cat);
  let catImpl = null;
  const note = root.querySelector('#ex-catnote');
  try { catImpl = await loadGltfCat(cat); note.innerHTML = 'แมว: ' + (CAT_CREDITS[catImpl.url] || catImpl.url); }
  catch (e) { if (!/no cat file/.test(e?.message)) console.warn('cat load failed', e); catImpl = makeProceduralCat(cat); note.innerHTML = 'ใช้แมวโลว์โพลีในตัว'; }
  cat.traverse(o => { if (o.isMesh) o.castShadow = renderer.shadowMap.enabled; });
  // จุดเกิด: ข้างตึกที่พัก ฝั่งที่ไม่ชน
  let spawn = null;
  for (let r = CAT_LENGTH * 0.7; r < 160 && !spawn; r += 3) for (let a = 0; a < 12 && !spawn; a++) { const x = homeC.x + Math.cos(a / 12 * Math.PI * 2) * (r + (homeFP.maxX - homeFP.minX) / 2), z = homeC.z + Math.sin(a / 12 * Math.PI * 2) * (r + (homeFP.maxZ - homeFP.minZ) / 2); if (!bodyBlocked(x, z, 0, 0) && !bodyBlocked(x, z, 0, Math.PI / 2)) spawn = [x, z]; }
  spawn ||= [0, 8];
  cat.position.set(spawn[0], 0, spawn[1]);
  window.__cat = catImpl;
  status.textContent = `🏙️ อาคาร OSM ${(footprints.length - GEN_INFO.genListing - GEN_INFO.genFill).toLocaleString()} + ตึกที่พักจริง ${GEN_INFO.genListing} + ตึกแถวจำลอง ${GEN_INFO.genFill} · 🏢 ที่พักรอบ ๆ ${pins.length} แห่ง · 🏪 7-Eleven ${shops?.seven ?? 0} · รัศมี ${RADIUS} ม.` + (water ? ` · 🌊 น้ำลึก ${depth0.toFixed(2)} ม.` : '');

  // ---------- input ----------
  const keys = new Set();
  let yaw = Math.atan2(cat.position.x - homeC.x, cat.position.z - homeC.z); // เริ่มหันกล้องไปทางตึกที่พัก
  let pitch = 0.42, dist = CAT_LENGTH * 3.2, lastInput = performance.now(), active = true, started = false;
  const joy = { x: 0, y: 0 }; let mRun = false, mJump = false, nearSign = null, cardOpen = false;
  function openCard(s) {
    if (!s?.l) return; cardOpen = true;
    const l = s.l, d = Math.hypot(s.x - cat.position.x, s.z - cat.position.z);
    cardEl.innerHTML = `<button class="btn sm ghost close" data-c="x">✕</button>
      <span class="chip" style="background:${TYPE_COLOR[l.type]}22;color:${TYPE_COLOR[l.type]}">${TYPE_LABEL[l.type] || ''}</span>
      <h3 style="margin:6px 0 2px">${l.name}</h3>
      <div class="small">${l.district || ''} · ห่างจากแมว ${Math.round(d)} ม.</div>
      <div style="font-size:22px;font-weight:700;margin:8px 0">${l.rentMarket ? fmtBaht(l.rentMarket) + ' <span class="small">/เดือน' + (l.priceEstimated ? ' (ประมาณ)' : '') + '</span>' : ''}</div>
      ${l.phone ? `<div class="small">☎ ${l.phone}</div>` : ''}${l.street ? `<div class="small">📮 ${l.street}</div>` : ''}
      <div class="small">🚇 ${l.station?.name || '-'} · ${l.station ? (l.station.distKm < 1 ? Math.round(l.station.distKm * 1000) + ' ม.' : l.station.distKm.toFixed(1) + ' กม.') : ''}</div>
      <div class="row" style="margin-top:10px"><button class="btn primary" data-c="sel">📍 ดูที่นี่บนแผนที่</button><button class="btn" data-c="x">เดินต่อ</button></div>`;
    cardEl.classList.remove('hidden');
    if (document.pointerLockElement) document.exitPointerLock();
  }
  const closeCard = () => { cardOpen = false; cardEl.classList.add('hidden'); if (started && !IS_MOBILE) lock(); };
  cardEl.onclick = e => { const c = e.target.dataset.c; if (c === 'x') closeCard(); if (c === 'sel' && nearSign?.l) { const id = nearSign.l.id; exit(); onSelect?.(id); } };
  const onKey = (e, down) => {
    const k = e.code;
    if (['KeyW', 'KeyA', 'KeyS', 'KeyD', 'Space', 'ShiftLeft', 'ShiftRight', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(k)) { e.preventDefault(); down ? keys.add(k) : keys.delete(k); lastInput = performance.now(); }
    if (down && k === 'KeyE') { cardOpen ? closeCard() : openCard(nearSign); }
    if (down && k === 'KeyM') { miniOn = !miniOn; mini.classList.toggle('hidden', !miniOn); }
    if (down && k === 'Escape') { if (cardOpen) closeCard(); else exit(); }
  };
  const kd = e => onKey(e, true), ku = e => onKey(e, false);
  const mm = e => { if (cardOpen || (document.pointerLockElement !== canvas && !(started && (e.buttons & 1)))) return; yaw -= e.movementX * 0.0026; pitch = THREE.MathUtils.clamp(pitch + e.movementY * 0.0022, -0.2, 1.45); if (Math.abs(e.movementX) + Math.abs(e.movementY) > 1) lastInput = performance.now(); };
  const wheel = e => { dist = THREE.MathUtils.clamp(dist * (e.deltaY > 0 ? 1.12 : 0.89), CAT_LENGTH * 1.2, 260); };
  let wasLocked = false;
  const plc = () => { if (document.pointerLockElement === canvas) wasLocked = true; else if (wasLocked && started && active && !cardOpen) exit(); };
  const lock = () => { try { const p = canvas.requestPointerLock?.(); p?.catch?.(() => {}); } catch {} };
  addEventListener('keydown', kd); addEventListener('keyup', ku); addEventListener('mousemove', mm); canvas.addEventListener('wheel', wheel, { passive: true });
  document.addEventListener('pointerlockchange', plc);
  startEl.onclick = () => { startEl.remove(); started = true; if (!IS_MOBILE) lock(); };
  canvas.onclick = () => { if (started && !IS_MOBILE && !cardOpen && document.pointerLockElement !== canvas) lock(); };
  root.querySelector('.ex-exit').onclick = exit;
  if (IS_MOBILE) {
    const jEl = root.querySelector('.joy'), knob = jEl.querySelector('i');
    jEl.addEventListener('touchmove', e => {
      const r = jEl.getBoundingClientRect(), t = e.targetTouches[0];
      let dx = (t.clientX - r.left - r.width / 2) / (r.width / 2), dy = (t.clientY - r.top - r.height / 2) / (r.height / 2);
      const l = Math.hypot(dx, dy); if (l > 1) { dx /= l; dy /= l; }
      joy.x = dx; joy.y = dy; knob.style.transform = `translate(${dx * 35}px,${dy * 35}px)`; lastInput = performance.now(); e.preventDefault();
    }, { passive: false });
    jEl.addEventListener('touchend', () => { joy.x = joy.y = 0; knob.style.transform = ''; });
    let last = null;
    canvas.addEventListener('touchmove', e => { const t = e.targetTouches[0]; if (last) { yaw -= (t.clientX - last.x) * 0.006; pitch = THREE.MathUtils.clamp(pitch + (t.clientY - last.y) * 0.004, -0.2, 1.45); } last = { x: t.clientX, y: t.clientY }; lastInput = performance.now(); }, { passive: true });
    canvas.addEventListener('touchend', () => last = null);
    root.querySelector('[data-b=run]').addEventListener('touchstart', () => mRun = !mRun);
    root.querySelector('[data-b=jump]').addEventListener('touchstart', () => mJump = true);
    root.querySelector('[data-b=info]').addEventListener('touchstart', () => cardOpen ? closeCard() : openCard(nearSign));
  }
  const resize = () => { renderer.setSize(innerWidth, innerHeight, false); camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); };
  addEventListener('resize', resize); resize();

  // ---------- loop ----------
  let vy = 0, onGround = true, heading = yaw + Math.PI, speedNow = 0, frame = 0;
  const clock = new THREE.Clock(); let acc = 0; const frameT = 1 / (settings.fpsCap || 60);
  const camPos = new THREE.Vector3(), look = new THREE.Vector3();
  function tick() {
    if (!active) return;
    requestAnimationFrame(tick);
    const raw = clock.getDelta(); acc += raw; if (acc < frameT * 0.9) return; const dt = Math.min(acc, 0.05); acc = 0; frame++;
    let fx = 0, fz = 0;
    if (!cardOpen) {
      if (keys.has('KeyW') || keys.has('ArrowUp')) fz += 1; if (keys.has('KeyS') || keys.has('ArrowDown')) fz -= 1;
      if (keys.has('KeyA') || keys.has('ArrowLeft')) fx -= 1; if (keys.has('KeyD') || keys.has('ArrowRight')) fx += 1;
      if (IS_MOBILE) { fx += joy.x; fz -= joy.y; }
    }
    const mag = Math.min(1, Math.hypot(fx, fz));
    const run = keys.has('ShiftLeft') || keys.has('ShiftRight') || mRun;
    const inWater = water && cat.position.y < water.position.y - 0.05;
    const targetSpeed = mag > 0.05 ? (run ? 30 : 10) * (inWater ? 0.6 : 1) : 0;
    speedNow += (targetSpeed - speedNow) * Math.min(1, dt * 6);
    if (mag > 0.05 && started) {
      const fwdX = -Math.sin(yaw), fwdZ = -Math.cos(yaw), rX = Math.cos(yaw), rZ = -Math.sin(yaw);
      heading = Math.atan2((fwdX * fz + rX * fx) / mag, (fwdZ * fz + rZ * fx) / mag);
    }
    if (speedNow > 0.01) {
      const step = speedNow * dt, nx = cat.position.x + Math.sin(heading) * step, nz = cat.position.z + Math.cos(heading) * step, y = cat.position.y;
      if (Math.hypot(nx, nz) < RADIUS) {
        if (!bodyBlocked(nx, nz, y, heading)) { cat.position.x = nx; cat.position.z = nz; }
        else if (!bodyBlocked(nx, cat.position.z, y, heading)) cat.position.x = nx;
        else if (!bodyBlocked(cat.position.x, nz, y, heading)) cat.position.z = nz;
      }
    }
    let d = heading + CAT_YAW_OFFSET - cat.rotation.y; d = Math.atan2(Math.sin(d), Math.cos(d)); cat.rotation.y += d * Math.min(1, dt * 10);
    if ((keys.has('Space') || mJump) && onGround && started && !cardOpen) { vy = 19; onGround = false; catImpl.jump?.(); } // กระโดดสูง ~6 ม. ขึ้นหลังคาตึกแถวได้
    mJump = false;
    vy -= 30 * dt; cat.position.y += vy * dt;
    const gy = Math.max(groundAt(cat.position.x, cat.position.z, cat.position.y), ...[[0.35, 0], [-0.35, 0]].map(([u]) => groundAt(cat.position.x + Math.sin(heading) * CAT_LENGTH * u, cat.position.z + Math.cos(heading) * CAT_LENGTH * u, cat.position.y)));
    if (cat.position.y <= gy) { cat.position.y = gy; vy = 0; onGround = true; }
    const idleFor = (performance.now() - lastInput) / 1000;
    catImpl.update(dt, { speed: speedNow, run, onGround, idle: started ? idleFor > 2.5 && speedNow < 0.05 : true });

    // camera (ซูมออกไกล = มุมสูงมองเมือง)
    const cy = cat.position.y + CAT_LENGTH * 0.45;
    look.set(cat.position.x, cy, cat.position.z);
    camPos.set(cat.position.x + Math.sin(yaw) * Math.cos(pitch) * dist, cy + Math.sin(pitch) * dist, cat.position.z + Math.cos(yaw) * Math.cos(pitch) * dist);
    // ไม่ดึงกล้องเข้าเมื่อมีตึกบัง — ใช้ "X-ray" ทำให้ส่วนของตึกที่อยู่ระหว่างกล้องกับแมวโปร่งใสแทน (ดู XRAY ด้านบน)
    camPos.y = Math.max(camPos.y, 0.3);
    camera.position.lerp(camPos, Math.min(1, dt * 10)); camera.lookAt(look);
    XRAY.uCam.value.copy(camera.position);
    XRAY.uCat.value.set(cat.position.x, cat.position.y + CAT_LENGTH * 0.3, cat.position.z);
    if (renderer.shadowMap.enabled) { sun.position.set(cat.position.x - 80, 140, cat.position.z + 60); sun.target.position.copy(cat.position); }
    if (water) water.position.y = depth0 + Math.sin(clock.elapsedTime * 0.8) * 0.01;
    beam.material.opacity = 0.25 + Math.sin(clock.elapsedTime * 2) * 0.1;

    // ป้าย: ซ่อนตัวที่ไกล, หาตัวที่ใกล้ที่สุดสำหรับปุ่ม E (ทำทุก 6 เฟรม)
    if (frame % 6 === 0) {
      let best = null, bd = 30 + CAT_LENGTH * 2;
      const vis = Math.min(RADIUS, 160 + dist * 4);
      for (const s of signs) {
        const dd = Math.hypot(s.x - cat.position.x, s.z - cat.position.z);
        s.sp.visible = s.kind === 'home' || dd < (s.kind === 'listing' ? vis : vis * 0.6);
        if (s.l && dd < bd) { bd = dd; best = s; }
      }
      if (best !== nearSign) {
        nearSign = best;
        promptEl.classList.toggle('hidden', !best || cardOpen);
        if (best) promptEl.innerHTML = `${IS_MOBILE ? 'แตะ ℹ️' : 'กด <kbd>E</kbd>'} ดูข้อมูล: <b>${best.l.name}</b>`;
      }
      if (cardOpen) promptEl.classList.add('hidden');
    }
    renderer.render(scene, camera);
    // มินิแมพ
    if (miniOn && frame % 3 === 0) {
      mg.drawImage(miniBase, 0, 0);
      const px = MS / 2 + cat.position.x * mscale, pz = MS / 2 + cat.position.z * mscale;
      mg.save(); mg.translate(px, pz); mg.rotate(-heading + Math.PI);
      mg.fillStyle = '#0f172a'; mg.beginPath(); mg.moveTo(0, -7); mg.lineTo(5, 5); mg.lineTo(0, 2); mg.lineTo(-5, 5); mg.closePath(); mg.fill(); mg.restore();
      // กรวยมุมกล้อง
      mg.fillStyle = 'rgba(47,107,255,.18)'; mg.beginPath(); mg.moveTo(px, pz); mg.arc(px, pz, 26, -yaw - Math.PI / 2 - 0.5 + Math.PI, -yaw - Math.PI / 2 + 0.5 + Math.PI); mg.fill();
    }
  }
  tick();

  function exit() {
    if (!active) return; active = false;
    removeEventListener('keydown', kd); removeEventListener('keyup', ku); removeEventListener('mousemove', mm); removeEventListener('resize', resize);
    document.removeEventListener('pointerlockchange', plc);
    if (document.pointerLockElement) document.exitPointerLock();
    scene.traverse(o => { o.geometry?.dispose(); if (o.material) [].concat(o.material).forEach(m => { m.map?.dispose(); m.dispose(); }); });
    renderer.dispose(); root.remove(); onExit?.();
  }
}

// =============================================================
//  แมวจากไฟล์ GLTF (Sketchfab)
// =============================================================
async function loadGltfCat(group) {
  let url = null;
  for (const f of CAT_FILES) { try { const r = await fetch(f, { method: 'HEAD' }); if (r.ok) { url = f; break; } } catch {} }
  if (!url) throw new Error('no cat file');
  const gltf = await new GLTFLoader().loadAsync(url);
  const model = gltf.scene;
  const holder = new THREE.Group(); holder.add(model); group.add(holder);
  model.updateMatrixWorld(true);
  // บางไฟล์เก็บท่าเริ่มต้นเป็นท่าโพส (เช่น นั่ง) — รีเซ็ตกระดูกเป็น bind pose (ท่ายืนตอนผูก rig)
  const orig = new Map(); model.traverse(o => { if (o.isBone) orig.set(o, { q: o.quaternion.clone(), p: o.position.clone() }); });
  model.traverse(o => { if (o.isSkinnedMesh && o.skeleton) o.skeleton.pose(); });
  model.updateMatrixWorld(true);

  // ---- กระดูก (รองรับทั้ง rig แบบ Rigify และ rig แบบ j_xxx) ----
  // หมายเหตุ: three.js ตัดจุดออกจากชื่อกระดูก (leg.upper.F.L -> legupperFL)
  const bones = []; model.traverse(o => { if (o.isBone) bones.push(o); });
  const find = (...res) => { for (const re of res) { const b = bones.find(x => re.test(x.name)); if (b) return b; } return null; };
  const B = {
    torso: find(/^j_body/i, /^torso/i), hips: find(/^j_hips/i),
    spine1: find(/^j_spine_1/i, /^spine.?0?1/i), spine2: find(/^j_spine_3/i, /^spine.?0?2/i), chest: find(/^j_chest/i),
    neck: find(/^j_neck_1/i, /^neck/i), neckBase: find(/^j_neck_base/i), head: find(/^j_head/i, /^head/i),
    mouth: find(/^j_jaw/i, /^mouth/i), earL: find(/^j_l_ear/i, /^ear.?L/i), earR: find(/^j_r_ear/i, /^ear.?R/i),
    lidL: find(/^j_l_upper_eyelid/i), lidR: find(/^j_r_upper_eyelid/i), eyeL: find(/^eye.?L/i), eyeR: find(/^eye.?R/i),
    tail: bones.filter(b => /tail/i.test(b.name) && !/ctrl|end/i.test(b.name)),
    fUL: find(/^j_l_humerous/i, /^leg.?upper.?F.?L/i), fUR: find(/^j_r_humerous/i, /^leg.?upper.?F.?R/i),
    fLL: find(/^j_l_elbow/i, /^leg.?lower.?F.?L/i), fLR: find(/^j_r_elbow/i, /^leg.?lower.?F.?R/i),
    fWL: find(/^j_l_wrist/i), fWR: find(/^j_r_wrist/i),
    bTL: find(/^j_l_femur/i, /^thigh.?B.?L/i), bTR: find(/^j_r_femur/i, /^thigh.?B.?R/i),
    bUL: find(/^j_l_knee/i, /^leg.?upper.?B.?L/i), bUR: find(/^j_r_knee/i, /^leg.?upper.?B.?R/i),
    bAL: find(/^j_l_ankle/i), bAR: find(/^j_r_ankle/i),
  };

  // ---- เลือกท่าตั้งต้น: bind pose หรือท่าเดิมในไฟล์ — เอาอันที่ "หัว-หาง อยู่แนวนอน" (ท่ายืนสี่ขา) ----
  // (Toon Cat มี bind pose เป็นท่ายืนตัวตรง ส่วนแมวดำมีท่าในไฟล์เป็นท่านั่ง → ต้องเลือกคนละแบบ)
  const headTail = () => {
    model.updateMatrixWorld(true);
    const h = B.head.getWorldPosition(new THREE.Vector3()), t = B.tail[0].getWorldPosition(new THREE.Vector3());
    const d = h.sub(t); return { d, flat: Math.hypot(d.x, d.z) / (d.length() || 1) };
  };
  if (B.head && B.tail.length) {
    const bind = headTail();
    for (const [b, o] of orig) { b.quaternion.copy(o.q); b.position.copy(o.p); }
    const original = headTail();
    if (bind.flat >= original.flat) model.traverse(o => { if (o.isSkinnedMesh && o.skeleton) o.skeleton.pose(); });
    const use = bind.flat >= original.flat ? bind : original;
    // ---- หันหน้าให้ตรง +Z (หัวไปทางหน้า) ----
    model.rotation.y += -Math.atan2(use.d.x, use.d.z);
    model.updateMatrixWorld(true);
  }
  // ---- ขนาด + วางเท้าบนพื้น ----
  const box = new THREE.Box3().setFromObject(model), size = box.getSize(new THREE.Vector3());
  const s = CAT_LENGTH / Math.max(size.z, size.x, 1e-6); model.scale.multiplyScalar(s); model.updateMatrixWorld(true);
  const box2 = new THREE.Box3().setFromObject(model), c = box2.getCenter(new THREE.Vector3());
  model.position.x -= c.x; model.position.z -= c.z; model.position.y -= box2.min.y; model.updateMatrixWorld(true);
  const height = box2.max.y - box2.min.y;
  model.traverse(o => { if (o.isMesh) { o.frustumCulled = false; if (o.material) o.material.side = THREE.FrontSide; } });

  // rest pose + แกนของกระดูกใน "พื้นที่ของแมว" (X = ข้างลำตัว, Y = ขึ้น, Z = หน้า)
  const holderInv = holder.getWorldQuaternion(new THREE.Quaternion()).invert();
  const rest = new Map();
  for (const b of bones) rest.set(b, { q: b.quaternion.clone(), p: b.position.clone(), s: b.scale.clone(), wi: holderInv.clone().multiply(b.getWorldQuaternion(new THREE.Quaternion())).invert() });
  const tmpQ = new THREE.Quaternion(), tmpA = new THREE.Vector3(), AX = [new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 0, 1)];
  /** หมุนกระดูกรอบแกนของแมว: rx (+ = ก้มหน้า / ขาเหวี่ยงไปหลัง), ry (หันซ้าย-ขวา), rz (เอียง) */
  function rot(b, rx = 0, ry = 0, rz = 0) {
    if (!b) return; const r = rest.get(b); const a = [rx, ry, rz];
    for (let i = 0; i < 3; i++) { if (Math.abs(a[i]) < 1e-4) continue; tmpA.copy(AX[i]).applyQuaternion(r.wi); b.quaternion.multiply(tmpQ.setFromAxisAngle(tmpA, a[i])); }
  }

  // ---- คลิปในไฟล์ ----
  const mixer = new THREE.AnimationMixer(model);
  const clips = gltf.animations || [];
  // คลิปเดิน: ชื่อมี walk/run หรือถ้ามีคลิปเดียวในโมเดลแบบ Rigify (เช่น Toon Cat ที่คลิปชื่อ "Scene" คือท่าเดิน)
  const walkClip = clips.find(c => /walk|run|trot/i.test(c.name)) || (clips.length === 1 && !/^j_/.test(B.torso?.name || '') ? clips[0] : null);
  const idleClips = clips.filter(c => c !== walkClip);  // คลิปอื่นทั้งหมดใช้เป็นท่า idle (เช่น เลียขน)
  const walkAct = walkClip && mixer.clipAction(walkClip);
  if (walkAct) { walkAct.play(); walkAct.setEffectiveWeight(0); }
  // กระดูกที่คลิป idle ไม่ได้ขยับ ให้กลับไปใช้ท่าเดิมของไฟล์ตอนเล่นคลิป (กันตัวบิด)
  const animated = new Set(idleClips.flatMap(c => c.tracks.map(tr => tr.name.split('.')[0])));
  const fixBones = bones.filter(b => !animated.has(b.name) && orig.has(b));
  const idleActs = idleClips.map(c => { const a = mixer.clipAction(c); a.play(); a.setEffectiveWeight(0); a.paused = true; return a; });
  // วัดว่าท่าในคลิปต้องยก/ลดตัวเท่าไรให้เท้าแตะพื้นพอดี (วัดจาก vertex ที่ skin แล้วจริง)
  const clipLift = idleActs.map((a, i) => {
    a.setEffectiveWeight(1); a.paused = false; a.time = idleClips[i].duration * 0.25; mixer.update(0);
    for (const b of fixBones) { const o = orig.get(b); b.quaternion.copy(o.q); b.position.copy(o.p); }
    model.updateMatrixWorld(true); const minY = new THREE.Box3().setFromObject(model, true).min.y;
    a.setEffectiveWeight(0); a.paused = true; a.time = 0;
    return -minY;
  });
  for (const b of bones) { const r0 = rest.get(b); b.quaternion.copy(r0.q); b.position.copy(r0.p); }
  model.updateMatrixWorld(true);

  // ---- ท่า idle (สุ่มไม่ซ้ำ) ----
  const P = { sit: 0, loaf: 0, stretch: 0, yawn: 0, scratch: 0, headYaw: 0, headPitch: 0, tailAmp: 0.18, tailSpeed: 1.6, ear: 0, sleep: 0 };
  const T = { ...P };
  const IDLES = {
    look:      () => { T.headYaw = (Math.random() - 0.5) * 1.4; T.headPitch = (Math.random() - 0.5) * 0.5; },
    sit:       () => { T.sit = 1; T.headYaw = (Math.random() - 0.5) * 0.7; T.tailAmp = 0.08; },
    tailflick: () => { T.tailAmp = 0.55; T.tailSpeed = 4; T.headPitch = -0.12; },
    stretch:   () => { T.stretch = 1; T.tailAmp = 0.05; },
    loaf:      () => { T.loaf = 1; T.tailAmp = 0.05; T.tailSpeed = 0.8; },
    sleep:     () => { T.loaf = 1; T.sleep = 1; T.tailAmp = 0.02; T.tailSpeed = 0.5; T.headPitch = 0.3; },
    yawn:      () => { T.sit = 1; T.yawn = 1; T.headPitch = -0.4; },
    scratch:   () => { T.sit = 1; T.scratch = 1; T.headYaw = 0.4; },
    ears:      () => { T.ear = 1; T.headYaw = (Math.random() - 0.5) * 0.9; },
  };
  idleClips.forEach((c, i) => { IDLES['clip' + i] = () => {}; });
  // rig แบบ j_xxx (แมวดำสมจริง): ท่าที่หมุนกระดูกเองแบบใหญ่ ๆ ดูไม่เป็นธรรมชาติ ใช้เฉพาะท่าเล็ก ๆ + คลิปในไฟล์ (ให้คลิปมีโอกาสออกบ่อยขึ้น)
  if (/^j_/.test(B.torso?.name || '')) { for (const k of ['sit', 'stretch', 'loaf', 'sleep', 'yawn', 'scratch']) delete IDLES[k]; idleClips.forEach((c, i) => { IDLES['clipB' + i] = IDLES['clip' + i]; }); }
  const names = Object.keys(IDLES);
  let cur = null, hist = [], timer = 0, t = 0, mv = 0, phase = 0, blink = 0, blinkT = 2, lookT = 0;
  const clipW = idleActs.map(() => 0);
  const reset = () => Object.assign(T, { sit: 0, loaf: 0, stretch: 0, yawn: 0, scratch: 0, headYaw: 0, headPitch: 0, tailAmp: 0.18, tailSpeed: 1.6, ear: 0, sleep: 0 });
  const start = n => {
    cur = n; reset(); IDLES[n]();
    const ci = n.startsWith('clip') ? +n.replace(/D/g, '') : -1;
    if (ci >= 0) { const a = idleActs[ci]; a.reset(); a.paused = false; a.play(); timer = idleClips[ci].duration * (1 + Math.floor(Math.random() * 2)) - 0.3; }
    else timer = n === 'sleep' ? 9 + Math.random() * 6 : 3.5 + Math.random() * 4.5;
  };
  const base = n => n.replace('clipB', 'clip');
  const histMax = Math.max(1, Math.min(4, names.length - 3));
  const next = () => {
    const last = hist[hist.length - 1];
    let pool = names.filter(n => !hist.includes(n) && (!last || base(n) !== base(last)));
    if (!pool.length) pool = names.filter(n => n !== last);
    const n = pool[Math.floor(Math.random() * pool.length)]; hist.push(n); if (hist.length > histMax) hist.shift(); start(n);
  };

  // ความเร็วเล่นคลิปเดินในไฟล์: ปรับตามความเร็วจริง ÷ ขนาดตัว (ไม่ให้ขาวิ่งรัวเกินจริง)
  // เดิน 10 ม./วิ (แมว 8 ม.) ≈ 1.0 เท่า · วิ่ง ≈ 1.6 เท่า (สูงสุด 1.8)
  const clipRate = st => st.run && st.speed > CAT_LENGTH * 1.6
    ? Math.min(1.8, Math.max(1.1, st.speed / (CAT_LENGTH * 2.3)))
    : Math.min(1.2, Math.max(0.5, st.speed / (CAT_LENGTH * 1.25)));

  return {
    url,
    jump() {},
    get state() { return cur; },
    force(name) { start(name); timer = 30; },
    _dbg: { B, rest, rot, holder, model, idleActs, clipW },
    update(dt, st) {
      t += dt;
      const moving = st.speed > 0.1;
      mv += ((moving ? 1 : 0) - mv) * Math.min(1, dt * 7);
      if (moving || !st.idle) { if (cur) { cur = null; reset(); } }
      else { timer -= dt; if (!cur || timer <= 0) next(); if (cur === 'look' && (lookT -= dt) < 0) { IDLES.look(); lookT = 1.2 + Math.random() * 1.8; } }
      // น้ำหนักคลิป
      let clipSum = 0;
      idleActs.forEach((a, i) => { const on = cur === 'clip' + i || cur === 'clipB' + i; clipW[i] += ((on ? 1 : 0) - clipW[i]) * Math.min(1, dt * 4); if (clipW[i] < 0.01 && !on) a.paused = true; a.setEffectiveWeight(clipW[i]); clipSum += clipW[i]; });
      if (walkAct) { walkAct.setEffectiveWeight(mv * (1 - clipSum)); walkAct.timeScale = clipRate(st); }
      for (const b of bones) { const r = rest.get(b); b.quaternion.copy(r.q); b.position.copy(r.p); b.scale.copy(r.s); }
      mixer.update(dt);
      if (clipSum > 0.001) for (const b of fixBones) { const o = orig.get(b); b.quaternion.slerp(o.q, clipSum); b.position.lerp(o.p, clipSum); }
      const pw = Math.max(0, 1 - clipSum);          // น้ำหนักการขยับด้วยโค้ด
      const iw = pw * (1 - mv);                       // ท่า idle ด้วยโค้ด
      const ww = walkAct ? 0 : pw * mv;               // ท่าเดินด้วยโค้ด (เมื่อไฟล์ไม่มีคลิปเดิน)
      const k = Math.min(1, dt * 3);
      for (const key in T) P[key] += (T[key] - P[key]) * k;

      // ---- เดิน/วิ่ง ด้วยโค้ด ----
      const run = st.run && st.speed > CAT_LENGTH * 1.6;
      // จังหวะก้าวตามขนาดตัว: แมวตัวใหญ่ก้าวยาว → ขยับขาช้าลง (1 รอบก้าว ≈ 0.9 เท่าความยาวตัว, วิ่ง ≈ 1.6 เท่า)
      phase += dt * 2 * Math.PI * Math.max(0.3, st.speed) / (CAT_LENGTH * (run ? 1.6 : 0.9));
      const A = run ? 0.75 : 0.45;
      // walk: ขาทแยงเคลื่อนพร้อมกัน / run: ขาหน้าคู่-ขาหลังคู่ (gallop)
      const ph = run ? [0, 0.35, Math.PI, Math.PI + 0.35] : [0, Math.PI, Math.PI * 1.5, Math.PI * 0.5]; // fL, fR, bL, bR
      const swing = i => Math.sin(phase + ph[i]);
      const lift = i => Math.max(0, Math.cos(phase + ph[i]));
      rot(B.fUL, ww * -swing(0) * A, 0, 0); rot(B.fUR, ww * -swing(1) * A, 0, 0);
      rot(B.fLL, ww * lift(0) * 0.7, 0, 0); rot(B.fLR, ww * lift(1) * 0.7, 0, 0);
      rot(B.fWL, ww * lift(0) * -0.6, 0, 0); rot(B.fWR, ww * lift(1) * -0.6, 0, 0);
      rot(B.bTL, ww * -swing(2) * A, 0, 0); rot(B.bTR, ww * -swing(3) * A, 0, 0);
      rot(B.bUL, ww * lift(2) * 0.8, 0, 0); rot(B.bUR, ww * lift(3) * 0.8, 0, 0);
      rot(B.bAL, ww * lift(2) * -0.6, 0, 0); rot(B.bAR, ww * lift(3) * -0.6, 0, 0);
      rot(B.spine1, ww * (run ? Math.sin(phase * 1) * 0.12 : 0), ww * Math.sin(phase) * 0.06, 0);
      rot(B.head, ww * (run ? 0.1 : Math.sin(phase * 2) * 0.04), ww * -Math.sin(phase) * 0.05, 0);

      // ---- ท่า idle ด้วยโค้ด ----
      const breathe = Math.sin(t * (P.sleep > 0.5 ? 1.4 : 2.4)) * 0.02;
      rot(B.torso, iw * (-P.sit * 0.7 + P.stretch * 0.28), 0, 0);
      rot(B.spine1, iw * (P.sit * 0.12 + breathe), 0, 0);
      rot(B.spine2, iw * (P.sit * 0.1 - P.stretch * 0.18), 0, 0);
      rot(B.neck || B.neckBase, iw * (P.sit * 0.4 - P.stretch * 0.15 + P.loaf * 0.15), iw * P.headYaw * 0.35, 0);
      rot(B.head, iw * (P.headPitch - P.yawn * Math.max(0, Math.sin(t * 1.3)) * 0.3), iw * P.headYaw * 0.65, iw * P.scratch * Math.sin(t * 20) * 0.1);
      rot(B.mouth, iw * P.yawn * Math.max(0, Math.sin(t * 1.3)) * 0.5, 0, 0);
      const twitch = P.ear * (Math.sin(t * 9) > 0.6 ? 0.45 : 0);
      rot(B.earL, iw * twitch, 0, 0); rot(B.earR, iw * twitch * 0.4, 0, 0);
      rot(B.fUL, iw * (P.sit * 0.6 - P.stretch * 1.0 + P.loaf * 1.2), 0, 0);
      rot(B.fUR, iw * (P.sit * 0.6 - P.stretch * 1.0 + P.loaf * 1.2), 0, 0);
      rot(B.fLL, iw * (P.loaf * -1.8), 0, 0); rot(B.fLR, iw * (P.loaf * -1.8), 0, 0);
      const scr = P.scratch * Math.sin(t * 22) * 0.35;
      rot(B.bTL, iw * (-P.sit * 0.9 - P.loaf * 1.2 - P.stretch * 0.45), 0, 0);
      rot(B.bTR, iw * (-P.sit * 0.9 - P.loaf * 1.2 - P.stretch * 0.45 - P.scratch * 0.8 + scr), 0, 0);
      rot(B.bUL, iw * (P.sit * 1.5 + P.loaf * 2.0), 0, 0); rot(B.bUR, iw * (P.sit * 1.5 + P.loaf * 2.0), 0, 0);
      // หาง
      B.tail.forEach((b, i) => rot(b, iw * (i === 0 ? P.sit * 0.5 + P.loaf * 0.6 : 0.04) + ww * (i === 0 ? -0.25 : 0.05),
        Math.sin(t * (pw * P.tailSpeed + (1 - pw) * 1.6) - i * 0.55) * (P.tailAmp * iw + 0.1 * ww + 0.04) * (0.5 + i * 0.2), 0));
      // ตา
      blinkT -= dt; if (blinkT < 0) { blinkT = 2 + Math.random() * 4; blink = 1; } blink = Math.max(0, blink - dt * 7);
      const closed = Math.max(blink, P.sleep > 0.6 ? 1 : 0, P.yawn * 0.7) * pw;
      rot(B.lidL, closed * 0.55, 0, 0); rot(B.lidR, closed * 0.55, 0, 0);
      for (const e of [B.eyeL, B.eyeR]) if (e) e.scale.set(1, Math.max(0.08, 1 - closed), 1);
      // ลำตัวลดต่ำลงตอนนั่ง/หมอบ + เด้งตอนเดิน
      holder.position.y = -height * iw * (P.sit * 0.36 + P.loaf * 0.32 + P.stretch * 0.12) + ww * Math.abs(Math.sin(phase)) * height * (run ? 0.06 : 0.02);
      holder.position.y += clipW.reduce((s2, w2, i) => s2 + w2 * clipLift[i], 0);
      holder.rotation.x = st.onGround ? 0 : -0.2;
    },
  };
}

// =============================================================
//  แมวโลว์โพลีในตัว + ท่าทาง idle แบบสุ่มไม่ซ้ำ
// =============================================================
function makeProceduralCat(group) {
  const fur = new THREE.MeshLambertMaterial({ color: '#f0a35e', flatShading: true });
  const fur2 = new THREE.MeshLambertMaterial({ color: '#fff4e6', flatShading: true });
  const dark = new THREE.MeshLambertMaterial({ color: '#2b2b2b' });
  const pink = new THREE.MeshLambertMaterial({ color: '#f7a1b5' });
  const S = CAT_LENGTH / 0.6;
  const root = new THREE.Group(); root.scale.setScalar(S); group.add(root);
  const hips = new THREE.Group(); hips.position.set(0, 0.2, -0.12); root.add(hips);
  const body = new THREE.Mesh(new THREE.IcosahedronGeometry(0.13, 1), fur); body.scale.set(0.85, 0.8, 1.75); body.position.z = 0.12; hips.add(body);
  const belly = new THREE.Mesh(new THREE.IcosahedronGeometry(0.1, 1), fur2); belly.scale.set(0.8, 0.6, 1.6); belly.position.set(0, -0.04, 0.12); hips.add(belly);
  const chest = new THREE.Group(); chest.position.set(0, 0.02, 0.27); hips.add(chest);
  const neck = new THREE.Group(); neck.position.set(0, 0.06, 0.03); chest.add(neck);
  const head = new THREE.Group(); head.position.set(0, 0.08, 0.06); neck.add(head);
  const skull = new THREE.Mesh(new THREE.IcosahedronGeometry(0.095, 1), fur); skull.scale.set(1.1, 0.95, 1); head.add(skull);
  const muzzle = new THREE.Mesh(new THREE.IcosahedronGeometry(0.045, 1), fur2); muzzle.scale.set(1.3, 0.8, 1); muzzle.position.set(0, -0.03, 0.08); head.add(muzzle);
  const nose = new THREE.Mesh(new THREE.SphereGeometry(0.012, 6, 4), pink); nose.position.set(0, -0.012, 0.125); head.add(nose);
  const eyes = [];
  for (const sx of [-1, 1]) {
    const ear = new THREE.Mesh(new THREE.ConeGeometry(0.04, 0.08, 4), fur); ear.position.set(sx * 0.055, 0.085, -0.01); ear.rotation.z = -sx * 0.25; head.add(ear);
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.015, 8, 6), dark); eye.position.set(sx * 0.04, 0.015, 0.085); eye.scale.y = 1.3; head.add(eye); eyes.push(eye);
  }
  const legs = [];
  const mkLeg = (x, z, parent, front) => {
    const pivot = new THREE.Group(); pivot.position.set(x, front ? -0.02 : 0, z); parent.add(pivot);
    const upper = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.022, 0.17, 6), fur); upper.position.y = -0.085; pivot.add(upper);
    const paw = new THREE.Mesh(new THREE.IcosahedronGeometry(0.03, 0), fur2); paw.scale.set(1, 0.6, 1.3); paw.position.set(0, -0.175, 0.01); pivot.add(paw);
    legs.push({ pivot, front, side: x > 0 ? 1 : -1 }); return pivot;
  };
  mkLeg(-0.06, 0.02, chest, true); mkLeg(0.06, 0.02, chest, true);
  mkLeg(-0.065, 0, hips, false); mkLeg(0.065, 0, hips, false);
  const tail = []; let parent = hips;
  for (let i = 0; i < 7; i++) {
    const seg = new THREE.Group(); seg.position.set(0, i ? 0 : 0.05, i ? -0.055 : -0.08); parent.add(seg);
    const m = new THREE.Mesh(new THREE.CylinderGeometry(0.02 - i * 0.0015, 0.022 - i * 0.0015, 0.06, 5), i === 6 ? fur2 : fur); m.rotation.x = Math.PI / 2; m.position.z = -0.03; seg.add(m);
    tail.push(seg); parent = seg;
  }

  // pose params (blended)
  const P = { sit: 0, lie: 0, stretch: 0, groom: 0, scratch: 0, yawn: 0, headYaw: 0, headPitch: 0, tailAmp: 0.15, tailSpeed: 1.5, blink: 0 };
  const T = { ...P };
  const BEHAVIORS = {
    look:     () => { T.headYaw = (Math.random() - 0.5) * 1.6; T.headPitch = (Math.random() - 0.3) * 0.4; T.tailAmp = 0.2; },
    sit:      () => { T.sit = 1; T.headYaw = (Math.random() - 0.5) * 0.8; T.tailAmp = 0.1; },
    groom:    () => { T.sit = 1; T.groom = 1; T.tailAmp = 0.08; },
    tailflick:() => { T.tailAmp = 0.55; T.tailSpeed = 4; T.headPitch = 0.15; },
    stretch:  () => { T.stretch = 1; T.tailAmp = 0.05; },
    lie:      () => { T.lie = 1; T.tailAmp = 0.06; T.tailSpeed = 0.8; T.headPitch = -0.1; },
    yawn:     () => { T.sit = 1; T.yawn = 1; T.headPitch = -0.5; },
    scratch:  () => { T.sit = 1; T.scratch = 1; T.headYaw = 0.35; },
    loaf:     () => { T.lie = 0.7; T.headPitch = 0.05; T.tailAmp = 0.03; },
  };
  const names = Object.keys(BEHAVIORS);
  let current = null, history = [], timer = 0, t = 0, walkPhase = 0, blinkT = 2, jumpT = 0;
  const resetT = () => Object.assign(T, { sit: 0, lie: 0, stretch: 0, groom: 0, scratch: 0, yawn: 0, headYaw: 0, headPitch: 0, tailAmp: 0.15, tailSpeed: 1.5 });
  const nextBehavior = () => {
    const pool = names.filter(n => !history.includes(n));
    current = pool[Math.floor(Math.random() * pool.length)];
    history.push(current); if (history.length > 3) history.shift();
    resetT(); BEHAVIORS[current](); timer = 3.5 + Math.random() * 4.5;
  };
  const lerp = (a, b, k) => a + (b - a) * k;

  return {
    jump() { jumpT = 0.45; },
    update(dt, st) {
      t += dt;
      const moving = st.speed > 0.1;
      if (moving || !st.idle) { if (current) { current = null; resetT(); } }
      if (st.idle && !moving) { timer -= dt; if (!current || timer <= 0) nextBehavior(); if (current === 'look' && Math.random() < dt * 0.6) BEHAVIORS.look(); }
      const k = Math.min(1, dt * 3.2);
      for (const key in T) P[key] = lerp(P[key], T[key], k);
      // walk cycle
      walkPhase += dt * (st.run ? 15 : 9) * Math.min(1, st.speed / 2);
      const walkAmp = Math.min(1, st.speed / 2) * (st.run ? 0.9 : 0.55);
      legs.forEach((L, i) => {
        const ph = walkPhase + (L.front ? 0 : Math.PI) + (L.side > 0 ? Math.PI / (st.run ? 4 : 1) : 0);
        let rx = Math.sin(ph) * walkAmp;
        if (!L.front) rx += P.sit * -1.25 + P.lie * -1.45 + P.stretch * 0.25;
        else rx += P.sit * 0.25 + P.lie * -1.45 + P.stretch * -1.1;
        if (L.front && L.side > 0) rx += P.groom * (-1.6 + Math.sin(t * 6) * 0.15);
        if (!L.front && L.side > 0) rx += P.scratch * (-0.6 + Math.sin(t * 22) * 0.35);
        if (!st.onGround) rx = L.front ? -0.8 : 0.8;
        L.pivot.rotation.x = rx;
      });
      // body pose
      hips.position.y = 0.2 - P.sit * 0.1 - P.lie * 0.15 - P.stretch * 0.0 + (moving ? Math.abs(Math.sin(walkPhase)) * 0.015 : Math.sin(t * 2.2) * 0.003);
      hips.rotation.x = -P.sit * 0.55 + P.stretch * 0.28 + (st.onGround ? 0 : -0.15);
      chest.position.y = 0.02 - P.stretch * 0.07;
      neck.rotation.x = P.sit * 0.45 - P.lie * 0.0 - P.stretch * 0.2 + P.groom * 0.55;
      head.rotation.y = lerp(head.rotation.y, P.headYaw + (P.groom ? Math.sin(t * 5) * 0.2 * P.groom : 0), 0.15);
      head.rotation.x = -P.headPitch + P.groom * 0.5 + P.yawn * Math.max(0, Math.sin(t * 1.2)) * -0.5;
      head.rotation.z = P.scratch * Math.sin(t * 22) * 0.08;
      // tail
      tail.forEach((s, i) => {
        s.rotation.y = Math.sin(t * P.tailSpeed - i * 0.5) * P.tailAmp * (0.5 + i * 0.15);
        s.rotation.x = i === 0 ? -0.6 + P.sit * 0.9 + P.lie * 0.8 - (moving ? 0.5 : 0) : 0.12 + P.lie * -0.05;
      });
      // blink (ตาหลับตอนนอน)
      blinkT -= dt; if (blinkT < 0) { blinkT = 2 + Math.random() * 4; P.blink = 1; }
      P.blink = Math.max(0, P.blink - dt * 8);
      const closed = Math.max(P.blink, P.lie > 0.8 ? 0.95 : 0);
      eyes.forEach(e => e.scale.y = 1.3 * (1 - closed) + 0.1);
      jumpT = Math.max(0, jumpT - dt);
      root.rotation.x = jumpT > 0 ? -0.25 : 0;
    },
  };
}
