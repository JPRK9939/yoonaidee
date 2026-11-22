import { LISTING_BY_ID, SCORE_KEYS, TYPE_LABEL, TYPE_COLOR, scoreListing, store, fmtBaht, fmtMoneyShort, estimateCommute, floodDepthAt } from './data.js';

const $ = s => document.querySelector(s);
const COLORS = ['#2f6bff', '#e5484d', '#12a594', '#f59e0b', '#8e4ec6', '#d6409f'];
const DEF_W = { price: 1.2, commute: 1.3, transit: 1, flood: 1, amenity: 0.7, quiet: 0.5, invest: 0.6 };
let weights = { ...DEF_W, ...(store('ynd-weights') || {}) };
let mode = (store('ynd-live') || {}).mode || 'rent';

function load() {
  const ids = (store('ynd-compare') || []).filter(id => LISTING_BY_ID[id]);
  const live = store('ynd-live') || {};
  const items = ids.map(id => {
    const l = { ...LISTING_BY_ID[id], ...(live.snap?.[id] || {}) };
    return l;
  });
  return { items, live, workplaces: store('ynd-workplaces') || [] };
}

function radar(items, results) {
  const keys = SCORE_KEYS.filter(k => k.key !== 'invest' || mode === 'buy');
  const N = keys.length, R = 120, cx = 170, cy = 150;
  const P = (i, v) => { const a = -Math.PI / 2 + i / N * Math.PI * 2; return [cx + Math.cos(a) * R * v / 100, cy + Math.sin(a) * R * v / 100]; };
  let s = `<svg viewBox="0 0 340 300" width="100%" style="max-width:420px">`;
  for (const g of [25, 50, 75, 100]) s += `<polygon points="${keys.map((_, i) => P(i, g).join(',')).join(' ')}" fill="none" stroke="#e2e8f0"/>`;
  keys.forEach((k, i) => { const [x, y] = P(i, 118); s += `<line x1="${cx}" y1="${cy}" x2="${P(i, 100)[0]}" y2="${P(i, 100)[1]}" stroke="#e2e8f0"/><text x="${x}" y="${y}" font-size="11" text-anchor="middle" dominant-baseline="middle" fill="#475569">${k.label.split(' ')[0]}</text>`; });
  results.forEach((r, j) => {
    const c = COLORS[j % COLORS.length];
    s += `<polygon points="${keys.map((k, i) => P(i, r.scores[k.key]).join(',')).join(' ')}" fill="${c}22" stroke="${c}" stroke-width="2"/>`;
  });
  return s + '</svg>';
}

function prosCons(l, r) {
  const s = r.scores, pros = [], cons = [];
  if (s.price >= 65) pros.push('ราคาถูกกว่าค่าเฉลี่ยประเภทเดียวกัน'); if (s.price < 35) cons.push('ราคาสูงกว่าตลาด');
  if (l.station.distKm < 0.6) pros.push(`ใกล้ ${l.station.name} (${Math.round(l.station.distKm * 1000)} ม.)`); if (l.station.distKm > 1.8) cons.push('ไกลรถไฟฟ้า ต้องต่อรถ');
  if (s.commute >= 65) pros.push('เดินทางไปที่ทำงานสะดวก'); if (s.commute < 35) cons.push('ใช้เวลาเดินทางนาน');
  if (s.flood >= 70) pros.push('พื้นที่ค่อนข้างสูง เสี่ยงน้ำท่วมต่ำ'); if (s.flood < 35) cons.push('พื้นที่ต่ำ เสี่ยงน้ำท่วม/น้ำขัง');
  if (r.depth > 0.05) cons.push(`สถานการณ์จำลอง: น้ำลึก ~${r.depth.toFixed(2)} ม.`);
  if (s.amenity >= 70) pros.push(`ร้านค้าเยอะ (7-Eleven ~${r.shops.seven} สาขา)`); if (s.amenity < 30) cons.push('ร้านค้า/สะดวกซื้อน้อย');
  if (s.quiet >= 70) pros.push('ย่านไม่แออัด'); if (s.quiet < 30) cons.push('ย่านหนาแน่น/วุ่นวาย');
  if (l.petFriendly) pros.push('เลี้ยงสัตว์ได้'); if (l.year && l.year < 2005) cons.push(`อาคารเก่า (ปี ${l.year})`);
  if (r.yieldPct > 5.5) pros.push(`ผลตอบแทนค่าเช่าดี ${r.yieldPct.toFixed(1)}%`);
  return { pros, cons };
}

