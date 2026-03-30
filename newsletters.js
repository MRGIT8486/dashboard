// ================================================================
// MODULE NEWSLETTERS — newsletters.js
// Données : onglets "Newsletter" et "Scores" du Google Sheet Mailchimp MR
// Sheet ID : 1v3H7rckC8P2-mG6DwLTxEe8J7NVqz52DVdbR-q4rzj8
// ================================================================

(function () {

  const SHEET_ID   = '1v3H7rckC8P2-mG6DwLTxEe8J7NVqz52DVdbR-q4rzj8';
  const SHEET_NL   = 'Newsletter';
  const SHEET_SC   = 'Scores';

  // ── Palette MR ─────────────────────────────────────────────────
  const MR_BLUE  = '#002EFF';
  const MR_SAM   = '#002EFF';   // Samedi
  const MR_DIM   = '#FF2D55';   // Dimanche
  const CM       = { muted:'#7A8BB5', grid:'rgba(0,46,255,0.08)', border:'rgba(0,46,255,0.15)' };
  const FONT     = { family:'DM Sans, system-ui, sans-serif', size:11 };

  const COPTS = {
    responsive: true, maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor:'#000F9F', titleColor:'#fff', bodyColor:'#C8D4FF',
        borderColor:'#002EFF', borderWidth:1, padding:10,
        bodyFont:{ family:'DM Sans, system-ui, sans-serif', size:12 },
        titleFont:{ family:'DM Sans, system-ui, sans-serif', size:12, weight:'600' }
      }
    },
    scales: {
      x: { ticks:{color:CM.muted,font:FONT,maxRotation:45,autoSkip:true}, grid:{color:CM.grid}, border:{color:CM.border} },
      y: { ticks:{color:CM.muted,font:FONT}, grid:{color:CM.grid}, border:{color:CM.border} }
    }
  };

  let NL_ROWS   = [];
  let SC_ROWS   = [];
  let nl_charts = {};

  // ── Parsing CSV ─────────────────────────────────────────────────
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

  function toNum(v) {
    const s = String(v || '').replace(',', '.').trim();
    const n = parseFloat(s);
    return isNaN(n) ? null : n;
  }

  function fmt2(n) { return n != null ? n.toFixed(2) : '—'; }
  function fmt1(n) { return n != null ? n.toFixed(1) : '—'; }
  function fmtPct(n) { return n != null ? n.toFixed(2) + ' %' : '—'; }
  function fmtN(n) { return n != null ? Math.round(n).toLocaleString('fr-BE') : '—'; }

  // ── Score styling ────────────────────────────────────────────────
  function scoreClass(s) {
    if (s == null) return '';
    if (s >= 110) return 'pill-green';
    if (s >= 90)  return 'pill-blue';
    if (s >= 75)  return 'pill-amber';
    return 'pill-red';
  }

  function trendArrow(diff) {
    if (diff == null) return '';
    const cls = diff >= 0 ? 'color:var(--green)' : 'color:var(--red)';
    const arrow = diff >= 0 ? '▲' : '▼';
    return `<span style="${cls};font-size:11px;margin-left:4px;">${arrow} ${Math.abs(diff).toFixed(1)}</span>`;
  }

  // ── Fetch ────────────────────────────────────────────────────────
  async function fetchSheet(sheetName) {
    const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(sheetName)}&t=${Date.now()}`;
    const r = await fetch(url);
    if (!r.ok) throw new Error('HTTP ' + r.status + ' pour ' + sheetName);
    return r.text();
  }

  function parseNL(csv) {
    const rows = parseCSV(csv);
    if (rows.length < 2) return [];
    // headers: semaine,campagne,type,emails_envoyes,emails_delivres,taux_ouverture,
    //          ouvertures_uniques,taux_clic,clics_uniques,taux_bounce,desabonnements,
    //          taux_desabonnement,signalements_spam
    return rows.slice(1).filter(r => r[0] && r[0] !== 'semaine').map(r => ({
      semaine:            r[0],
      campagne:           r[1],
      type:               r[2],
      emails_envoyes:     toNum(r[3]),
      emails_delivres:    toNum(r[4]),
      taux_ouverture:     toNum(r[5]),
      ouvertures_uniques: toNum(r[6]),
      taux_clic:          toNum(r[7]),
      clics_uniques:      toNum(r[8]),
      taux_bounce:        toNum(r[9]),
      desabonnements:     toNum(r[10]),
      taux_desabonnement: toNum(r[11]),
      signalements_spam:  toNum(r[12]),
    }));
  }

  function parseSC(csv) {
    const rows = parseCSV(csv);
    if (rows.length < 2) return [];
    // headers: semaine,type,score_engagement,moy_ouverture_52,moy_clic_52,moy_desabo_52,
    //          est_derniere,diff_score
    return rows.slice(1).filter(r => r[0] && r[0] !== 'semaine').map(r => ({
      semaine:         r[0],
      type:            r[1],
      score:           toNum(r[2]),
      moy_ouverture:   toNum(r[3]),
      moy_clic:        toNum(r[4]),
      moy_desabo:      toNum(r[5]),
      est_derniere:    parseInt(r[6]) === 1,
      diff_score:      toNum(r[7]),
    }));
  }

  // ── Chart helpers ────────────────────────────────────────────────
  function mkChart(id, type, data, extra) {
    if (nl_charts[id]) { nl_charts[id].destroy(); delete nl_charts[id]; }
    const el = document.getElementById(id);
    if (!el) return;
    nl_charts[id] = new Chart(el, { type, data, options: Object.assign({}, COPTS, extra || {}) });
  }

  function setText(id, val) { const el = document.getElementById(id); if (el) el.textContent = val; }

  // ── Render KPIs ─────────────────────────────────────────────────
  function renderNLKPIs(nlRows, scRows) {
    // Dernière newsletter Samedi & Dimanche
    ['Samedi','Dimanche'].forEach(type => {
      const prefix = type === 'Samedi' ? 'sam' : 'dim';
      const last   = nlRows.filter(r => r.type === type).slice(-1)[0];
      const lastSc = scRows.filter(r => r.type === type && r.est_derniere).slice(-1)[0];

      if (last) {
        setText(`nl-${prefix}-date`,   last.semaine);
        setText(`nl-${prefix}-envoi`,  fmtN(last.emails_envoyes));
        setText(`nl-${prefix}-ouv`,    fmtPct(last.taux_ouverture));
        setText(`nl-${prefix}-clic`,   fmtPct(last.taux_clic));
        setText(`nl-${prefix}-desabo`, last.taux_desabonnement != null ? last.taux_desabonnement.toFixed(3) + ' %' : '—');
      }
      if (lastSc) {
        const scoreEl = document.getElementById(`nl-${prefix}-score`);
        if (scoreEl) {
          scoreEl.innerHTML = lastSc.score != null
            ? `<span class="pill ${scoreClass(lastSc.score)}">${lastSc.score.toFixed(1)}</span>${trendArrow(lastSc.diff_score)}`
            : '—';
        }
      }
    });
  }

  // ── Render Vue d'ensemble ────────────────────────────────────────
  function renderNLOverview(nlRows, scRows) {
    // Graphique taux ouverture + clic par semaine pour chaque type
    ['Samedi','Dimanche'].forEach((type, idx) => {
      const subset  = nlRows.filter(r => r.type === type).slice(-20);
      const labels  = subset.map(r => r.semaine.slice(5));  // MM-DD
      const colOuv  = type === 'Samedi' ? MR_SAM : MR_DIM;
      const colClic = type === 'Samedi' ? '#0099DD' : '#FF8C00';

      const chartId = `nl-ch-${type.toLowerCase()}-ouv`;
      mkChart(chartId, 'line', {
        labels,
        datasets: [
          { label:'Taux ouverture', data: subset.map(r => r.taux_ouverture), borderColor: colOuv, backgroundColor:'transparent', tension:.4, pointRadius:4, pointBackgroundColor:colOuv, pointBorderColor:'#fff', pointBorderWidth:2 },
          { label:'Taux clic',      data: subset.map(r => r.taux_clic),      borderColor: colClic, backgroundColor:'transparent', tension:.4, pointRadius:4, pointBackgroundColor:colClic, pointBorderColor:'#fff', pointBorderWidth:2, borderDash:[5,3] }
        ]
      }, {
        plugins:{ ...COPTS.plugins, legend:{ display:true, labels:{color:CM.muted,font:FONT,boxWidth:10,padding:16} } },
        scales:{ ...COPTS.scales, y:{ ...COPTS.scales.y, min:0, ticks:{...COPTS.scales.y.ticks, callback:v=>v+'%'} } }
      });
    });

    // Graphique scores engagement
    ['Samedi','Dimanche'].forEach(type => {
      const subset  = scRows.filter(r => r.type === type && r.score != null).slice(-20);
      const labels  = subset.map(r => r.semaine.slice(5));
      const col     = type === 'Samedi' ? MR_SAM : MR_DIM;
      const chartId = `nl-ch-${type.toLowerCase()}-score`;

      mkChart(chartId, 'bar', {
        labels,
        datasets: [{ data: subset.map(r => r.score), backgroundColor: subset.map(r => scoreColorHex(r.score)), borderRadius:4 }]
      }, {
        plugins:{ ...COPTS.plugins, legend:{ display:false } },
        scales:{ ...COPTS.scales, y:{ ...COPTS.scales.y, min:0, max:200, ticks:{...COPTS.scales.y.ticks} } }
      });

      // Ligne de référence 100
      const ref100El = document.getElementById(`nl-ref-${type.toLowerCase()}`);
      // handled via chart annotation or just CSS label
    });
  }

  function scoreColorHex(s) {
    if (s == null)  return '#9AA5C8';
    if (s >= 110)   return '#1A8C3A';
    if (s >= 90)    return '#002EFF';
    if (s >= 75)    return '#B86800';
    return '#CC0022';
  }

  // ── Render Évolution ─────────────────────────────────────────────
  function renderNLEvolution(nlRows) {
    // Envois au fil du temps (Samedi + Dimanche)
    const allDates = [...new Set(nlRows.map(r => r.semaine))].sort();
    const labels   = allDates.map(d => d.slice(5));

    const dataEnvSam = allDates.map(d => { const r = nlRows.find(x => x.semaine===d && x.type==='Samedi'); return r ? r.emails_envoyes : null; });
    const dataEnvDim = allDates.map(d => { const r = nlRows.find(x => x.semaine===d && x.type==='Dimanche'); return r ? r.emails_envoyes : null; });

    mkChart('nl-ch-envois', 'line', {
      labels,
      datasets: [
        { label:'Envois Samedi',   data:dataEnvSam, borderColor:MR_SAM, backgroundColor:'rgba(0,46,255,0.08)', tension:.4, fill:true, pointRadius:3, pointBackgroundColor:MR_SAM, pointBorderColor:'#fff', pointBorderWidth:1 },
        { label:'Envois Dimanche', data:dataEnvDim, borderColor:MR_DIM, backgroundColor:'rgba(255,45,85,0.08)', tension:.4, fill:true, pointRadius:3, pointBackgroundColor:MR_DIM, pointBorderColor:'#fff', pointBorderWidth:1 },
      ]
    }, { plugins:{...COPTS.plugins, legend:{display:true, labels:{color:CM.muted,font:FONT,boxWidth:10,padding:16}}} });

    // Taux ouverture comparé
    const dataOuvSam = allDates.map(d => { const r = nlRows.find(x => x.semaine===d && x.type==='Samedi'); return r ? r.taux_ouverture : null; });
    const dataOuvDim = allDates.map(d => { const r = nlRows.find(x => x.semaine===d && x.type==='Dimanche'); return r ? r.taux_ouverture : null; });
    mkChart('nl-ch-ouv-compare', 'line', {
      labels,
      datasets: [
        { label:'Ouverture Samedi',   data:dataOuvSam, borderColor:MR_SAM, backgroundColor:'transparent', tension:.4, pointRadius:3, pointBackgroundColor:MR_SAM, pointBorderColor:'#fff', pointBorderWidth:1 },
        { label:'Ouverture Dimanche', data:dataOuvDim, borderColor:MR_DIM, backgroundColor:'transparent', tension:.4, pointRadius:3, pointBackgroundColor:MR_DIM, pointBorderColor:'#fff', pointBorderWidth:1 },
      ]
    }, {
      plugins:{...COPTS.plugins, legend:{display:true, labels:{color:CM.muted,font:FONT,boxWidth:10,padding:16}}},
      scales:{...COPTS.scales, y:{...COPTS.scales.y, ticks:{...COPTS.scales.y.ticks, callback:v=>v+'%'}}}
    });

    // Taux clic comparé
    const dataClicSam = allDates.map(d => { const r = nlRows.find(x => x.semaine===d && x.type==='Samedi'); return r ? r.taux_clic : null; });
    const dataClicDim = allDates.map(d => { const r = nlRows.find(x => x.semaine===d && x.type==='Dimanche'); return r ? r.taux_clic : null; });
    mkChart('nl-ch-clic-compare', 'line', {
      labels,
      datasets: [
        { label:'Clic Samedi',   data:dataClicSam, borderColor:MR_SAM, backgroundColor:'transparent', tension:.4, pointRadius:3, pointBackgroundColor:MR_SAM, pointBorderColor:'#fff', pointBorderWidth:1, borderDash:[5,3] },
        { label:'Clic Dimanche', data:dataClicDim, borderColor:MR_DIM, backgroundColor:'transparent', tension:.4, pointRadius:3, pointBackgroundColor:MR_DIM, pointBorderColor:'#fff', pointBorderWidth:1, borderDash:[5,3] },
      ]
    }, {
      plugins:{...COPTS.plugins, legend:{display:true, labels:{color:CM.muted,font:FONT,boxWidth:10,padding:16}}},
      scales:{...COPTS.scales, y:{...COPTS.scales.y, ticks:{...COPTS.scales.y.ticks, callback:v=>v+'%'}}}
    });
  }

  // ── Render Scores ────────────────────────────────────────────────
  function renderNLScores(scRows) {
    ['Samedi','Dimanche'].forEach(type => {
      const subset = scRows.filter(r => r.type === type && r.score != null).slice(-30);
      const labels = subset.map(r => r.semaine.slice(5));

      mkChart(`nl-ch-score-${type.toLowerCase()}`, 'bar', {
        labels,
        datasets: [{
          data: subset.map(r => r.score),
          backgroundColor: subset.map(r => scoreColorHex(r.score)),
          borderRadius: 4
        }]
      }, {
        plugins:{...COPTS.plugins},
        scales:{ ...COPTS.scales, y:{...COPTS.scales.y, min:0, max:200} }
      });
    });

    // Tableau des scores
    const tbody = document.getElementById('nl-tbl-scores');
    if (!tbody) return;
    const allScores = [...scRows].sort((a,b) => b.semaine.localeCompare(a.semaine)).slice(0,40);
    tbody.innerHTML = allScores.map(r => `<tr>
      <td style="white-space:nowrap">${r.semaine}</td>
      <td><span class="pill ${r.type==='Samedi'?'pill-blue':'pill-red'}">${r.type}</span></td>
      <td>${r.score != null ? `<span class="pill ${scoreClass(r.score)}">${r.score.toFixed(1)}</span>${trendArrow(r.diff_score)}` : '—'}</td>
      <td>${fmt2(r.moy_ouverture)} %</td>
      <td>${fmt2(r.moy_clic)} %</td>
      <td>${r.moy_desabo != null ? r.moy_desabo.toFixed(3) : '—'} %</td>
    </tr>`).join('');
  }

  // ── Render Tableau données ────────────────────────────────────────
  function renderNLTable(nlRows) {
    const tbody = document.getElementById('nl-tbl-raw');
    if (!tbody) return;
    const sorted = [...nlRows].sort((a,b) => b.semaine.localeCompare(a.semaine));
    tbody.innerHTML = sorted.map(r => `<tr>
      <td style="white-space:nowrap">${r.semaine}</td>
      <td style="max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${r.campagne}">${r.campagne}</td>
      <td><span class="pill ${r.type==='Samedi'?'pill-blue':'pill-red'}">${r.type}</span></td>
      <td>${fmtN(r.emails_envoyes)}</td>
      <td>${fmtN(r.emails_delivres)}</td>
      <td><strong>${fmtPct(r.taux_ouverture)}</strong></td>
      <td>${fmtPct(r.taux_clic)}</td>
      <td>${r.taux_desabonnement != null ? r.taux_desabonnement.toFixed(3)+' %' : '—'}</td>
      <td>${fmtPct(r.taux_bounce)}</td>
    </tr>`).join('');
  }

  // ── Render complet ───────────────────────────────────────────────
  function renderAll(nlRows, scRows) {
    renderNLKPIs(nlRows, scRows);
    renderNLOverview(nlRows, scRows);
    renderNLEvolution(nlRows);
    renderNLScores(scRows);
    renderNLTable(nlRows);
  }

  // ── Loading state ─────────────────────────────────────────────────
  function showNLLoading(show) {
    const l = document.getElementById('nl-loading');
    const c = document.getElementById('nl-content');
    if (l) l.style.display = show ? 'flex' : 'none';
    if (c) c.style.display = show ? 'none'  : 'block';
  }

  // ── Tab switching scoped to newsletters ──────────────────────────
  window.showNLTab = function(id, btn) {
    document.querySelectorAll('#page-newsletters .tab-section').forEach(s => s.classList.remove('active'));
    document.querySelectorAll('#nl-subnav button').forEach(b => b.classList.remove('active'));
    document.getElementById('nl-tab-' + id).classList.add('active');
    btn.classList.add('active');
  };

  // ── Load ─────────────────────────────────────────────────────────
  async function load() {
    window.setGlobalStatus('loading', 'Chargement newsletters…');
    showNLLoading(true);
    try {
      const [csvNL, csvSC] = await Promise.all([
        fetchSheet(SHEET_NL),
        fetchSheet(SHEET_SC),
      ]);
      NL_ROWS = parseNL(csvNL);
      SC_ROWS = parseSC(csvSC);
      renderAll(NL_ROWS, SC_ROWS);
      showNLLoading(false);
      const now = new Date().toLocaleTimeString('fr-BE', { hour:'2-digit', minute:'2-digit' });
      window.setGlobalStatus('ok', 'Mis à jour ' + now);
    } catch(e) {
      console.error(e);
      window.setGlobalStatus('error', 'Erreur newsletters');
      const l = document.getElementById('nl-loading');
      if (l) l.innerHTML = `
        <div style="color:#FF2D55;font-size:14px;font-weight:600;">Impossible de charger les données newsletter.</div>
        <div style="color:#7A8BB5;font-size:12px;margin-top:6px;">Vérifiez que le Google Sheet est public (onglets "Newsletter" et "Scores").</div>
        <button onclick="window.nlLoad()" style="margin-top:14px;background:#002EFF;color:#fff;border:none;border-radius:6px;padding:8px 20px;font-family:'DM Sans',sans-serif;cursor:pointer;font-weight:600;">Réessayer</button>`;
    }
  }

  window.nlLoad    = load;
  window.nlRefresh = load;

  // Auto-refresh toutes les 5 min (si page active)
  if (window._nlInterval) clearInterval(window._nlInterval);
  window._nlInterval = setInterval(() => {
    const page = document.getElementById('page-newsletters');
    if (page && page.classList.contains('active')) load();
  }, 5 * 60 * 1000);

  // Chargement au clic sur l'onglet (lazy load)
  // Le chargement initial est déclenché depuis index.html via showPage()

})();
