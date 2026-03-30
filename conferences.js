// ================================================================
// MODULE CONFÉRENCES — conferences.js
// Données : onglet "data" du Google Sheet MR
// ================================================================

(function() {

const SHEET_ID = '1jmWqwF4l1Y1taD3Mhu0M3zPA3-5dqzRBmw-TJjBKk4k';
const SHEET_NAME = 'data';

// Palette MR + couleurs complémentaires pour les graphiques
const MR_BLUE   = '#002EFF';
const MR_ROYAL  = '#000F9F';
const MR_DARK   = '#000064';
const MR_WHITE  = '#FFFFFF';

const PAL = ['#002EFF','#0099DD','#FF2D55','#1A8C3A','#C47600','#5500DD','#CC2200','#0077AA','#6B21A8','#B45309'];

const CM = { muted:'#7A8BB5', grid:'rgba(0,46,255,0.08)', border:'rgba(0,46,255,0.15)' };

const FONT = { family:'Inter, system-ui, sans-serif', size:11 };

const COPTS = {
  responsive: true, maintainAspectRatio: false,
  plugins: {
    legend: { display: false },
    tooltip: {
      backgroundColor: '#000F9F',
      titleColor: '#fff',
      bodyColor: '#C8D4FF',
      borderColor: '#002EFF',
      borderWidth: 1,
      padding: 10,
      bodyFont:  { family:'Inter, system-ui, sans-serif', size:12 },
      titleFont: { family:'Inter, system-ui, sans-serif', size:12, weight:'600' }
    }
  },
  scales: {
    x: { ticks:{color:CM.muted, font:FONT, maxRotation:45, autoSkip:false}, grid:{color:CM.grid}, border:{color:CM.border} },
    y: { ticks:{color:CM.muted, font:FONT}, grid:{color:CM.grid}, border:{color:CM.border} }
  }
};

let ROWS = [];
let charts = {};

// ── Parsing ──────────────────────────────────────────────────────

function parseCSV(txt) {
  const lines = txt.trim().split('\n');
  return lines.map(line => {
    const cols = []; let cur = '', inQ = false;
    for (const c of line) {
      if (c === '"') { inQ = !inQ; continue; }
      if (c === ',' && !inQ) { cols.push(cur.trim()); cur = ''; continue; }
      cur += c;
    }
    cols.push(cur.trim());
    return cols;
  });
}

function toInt(v) {
  const x = parseInt(String(v || '').replace(/\s/g,'').replace(',','.'));
  return isNaN(x) ? 0 : x;
}

function fmt(n) { return Math.round(n).toLocaleString('fr-BE'); }
function fmtPct(r) { return (r * 100).toFixed(1) + '%'; }
function pillCls(r) {
  const p = r * 100;
  return p >= 80 ? 'pill-green' : p >= 65 ? 'pill-blue' : p >= 50 ? 'pill-amber' : 'pill-red';
}

// ── Fetch ────────────────────────────────────────────────────────

async function fetchData() {
  const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(SHEET_NAME)}&t=${Date.now()}`;
  const r = await fetch(url);
  if (!r.ok) throw new Error('HTTP ' + r.status);
  const csv = await r.text();
  const rows = parseCSV(csv);
  return rows.slice(1).filter(r => r[0] && r[0] !== 'Date' && r[2]).map(r => ({
    date: r[0], mois: r[1], commune: r[2], province: r[3],
    theme: r[4], ministre: r[5],
    inscrits: toInt(r[6]), membresMR: toInt(r[7]), nonMembres: toInt(r[8]),
    participants: toInt(r[9]),
  }));
}

// ── Agrégats ─────────────────────────────────────────────────────

function groupBy(rows, key) {
  const map = {};
  for (const r of rows) {
    const k = r[key] || '—';
    if (!map[k]) map[k] = [];
    map[k].push(r);
  }
  return map;
}

function agg(rows) {
  const inscrits     = rows.reduce((s,r) => s + r.inscrits, 0);
  const participants = rows.reduce((s,r) => s + r.participants, 0);
  const nonMembres   = rows.reduce((s,r) => s + r.nonMembres, 0);
  const nb           = rows.length;
  return {
    nb, inscrits, participants, nonMembres,
    membresMR:    rows.reduce((s,r) => s + r.membresMR, 0),
    tauxNonMR:    participants > 0 ? nonMembres / participants : 0,
    tauxParticip: inscrits     > 0 ? participants / inscrits   : 0,
    moyInscrits:  nb > 0 ? inscrits / nb : 0,
    moyPart:      nb > 0 ? participants / nb : 0,
  };
}

function computeMonthly(rows) {
  const byMonth = groupBy(rows, 'mois');
  return Object.keys(byMonth).sort().map(mois => ({ mois, ...agg(byMonth[mois]) }));
}

function computeByKey(rows, key) {
  const grouped = groupBy(rows, key);
  return Object.keys(grouped).sort().map(k => ({ label: k, ...agg(grouped[k]) }));
}

function expandMinisters(rows) {
  const out = [];
  for (const r of rows) {
    const names = r.ministre.split(/\s+et\s+/i).map(s => s.trim().replace(/\s*\(excusé\)/i,'').trim());
    for (const name of names) { if (name) out.push({ ...r, ministre: name }); }
  }
  return out;
}

// ── Charts ───────────────────────────────────────────────────────

function mkChart(id, type, data, extra = {}) {
  if (charts[id]) { charts[id].destroy(); delete charts[id]; }
  const el = document.getElementById(id);
  if (!el) return;
  charts[id] = new Chart(el, { type, data, options: { ...COPTS, ...extra } });
}

function renderBars(cid, items, max, labelFn, valFn, fmtFn) {
  const el = document.getElementById(cid);
  if (!el) return;
  el.innerHTML = items.map((r, i) => `
    <div class="bar-row">
      <div class="bar-label" title="${labelFn(r)}">${labelFn(r).length > 15 ? labelFn(r).slice(0,15)+'…' : labelFn(r)}</div>
      <div class="bar-track"><div class="bar-fill" style="width:${Math.min(100,(valFn(r)/max*100)).toFixed(1)}%;background:${PAL[i%PAL.length]};"></div></div>
      <div class="bar-val">${fmtFn(r)}</div>
    </div>`).join('');
}

// ── Render ───────────────────────────────────────────────────────

function render(rows) {
  const monthly    = computeMonthly(rows);
  const byProvince = computeByKey(rows, 'province');
  const byTheme    = computeByKey(rows, 'theme');
  const byMin      = computeByKey(expandMinisters(rows), 'ministre');
  const totals     = agg(rows);

  renderKPIs(totals, rows.length);
  renderOverview(rows, monthly, byProvince);
  renderEvolution(monthly);
  renderThemes(byTheme);
  renderMinistres(byMin);
  renderProvinces(byProvince);
  renderDetail(rows, byProvince, byTheme);
}

function renderKPIs(t, nbConf) {
  setText('k-total',        nbConf);
  setText('k-inscrits',     fmt(t.inscrits));
  setText('k-participants', fmt(t.participants));
  setText('k-nonmr',        fmtPct(t.tauxNonMR));
  setText('k-taux',         fmtPct(t.tauxParticip));
}

function renderOverview(rows, monthly, byProvince) {
  const lbl = monthly.map(r => r.mois.replace('20',''));

  mkChart('ch-overview', 'bar', {
    labels: lbl,
    datasets: [
      { label:'Inscrits',     data:monthly.map(r=>r.inscrits),     backgroundColor:'#002EFF', borderColor:'#001AC0', borderWidth:0, borderRadius:3 },
      { label:'Participants', data:monthly.map(r=>r.participants),  backgroundColor:'#0088DD', borderColor:'#006BB0', borderWidth:0, borderRadius:3 }
    ]
  }, { plugins:{...COPTS.plugins, legend:{display:true, labels:{color:CM.muted, font:FONT, boxWidth:10, padding:16}}} });

  mkChart('ch-nonmr', 'line', {
    labels: lbl,
    datasets: [{
      data: monthly.map(r => +(r.tauxNonMR*100).toFixed(1)),
      borderColor: MR_BLUE, backgroundColor: 'rgba(0,46,255,0.08)',
      tension:.4, fill:true, pointBackgroundColor:MR_BLUE, pointRadius:4, pointBorderColor:'#fff', pointBorderWidth:2
    }]
  }, { scales:{...COPTS.scales, y:{...COPTS.scales.y, min:0, ticks:{...COPTS.scales.y.ticks, callback:v=>v+'%'}}} });

  const provSorted = [...byProvince].sort((a,b) => b.nb - a.nb);
  renderBars('bars-province', provSorted, provSorted[0]?.nb||1, r=>r.label, r=>r.nb, r=>r.nb+' conf.');

  const top8 = [...rows].sort((a,b) => b.participants - a.participants).slice(0, 8);
  const el = document.getElementById('bars-top-conf');
  if (el) el.innerHTML = top8.map((r,i) => `
    <div class="bar-row">
      <div class="bar-label" title="${r.commune}">${r.commune.length>15?r.commune.slice(0,15)+'…':r.commune}</div>
      <div class="bar-track"><div class="bar-fill" style="width:${(r.participants/top8[0].participants*100).toFixed(1)}%;background:${PAL[i%PAL.length]};"></div></div>
      <div class="bar-val">${r.participants}</div>
    </div>`).join('');
}

function renderEvolution(monthly) {
  const lbl = monthly.map(r => r.mois.replace('20',''));

  mkChart('ch-evo-bar', 'bar', { labels:lbl, datasets:[
    { label:'Inscrits',     data:monthly.map(r=>r.inscrits),    backgroundColor:'#002EFF', borderColor:'#001AC0', borderWidth:0, borderRadius:3 },
    { label:'Participants', data:monthly.map(r=>r.participants), backgroundColor:'#0088DD', borderColor:'#006BB0', borderWidth:0, borderRadius:3 }
  ]}, { plugins:{...COPTS.plugins, legend:{display:true, labels:{color:CM.muted, font:FONT, boxWidth:10, padding:16}}} });

  mkChart('ch-nb-conf', 'bar', { labels:lbl, datasets:[
    { data:monthly.map(r=>r.nb), backgroundColor:'#002EFF', borderColor:'#001AC0', borderWidth:0, borderRadius:4 }
  ]});

  mkChart('ch-taux-evo', 'line', { labels:lbl, datasets:[
    { label:'Taux non-MR',       data:monthly.map(r=>+(r.tauxNonMR*100).toFixed(1)),    borderColor:MR_BLUE,   backgroundColor:'transparent', tension:.4, pointRadius:4, pointBackgroundColor:MR_BLUE,   pointBorderColor:'#fff', pointBorderWidth:2 },
    { label:'Taux participation', data:monthly.map(r=>+(r.tauxParticip*100).toFixed(1)), borderColor:'#00C2FF', backgroundColor:'transparent', tension:.4, pointRadius:4, pointBackgroundColor:'#00C2FF', pointBorderColor:'#fff', pointBorderWidth:2 }
  ]}, {
    plugins:{...COPTS.plugins, legend:{display:true, labels:{color:CM.muted, font:FONT, boxWidth:10, padding:16}}},
    scales:{...COPTS.scales, y:{...COPTS.scales.y, min:0, ticks:{...COPTS.scales.y.ticks, callback:v=>v+'%'}}}
  });

  const tbody = document.getElementById('tbl-mensuel');
  if (tbody) tbody.innerHTML = monthly.map(r => `<tr>
    <td>${r.mois}</td><td>${r.nb}</td>
    <td>${fmt(r.inscrits)}</td><td>${fmt(r.participants)}</td>
    <td>${fmt(r.membresMR)}</td><td>${fmt(r.nonMembres)}</td>
    <td>${fmtPct(r.tauxNonMR)}</td><td>${fmtPct(r.tauxParticip)}</td>
  </tr>`).join('');
}

function renderThemes(byTheme) {
  const sorted = [...byTheme].sort((a,b) => b.nb - a.nb);
  const h = Math.max(280, sorted.length * 36 + 60);
  const wrap = document.getElementById('wrap-themes-bar');
  if (wrap) wrap.style.height = h + 'px';

  mkChart('ch-themes-bar', 'bar', {
    labels: sorted.map(r => r.label.length > 28 ? r.label.slice(0,28)+'…' : r.label),
    datasets: [{ data:sorted.map(r=>r.nb), backgroundColor:PAL.slice(0,sorted.length), borderRadius:4 }]
  }, { indexAxis:'y', scales:{x:{...COPTS.scales.x,ticks:{...COPTS.scales.x.ticks,maxRotation:0}}, y:{...COPTS.scales.y}} });

  const tSorted = [...byTheme].sort((a,b) => b.tauxParticip - a.tauxParticip);
  renderBars('bars-theme-taux', tSorted, tSorted[0]?.tauxParticip||1, r=>r.label, r=>r.tauxParticip, r=>fmtPct(r.tauxParticip));

  const tbody = document.getElementById('tbl-themes');
  if (tbody) tbody.innerHTML = byTheme.map(r => `<tr>
    <td>${r.label}</td>
    <td>${r.nb}</td>
    <td>${fmt(r.inscrits)}</td>
    <td>${fmt(r.participants)}</td>
    <td>${Math.round(r.moyInscrits)}</td>
    <td><strong>${Math.round(r.moyPart)}</strong></td>
    <td>${fmtPct(r.tauxNonMR)}</td>
    <td><span class="pill ${pillCls(r.tauxParticip)}">${fmtPct(r.tauxParticip)}</span></td>
  </tr>`).join('');
}

function renderMinistres(byMin) {
  const sorted = [...byMin].sort((a,b) => b.nb - a.nb);

  mkChart('ch-min-bar', 'bar', {
    labels: sorted.map(r=>r.label),
    datasets: [{ data:sorted.map(r=>r.nb), backgroundColor:PAL.slice(0,sorted.length), borderRadius:4 }]
  });

  const partSorted = [...byMin].sort((a,b) => b.moyPart - a.moyPart);
  renderBars('bars-min-part', partSorted, partSorted[0]?.moyPart||1, r=>r.label, r=>r.moyPart, r=>Math.round(r.moyPart)+' moy.');

  const tbody = document.getElementById('tbl-ministres');
  if (tbody) tbody.innerHTML = sorted.map(r => `<tr>
    <td><strong>${r.label}</strong></td>
    <td>${r.nb}</td>
    <td>${Math.round(r.moyInscrits)}</td>
    <td><strong>${Math.round(r.moyPart)}</strong></td>
    <td>${fmtPct(r.tauxNonMR)}</td>
    <td><span class="pill ${pillCls(r.tauxParticip)}">${fmtPct(r.tauxParticip)}</span></td>
  </tr>`).join('');
}

function renderProvinces(byProvince) {
  const sorted = [...byProvince].sort((a,b) => b.nb - a.nb);

  mkChart('ch-prov-inscrits', 'bar', {
    labels: sorted.map(r=>r.label),
    datasets: [
      { label:'Moy. inscrits',      data:sorted.map(r=>Math.round(r.moyInscrits)), backgroundColor:'#002EFF', borderColor:'#001AC0', borderWidth:0, borderRadius:3 },
      { label:'Moy. participants',   data:sorted.map(r=>Math.round(r.moyPart)),     backgroundColor:'#0088DD', borderColor:'#006BB0', borderWidth:0, borderRadius:3 }
    ]
  }, { plugins:{...COPTS.plugins, legend:{display:true, labels:{color:CM.muted, font:FONT, boxWidth:10, padding:16}}} });

  const tpSorted = [...byProvince].sort((a,b) => b.tauxParticip - a.tauxParticip);
  renderBars('bars-prov-taux', tpSorted, tpSorted[0]?.tauxParticip||1, r=>r.label, r=>r.tauxParticip, r=>fmtPct(r.tauxParticip));

  const tbody = document.getElementById('tbl-provinces');
  if (tbody) tbody.innerHTML = sorted.map(r => `<tr>
    <td><strong>${r.label}</strong></td>
    <td>${r.nb}</td>
    <td>${Math.round(r.moyInscrits)}</td>
    <td><strong>${Math.round(r.moyPart)}</strong></td>
    <td>${fmtPct(r.tauxNonMR)}</td>
    <td><span class="pill ${pillCls(r.tauxParticip)}">${fmtPct(r.tauxParticip)}</span></td>
  </tr>`).join('');
}

function renderDetail(rows, byProvince, byTheme) {
  const selP = document.getElementById('filter-province');
  const selT = document.getElementById('filter-theme');
  if (!selP || !selT) return;

  if (selP.options.length <= 1) {
    [...byProvince].sort((a,b)=>a.label.localeCompare(b.label)).forEach(p => {
      const o = document.createElement('option'); o.value=p.label; o.textContent=p.label; selP.appendChild(o);
    });
    [...byTheme].sort((a,b)=>a.label.localeCompare(b.label)).forEach(t => {
      const o = document.createElement('option'); o.value=t.label; o.textContent=t.label; selT.appendChild(o);
    });
  }

  function apply() {
    const q  = (document.getElementById('search-input')?.value||'').toLowerCase();
    const pv = selP.value, th = selT.value;
    const filtered = rows.filter(r =>
      (!pv||r.province===pv)&&(!th||r.theme===th)&&
      (!q||[r.commune,r.theme,r.ministre,r.province].some(v=>v.toLowerCase().includes(q)))
    );
    const countEl = document.getElementById('filter-count');
    if (countEl) countEl.textContent = filtered.length + ' conf.';
    const tbody = document.getElementById('tbl-detail');
    if (!tbody) return;
    const tnmr = r => r.participants>0 ? r.nonMembres/r.participants : 0;
    const tp   = r => r.inscrits>0    ? r.participants/r.inscrits   : 0;
    tbody.innerHTML = filtered.map(r => `<tr>
      <td style="white-space:nowrap">${r.date}</td>
      <td>${r.commune}</td>
      <td><span class="pill pill-blue">${r.province}</span></td>
      <td style="max-width:150px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${r.theme}">${r.theme}</td>
      <td>${r.ministre}</td>
      <td>${r.inscrits}</td><td>${r.membresMR}</td><td>${r.nonMembres}</td>
      <td><strong>${r.participants}</strong></td>
      <td>${fmtPct(tnmr(r))}</td>
      <td><span class="pill ${pillCls(tp(r))}">${fmtPct(tp(r))}</span></td>
    </tr>`).join('');
  }

  document.getElementById('search-input')?.addEventListener('input', apply);
  selP.addEventListener('change', apply);
  selT.addEventListener('change', apply);
  apply();
}

// ── Utils ────────────────────────────────────────────────────────

function setText(id, val) { const el=document.getElementById(id); if(el) el.textContent=val; }

function showLoading(show) {
  const l=document.getElementById('conf-loading');
  const c=document.getElementById('conf-content');
  if(l) l.style.display=show?'flex':'none';
  if(c) c.style.display=show?'none':'block';
}

// ── Public ───────────────────────────────────────────────────────

async function load() {
  window.setGlobalStatus('loading','Chargement…');
  showLoading(true);
  try {
    ROWS = await fetchData();
    render(ROWS);
    showLoading(false);
    const now = new Date().toLocaleTimeString('fr-BE',{hour:'2-digit',minute:'2-digit'});
    window.setGlobalStatus('ok','Mis à jour '+now);
  } catch(e) {
    console.error(e);
    window.setGlobalStatus('error','Erreur de connexion');
    const l=document.getElementById('conf-loading');
    if(l) l.innerHTML=`
      <div style="color:#FF2D55;font-size:14px;font-weight:600;">Impossible de charger les données.</div>
      <div style="color:#7A8BB5;font-size:12px;margin-top:6px;">Vérifiez que le Google Sheet est public (onglet "data").</div>
      <button onclick="window.confLoad()" style="margin-top:14px;background:#002EFF;color:#fff;border:none;border-radius:6px;padding:8px 20px;font-family:'Inter',sans-serif;cursor:pointer;font-weight:600;">Réessayer</button>`;
  }
}

window.confLoad    = load;
window.confRefresh = load;

if (window._confInterval) clearInterval(window._confInterval);
window._confInterval = setInterval(load, 5*60*1000);

load();

})();