function render() {
  const { items, live, workplaces } = load();
  document.querySelectorAll('#mode button').forEach(b => b.classList.toggle('on', b.dataset.v === mode));
  if (!items.length) {
    $('#root').innerHTML = `<div class="cmp-card empty"><h2>ยังไม่มีที่พักในรายการ</h2><p>เปิดแผนที่ เลือกที่พัก แล้วกด “⚖️ เพิ่มเปรียบเทียบ” (สูงสุด 6 แห่ง)<br>หน้านี้จะอัปเดตอัตโนมัติเมื่อเพิ่มจากแท็บแผนที่</p><a class="btn primary" href="app.html">ไปที่แผนที่</a></div>`;
    return;
  }
  const ctx = { mode, workplaces, hour: live.hour ?? 8, flood: live.flood, shops: live.shops || {}, weights: { ...weights, invest: mode === 'buy' ? weights.invest : 0 } };
  const results = items.map(l => scoreListing(l, ctx));
  const best = Math.max(...results.map(r => r.scores.overall));
  const keys = SCORE_KEYS.filter(k => k.key !== 'invest' || mode === 'buy');

  // matrix rows
  const rows = [
    ['ประเภท', l => TYPE_LABEL[l.type], null],
    ['ทำเล', l => `${l.district}, ${l.prov}`, null],
    ['ขนาด', l => l.size + ' ตร.ม.', l => l.size, 'max'],
    ['ค่าเช่าตลาด / เดือน', l => fmtBaht(l.rentMarket), l => l.rentMarket, 'min'],
    ['ราคาที่ผู้ให้เช่าตั้ง', l => fmtBaht(l.rentAsk), l => l.rentAsk, 'min'],
    ['ค่าเช่าต่อ ตร.ม.', l => fmtBaht(l.rentMarket / l.size), l => l.rentMarket / l.size, 'min'],
    ['ราคาขาย', l => l.salePrice ? fmtMoneyShort(l.salePrice) : '—', l => l.salePrice || null, 'min'],
    ['ราคาขาย / ตร.ม.', l => l.ppsm ? fmtBaht(l.ppsm) : '—', l => l.ppsm || null, 'min'],
    ['รถไฟฟ้าใกล้สุด', l => `${l.station.name} · ${l.station.distKm < 1 ? Math.round(l.station.distKm * 1000) + ' ม.' : l.station.distKm.toFixed(1) + ' กม.'}`, l => l.station.distKm, 'min'],
    ['ระดับพื้นดิน', l => l.elev.toFixed(2) + ' ม.', l => l.elev, 'max'],
    ['ความหนาแน่นประชากร', l => l.density.toLocaleString() + ' คน/ตร.กม.', l => l.density, 'min'],
    ...workplaces.map(w => [`⏱ ไป ${w.name}`, l => { const c = estimateCommute(l, w, { hour: ctx.hour, flood: ctx.flood }); return `${c.best} นาที (${c.mode})${c.carBlocked ? ' ⚠️' : ''}`; }, l => estimateCommute(l, w, { hour: ctx.hour, flood: ctx.flood }).best, 'min']),
    ['ปีที่สร้าง', l => l.year || '—', l => l.year || null, 'max'],
    ['ที่มาของข้อมูล', l => l.real ? 'ที่พักจริง (OSM) · ราคาประมาณ' : 'จำลอง', null],
  ];
  const matrix = rows.map(([label, fmt, val, dir]) => {
    const vals = items.map(l => val ? val(l) : null).filter(v => v != null);
    const target = dir === 'min' ? Math.min(...vals) : Math.max(...vals);
    return `<tr><th>${label}</th>${items.map(l => { const v = val ? val(l) : null; return `<td class="${val && v != null && v === target && items.length > 1 ? 'best' : ''}">${fmt(l)}</td>`; }).join('')}</tr>`;
  }).join('');
  const scoreRows = keys.concat([{ key: 'overall', label: '<b>คะแนนรวม</b>' }]).map(k => {
    const vals = results.map(r => r.scores[k.key]); const mx = Math.max(...vals);
    return `<tr><th>${k.label}</th>${vals.map(v => `<td class="${v === mx && items.length > 1 ? 'best' : ''}">${v}%</td>`).join('')}</tr>`;
  }).join('');

  $('#root').innerHTML = `
  <div class="cmp-grid">
    <div class="cmp-card">
      <h3 style="margin-top:0">น้ำหนักความสำคัญ</h3>
      <div class="small" style="margin-bottom:8px">ปรับตามสิ่งที่คุณให้ความสำคัญ คะแนนจะคำนวณใหม่ทันที</div>
      ${keys.map(k => `<div class="row" style="justify-content:space-between;margin:2px 0"><label>${k.label}</label><b>${weights[k.key].toFixed(1)}</b></div><input type="range" min="0" max="3" step="0.1" value="${weights[k.key]}" data-w="${k.key}">`).join('')}
      <button class="btn sm" id="reset-w" style="margin-top:8px">คืนค่าเริ่มต้น</button>
      <h3>สถานการณ์</h3>
      <div class="small">⏰ เวลาเดินทาง: ${String(Math.floor(ctx.hour)).padStart(2, '0')}:${ctx.hour % 1 ? '30' : '00'} น.<br>
      🌊 น้ำท่วมจำลอง: ${ctx.flood ? `ระดับ ${ctx.flood.level} ม. · ฝน ${ctx.flood.rain} มม.` : 'ปิด'}<br>
      📍 ที่ทำงาน: ${workplaces.length ? workplaces.map(w => w.name).join(', ') : 'ยังไม่ได้ปักหมุด'}</div>
      <div class="small" style="margin-top:6px">เปลี่ยนสถานการณ์ได้จากแท็บแผนที่ — หน้านี้ซิงก์อัตโนมัติ</div>
    </div>
    <div>
      <div class="cmp-card" style="display:flex;gap:16px;flex-wrap:wrap;align-items:center;margin-bottom:14px">
        <div style="flex:1;min-width:260px">${radar(items, results)}</div>
        <div style="flex:1;min-width:220px">${items.map((l, j) => `<div class="row"><i style="width:12px;height:12px;border-radius:3px;background:${COLORS[j % COLORS.length]}"></i><b style="flex:1">${l.name}</b><span>${results[j].scores.overall}%</span></div>`).join('')}</div>
      </div>
      <div class="cmp-cols">
        ${items.map((l, j) => { const r = results[j], pc = prosCons(l, r), win = r.scores.overall === best && items.length > 1; return `
        <div class="cmp-card cmp-col ${win ? 'win' : ''}">${win ? '<span class="crown">🏆 เหมาะสุด</span>' : ''}
          <div class="row" style="justify-content:space-between"><span class="chip" style="background:${TYPE_COLOR[l.type]}1a;color:${TYPE_COLOR[l.type]}">${TYPE_LABEL[l.type]}</span><button class="btn sm ghost" data-rm="${l.id}">✕</button></div>
          <h3 style="margin:6px 0 2px;border-left:4px solid ${COLORS[j % COLORS.length]};padding-left:8px">${l.name}</h3>
          <div class="small">${l.district} · ${l.size} ตร.ม.</div>
          <div style="font-size:26px;font-weight:700;margin:8px 0">${r.scores.overall}<span style="font-size:14px;color:var(--ink3)">/100</span></div>
          <div class="small">${mode === 'buy' && l.salePrice ? fmtMoneyShort(l.salePrice) : fmtBaht(l.rentMarket) + ' / เดือน'}</div>
          <h4 class="small" style="margin:10px 0 2px">ข้อดี</h4><ul class="pros">${pc.pros.map(x => `<li>${x}</li>`).join('') || '<li>—</li>'}</ul>
          <h4 class="small" style="margin:8px 0 2px">ข้อเสีย</h4><ul class="cons">${pc.cons.map(x => `<li>${x}</li>`).join('') || '<li>ไม่พบจุดด้อยชัดเจน</li>'}</ul>
        </div>`; }).join('')}
      </div>
      <div class="cmp-card" style="margin-top:14px;overflow-x:auto">
        <h3 style="margin-top:0">คะแนนแต่ละด้าน (%)</h3>
        <table class="mtable"><tr><th></th>${items.map(l => `<th>${l.name}</th>`).join('')}</tr>${scoreRows}</table>
        <h3>รายละเอียด</h3>
        <table class="mtable"><tr><th></th>${items.map(l => `<th>${l.name}</th>`).join('')}</tr>${matrix}</table>
        <p class="small">ช่องสีเขียว = ดีที่สุดในแถว · ราคาเป็นข้อมูลจำลองที่อัปเดตสดจากแท็บแผนที่ (${live.t ? new Date(live.t).toLocaleTimeString('th-TH') : '—'})</p>
      </div>
    </div>
  </div>`;
}

document.addEventListener('input', e => {
  const k = e.target.dataset.w; if (!k) return;
  weights[k] = +e.target.value; e.target.previousElementSibling.querySelector('b').textContent = weights[k].toFixed(1);
});
document.addEventListener('change', e => { if (e.target.dataset.w) { store('ynd-weights', weights); render(); } });
document.addEventListener('click', e => {
  if (e.target.dataset.rm) { store('ynd-compare', (store('ynd-compare') || []).filter(x => x !== e.target.dataset.rm)); render(); }
  if (e.target.id === 'reset-w') { weights = { ...DEF_W }; store('ynd-weights', weights); render(); }
  if (e.target.closest('#mode') && e.target.dataset.v) { mode = e.target.dataset.v; render(); }
});
let rt; addEventListener('storage', e => { if (['ynd-compare', 'ynd-live', 'ynd-workplaces'].includes(e.key)) { clearTimeout(rt); rt = setTimeout(render, 150); } });
render();
