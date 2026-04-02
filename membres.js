// ════════════════════════════════════════════════════════════════
//  MEMBRES.JS — Module "Militants & membres"
//  ▶ Ce fichier ne change jamais. Seul membres-data.js change.
// ════════════════════════════════════════════════════════════════

(function () {

  // ── Constantes ───────────────────────────────────────────────
  const PROV_KEYS   = ['bruxelles','brabant_wallon','hainaut','liege','luxembourg','namur'];
  const PROV_LABELS = { bruxelles:'Bruxelles', brabant_wallon:'Brabant W.', hainaut:'Hainaut', liege:'Liège', luxembourg:'Luxembourg', namur:'Namur' };
  const PROV_COLORS = ['#002EFF','#1A8C3A','#862E9C','#CC0022','#B86800','#0077AA'];

  // ── Utilitaires ──────────────────────────────────────────────
  const fmt   = n => Number(n).toLocaleString('fr-BE');
  const s     = id => document.getElementById(id);
  const html  = (id, v) => { const el = s(id); if (el) el.innerHTML = v; };
  const txt   = (id, v) => { const el = s(id); if (el) el.textContent = v; };

  function pillCls(val, hi, mid) {
    if (val >= hi)  return 'pill-green';
    if (val >= mid) return 'pill-amber';
    return 'pill-red';
  }
  function destroyChart(id) { const c = Chart.getChart(id); if (c) c.destroy(); }

  // ── Point d'entrée ───────────────────────────────────────────
  function mbLoad() {
    const D = window.MEMBRES_DATA;
    if (!D) { console.error('membres-data.js non chargé'); return; }

    const last  = D.hebdo[D.hebdo.length - 1];
    const prev  = D.hebdo.length > 1 ? D.hebdo[D.hebdo.length - 2] : null;

    buildKPIs(D, last, prev);
    buildTabVueEnsemble(D, last, prev);
    buildTabEvolution(D);
    buildTabProvinces(D, last);
    buildTabSections(D, last);

    // Mise à jour statut global
    if (window.setGlobalStatus) window.setGlobalStatus('ok', 'Membres — ' + last.label);

    // Activer premier onglet
    mbShowTab('vue-ensemble', s('mb-tab-vue-ensemble'));
  }

  // ── KPIs en haut de page ─────────────────────────────────────
  function buildKPIs(D, last, prev) {
    const diffTotal = prev ? last.total - prev.total : 0;
    const fin2025   = D.annuel.total[D.annuel.annees.indexOf(2025)] || 0;
    const renouv    = fin2025 ? Math.round(last.total / fin2025 * 100) : 0;

    txt('mb-kpi-total',    fmt(last.total));
    txt('mb-kpi-date',     last.label);
    txt('mb-kpi-prog-sem', (diffTotal >= 0 ? '+' : '') + fmt(diffTotal));
    txt('mb-kpi-contacts', '+' + fmt(last.nouveaux_contacts));
    txt('mb-kpi-prog-heb', '+' + fmt(last.progression_semaine));
    txt('mb-kpi-renouv',   renouv + ' %');

    const el = s('mb-kpi-prog-sem');
    if (el) el.style.color = diffTotal >= 0 ? 'var(--green)' : 'var(--red)';
  }

  // ── Onglet Vue d'ensemble ────────────────────────────────────
  function buildTabVueEnsemble(D, last, prev) {
    // Barres provinces
    const maxVal = Math.max(...PROV_KEYS.map(k => last.provinces[k] || 0));
    html('mb-prov-bars', PROV_KEYS.map((k, i) => {
      const val  = last.provinces[k] || 0;
      const pval = prev ? (prev.provinces[k] || 0) : val;
      const diff = val - pval;
      const arw  = prev
        ? (diff >= 0
          ? `<span style="color:var(--green);font-size:10px">▲ ${fmt(diff)}</span>`
          : `<span style="color:var(--red);font-size:10px">▼ ${fmt(Math.abs(diff))}</span>`)
        : '';
      const pct = Math.round(val / maxVal * 100);
      return `<div class="bar-row">
        <div class="bar-label">${PROV_LABELS[k]}</div>
        <div class="bar-track"><div class="bar-fill" style="width:${pct}%;background:${PROV_COLORS[i]}"></div></div>
        <div class="bar-val">${fmt(val)} ${arw}</div>
      </div>`;
    }).join(''));

    // Tableau taux
    html('mb-taux-tbody', PROV_KEYS.map((k, i) => {
      const r = last.taux[k + '_renouv'] || 0;
      const a = last.taux[k + '_appels'] || 0;
      return `<tr>
        <td style="color:${PROV_COLORS[i]};font-weight:600">${PROV_LABELS[k]}</td>
        <td>${fmt(last.provinces[k] || 0)}</td>
        <td><span class="pill ${pillCls(r,70,60)}">${r} %</span></td>
        <td><span class="pill ${pillCls(a,50,40)}">${a} %</span></td>
      </tr>`;
    }).join(''));
  }

  // ── Onglet Évolution ─────────────────────────────────────────
  function buildTabEvolution(D) {
    const ann = D.annuel;

    // Graphe total annuel + hebdo
    destroyChart('mb-ch-total');
    const labelsAnn  = ann.annees.map(String);
    const valsAnn    = ann.total;

    // Ajouter points hebdo de l'année en cours si plusieurs semaines
    const hebdo2026 = D.hebdo.filter(h => h.date.startsWith('2026'));
    const labelsHeb = hebdo2026.map(h => h.label);
    const valsHeb   = hebdo2026.map(h => h.total);

    new Chart(s('mb-ch-total'), {
      type: 'line',
      data: {
        labels: labelsAnn,
        datasets: [{
          label: 'Total membres (annuel)',
          data: valsAnn,
          borderColor: '#002EFF',
          backgroundColor: 'rgba(0,46,255,0.07)',
          fill: true, tension: 0.35,
          pointRadius: labelsAnn.map(l => l === '2026' ? 7 : 4),
          pointBackgroundColor: labelsAnn.map(l => l === '2026' ? '#CC0022' : '#002EFF'),
        }]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false }, tooltip: { callbacks: { label: ctx => ' ' + fmt(ctx.parsed.y) + ' membres' } } },
        scales: {
          x: { ticks: { color: '#4A5785', font: { size: 11 } }, grid: { display: false } },
          y: { min: 15000, ticks: { color: '#4A5785', font: { size: 11 }, callback: v => fmt(v) }, grid: { color: 'rgba(0,46,255,0.07)' } }
        }
      }
    });

    // Graphe hebdo 2026 (si assez de données)
    destroyChart('mb-ch-hebdo');
    const hebWrap = s('mb-hebdo-wrap');
    if (D.hebdo.length > 1) {
      if (hebWrap) hebWrap.style.display = 'block';
      new Chart(s('mb-ch-hebdo'), {
        type: 'line',
        data: {
          labels: D.hebdo.map(h => h.label),
          datasets: [{
            label: 'Total membres',
            data: D.hebdo.map(h => h.total),
            borderColor: '#002EFF', backgroundColor: 'rgba(0,46,255,0.07)',
            fill: true, tension: 0.3, pointRadius: 5,
          }, {
            label: 'Nouveaux contacts',
            data: D.hebdo.map(h => h.nouveaux_contacts),
            borderColor: '#1A8C3A', backgroundColor: 'transparent',
            tension: 0.3, pointRadius: 4, yAxisID: 'y2',
          }]
        },
        options: {
          responsive: true, maintainAspectRatio: false,
          plugins: { legend: { display: false }, tooltip: { callbacks: { label: ctx => ' ' + fmt(ctx.parsed.y) } } },
          scales: {
            x: { ticks: { color: '#4A5785', font: { size: 11 } }, grid: { display: false } },
            y:  { position: 'left',  ticks: { color: '#002EFF', font: { size: 11 }, callback: v => fmt(v) }, grid: { color: 'rgba(0,46,255,0.07)' } },
            y2: { position: 'right', ticks: { color: '#1A8C3A', font: { size: 11 } }, grid: { display: false } }
          }
        }
      });
    } else {
      if (hebWrap) hebWrap.style.display = 'none';
    }

    // Graphe provinces multi-ligne
    destroyChart('mb-ch-prov-evol');
    new Chart(s('mb-ch-prov-evol'), {
      type: 'line',
      data: {
        labels: ann.annees.map(String),
        datasets: PROV_KEYS.map((k, i) => ({
          label: PROV_LABELS[k],
          data: ann.provinces[k],
          borderColor: PROV_COLORS[i], backgroundColor: 'transparent',
          tension: 0.3, pointRadius: 3, borderWidth: 2,
        }))
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false }, tooltip: { callbacks: { label: ctx => ' ' + ctx.dataset.label + ': ' + fmt(ctx.parsed.y) } } },
        scales: {
          x: { ticks: { color: '#4A5785', font: { size: 11 } }, grid: { display: false } },
          y: { ticks: { color: '#4A5785', font: { size: 11 }, callback: v => fmt(v) }, grid: { color: 'rgba(0,46,255,0.07)' } }
        }
      }
    });

    // Légende manuelle provinces
    html('mb-prov-legend', PROV_KEYS.map((k, i) =>
      `<span style="display:inline-flex;align-items:center;gap:4px;font-size:11px;color:#4A5785;cursor:pointer" onclick="mbToggleProv(${i})" id="mb-leg-${i}">
        <span style="width:10px;height:10px;border-radius:2px;background:${PROV_COLORS[i]};display:inline-block"></span>${PROV_LABELS[k]}
      </span>`
    ).join(''));
  }

  // ── Onglet Provinces ─────────────────────────────────────────
  function buildTabProvinces(D, last) {
    // Graphe barres provinces
    destroyChart('mb-ch-prov-bar');
    new Chart(s('mb-ch-prov-bar'), {
      type: 'bar',
      data: {
        labels: PROV_KEYS.map(k => PROV_LABELS[k]),
        datasets: [
          { label: '2026', data: PROV_KEYS.map(k => last.provinces[k] || 0), backgroundColor: PROV_COLORS, borderRadius: 4 },
          { label: '2024', data: PROV_KEYS.map(k => D.annuel.provinces[k]?.[D.annuel.annees.indexOf(2024)] || 0), backgroundColor: 'rgba(0,0,0,0.09)', borderRadius: 4 },
        ]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false }, tooltip: { callbacks: { label: ctx => ' ' + ctx.dataset.label + ': ' + fmt(ctx.parsed.y) } } },
        scales: {
          x: { ticks: { color: '#4A5785', font: { size: 11 } }, grid: { display: false } },
          y: { ticks: { color: '#4A5785', font: { size: 11 }, callback: v => fmt(v) }, grid: { color: 'rgba(0,46,255,0.07)' } }
        }
      }
    });

    // Graphe taux renouvellement
    destroyChart('mb-ch-renouv');
    new Chart(s('mb-ch-renouv'), {
      type: 'bar',
      data: {
        labels: PROV_KEYS.map(k => PROV_LABELS[k]),
        datasets: [{
          data: PROV_KEYS.map(k => last.taux[k + '_renouv'] || 0),
          backgroundColor: PROV_KEYS.map(k => {
            const v = last.taux[k + '_renouv'] || 0;
            return v >= 70 ? '#1A8C3A' : v >= 60 ? '#B86800' : '#CC0022';
          }),
          borderRadius: 4,
        }]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false }, tooltip: { callbacks: { label: ctx => ' ' + ctx.parsed.y + ' %' } } },
        scales: {
          x: { ticks: { color: '#4A5785', font: { size: 11 } }, grid: { display: false } },
          y: { min: 50, max: 80, ticks: { color: '#4A5785', font: { size: 11 }, callback: v => v + '%' }, grid: { color: 'rgba(0,46,255,0.07)' } }
        }
      }
    });
  }

  // ── Onglet Sections locales ───────────────────────────────────
  function buildTabSections(D, last) {
    const sec = D.sections;

    // Sélecteur province
    html('mb-prov-select', PROV_KEYS.map((k, i) =>
      `<button class="subnav-btn${i === 0 ? ' active' : ''}" onclick="mbSelectProv('${k}',this)" style="border-bottom:2px solid ${i===0?PROV_COLORS[i]:'transparent'};color:${i===0?PROV_COLORS[i]:'var(--muted)'}">${PROV_LABELS[k]}</button>`
    ).join(''));

    mbRenderSections(sec, 'bruxelles', last);
  }

  window.mbSelectProv = function(key, btn) {
    document.querySelectorAll('#mb-prov-select .subnav-btn').forEach((b, i) => {
      b.classList.remove('active');
      b.style.borderBottomColor = 'transparent';
      b.style.color = 'var(--muted)';
    });
    btn.classList.add('active');
    btn.style.borderBottomColor = PROV_COLORS[PROV_KEYS.indexOf(key)];
    btn.style.color = PROV_COLORS[PROV_KEYS.indexOf(key)];
    mbRenderSections(window.MEMBRES_DATA.sections, key, window.MEMBRES_DATA.hebdo[window.MEMBRES_DATA.hebdo.length - 1]);
  };

  function mbRenderSections(sec, provKey, last) {
    const prov = sec[provKey];
    if (!prov) return;
    const color = PROV_COLORS[PROV_KEYS.indexOf(provKey)];

    let out = '';
    Object.values(prov.arrondissements).forEach(arr => {
      out += `<div style="margin-bottom:20px">
        <div style="font-size:10px;font-weight:600;color:var(--muted);text-transform:uppercase;letter-spacing:.6px;padding:6px 12px;background:var(--surf2);border-radius:6px;margin-bottom:8px">${arr.label} — ${fmt(arr.membres)} membres</div>
        <div class="table-wrap"><table>
          <thead><tr>
            <th>Section</th><th>Mbr 2026</th><th>Mbr 2025</th><th>Mbr 2024</th>
            <th>Renouv.</th><th>Appels</th><th>Contacts</th><th>Prog. sem.</th>
          </tr></thead>
          <tbody>`;
      [...arr.sections].sort((a, b) => b.m26 - a.m26).forEach(s => {
        const diffY = s.m26 - s.m25;
        const progCls = s.prog > 0 ? 'color:var(--green)' : s.prog < 0 ? 'color:var(--red)' : 'color:var(--muted)';
        const diffCls = diffY > 0 ? 'color:var(--green)' : diffY < 0 ? 'color:var(--red)' : 'color:var(--muted)';
        out += `<tr>
          <td style="font-weight:500">${s.nom}</td>
          <td style="font-weight:600;color:${color}">${s.m26}</td>
          <td style="${diffCls}">${s.m25} (${diffY > 0 ? '+' : ''}${diffY})</td>
          <td style="color:var(--muted)">${s.m24}</td>
          <td><span class="pill ${pillCls(s.renouv,70,60)}">${s.renouv}%</span></td>
          <td><span class="pill ${pillCls(s.appels,50,40)}">${s.appels}%</span></td>
          <td style="color:var(--green)">${s.contacts > 0 ? '+' + s.contacts : s.contacts}</td>
          <td style="${progCls}">${s.prog > 0 ? '+' : ''}${s.prog}</td>
        </tr>`;
      });
      out += `</tbody></table></div></div>`;
    });
    html('mb-sections-list', out);
  }

  // ── Navigation onglets ────────────────────────────────────────
  window.mbShowTab = function(id, btn) {
    document.querySelectorAll('#page-militants .tab-section').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('#mb-subnav button').forEach(b => { b.classList.remove('active'); });
    const sec = document.getElementById('mb-section-' + id);
    if (sec) sec.classList.add('active');
    if (btn) btn.classList.add('active');
  };

  // ── Toggle province sur graphe évolution ─────────────────────
  window.mbToggleProv = function(i) {
    const chart = Chart.getChart('mb-ch-prov-evol');
    if (!chart) return;
    const ds = chart.data.datasets[i];
    ds.hidden = !ds.hidden;
    const leg = document.getElementById('mb-leg-' + i);
    if (leg) leg.style.opacity = ds.hidden ? '0.3' : '1';
    chart.update();
  };

  // ── Exposition publique ───────────────────────────────────────
  window.mbLoad = mbLoad;

})();
