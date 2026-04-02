// ══════════════════════════════════════════════════════════════
//  MODULE RÉSEAUX SOCIAUX — MR Dashboard  v6
//  FB+IG combinés · filtres réseau/période · thèmes IA
// ══════════════════════════════════════════════════════════════
(function () {

  const CFG = {
    TOKEN : 'EAAUYBzkOe7sBRLpwk0ZC36nMTimBDFKZAMmZC4024IZA8HrGFO4rbiffKxyr7ZAQo5hHKbo9F6E564YxrewPwJSXF2ypxbxTr5f6JAtgue354RVMbihV51ToSDCVg3ZCZAZChBtMd6wHSB3Di9dirqRHZB0dZBFnCQAIaZAg1RCAZAfpcPpJOILZCeTvyD2NQ6o8ZAzzyrywZDZD',
    FB_ID : '236330169511',
    IG_ID : '17841404954117626',
    BASE  : 'https://graph.facebook.com/v25.0',
    THEMES: ['Agriculture','Bonne gouvernance','Emploi','Énergie','Enseignement',
             'Fiscalité','International','Justice','Logement','Médias',
             'Mobilité','Pensions','Pouvoir d\'achat','Réseaux sociaux',
             'Santé','Sécurité','Social'],
    FOLLOWERS_KEY: 'mr_rs_followers_history',
  };

  // ── Utilitaires ────────────────────────────────────────────
  function fmt(n) {
    if (!n && n !== 0) return '—';
    if (n >= 1000000) return (n/1000000).toFixed(1).replace('.',',') + '\u00a0M';
    if (n >= 10000)   return Math.round(n/1000) + '\u00a0k';
    if (n >= 1000)    return (Math.round(n/100)/10).toFixed(1).replace('.',',') + '\u00a0k';
    return Number(n).toLocaleString('fr-BE');
  }
  function ago(iso) {
    if (!iso) return '';
    const s = Math.floor((Date.now() - new Date(iso)) / 1000);
    if (s < 60)     return "à l'instant";
    if (s < 3600)   return `il y a ${Math.floor(s/60)} min`;
    if (s < 86400)  return `il y a ${Math.floor(s/3600)} h`;
    if (s < 604800) return `il y a ${Math.floor(s/86400)} j`;
    return new Date(iso).toLocaleDateString('fr-BE',{day:'2-digit',month:'2-digit'});
  }
  function set(id, v) { const e = document.getElementById(id); if(e) e.textContent = v; }
  async function api(path) {
    const sep = path.includes('?') ? '&' : '?';
    const r = await fetch(`${CFG.BASE}/${path}${sep}access_token=${CFG.TOKEN}`);
    const j = await r.json();
    if (j.error) throw new Error(j.error.message);
    return j;
  }

  // ── Couleurs ───────────────────────────────────────────────
  const C = {
    fb: '#1877F2', fbA: 'rgba(24,119,242,0.55)',
    ig: '#dc2743', igA: 'rgba(220,39,67,0.55)',
    both: '#5500DD', bothA: 'rgba(85,0,221,0.45)',
    IMAGE: { bg:'rgba(0,46,255,0.55)', bd:'#002EFF' },
    VIDEO: { bg:'rgba(220,39,67,0.60)', bd:'#dc2743' },
    CAROUSEL_ALBUM: { bg:'rgba(184,104,0,0.55)', bd:'#B86800' },
    FB_POST: { bg:'rgba(24,119,242,0.55)', bd:'#1877F2' },
  };

  // ── État global ────────────────────────────────────────────
  let _state = { network: 'both', period: '4w', fbPosts: [], igPosts: [], fb: null, ig: null, themes: {} };
  const _charts = {};

  // ── Shell HTML ─────────────────────────────────────────────
  function buildShell() {
    document.getElementById('page-reseaux').innerHTML = `
      <div class="topbar">
        <div class="topbar-left">
          <button class="hamburger" onclick="openSidebar()">☰</button>
          <div>
            <div class="topbar-title">Réseaux sociaux</div>
            <div class="topbar-sub" id="rs-sub">Chargement…</div>
          </div>
        </div>
        <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
          <!-- Filtre réseau -->
          <div style="display:flex;gap:2px;background:var(--surf2);border-radius:8px;padding:3px;">
            <button class="rs-net-btn active" onclick="rsSetNetwork('both',this)">FB + IG</button>
            <button class="rs-net-btn" onclick="rsSetNetwork('fb',this)" style="color:#1877F2;">Facebook</button>
            <button class="rs-net-btn" onclick="rsSetNetwork('ig',this)" style="color:#dc2743;">Instagram</button>
          </div>
          <!-- Filtre période -->
          <div style="display:flex;gap:2px;background:var(--surf2);border-radius:8px;padding:3px;">
            <button class="rs-per-btn" onclick="rsSetPeriod('1w',this)">1 sem.</button>
            <button class="rs-per-btn active" onclick="rsSetPeriod('4w',this)">1 mois</button>
            <button class="rs-per-btn" onclick="rsSetPeriod('8w',this)">2 mois</button>
            <button class="rs-per-btn" onclick="rsSetPeriod('all',this)">Tout</button>
          </div>
          <button class="btn-refresh" onclick="window._rsLoad(true)">↻</button>
          <button onclick="rsPasteStats()" style="background:var(--green);color:#fff;border:none;border-radius:8px;padding:6px 12px;font-size:11px;font-family:'DM Sans',sans-serif;cursor:pointer;font-weight:500;" title="Coller les stats Facebook copiées par le bookmarklet">📋 Coller stats FB</button>
        </div>
      </div>

      <div style="padding:16px 24px 40px;flex:1;overflow-y:auto;">

        <!-- Onglets -->
        <div style="display:flex;border-bottom:1px solid var(--border);margin-bottom:18px;overflow-x:auto;">
          <button class="rs-tab active" onclick="rsTab('global',this)">Vue globale</button>
          <button class="rs-tab" onclick="rsTab('stats',this)">Stats FB avancées</button>
          <button class="rs-tab" onclick="rsTab('evolution',this)">Évolution</button>
          <button class="rs-tab" onclick="rsTab('posts',this)">Posts</button>
          <button class="rs-tab" onclick="rsTab('types',this)">Par type</button>
          <button class="rs-tab" onclick="rsTab('themes',this)">Thèmes</button>
          <button class="rs-tab" onclick="rsTab('facebook',this)">Facebook</button>
          <button class="rs-tab" onclick="rsTab('instagram',this)">Instagram</button>
        </div>

        <!-- ══ STATS FB AVANCÉES ══ -->
        <div id="rs-s-stats" class="rs-s" style="display:none;">

          <!-- Évolution journalière sur 90 jours -->
          <div class="card" style="margin-bottom:14px;">
            <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;">
              <div class="card-title">Vues — évolution journalière (90 jours)</div>
              <div style="font-size:11px;color:var(--muted);" id="st-daily-note">Utilisez le bookmarklet v2 pour activer ce graphique</div>
            </div>
            <div class="chart-wrap" style="height:200px"><canvas id="st-ch-daily-vues"></canvas></div>
          </div>
          <div class="card" style="margin-bottom:14px;">
            <div class="card-title">Interactions — évolution journalière (90 jours)</div>
            <div class="chart-wrap" style="height:180px"><canvas id="st-ch-daily-inter"></canvas></div>
          </div>

          <!-- KPIs principaux -->
          <div class="charts-grid" style="grid-template-columns:repeat(auto-fit,minmax(148px,1fr));gap:12px;margin-bottom:16px;" id="st-kpis-row"></div>

          <!-- Vues + Interactions côte à côte -->
          <div class="charts-grid" style="gap:14px;margin-bottom:14px;">
            <div class="card">
              <div class="card-title">Répartition des vues par type de contenu</div>
              <div style="font-size:11px;color:var(--muted);margin-bottom:8px;" id="st-periode-label"></div>
              <div id="st-vues-bars" style="margin-top:8px;"></div>
            </div>
            <div class="card">
              <div class="card-title">Répartition des interactions</div>
              <div class="chart-wrap" style="height:200px"><canvas id="st-ch-inter-donut"></canvas></div>
            </div>
          </div>

          <!-- Vues followers vs non-followers + qualité -->
          <div class="charts-grid" style="gap:14px;margin-bottom:14px;">
            <div class="card">
              <div class="card-title">Vues — Followers vs Non-followers</div>
              <div class="chart-wrap" style="height:180px"><canvas id="st-ch-fol-split"></canvas></div>
            </div>
            <div class="card">
              <div class="card-title">Qualité des vues</div>
              <div id="st-vues-quality" style="padding-top:8px;"></div>
            </div>
          </div>

          <!-- Démographie audience -->
          <div class="charts-grid" style="gap:14px;margin-bottom:14px;">
            <div class="card">
              <div class="card-title">Répartition par âge (audience)</div>
              <div class="chart-wrap" style="height:220px"><canvas id="st-ch-age"></canvas></div>
            </div>
            <div class="card">
              <div class="card-title">Pays d'origine</div>
              <div id="st-pays-bars" style="margin-top:8px;"></div>
            </div>
          </div>

          <!-- Villes + Audience nets -->
          <div class="charts-grid" style="gap:14px;margin-bottom:14px;">
            <div class="card">
              <div class="card-title">Principales villes</div>
              <div id="st-villes-bars" style="margin-top:8px;"></div>
            </div>
            <div class="card">
              <div class="card-title">Abonnements nets</div>
              <div id="st-audience-kpis" style="margin-top:8px;"></div>
            </div>
          </div>

          <!-- Note source + bouton coller -->
          <div style="display:flex;align-items:center;justify-content:space-between;padding:10px 14px;background:var(--surf2);border-radius:8px;font-size:12px;color:var(--muted);">
            <span id="st-source-note">Source : Google Sheet (données saisies via bookmarklet) · Les filtres 1 sem. / 1 mois du haut s'appliquent uniquement aux onglets API temps réel</span>
            <button onclick="rsPasteStats()" style="background:var(--accent);color:#fff;border:none;border-radius:6px;padding:6px 14px;font-size:11px;font-family:'DM Sans',sans-serif;cursor:pointer;font-weight:500;">📋 Mettre à jour</button>
          </div>
        </div>

        <!-- ══ VUE GLOBALE ══ -->
        <div id="rs-s-global" class="rs-s">
          <div class="charts-grid" style="grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:12px;margin-bottom:16px;">
            <div class="card" style="padding:12px 14px;">
              <div class="rs-kl">Total abonnés</div>
              <div class="rs-kv" id="g-total">…</div>
              <div class="rs-ks" id="g-total-sub"></div>
            </div>
            <div class="card" style="padding:12px 14px;">
              <div class="rs-kl">Actifs sur la page FB</div>
              <div class="rs-kv" id="g-talking">…</div>
              <div class="rs-ks">Interactions 7 derniers jours</div>
            </div>
            <div class="card" style="padding:12px 14px;">
              <div class="rs-kl">Engagement moy./post</div>
              <div class="rs-kv" id="g-avg-eng">…</div>
              <div class="rs-ks" id="g-avg-eng-sub"></div>
            </div>
            <div class="card" style="padding:12px 14px;">
              <div class="rs-kl">Format le + engageant</div>
              <div class="rs-kv" id="g-best-type">…</div>
              <div class="rs-ks" id="g-best-type-sub"></div>
            </div>
          </div>

          <!-- Répartition -->
          <div class="card" style="margin-bottom:14px;">
            <div class="card-title">Répartition des abonnés</div>
            <div style="display:flex;align-items:center;gap:14px;flex-wrap:wrap;margin-top:12px;">
              <div style="display:flex;align-items:center;gap:9px;">
                <div class="rs-icon rs-icon-fb">f</div>
                <div><div style="font-size:11px;color:var(--muted);">Facebook</div>
                <div id="g-fb-fans" style="font-size:19px;font-weight:700;font-family:'Syne',sans-serif;">…</div></div>
              </div>
              <div style="flex:1;min-width:60px;">
                <div style="height:10px;background:var(--surf2);border-radius:6px;overflow:hidden;">
                  <div id="g-bar" style="height:100%;background:#1877F2;border-radius:6px 0 0 6px;width:0%;transition:width .8s ease;"></div>
                </div>
                <div id="g-bar-lbl" style="font-size:10px;color:var(--muted);text-align:center;margin-top:3px;"></div>
              </div>
              <div style="display:flex;align-items:center;gap:9px;flex-direction:row-reverse;">
                <div class="rs-icon rs-icon-ig">IG</div>
                <div style="text-align:right;"><div style="font-size:11px;color:var(--muted);">Instagram</div>
                <div id="g-ig-fans" style="font-size:19px;font-weight:700;font-family:'Syne',sans-serif;">…</div></div>
              </div>
            </div>
          </div>

          <!-- Mini évolution -->
          <div class="card" style="margin-bottom:14px;">
            <div class="card-title">Engagement hebdomadaire</div>
            <div id="g-evol-legend" style="display:flex;flex-wrap:wrap;gap:14px;margin-bottom:8px;font-size:11px;color:var(--muted);"></div>
            <div class="chart-wrap" style="height:170px"><canvas id="g-ch-evol"></canvas></div>
          </div>

          <!-- Publications récentes -->
          <div class="card">
            <div class="card-title" id="g-posts-title">Dernières publications</div>
            <div id="g-posts" style="margin-top:10px;"><div class="rs-loading">Chargement…</div></div>
          </div>
        </div>

        <!-- ══ ÉVOLUTION ══ -->
        <div id="rs-s-evolution" class="rs-s" style="display:none;">
          <!-- Followers -->
          <div class="card" style="margin-bottom:14px;">
            <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:4px;">
              <div class="card-title">Évolution des abonnés</div>
              <div style="font-size:11px;color:var(--muted);">Historique local · mis à jour à chaque visite</div>
            </div>
            <div id="evol-followers-legend" style="display:flex;flex-wrap:wrap;gap:14px;margin-bottom:8px;font-size:11px;color:var(--muted);"></div>
            <div class="chart-wrap" style="height:200px"><canvas id="ch-evol-followers"></canvas></div>
            <div id="evol-followers-note" style="font-size:11px;color:var(--muted);margin-top:8px;text-align:center;"></div>
          </div>

          <!-- Likes -->
          <div class="card" style="margin-bottom:14px;">
            <div class="card-title">Likes par semaine</div>
            <div id="evol-likes-legend" style="display:flex;flex-wrap:wrap;gap:14px;margin-bottom:8px;font-size:11px;color:var(--muted);"></div>
            <div class="chart-wrap" style="height:200px"><canvas id="ch-evol-likes"></canvas></div>
          </div>

          <!-- Commentaires -->
          <div class="card" style="margin-bottom:14px;">
            <div class="card-title">Commentaires par semaine</div>
            <div id="evol-comments-legend" style="display:flex;flex-wrap:wrap;gap:14px;margin-bottom:8px;font-size:11px;color:var(--muted);"></div>
            <div class="chart-wrap" style="height:180px"><canvas id="ch-evol-comments"></canvas></div>
          </div>

          <!-- Publications / semaine -->
          <div class="card">
            <div class="card-title">Publications par semaine</div>
            <div id="evol-count-legend" style="display:flex;flex-wrap:wrap;gap:14px;margin-bottom:8px;font-size:11px;color:var(--muted);"></div>
            <div class="chart-wrap" style="height:160px"><canvas id="ch-evol-count"></canvas></div>
          </div>
        </div>

        <!-- ══ POSTS ══ -->
        <div id="rs-s-posts" class="rs-s" style="display:none;">
          <div class="card" style="margin-bottom:14px;">
            <div class="card-title">Likes par publication</div>
            <div style="font-size:11px;color:var(--muted);margin-bottom:8px;" id="posts-likes-legend"></div>
            <div class="chart-wrap" style="height:260px"><canvas id="ch-posts-likes"></canvas></div>
          </div>
          <div class="card" style="margin-bottom:14px;">
            <div class="card-title">Commentaires par publication</div>
            <div class="chart-wrap" style="height:220px"><canvas id="ch-posts-comments"></canvas></div>
          </div>
          <div class="card">
            <div class="card-title">Engagement total par publication</div>
            <div class="chart-wrap" style="height:260px"><canvas id="ch-posts-eng"></canvas></div>
          </div>
        </div>

        <!-- ══ PAR TYPE ══ -->
        <div id="rs-s-types" class="rs-s" style="display:none;">
          <div id="rs-type-kpis" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:12px;margin-bottom:16px;"></div>
          <div class="card" style="margin-bottom:14px;">
            <div class="card-title">Engagement moyen par format</div>
            <div class="chart-wrap" style="height:200px"><canvas id="ch-type-eng"></canvas></div>
          </div>
          <div class="charts-grid" style="gap:14px;">
            <div class="card"><div class="card-title">Likes moyens</div><div class="chart-wrap" style="height:180px"><canvas id="ch-type-likes"></canvas></div></div>
            <div class="card"><div class="card-title">Commentaires moyens</div><div class="chart-wrap" style="height:180px"><canvas id="ch-type-comments"></canvas></div></div>
          </div>
        </div>

        <!-- ══ THÈMES ══ -->
        <div id="rs-s-themes" class="rs-s" style="display:none;">
          <div style="margin-bottom:14px;display:flex;align-items:center;gap:10px;flex-wrap:wrap;">
            <div style="flex:1;min-width:200px;">
              <div style="font-size:13px;font-weight:600;margin-bottom:2px;">Classification par thème</div>
              <div style="font-size:12px;color:var(--muted);">Analyse automatique de chaque publication parmi 17 thèmes politiques.</div>
            </div>
            <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;">
              <button id="btn-classify" onclick="rsClassifyAll()" style="background:var(--accent);color:#fff;border:none;border-radius:8px;padding:7px 16px;font-size:12px;font-family:'DM Sans',sans-serif;cursor:pointer;font-weight:500;">Analyser</button>
              <button onclick="rsResetThemes()" style="background:none;color:var(--muted);border:1px solid var(--border);border-radius:8px;padding:7px 14px;font-size:12px;font-family:'DM Sans',sans-serif;cursor:pointer;">Effacer</button>
              <span id="classify-status" style="font-size:11px;color:var(--muted);"></span>
            </div>
          </div>

          <div class="charts-grid" style="gap:14px;margin-bottom:14px;">
            <div class="card">
              <div class="card-title">Publications par thème</div>
              <div class="chart-wrap" style="height:280px"><canvas id="ch-themes-count"></canvas></div>
            </div>
            <div class="card">
              <div class="card-title">Engagement moyen par thème</div>
              <div class="chart-wrap" style="height:280px"><canvas id="ch-themes-eng"></canvas></div>
            </div>
          </div>

          <div class="card">
            <div class="card-title">Publications classifiées</div>
            <div id="themes-posts-list" style="margin-top:10px;"><div class="rs-loading">Cliquez "Analyser" pour classifier les publications.</div></div>
          </div>
        </div>

        <!-- ══ FACEBOOK ══ -->
        <div id="rs-s-facebook" class="rs-s" style="display:none;">
          <div class="card" style="margin-bottom:14px;">
            <div style="display:flex;align-items:center;gap:12px;margin-bottom:16px;">
              <div class="rs-icon rs-icon-fb" style="width:42px;height:42px;font-size:20px;border-radius:10px;flex-shrink:0;">f</div>
              <div style="flex:1;"><div style="font-weight:600;font-size:14px;">MR — Mouvement Réformateur</div>
              <div style="font-size:11px;color:var(--muted);">Page Facebook officielle</div></div>
              <a href="https://www.facebook.com/MouvementReformateur" target="_blank" style="font-size:11px;color:var(--accent);text-decoration:none;">Voir →</a>
            </div>
            <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(110px,1fr));gap:8px;">
              <div class="rs-chip"><div class="rs-cl">Fans</div><div class="rs-cv" id="fb-fans">…</div></div>
              <div class="rs-chip"><div class="rs-cl">Abonnés</div><div class="rs-cv" id="fb-fol">…</div></div>
              <div class="rs-chip"><div class="rs-cl">Actifs 7 jours</div><div class="rs-cv" id="fb-talk">…</div></div>
              <div class="rs-chip"><div class="rs-cl">Engagement (posts)</div><div class="rs-cv" id="fb-eng">…</div></div>
            </div>
          </div>
          <div class="card"><div class="card-title">5 dernières publications</div>
          <div id="fb-posts" style="margin-top:10px;"><div class="rs-loading">Chargement…</div></div></div>
        </div>

        <!-- ══ INSTAGRAM ══ -->
        <div id="rs-s-instagram" class="rs-s" style="display:none;">
          <div class="card" style="margin-bottom:14px;">
            <div style="display:flex;align-items:center;gap:12px;margin-bottom:16px;">
              <div class="rs-icon rs-icon-ig" style="width:42px;height:42px;font-size:13px;border-radius:10px;flex-shrink:0;">IG</div>
              <div style="flex:1;"><div style="font-weight:600;font-size:14px;" id="ig-handle">@mrbe</div>
              <div style="font-size:11px;color:var(--muted);">Compte Instagram officiel</div></div>
              <a id="ig-link" href="https://www.instagram.com/mrbe" target="_blank" style="font-size:11px;color:var(--accent);text-decoration:none;">Voir →</a>
            </div>
            <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(110px,1fr));gap:8px;">
              <div class="rs-chip"><div class="rs-cl">Abonnés</div><div class="rs-cv" id="ig-fans">…</div></div>
              <div class="rs-chip"><div class="rs-cl">Publications totales</div><div class="rs-cv" id="ig-count">…</div></div>
              <div class="rs-chip"><div class="rs-cl">Engagement (posts)</div><div class="rs-cv" id="ig-eng">…</div></div>
              <div class="rs-chip"><div class="rs-cl">Moy. likes/post</div><div class="rs-cv" id="ig-avg">…</div></div>
            </div>
          </div>
          <div class="card"><div class="card-title">5 dernières publications</div>
          <div id="ig-posts" style="margin-top:10px;"><div class="rs-loading">Chargement…</div></div></div>
        </div>

      </div>`;
    injectCSS();
  }

  function injectCSS() {
    if (document.getElementById('rs-css')) return;
    const s = document.createElement('style');
    s.id = 'rs-css';
    s.textContent = `
      .rs-tab{background:none;border:none;color:var(--muted);padding:8px 14px;font-family:'DM Sans',sans-serif;font-size:13px;cursor:pointer;border-bottom:2px solid transparent;transition:color .15s,border-color .15s;white-space:nowrap;}
      .rs-tab:hover{color:var(--text);}
      .rs-tab.active{color:var(--accent);border-bottom-color:var(--accent);font-weight:500;}
      .rs-net-btn,.rs-per-btn{background:none;border:none;font-size:11px;font-family:'DM Sans',sans-serif;padding:4px 10px;border-radius:6px;cursor:pointer;color:var(--muted);transition:background .15s,color .15s;}
      .rs-net-btn.active,.rs-per-btn.active{background:var(--surface);color:var(--text);font-weight:500;box-shadow:0 1px 3px rgba(0,0,0,.08);}
      .rs-kl{font-size:10px;color:var(--muted);text-transform:uppercase;letter-spacing:.5px;margin-bottom:5px;}
      .rs-kv{font-size:22px;font-family:'Syne',sans-serif;font-weight:700;}
      .rs-ks{font-size:11px;color:var(--muted);margin-top:2px;}
      .rs-chip{background:var(--surf2);border-radius:8px;padding:10px 12px;}
      .rs-cl{font-size:10px;color:var(--muted);text-transform:uppercase;letter-spacing:.4px;margin-bottom:4px;}
      .rs-cv{font-size:17px;font-weight:600;}
      .rs-icon{display:flex;align-items:center;justify-content:center;width:36px;height:36px;border-radius:8px;font-weight:800;font-family:'Syne',sans-serif;}
      .rs-icon-fb{background:#1877F2;color:#fff;font-size:16px;}
      .rs-icon-ig{background:linear-gradient(135deg,#f09433,#e6683c,#dc2743,#cc2366,#bc1888);color:#fff;font-size:11px;}
      .rs-post{display:flex;gap:10px;padding:9px 0;border-bottom:1px solid var(--border);}
      .rs-post:last-child{border-bottom:none;}
      .rs-img{width:50px;height:50px;border-radius:7px;object-fit:cover;flex-shrink:0;}
      .rs-ph{width:50px;height:50px;border-radius:7px;background:var(--surf2);flex-shrink:0;display:flex;align-items:center;justify-content:center;font-size:20px;}
      .rs-cap{font-size:12px;color:var(--text);overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;line-height:1.5;}
      .rs-meta{font-size:11px;color:var(--muted);margin-top:4px;display:flex;flex-wrap:wrap;gap:8px;align-items:center;}
      .rs-badge{font-size:10px;padding:2px 7px;border-radius:4px;font-weight:500;display:inline-block;}
      .rs-loading{color:var(--muted);font-size:13px;padding:8px 0;}
      .rs-theme-badge{font-size:10px;padding:2px 8px;border-radius:10px;background:rgba(0,46,255,.1);color:var(--accent);font-weight:500;}
    `;
    document.head.appendChild(s);
  }

  // ── Navigation ─────────────────────────────────────────────
  window.rsTab = function(id, btn) {
    document.querySelectorAll('.rs-s').forEach(s => s.style.display = 'none');
    document.querySelectorAll('.rs-tab').forEach(b => b.classList.remove('active'));
    document.getElementById('rs-s-' + id).style.display = 'block';
    btn.classList.add('active');
    // Masquer les filtres réseau/période sur l'onglet Stats (données Sheet, pas API)
    const filters = document.getElementById('rs-api-filters');
    if (filters) filters.style.opacity = id === 'stats' ? '0.3' : '1';
    if (filters) filters.style.pointerEvents = id === 'stats' ? 'none' : '';
    if (id === 'stats') {
      if (!window._stData) loadSheetData();
      else renderStatsAvancees();
    }
    refreshCharts();
  };

  window.rsSetNetwork = function(net, btn) {
    _state.network = net;
    document.querySelectorAll('.rs-net-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    refreshCharts();
  };

  window.rsSetPeriod = function(per, btn) {
    _state.period = per;
    document.querySelectorAll('.rs-per-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    refreshCharts();
    // Si l'onglet Stats avancées est actif ET qu'on a des données, re-rendre
    if (window._stData) renderStatsAvancees();
  };

  // ── Filtrage par réseau et période ─────────────────────────
  function filterPosts() {
    const cutoff = periodCutoff();
    let fb = _state.fbPosts.filter(p => new Date(p.created_time) >= cutoff);
    let ig = _state.igPosts.filter(p => new Date(p.timestamp) >= cutoff);
    if (_state.network === 'fb') ig = [];
    if (_state.network === 'ig') fb = [];
    return { fb, ig };
  }

  function periodCutoff() {
    const now = Date.now();
    const p = _state.period;
    if (p === '1w')  return new Date(now - 7*86400000);
    if (p === '4w')  return new Date(now - 28*86400000);
    if (p === '8w')  return new Date(now - 56*86400000);
    return new Date(0); // 'all'
  }

  function periodDays() {
    const p = _state.period;
    if (p === '1w') return 7;
    if (p === '4w') return 30;
    if (p === '8w') return 60;
    return 90; // 'all'
  }

  function filterDaily(rows) {
    // Filtre les données journalières selon la période sélectionnée
    if (!rows || !rows.length) return [];
    const days = periodDays();
    const cutoff = new Date(Date.now() - days * 86400000);
    return rows.filter(r => {
      const dt = new Date(r.date_point);
      return !isNaN(dt) && dt >= cutoff;
    });
  }

  // ── Chargement ─────────────────────────────────────────────
  window._rsLoad = async function(force) {
    const KEY = 'mr_rs_v6', TTL = 20 * 60 * 1000;
    if (!force) {
      try {
        const c = JSON.parse(sessionStorage.getItem(KEY) || 'null');
        if (c && Date.now() - c.ts < TTL) {
          _state.fb = c.d.fb; _state.ig = c.d.ig;
          _state.fbPosts = c.d.fbPosts; _state.igPosts = c.d.igPosts;
          renderStatic(); refreshCharts();
          const h = new Date(c.ts).toLocaleTimeString('fr-BE',{hour:'2-digit',minute:'2-digit'});
          set('rs-sub', 'Mis à jour · ' + h);
          setGlobalStatus('ok', 'Réseaux · ' + h);
          return;
        }
      } catch(e) {}
    }
    setGlobalStatus('loading', 'Chargement réseaux…');
    try {
      const [fb, ig, fbMedia, igMedia] = await Promise.all([
        api(`${CFG.FB_ID}?fields=name,fan_count,followers_count,talking_about_count`),
        api(`${CFG.IG_ID}?fields=username,followers_count,media_count`),
        api(`${CFG.FB_ID}/posts?fields=message,story,created_time,full_picture,likes.summary(true),comments.summary(true),shares&limit=50`).catch(()=>null),
        api(`${CFG.IG_ID}/media?fields=id,caption,media_type,media_url,thumbnail_url,timestamp,like_count,comments_count&limit=50`).catch(()=>null),
      ]);
      _state.fb = fb;
      _state.ig = ig;
      _state.fbPosts = fbMedia?.data || [];
      _state.igPosts = igMedia?.data || [];

      // Sauvegarder historique followers
      saveFollowersHistory(fb?.fan_count, ig?.followers_count);

      sessionStorage.setItem(KEY, JSON.stringify({ ts: Date.now(), d: { fb, ig, fbPosts: _state.fbPosts, igPosts: _state.igPosts } }));
      renderStatic();
      refreshCharts();
      const h = new Date().toLocaleTimeString('fr-BE',{hour:'2-digit',minute:'2-digit'});
      setGlobalStatus('ok', 'Réseaux · ' + h);
      set('rs-sub', 'Mis à jour · ' + h);
    } catch(err) {
      console.error(err);
      setGlobalStatus('error', 'Erreur réseaux');
      set('rs-sub', 'Erreur : ' + err.message);
    }
  };

  // ── Historique followers (stockage local) ──────────────────
  function saveFollowersHistory(fbFans, igFans) {
    try {
      const today = new Date().toISOString().slice(0,10);
      const raw   = localStorage.getItem(CFG.FOLLOWERS_KEY);
      const hist  = raw ? JSON.parse(raw) : [];
      // Éviter doublons du même jour
      const last  = hist[hist.length - 1];
      if (!last || last.date !== today) {
        hist.push({ date: today, fb: fbFans || 0, ig: igFans || 0 });
        // Garder max 365 entrées
        if (hist.length > 365) hist.splice(0, hist.length - 365);
        localStorage.setItem(CFG.FOLLOWERS_KEY, JSON.stringify(hist));
      }
    } catch(e) {}
  }

  function loadFollowersHistory() {
    try {
      const raw = localStorage.getItem(CFG.FOLLOWERS_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch(e) { return []; }
  }

  // ── Rendu statique (indépendant des filtres) ───────────────
  function renderStatic() {
    const { fb, ig, fbPosts, igPosts } = _state;
    const fbF = fb?.fan_count        || 0;
    const igF = ig?.followers_count  || 0;
    const tot = fbF + igF;
    const pct = tot ? Math.round(fbF / tot * 100) : 50;

    set('g-total',    fmt(tot));
    set('g-total-sub','FB\u00a0: ' + fmt(fbF) + ' \u00b7 IG\u00a0: ' + fmt(igF));
    set('g-talking',  fmt(fb?.talking_about_count));
    set('g-fb-fans',  fmt(fbF));
    set('g-ig-fans',  fmt(igF));
    set('g-bar-lbl',  pct + '% Facebook · ' + (100-pct) + '% Instagram');
    setTimeout(() => { const b = document.getElementById('g-bar'); if(b) b.style.width = pct + '%'; }, 120);

    set('fb-fans', fmt(fbF));
    set('fb-fol',  fmt(fb?.followers_count));
    set('fb-talk', fmt(fb?.talking_about_count));
    set('ig-fans',  fmt(igF));
    set('ig-count', fmt(ig?.media_count));
    if (ig?.username) {
      set('ig-handle', '@' + ig.username);
      const lnk = document.getElementById('ig-link');
      if (lnk) lnk.href = 'https://www.instagram.com/' + ig.username;
    }

    let fbEng = 0;
    fbPosts.forEach(p => { fbEng += (p.likes?.summary?.total_count||0) + (p.comments?.summary?.total_count||0); });
    set('fb-eng', fmt(fbEng));

    let igEng = 0, igLk = 0;
    igPosts.forEach(p => { igEng += (p.like_count||0) + (p.comments_count||0); igLk += (p.like_count||0); });
    set('ig-eng', fmt(igEng));
    set('ig-avg', igPosts.length ? fmt(Math.round(igLk/igPosts.length)) : '—');

    renderFbPosts(fbPosts.slice(0,5), 'fb-posts');
    renderIgPosts(igPosts.slice(0,5), 'ig-posts');

    // Thèmes déjà classifiés
    renderThemesFromCache();
  }

  // ── Refresh graphiques (dépend des filtres) ────────────────
  function refreshCharts() {
    const { fb, ig } = _state;
    const { fb: fbF, ig: igF } = filterPosts();
    const all = [
      ...fbF.map(p => ({ lk: p.likes?.summary?.total_count||0, cm: p.comments?.summary?.total_count||0, ts: p.created_time, type: 'FB_POST', src: 'fb' })),
      ...igF.map(p => ({ lk: p.like_count||0, cm: p.comments_count||0, ts: p.timestamp, type: p.media_type, src: 'ig' })),
    ].sort((a,b) => new Date(a.ts) - new Date(b.ts));

    // KPIs
    const totalEng = all.reduce((s,p) => s + p.lk + p.cm, 0);
    const avgEng   = all.length ? Math.round(totalEng / all.length) : 0;
    set('g-avg-eng', fmt(avgEng));
    const netLabel = _state.network === 'both' ? 'FB + IG' : _state.network === 'fb' ? 'Facebook' : 'Instagram';
    const perLabel = { '1w':'1 semaine', '4w':'1 mois', '8w':'2 mois', 'all':'Tout' }[_state.period];
    set('g-avg-eng-sub', `${netLabel} · ${perLabel}`);

    // Meilleur type
    const typeStats = computeTypeStats(all);
    const best = getBestType(typeStats);
    set('g-best-type', best.label);
    set('g-best-type-sub', fmt(best.avg_eng) + ' eng. moy./post');

    // Titre posts globaux
    set('g-posts-title', `Dernières publications · ${netLabel}`);

    // Publications globales
    renderMixedPosts(fbF.slice(0,4), igF.slice(0,4), 'g-posts');

    const weekly = computeWeekly(all, fbF, igF);

    setTimeout(() => {
      renderEvolMiniChart(weekly);
      renderEvolCharts(weekly, fbF, igF);
      renderPostCharts(all, fbF, igF);
      renderTypeCharts(typeStats);
      renderTypeKPIs(typeStats);
      renderFollowersChart();
      renderThemesFromCache(); // respecte le filtre réseau actif
    }, 60);
  }

  // ── Calculs ────────────────────────────────────────────────
  function computeWeekly(all, fbArr, igArr) {
    const toWeekKey = iso => {
      const d = new Date(iso);
      const day = d.getDay() || 7;
      const mon = new Date(d); mon.setDate(d.getDate() - day + 1);
      return mon.toISOString().slice(0,10);
    };
    const toLabel = key => {
      const d = new Date(key);
      return d.toLocaleDateString('fr-BE',{day:'2-digit',month:'2-digit'});
    };
    const map = {};
    all.forEach(p => {
      const k = toWeekKey(p.ts);
      if (!map[k]) map[k] = { label: toLabel(k), fb_lk:0, fb_cm:0, fb_n:0, ig_lk:0, ig_cm:0, ig_n:0 };
      if (p.src === 'fb') { map[k].fb_lk += p.lk; map[k].fb_cm += p.cm; map[k].fb_n++; }
      else                { map[k].ig_lk += p.lk; map[k].ig_cm += p.cm; map[k].ig_n++; }
    });
    return Object.entries(map).sort((a,b) => a[0].localeCompare(b[0])).map(([,v]) => v);
  }

  function computeTypeStats(posts) {
    const LABELS = { IMAGE:'Image', VIDEO:'Vidéo', CAROUSEL_ALBUM:'Carrousel', FB_POST:'Post FB' };
    const s = {};
    posts.forEach(p => {
      const t = p.type || 'FB_POST';
      if (!s[t]) s[t] = { count:0, likes:0, comments:0 };
      s[t].count++; s[t].likes += p.lk; s[t].comments += p.cm;
    });
    Object.keys(s).forEach(t => {
      s[t].label      = LABELS[t] || t;
      s[t].avg_likes  = s[t].count ? Math.round(s[t].likes    / s[t].count) : 0;
      s[t].avg_comments = s[t].count ? Math.round(s[t].comments / s[t].count) : 0;
      s[t].avg_eng    = s[t].avg_likes + s[t].avg_comments;
    });
    return s;
  }

  function getBestType(stats) {
    let best = { label:'—', avg_eng:0 };
    Object.values(stats).forEach(s => { if(s.avg_eng > best.avg_eng) best = s; });
    return best;
  }

  // ── Graphiques ─────────────────────────────────────────────
  function makeChart(id, config) {
    if (_charts[id]) { try { _charts[id].destroy(); } catch(e) {} }
    const canvas = document.getElementById(id);
    if (!canvas || typeof Chart === 'undefined') return;
    _charts[id] = new Chart(canvas, config);
  }

  function legend(legendId, items) {
    const el = document.getElementById(legendId);
    if (!el) return;
    el.innerHTML = items.map(i =>
      `<span style="display:flex;align-items:center;gap:4px;"><span style="width:10px;height:10px;border-radius:2px;background:${i.color};display:inline-block;"></span>${i.label}</span>`
    ).join('');
  }

  const baseOpts = () => ({
    responsive: true, maintainAspectRatio: false,
    plugins: { legend: { display: false } },
    scales: {
      x: { grid: { display: false }, ticks: { font: { size: 10 }, maxRotation: 45, autoSkip: true } },
      y: { grid: { color: 'rgba(0,0,0,0.05)' }, ticks: { font: { size: 10 } } },
    },
  });

  function renderEvolMiniChart(weeks) {
    const net = _state.network;
    const datasets = [];
    if (net !== 'ig') datasets.push({ label:'Likes FB', data: weeks.map(w => w.fb_lk), borderColor: C.fb, backgroundColor: 'rgba(24,119,242,0.12)', fill:true, tension:.35, pointRadius:3, borderWidth:2 });
    if (net !== 'fb') datasets.push({ label:'Likes IG', data: weeks.map(w => w.ig_lk), borderColor: C.ig, backgroundColor: 'rgba(220,39,67,0.12)', fill:true, tension:.35, pointRadius:3, borderWidth:2 });
    makeChart('g-ch-evol', { type:'line', data: { labels: weeks.map(w=>w.label), datasets }, options: { ...baseOpts(), plugins: { legend: { display: false } } } });
    const lgItems = [];
    if (net !== 'ig') lgItems.push({ color: C.fb, label: 'Likes Facebook' });
    if (net !== 'fb') lgItems.push({ color: C.ig, label: 'Likes Instagram' });
    legend('g-evol-legend', lgItems);
  }

  function renderFollowersChart() {
    const hist = loadFollowersHistory();
    const cutoff = periodCutoff();
    const filtered = hist.filter(h => new Date(h.date) >= cutoff);
    const labels = filtered.map(h => { const d = new Date(h.date); return d.toLocaleDateString('fr-BE',{day:'2-digit',month:'2-digit'}); });
    const net = _state.network;
    const datasets = [];
    if (net !== 'ig') datasets.push({ label:'Fans FB', data: filtered.map(h=>h.fb), borderColor: C.fb, backgroundColor: 'rgba(24,119,242,0.1)', fill:true, tension:.3, pointRadius:4, borderWidth:2 });
    if (net !== 'fb') datasets.push({ label:'Abonnés IG', data: filtered.map(h=>h.ig), borderColor: C.ig, backgroundColor: 'rgba(220,39,67,0.1)', fill:true, tension:.3, pointRadius:4, borderWidth:2 });
    makeChart('ch-evol-followers', { type:'line', data: { labels, datasets }, options: { ...baseOpts() } });
    const lgItems = [];
    if (net !== 'ig') lgItems.push({ color: C.fb, label: 'Fans Facebook' });
    if (net !== 'fb') lgItems.push({ color: C.ig, label: 'Abonnés Instagram' });
    legend('evol-followers-legend', lgItems);
    const note = document.getElementById('evol-followers-note');
    if (note) {
      if (filtered.length <= 1) note.textContent = `${filtered.length} point(s) enregistré(s). L'historique se construit à chaque visite du dashboard.`;
      else note.textContent = `${filtered.length} points · du ${filtered[0]?.date} au ${filtered[filtered.length-1]?.date}`;
    }
  }

  function renderEvolCharts(weeks, fbArr, igArr) {
    const net = _state.network;

    // Likes
    const likesDatasets = [];
    if (net !== 'ig') likesDatasets.push({ label:'FB', data: weeks.map(w=>w.fb_lk), backgroundColor: C.fbA, borderColor: C.fb, borderWidth:1.5, borderRadius:3 });
    if (net !== 'fb') likesDatasets.push({ label:'IG', data: weeks.map(w=>w.ig_lk), backgroundColor: C.igA, borderColor: C.ig, borderWidth:1.5, borderRadius:3 });
    makeChart('ch-evol-likes', { type:'bar', data: { labels: weeks.map(w=>w.label), datasets: likesDatasets }, options: { ...baseOpts() } });
    const lkLg = [];
    if (net !== 'ig') lkLg.push({ color: C.fb, label: 'Likes Facebook' });
    if (net !== 'fb') lkLg.push({ color: C.ig, label: 'Likes Instagram' });
    legend('evol-likes-legend', lkLg);

    // Commentaires
    const cmDatasets = [];
    if (net !== 'ig') cmDatasets.push({ label:'FB', data: weeks.map(w=>w.fb_cm), backgroundColor: C.fbA, borderColor: C.fb, borderWidth:1.5, borderRadius:3 });
    if (net !== 'fb') cmDatasets.push({ label:'IG', data: weeks.map(w=>w.ig_cm), backgroundColor: C.igA, borderColor: C.ig, borderWidth:1.5, borderRadius:3 });
    makeChart('ch-evol-comments', { type:'bar', data: { labels: weeks.map(w=>w.label), datasets: cmDatasets }, options: { ...baseOpts() } });
    const cmLg = [];
    if (net !== 'ig') cmLg.push({ color: C.fb, label: 'Commentaires Facebook' });
    if (net !== 'fb') cmLg.push({ color: C.ig, label: 'Commentaires Instagram' });
    legend('evol-comments-legend', cmLg);

    // Publications
    const ctDatasets = [];
    if (net !== 'ig') ctDatasets.push({ label:'FB', data: weeks.map(w=>w.fb_n), backgroundColor: C.fbA, borderColor: C.fb, borderWidth:1.5, borderRadius:3 });
    if (net !== 'fb') ctDatasets.push({ label:'IG', data: weeks.map(w=>w.ig_n), backgroundColor: C.igA, borderColor: C.ig, borderWidth:1.5, borderRadius:3 });
    makeChart('ch-evol-count', { type:'bar', data: { labels: weeks.map(w=>w.label), datasets: ctDatasets }, options: { ...baseOpts() } });
    const ctLg = [];
    if (net !== 'ig') ctLg.push({ color: C.fb, label: 'Publications Facebook' });
    if (net !== 'fb') ctLg.push({ color: C.ig, label: 'Publications Instagram' });
    legend('evol-count-legend', ctLg);
  }

  function renderPostCharts(all) {
    // all est déjà trié du plus ancien au plus récent (sort ascendant dans computeWeekly)
    // On l'affiche dans cet ordre : plus ancien à gauche, plus récent à droite
    const ordered = all; // déjà dans le bon ordre chronologique
    const labels  = ordered.map(p => { const d = new Date(p.ts); return d.toLocaleDateString('fr-BE',{day:'2-digit',month:'2-digit'}); });
    const bgs  = ordered.map(p => p.src === 'fb' ? C.fbA : C.igA);
    const bdrs = ordered.map(p => p.src === 'fb' ? C.fb  : C.ig);
    const opts = { ...baseOpts() };

    const lgEl = document.getElementById('posts-likes-legend');
    if (lgEl) lgEl.innerHTML = `<span style="display:flex;align-items:center;gap:4px;"><span style="width:10px;height:10px;border-radius:2px;background:${C.fb};display:inline-block;"></span>Facebook</span>&nbsp;&nbsp;<span style="display:flex;align-items:center;gap:4px;"><span style="width:10px;height:10px;border-radius:2px;background:${C.ig};display:inline-block;"></span>Instagram</span>`;

    makeChart('ch-posts-likes',    { type:'bar', data: { labels, datasets: [{ data: ordered.map(p=>p.lk),      backgroundColor: bgs, borderColor: bdrs, borderWidth:1, borderRadius:3 }] }, options: opts });
    makeChart('ch-posts-comments', { type:'bar', data: { labels, datasets: [{ data: ordered.map(p=>p.cm),      backgroundColor: bgs, borderColor: bdrs, borderWidth:1, borderRadius:3 }] }, options: opts });
    makeChart('ch-posts-eng',      { type:'bar', data: { labels, datasets: [{ data: ordered.map(p=>p.lk+p.cm), backgroundColor: bgs, borderColor: bdrs, borderWidth:1, borderRadius:3 }] }, options: opts });
  }

  function renderTypeCharts(stats) {
    const types  = Object.keys(stats);
    const labels = types.map(t => stats[t].label);
    const COLORS = { IMAGE: C.IMAGE, VIDEO: C.VIDEO, CAROUSEL_ALBUM: C.CAROUSEL_ALBUM, FB_POST: { bg: C.fbA, bd: C.fb } };
    const bgs  = types.map(t => (COLORS[t] || C.IMAGE).bg);
    const bdrs = types.map(t => (COLORS[t] || C.IMAGE).bd);
    const opts = { ...baseOpts(), scales: { x: { grid:{display:false}, ticks:{font:{size:12}} }, y: { grid:{color:'rgba(0,0,0,0.05)'}, ticks:{font:{size:10}} } } };
    makeChart('ch-type-eng',      { type:'bar', data:{ labels, datasets:[{ data: types.map(t=>stats[t].avg_eng),      backgroundColor:bgs, borderColor:bdrs, borderWidth:1.5, borderRadius:6 }] }, options:opts });
    makeChart('ch-type-likes',    { type:'bar', data:{ labels, datasets:[{ data: types.map(t=>stats[t].avg_likes),    backgroundColor:bgs, borderColor:bdrs, borderWidth:1.5, borderRadius:6 }] }, options:opts });
    makeChart('ch-type-comments', { type:'bar', data:{ labels, datasets:[{ data: types.map(t=>stats[t].avg_comments), backgroundColor:bgs, borderColor:bdrs, borderWidth:1.5, borderRadius:6 }] }, options:opts });
  }

  function renderTypeKPIs(stats) {
    const el = document.getElementById('rs-type-kpis');
    if (!el) return;
    const META = {
      IMAGE          : { emoji:'📷', color:'#002EFF', bg:'rgba(0,46,255,.08)' },
      VIDEO          : { emoji:'🎥', color:'#dc2743', bg:'rgba(220,39,67,.08)' },
      CAROUSEL_ALBUM : { emoji:'🖼️', color:'#B86800', bg:'rgba(184,104,0,.08)' },
      FB_POST        : { emoji:'📘', color:'#1877F2', bg:'rgba(24,119,242,.08)' },
    };
    el.innerHTML = Object.entries(stats).map(([t,s]) => {
      const m = META[t] || { emoji:'📄', color:'#9AA5C8', bg:'rgba(154,165,200,.1)' };
      return `<div style="background:var(--surface);border:1px solid var(--border);border-radius:10px;padding:14px 16px;border-left:3px solid ${m.color};">
        <div style="font-size:12px;font-weight:600;color:${m.color};margin-bottom:10px;display:flex;align-items:center;gap:6px;">
          <span style="font-size:16px;">${m.emoji}</span>${s.label}
          <span style="margin-left:auto;font-size:11px;color:var(--muted);font-weight:400;">${s.count} post${s.count>1?'s':''}</span>
        </div>
        <div style="display:flex;justify-content:space-between;padding:4px 0;font-size:12px;border-bottom:1px solid var(--border);"><span style="color:var(--muted);">Likes moyens</span><strong>${fmt(s.avg_likes)}</strong></div>
        <div style="display:flex;justify-content:space-between;padding:4px 0;font-size:12px;border-bottom:1px solid var(--border);"><span style="color:var(--muted);">Commentaires moyens</span><strong>${fmt(s.avg_comments)}</strong></div>
        <div style="display:flex;justify-content:space-between;padding:4px 0;font-size:12px;"><span style="color:var(--muted);">Engagement moyen</span><strong style="color:${m.color};">${fmt(s.avg_eng)}</strong></div>
      </div>`;
    }).join('');
  }

  // ── Rendu publications ─────────────────────────────────────
  function renderFbPosts(posts, id) {
    const el = document.getElementById(id);
    if (!el) return;
    if (!posts.length) { el.innerHTML = '<div class="rs-loading">Aucune publication.</div>'; return; }
    el.innerHTML = posts.map(p => {
      const txt = p.message || p.story || '(Publication sans texte)';
      const lk  = p.likes?.summary?.total_count || 0;
      const cm  = p.comments?.summary?.total_count || 0;
      const sh  = p.shares?.count || 0;
      const thm = _state.themes[p.id] ? `<span class="rs-theme-badge">${_state.themes[p.id]}</span>` : '';
      const thumb = p.full_picture ? `<img src="${p.full_picture}" class="rs-img" alt="" onerror="this.style.display='none'">` : `<div class="rs-ph">📝</div>`;
      return `<div class="rs-post">${thumb}<div style="flex:1;min-width:0;">
        <div style="margin-bottom:3px;display:flex;gap:5px;flex-wrap:wrap;"><span class="rs-badge" style="background:rgba(24,119,242,.1);color:#1877F2;">Facebook</span>${thm}</div>
        <div class="rs-cap">${txt}</div>
        <div class="rs-meta"><span>${ago(p.created_time)}</span><span>👍 ${fmt(lk)}</span><span>💬 ${fmt(cm)}</span>${sh?`<span>🔁 ${fmt(sh)}</span>`:''}</div>
      </div></div>`;
    }).join('');
  }

  function renderIgPosts(posts, id) {
    const el = document.getElementById(id);
    if (!el) return;
    if (!posts.length) { el.innerHTML = '<div class="rs-loading">Aucune publication.</div>'; return; }
    const TYPE_LABEL = { IMAGE:'Image', VIDEO:'Vidéo', CAROUSEL_ALBUM:'Carrousel' };
    const TYPE_COLOR = { IMAGE:'#002EFF', VIDEO:'#dc2743', CAROUSEL_ALBUM:'#B86800' };
    const TYPE_BG    = { IMAGE:'rgba(0,46,255,.1)', VIDEO:'rgba(220,39,67,.1)', CAROUSEL_ALBUM:'rgba(184,104,0,.1)' };
    el.innerHTML = posts.map(p => {
      const cap  = p.caption || '(Publication sans légende)';
      const src  = p.thumbnail_url || p.media_url;
      const thm  = _state.themes[p.id] ? `<span class="rs-theme-badge">${_state.themes[p.id]}</span>` : '';
      const thumb = src ? `<img src="${src}" class="rs-img" alt="" onerror="this.style.display='none'">` : `<div class="rs-ph">${p.media_type==='VIDEO'?'🎥':'📸'}</div>`;
      return `<div class="rs-post">${thumb}<div style="flex:1;min-width:0;">
        <div style="margin-bottom:3px;display:flex;gap:5px;flex-wrap:wrap;">
          <span class="rs-badge" style="background:${TYPE_BG[p.media_type]||'var(--surf2)'};color:${TYPE_COLOR[p.media_type]||'var(--muted)'}">${TYPE_LABEL[p.media_type]||'Post'}</span>${thm}
        </div>
        <div class="rs-cap">${cap}</div>
        <div class="rs-meta"><span>${ago(p.timestamp)}</span><span>❤️ ${fmt(p.like_count)}</span><span>💬 ${fmt(p.comments_count)}</span></div>
      </div></div>`;
    }).join('');
  }

  function renderMixedPosts(fbPosts, igPosts, targetId) {
    const el = document.getElementById(targetId);
    if (!el) return;
    const all = [
      ...fbPosts.map(p => ({ ...p, _s:'fb', _d: new Date(p.created_time) })),
      ...igPosts.map(p => ({ ...p, _s:'ig', _d: new Date(p.timestamp) })),
    ].sort((a,b) => b._d - a._d).slice(0,6);
    if (!all.length) { el.innerHTML = '<div class="rs-loading">Aucune publication.</div>'; return; }
    const tmpFb = all.filter(p=>p._s==='fb');
    const tmpIg = all.filter(p=>p._s==='ig');
    // Render inline
    const TYPE_LABEL = { IMAGE:'Image', VIDEO:'Vidéo', CAROUSEL_ALBUM:'Carrousel' };
    const TYPE_COLOR = { IMAGE:'#002EFF', VIDEO:'#dc2743', CAROUSEL_ALBUM:'#B86800' };
    const TYPE_BG    = { IMAGE:'rgba(0,46,255,.1)', VIDEO:'rgba(220,39,67,.1)', CAROUSEL_ALBUM:'rgba(184,104,0,.1)' };
    el.innerHTML = all.map(p => {
      const thm = _state.themes[p.id] ? `<span class="rs-theme-badge">${_state.themes[p.id]}</span>` : '';
      if (p._s === 'fb') {
        const txt = p.message || p.story || '(Publication sans texte)';
        const lk  = p.likes?.summary?.total_count || 0;
        const cm  = p.comments?.summary?.total_count || 0;
        const thumb = p.full_picture ? `<img src="${p.full_picture}" class="rs-img" alt="" onerror="this.style.display='none'">` : `<div class="rs-ph">📝</div>`;
        return `<div class="rs-post">${thumb}<div style="flex:1;min-width:0;">
          <div style="margin-bottom:3px;display:flex;gap:5px;flex-wrap:wrap;"><span class="rs-badge" style="background:rgba(24,119,242,.1);color:#1877F2;">Facebook</span>${thm}</div>
          <div class="rs-cap">${txt}</div>
          <div class="rs-meta"><span>${ago(p.created_time)}</span><span>👍 ${fmt(lk)}</span><span>💬 ${fmt(cm)}</span></div>
        </div></div>`;
      } else {
        const cap  = p.caption || '(Publication sans légende)';
        const src  = p.thumbnail_url || p.media_url;
        const thumb = src ? `<img src="${src}" class="rs-img" alt="" onerror="this.style.display='none'">` : `<div class="rs-ph">📸</div>`;
        return `<div class="rs-post">${thumb}<div style="flex:1;min-width:0;">
          <div style="margin-bottom:3px;display:flex;gap:5px;flex-wrap:wrap;">
            <span class="rs-badge" style="background:${TYPE_BG[p.media_type]||'var(--surf2)'};color:${TYPE_COLOR[p.media_type]||'var(--muted)'}">${TYPE_LABEL[p.media_type]||'IG'}</span>${thm}
          </div>
          <div class="rs-cap">${cap}</div>
          <div class="rs-meta"><span>${ago(p.timestamp)}</span><span>❤️ ${fmt(p.like_count)}</span><span>💬 ${fmt(p.comments_count)}</span></div>
        </div></div>`;
      }
    }).join('');
  }

  // ── Cache thèmes ───────────────────────────────────────────
  const THEMES_CACHE_KEY = 'mr_rs_themes_v1';
  function loadThemesCache() {
    try { return JSON.parse(localStorage.getItem(THEMES_CACHE_KEY) || '{}'); } catch(e) { return {}; }
  }
  function saveThemesCache(obj) {
    try { localStorage.setItem(THEMES_CACHE_KEY, JSON.stringify(obj)); } catch(e) {}
  }

  // ── Classification par thème (mots-clés locaux) ───────────
  const THEME_KEYWORDS = {
    'Agriculture':        ['agriculture','agriculteur','agricole','ferme','fermier','élevage','paysan','rural','campagne','alimentation','pesticide','bio','semence','récolte','culture','céréale','betterave','lait','viande','filière','agroalimentaire'],
    'Bonne gouvernance':  ['gouvernance','transparence','corruption','démocratie','institution','réforme','administration','fonctionnaire','bureaucratie','état de droit','élection','vote','parlement','coalition','gouvernement','mandataire','politique','débat','pluralisme','liberté d\'expression','liberté','censure','livre','culture','expression','idées','fondamental','pétition','mobilisé'],
    'Emploi':             ['emploi','travail','travailleur','chômage','chômeur','licenciement','recrutement','salaire','patron','entreprise','flexibilité','contrat de travail','temps plein','temps partiel','syndicat','ouvrier','cadre','rémunération','ONEM','chômeur'],
    'Énergie':            ['énergie','nucléaire','électricité','gaz naturel','pétrole','carburant','renouvelable','solaire','éolien','transition énergétique','facture d\'énergie','prix de l\'énergie','climatique','consommation','centrale','réacteur','cliquet','tarif','réseau électrique'],
    'Enseignement':       ['enseignement','école','éducation','élève','étudiant','professeur','enseignant','université','diplôme','formation','apprentissage','scolaire','lycée','réforme scolaire','pédagogie','cours','classe','programme','secondaire','primaire','maternel','décroché','résultats'],
    'Fiscalité':          ['fiscalité','impôt','taxe','TVA','fisc','précompte','revenu','déduction','exonération','contribution','charge fiscale','budget','finances','déficit','dette','réforme fiscale','cotisation','exonération','boni','fraude fiscale'],
    'International':      ['international','europe','européen','union européenne','OTAN','NATO','guerre','ukraine','russie','états-unis','trump','diplomatie','ambassadeur','traité','migration','réfugié','géopolitique','mondial','conflit','sanction','bilatéral'],
    'Justice':            ['justice','tribunal','juge','magistrat','procès','condamnation','prison','peine','droit','loi','avocat','criminalité','délinquance','police judiciaire','enquête','parquet','cour','arrêt','juridiction','légal','illégal','infraction'],
    'Logement':           ['logement','habitation','immobilier','loyer','propriétaire','locataire','construction','permis de construire','urbanisme','rénovation','crise du logement','maison','appartement','logement social','SDF','sans-abri','expulsion','bail'],
    'Médias':             ['média','presse','journaliste','information','fake news','liberté de la presse','RTBF','RTL','télévision','radio','numérique','communication','rédaction','journal','reportage','couverture médiatique','LN24','La Libre','Le Soir'],
    'Mobilité':           ['mobilité','transport','route','autoroute','train','SNCB','tram','bus','vélo','voiture','embouteillage','infrastructure','stationnement','TEC','aviation','parking','gare','navette','covoiturage','déplacement','vitesse'],
    'Pensions':           ['pension','retraite','pensionné','âge légal de la retraite','carrière','cotisation retraite','ONSS','vieillissement','baby-boom','solidarité intergénérationnelle','allocation de retraite','prépension','pension minimum','capital pension'],
    'Pouvoir d\'achat':   ['pouvoir d\'achat','inflation','prix','coût de la vie','cherté','index','indexation','salaire minimum','allocation','revenu','budget ménage','facture','dépense','consommateur','bas revenu','classe moyenne','ménage'],
    'Réseaux sociaux':    ['facebook','instagram','twitter','tiktok','réseau social','influenceur','viral','story','followers','like','commentaire','partage','social media','plateforme','algorithme','contenu'],
    'Santé':              ['santé','hôpital','médecin','patient','soins','médicament','maladie','mutuelle','INAMI','infirmier','urgences','cancer','vaccination','pandémie','bien-être','médical','chirurgie','soin','traitement','remboursement','généraliste'],
    'Sécurité':           ['sécurité','police','criminalité','terrorisme','violence','délinquance','prison','ordre public','zone de police','gendarmerie','cambriolage','agression','attaque','menace','armée','défense','service de secours','pompier'],
    'Social':             ['social','solidarité','aide sociale','CPAS','pauvreté','précarité','allocation','revenu d\'intégration','exclusion','protection sociale','famille','enfant','handicap','personne âgée','vulnérable','inclusion','cohésion'],
  };

  function classifyByKeywords(text) {
    const lower = text.toLowerCase();
    let bestTheme = null;
    let bestScore = -1;
    for (const [theme, keywords] of Object.entries(THEME_KEYWORDS)) {
      let score = 0;
      for (const kw of keywords) {
        if (lower.includes(kw.toLowerCase())) score++;
      }
      if (score > bestScore) { bestScore = score; bestTheme = theme; }
    }
    // Si aucun mot-clé ne matche (score=0), on cherche des thèmes transversaux
    if (bestScore === 0) {
      if (lower.includes('mr') || lower.includes('mouvement réformateur') || lower.includes('libéral')) return 'Bonne gouvernance';
      if (lower.includes('femme') || lower.includes('égalité')) return 'Social';
      return 'Bonne gouvernance'; // fallback général politique
    }
    return bestTheme;
  }

  // Détecter si un post est une création d'événement (à exclure)
  function isEventPost(post) {
    // Posts FB qui sont uniquement des événements : ils ont story mais pas message,
    // ou leur story contient "a créé un événement" / "a partagé un événement"
    if (post.src === 'fb') {
      const story = (post.story || '').toLowerCase();
      const msg   = (post.message || '').trim();
      if (!msg && story) return true; // story sans message = événement/partage automatique
      if (story.includes('créé un événement') || story.includes('partagé un événement')) return true;
    }
    return false;
  }

  window.rsResetThemes = function() {
    localStorage.removeItem(THEMES_CACHE_KEY);
    _state.themes = {};
    const listEl = document.getElementById('themes-posts-list');
    if (listEl) listEl.innerHTML = '<div class="rs-loading">Cache effacé. Cliquez "Analyser" pour reclassifier.</div>';
    const status = document.getElementById('classify-status');
    if (status) status.textContent = '';
    // Réinitialiser les graphiques
    if (_charts['ch-themes-count']) { try { _charts['ch-themes-count'].destroy(); } catch(e) {} }
    if (_charts['ch-themes-eng'])   { try { _charts['ch-themes-eng'].destroy();   } catch(e) {} }
  };

  window.rsClassifyAll = async function() {
    const btn    = document.getElementById('btn-classify');
    const status = document.getElementById('classify-status');
    if (btn) { btn.disabled = true; btn.textContent = '⏳ Analyse en cours…'; }

    // Filtrer selon le réseau sélectionné ET exclure les événements
    const { fb: fbFiltered, ig: igFiltered } = filterPosts();
    const allPosts = [
      ...fbFiltered.map(p => ({ id: p.id, text: (p.message||'').slice(0,600), lk: p.likes?.summary?.total_count||0, cm: p.comments?.summary?.total_count||0, src:'fb', ts: p.created_time, story: p.story||'' })),
      ...igFiltered.map(p => ({ id: p.id, text: (p.caption||'').slice(0,600), lk: p.like_count||0, cm: p.comments_count||0, src:'ig', ts: p.timestamp, story:'' })),
    ].filter(p => !isEventPost(p) && p.text.trim().length > 15);

    const cached = loadThemesCache();
    const toClassify = allPosts.filter(p => !cached[p.id]);

    if (toClassify.length === 0) {
      _state.themes = cached;
      renderThemesFromCache();
      if (status) status.textContent = '✅ Tout est déjà classifié.';
      if (btn) { btn.disabled = false; btn.innerHTML = '🔄 Reclassifier'; }
      return;
    }

    if (status) status.textContent = `Analyse de ${toClassify.length} publications…`;

    let done = 0;
    for (const post of toClassify) {
      cached[post.id] = classifyByKeywords(post.text);
      done++;
      if (done % 10 === 0 && status) status.textContent = `Analyse… ${done}/${toClassify.length}`;
    }

    saveThemesCache(cached);
    _state.themes = cached;
    renderThemesFromCache();

    const total = Object.keys(cached).length;
    if (status) status.textContent = `✅ ${total} publication${total>1?'s':''} classifiée${total>1?'s':''}.`;
    if (btn) { btn.disabled = false; btn.innerHTML = '🔄 Reclassifier'; }
  };

  function renderThemesFromCache() {
    const cached = loadThemesCache();
    _state.themes = cached;

    // Appliquer le filtre réseau ET exclure les événements
    const { fb: fbFiltered, ig: igFiltered } = filterPosts();
    const allPosts = [
      ...fbFiltered.map(p => ({ id:p.id, text:p.message||'', lk:p.likes?.summary?.total_count||0, cm:p.comments?.summary?.total_count||0, src:'fb', ts:p.created_time, pic:p.full_picture, story:p.story||'' })),
      ...igFiltered.map(p => ({ id:p.id, text:p.caption||'', lk:p.like_count||0, cm:p.comments_count||0, src:'ig', ts:p.timestamp, pic:p.thumbnail_url||p.media_url, story:'' })),
    ].filter(p => !isEventPost(p));

    const classified = allPosts.filter(p => cached[p.id]);
    if (!classified.length) return;

    // Stats par thème
    const themeStats = {};
    classified.forEach(p => {
      const t = cached[p.id];
      if (!themeStats[t]) themeStats[t] = { count:0, eng:0 };
      themeStats[t].count++;
      themeStats[t].eng += p.lk + p.cm;
    });
    Object.values(themeStats).forEach(s => { s.avg_eng = s.count ? Math.round(s.eng/s.count) : 0; });

    const sorted = Object.entries(themeStats).sort((a,b) => b[1].count - a[1].count);

    // Graphiques thèmes
    setTimeout(() => {
      const labels = sorted.map(([t]) => t);
      const PALETTE = ['#002EFF','#dc2743','#B86800','#1A8C3A','#5500DD','#0077AA','#CC0022','#8B4513','#006400','#8B008B','#FF6347','#4169E1','#20B2AA','#DAA520','#CD853F','#708090','#2F4F4F'];
      const colors  = labels.map((_,i) => PALETTE[i % PALETTE.length]);

      makeChart('ch-themes-count', {
        type:'bar',
        data: { labels, datasets:[{ data: sorted.map(([,s])=>s.count), backgroundColor: colors.map(c=>c+'99'), borderColor: colors, borderWidth:1.5, borderRadius:4 }] },
        options: { indexAxis:'y', responsive:true, maintainAspectRatio:false, plugins:{legend:{display:false}}, scales:{ x:{grid:{color:'rgba(0,0,0,0.05)'},ticks:{font:{size:10}}}, y:{grid:{display:false},ticks:{font:{size:11}}} } },
      });
      makeChart('ch-themes-eng', {
        type:'bar',
        data: { labels, datasets:[{ data: sorted.map(([,s])=>s.avg_eng), backgroundColor: colors.map(c=>c+'99'), borderColor: colors, borderWidth:1.5, borderRadius:4 }] },
        options: { indexAxis:'y', responsive:true, maintainAspectRatio:false, plugins:{legend:{display:false}}, scales:{ x:{grid:{color:'rgba(0,0,0,0.05)'},ticks:{font:{size:10}}}, y:{grid:{display:false},ticks:{font:{size:11}}} } },
      });
    }, 80);

    // Liste publications classifiées par thème
    const listEl = document.getElementById('themes-posts-list');
    if (!listEl) return;

    // Grouper par thème
    const byTheme = {};
    classified.forEach(p => {
      const t = cached[p.id];
      if (!byTheme[t]) byTheme[t] = [];
      byTheme[t].push(p);
    });

    const sortedThemes = Object.entries(byTheme).sort((a,b) => b[1].length - a[1].length);
    listEl.innerHTML = sortedThemes.map(([theme, posts]) => `
      <div style="margin-bottom:16px;">
        <div style="font-size:12px;font-weight:600;color:var(--accent);margin-bottom:6px;padding-bottom:4px;border-bottom:1px solid var(--border);">
          ${theme} <span style="font-weight:400;color:var(--muted);">(${posts.length} post${posts.length>1?'s':''})</span>
        </div>
        ${posts.slice(0,3).map(p => `
          <div class="rs-post" style="padding:6px 0;">
            ${p.pic ? `<img src="${p.pic}" class="rs-img" style="width:36px;height:36px;" alt="" onerror="this.style.display='none'">` : `<div class="rs-ph" style="width:36px;height:36px;font-size:14px;">${p.src==='fb'?'📘':'📸'}</div>`}
            <div style="flex:1;min-width:0;">
              <div class="rs-cap" style="-webkit-line-clamp:1;">${p.text.slice(0,100)}</div>
              <div class="rs-meta" style="margin-top:2px;"><span>${ago(p.ts)}</span><span>${p.src==='fb'?'👍':'❤️'} ${fmt(p.lk)}</span><span>💬 ${fmt(p.cm)}</span></div>
            </div>
          </div>`).join('')}
        ${posts.length > 3 ? `<div style="font-size:11px;color:var(--muted);padding:4px 0;">+ ${posts.length-3} autre${posts.length-3>1?'s':''} publication${posts.length-3>1?'s':''}</div>` : ''}
      </div>
    `).join('');
  }

  // ── Fonction Coller stats Facebook ────────────────────────
  const APPS_URL = 'https://script.google.com/macros/s/AKfycbxRvkaXvA1JvDvWaF25Y_6BHtoN2qseDRC-PqnQWo6CYT-21C74fbarHLA9afJj6rnF/exec';

  window.rsPasteStats = async function() {
    let json = '';
    try {
      json = await navigator.clipboard.readText();
    } catch(e) {
      json = prompt('Collez ici les données copiées depuis Facebook (via le favori) :') || '';
    }
    if (!json.trim()) return;

    let data;
    try {
      data = JSON.parse(json.trim());
    } catch(e) {
      alert('❌ Les données ne semblent pas valides.\nAssurez-vous d\'avoir cliqué le favori "MR Facebook Stats" sur la page Facebook.');
      return;
    }

    if (!data.type || !['vues','interactions','audience'].includes(data.type)) {
      alert('❌ Type de données non reconnu : ' + data.type);
      return;
    }

    // Notification envoi
    const notif = document.createElement('div');
    notif.style.cssText = 'position:fixed;bottom:24px;right:24px;z-index:99999;background:#002EFF;color:#fff;padding:14px 20px;border-radius:12px;font-family:sans-serif;font-size:13px;font-weight:600;box-shadow:0 6px 24px rgba(0,0,0,.25);';
    notif.textContent = 'Envoi ' + data.type + ' vers Google Sheet…';
    document.body.appendChild(notif);

    try {
      const res = await fetch(APPS_URL, {
        method: 'POST',
        body: JSON.stringify(data),
      });
      const result = await res.json();
      notif.style.background = result.ok ? '#1A8C3A' : '#CC0022';
      notif.innerHTML = result.ok
        ? '✅ ' + data.type + ' enregistré · ' + data.date_scrape + '<br><small style="font-weight:400;opacity:.85;">Période : ' + (data.periode_debut||'') + ' – ' + (data.periode_fin||'') + '</small>'
        : '❌ Erreur : ' + result.error;
      // Recharger les données Sheet si succès
      if (result.ok) { window._stData = null; loadSheetData(); }
    } catch(e) {
      notif.style.background = '#CC0022';
      notif.textContent = '❌ Erreur réseau : ' + e.message;
    }
    setTimeout(() => notif.remove(), 6000);
  };

  // ── Chargement Google Sheet ────────────────────────────────
  const SHEET_ID   = '1uw13osMAhdhI975BfRYtyX8Liyd78ApMIL-aFUG79ko';
  const SHEET_BASE = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:json&sheet=`;

  async function fetchSheet(name) {
    try {
      const r   = await fetch(SHEET_BASE + encodeURIComponent(name));
      const txt = await r.text();
      const m   = txt.match(/google\.visualization\.Query\.setResponse\(([\s\S]*)\)/);
      if (!m) return [];
      const j        = JSON.parse(m[1]);
      const headers  = j.table.cols.map(c => c.label || c.id);
      const colTypes = j.table.cols.map(c => c.type);
      return (j.table.rows || []).map(row => {
        const obj = {};
        headers.forEach((h, i) => {
          const cell = row.c?.[i];
          if (!cell || cell.v === null || cell.v === undefined) { obj[h] = null; return; }
          if (colTypes[i] === 'date' || colTypes[i] === 'datetime') {
            // gviz retourne les dates comme "Date(2026,0,3)" — mois 0-indexé
            const dv = String(cell.v);
            const dm = dv.match(/Date\((\d+),(\d+),(\d+)/);
            if (dm) {
              const yr = parseInt(dm[1]), mo = parseInt(dm[2]), dy = parseInt(dm[3]);
              obj[h] = yr + '-' + String(mo+1).padStart(2,'0') + '-' + String(dy).padStart(2,'0');
            } else {
              try { obj[h] = new Date(cell.v).toISOString().slice(0,10); } catch(e2) { obj[h] = String(cell.v); }
            }
          } else {
            obj[h] = cell.v;
          }
        });
        return obj;
      });
    } catch(e) { return []; }
  }

  window._stData = null;

  async function loadSheetData() {
    const [vues, interactions, audience, quotidien] = await Promise.all([
      fetchSheet('Vues'), fetchSheet('Interactions'), fetchSheet('Audience'), fetchSheet('Quotidien'),
    ]);
    window._stData = { vues, interactions, audience, quotidien };
    renderStatsAvancees();
  }

  function fmtN(n) {
    if (!n && n !== 0) return '—';
    if (n >= 1000000) return (n/1000000).toFixed(1).replace('.',',') + '\u00a0M';
    if (n >= 10000)   return Math.round(n/1000) + '\u00a0k';
    if (n >= 1000)    return (Math.round(n/100)/10).toFixed(1).replace('.',',') + '\u00a0k';
    return Number(n).toLocaleString('fr-BE');
  }

  const _stCharts = {};
  function makeSt(id, cfg) {
    if (_stCharts[id]) { try { _stCharts[id].destroy(); } catch(e){} }
    const c = document.getElementById(id);
    if (!c || typeof Chart === 'undefined') return;
    _stCharts[id] = new Chart(c, cfg);
  }

  function renderBars(elId, items, color) {
    const el = document.getElementById(elId);
    if (!el) return;
    const max = Math.max(...items.map(t => t.val || 0), 1);
    el.innerHTML = items.filter(t => t.val > 0).map(t => `
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:9px;font-size:12px;">
        <div style="min-width:110px;color:var(--muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;" title="${t.label}">${t.label}</div>
        <div style="flex:1;height:8px;background:var(--surf2);border-radius:4px;overflow:hidden;">
          <div style="width:${(t.val/max*100).toFixed(0)}%;height:100%;background:${t.color||color};border-radius:4px;transition:width .6s ease;"></div>
        </div>
        <div style="min-width:38px;text-align:right;font-weight:500;">${t.val.toFixed(1)}%</div>
      </div>`).join('');
  }

  function renderStatsAvancees() {
    const d = window._stData;
    if (!d) return;
    const v = d.vues?.[d.vues.length - 1];
    const i = d.interactions?.[d.interactions.length - 1];
    const a = d.audience?.[d.audience.length - 1];

    // ── Graphiques journaliers depuis la feuille Quotidien ──
    const quotidien = d.quotidien || [];
    const sortByDate = (a,b) => String(a.date_point).localeCompare(String(b.date_point));
    const dailyVues  = filterDaily(quotidien.filter(r => r.type === 'vues').sort(sortByDate));
    const dailyInter = filterDaily(quotidien.filter(r => r.type === 'interactions').sort(sortByDate));

    if (dailyVues.length > 0) {
      set('st-daily-note', dailyVues.length + ' points · ' + String(dailyVues[0].date_point).slice(0,10) + ' → ' + String(dailyVues[dailyVues.length-1].date_point).slice(0,10));
      const lblV = dailyVues.map(r => {
        const d = new Date(r.date_point);
        return d.toLocaleDateString('fr-BE', {day:'2-digit', month:'2-digit'});
      });
      makeSt('st-ch-daily-vues', {
        type: 'line',
        data: { labels: lblV, datasets: [{
          data: dailyVues.map(r => r.valeur || 0),
          borderColor: '#002EFF', backgroundColor: 'rgba(0,46,255,0.08)',
          fill: true, tension: 0.3, pointRadius: dailyVues.length > 30 ? 0 : 3,
          borderWidth: 2,
        }]},
        options: { responsive:true, maintainAspectRatio:false,
          plugins: { legend: { display:false } },
          scales: {
            x: { grid:{display:false}, ticks:{font:{size:9}, maxTicksLimit:12, maxRotation:0} },
            y: { grid:{color:'rgba(0,0,0,0.05)'}, ticks:{font:{size:10}, callback: v => fmtN(v)} },
          }},
      });
    }

    if (dailyInter.length > 0) {
      const lblI = dailyInter.map(r => {
        const d = new Date(r.date_point);
        return d.toLocaleDateString('fr-BE', {day:'2-digit', month:'2-digit'});
      });
      makeSt('st-ch-daily-inter', {
        type: 'bar',
        data: { labels: lblI, datasets: [{
          data: dailyInter.map(r => r.valeur || 0),
          backgroundColor: 'rgba(220,39,67,0.55)', borderColor: '#dc2743',
          borderWidth: dailyInter.length > 30 ? 0 : 1, borderRadius: 3,
        }]},
        options: { responsive:true, maintainAspectRatio:false,
          plugins: { legend: { display:false } },
          scales: {
            x: { grid:{display:false}, ticks:{font:{size:9}, maxTicksLimit:12, maxRotation:0} },
            y: { grid:{color:'rgba(0,0,0,0.05)'}, ticks:{font:{size:10}, callback: v => fmtN(v)} },
          }},
      });
    }

    // Message si pas encore de données journalières
    if (dailyVues.length === 0 && dailyInter.length === 0) {
      const noteEl = document.getElementById('st-daily-note');
      if (noteEl) noteEl.innerHTML = '⚠️ Pas encore de données · <a href="/dashboard/installer_bookmarklet.html" target="_blank" style="color:var(--accent);">Réinstallez le bookmarklet v2</a> et recliquez sur Facebook';
    }

    const noDataEl = document.getElementById('st-kpis-row');
    if (!v && !i && !a) {
      if (noDataEl) noDataEl.innerHTML = '<div style="color:var(--muted);font-size:13px;padding:20px 0;grid-column:1/-1;">Aucune donnée. Utilisez le bookmarklet Facebook puis "📋 Coller stats FB".</div>';
      return;
    }

    // Calculer les agrégats depuis les données journalières filtrées
    const vuesPeriode  = dailyVues.reduce((s,r)  => s + (r.valeur||0), 0);
    const interPeriode = dailyInter.reduce((s,r) => s + (r.valeur||0), 0);
    const days = periodDays();
    const perLabel = { '1w':'7 derniers jours', '4w':'30 derniers jours', '8w':'60 derniers jours', 'all':'90 derniers jours' }[_state.period] || '90 jours';

    const periodeLabel = perLabel + (v?.periode_debut && v?.periode_fin ? ` · données : ${v.periode_debut} – ${String(v.periode_fin).slice(0,10)}` : '');
    set('st-periode-label', periodeLabel);
    set('st-source-note', 'Source : Google Sheet · ' + perLabel);

    // KPIs : fans = dernier connu (pas filtrable) / vues+interactions = somme filtrée
    const hasDaily = dailyVues.length > 0 || dailyInter.length > 0;
    if (noDataEl) noDataEl.innerHTML = [
      { label:'Fans Facebook',        val:a?.followers_total,  color:'#1877F2', note:'total actuel' },
      { label:'Vues ('+perLabel+')',   val:hasDaily && vuesPeriode > 0 ? vuesPeriode : v?.vues_total,  color:'#002EFF', note: hasDaily && vuesPeriode > 0 ? '' : '90 jours' },
      { label:'Interactions ('+perLabel+')', val:hasDaily && interPeriode > 0 ? interPeriode : i?.interactions_total, color:'#dc2743', note: hasDaily && interPeriode > 0 ? '' : '90 jours' },
      { label:'Réactions',            val:i?.reactions,        color:'#002EFF' },
      { label:'Commentaires',         val:i?.commentaires,     color:'#5500DD' },
      { label:'Partages',             val:i?.partages,         color:'#B86800' },
    ].filter(k=>k.val!==null&&k.val!==undefined).map(k=>`
      <div class="card" style="padding:12px 14px;border-left:3px solid ${k.color};">
        <div class="rs-kl">${k.label}</div>
        <div class="rs-kv" style="color:${k.color};">${k.fmt?k.fmt(k.val):fmtN(k.val)}</div>
        ${k.note?`<div style="font-size:10px;color:var(--muted);margin-top:2px;">${k.note}</div>`:''}
      </div>`).join('');

    // Barres vues par type
    renderBars('st-vues-bars', [
      {label:'Photo',            val:v?.vues_photo_pct,    color:'#002EFF'},
      {label:'Reel',             val:v?.vues_reel_pct,     color:'#dc2743'},
      {label:'Plusieurs photos', val:v?.vues_carousel_pct, color:'#B86800'},
      {label:'Story',            val:v?.vues_story_pct,    color:'#5500DD'},
      {label:'En direct',        val:v?.vues_live_pct,     color:'#0077AA'},
      {label:'Autre',            val:v?.vues_autre_pct,    color:'#9AA5C8'},
    ].filter(t=>t.val>0).sort((a,b)=>b.val-a.val), '#002EFF');

    // Donut interactions
    if (i?.reactions||i?.commentaires||i?.partages) makeSt('st-ch-inter-donut',{
      type:'doughnut',
      data:{labels:['Réactions','Commentaires','Partages'],datasets:[{
        data:[i.reactions||0,i.commentaires||0,i.partages||0],
        backgroundColor:['rgba(0,46,255,.75)','rgba(220,39,67,.75)','rgba(184,104,0,.75)'],
        borderWidth:2,borderColor:'#fff'}]},
      options:{responsive:true,maintainAspectRatio:false,cutout:'62%',
        plugins:{legend:{display:true,position:'bottom',labels:{font:{size:11},boxWidth:12}}}},
    });

    // Donut followers vs non-followers
    // Calculer la valeur manquante si une seule est renseignée
    const folPct    = v?.vues_followers_pct    || null;
    const nonFolPct = v?.vues_nonfollowers_pct || null;
    // N'afficher le graphique que si on a les deux valeurs (sinon 100% incorrect)
    if (folPct !== null && nonFolPct !== null) makeSt('st-ch-fol-split',{
      type:'doughnut',
      data:{labels:['Non-followers','Followers'],datasets:[{
        data:[nonFolPct||0, folPct||0],
        backgroundColor:['rgba(0,46,255,.7)','rgba(26,140,58,.7)'],
        borderWidth:2,borderColor:'#fff'}]},
      options:{responsive:true,maintainAspectRatio:false,cutout:'60%',
        plugins:{legend:{display:true,position:'bottom',labels:{font:{size:11},boxWidth:12}}}},
    });

    // Qualité vues
    const qEl = document.getElementById('st-vues-quality');
    if (qEl&&v) qEl.innerHTML = [
      {label:'Vues totales',    val:fmtN(v.vues_total)},
      {label:'Vues 3 secondes', val:v.vues_3s?fmtN(v.vues_3s)+(v.vues_total?' ('+(v.vues_3s/v.vues_total*100).toFixed(1)+'%)':''):'—'},
      {label:'Vues 1 minute',   val:v.vues_1min?fmtN(v.vues_1min)+(v.vues_total?' ('+(v.vues_1min/v.vues_total*100).toFixed(1)+'%)':''):'—'},
      {label:'Reach followers',      val:v.vues_followers_pct?v.vues_followers_pct.toFixed(1)+'%':'—'},
      {label:'Reach non-followers',  val:v.vues_nonfollowers_pct?v.vues_nonfollowers_pct.toFixed(1)+'%':'—'},
    ].map(r=>`<div style="display:flex;justify-content:space-between;padding:6px 0;font-size:12px;border-bottom:1px solid var(--border);"><span style="color:var(--muted);">${r.label}</span><strong>${r.val}</strong></div>`).join('');

    // Âge
    if (a) {
      const ageV=[a.age_18_24||0,a.age_25_34||0,a.age_35_44||0,a.age_45_54||0,a.age_55_64||0,a.age_65plus||0];
      makeSt('st-ch-age',{type:'bar',
        data:{labels:['18–24','25–34','35–44','45–54','55–64','65+'],datasets:[{data:ageV,
          backgroundColor:'rgba(0,46,255,.65)',borderColor:'#002EFF',borderWidth:1.5,borderRadius:5}]},
        options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}},
          scales:{x:{grid:{display:false},ticks:{font:{size:11}}},
            y:{max:Math.max(...ageV)+3,ticks:{callback:v=>v+'%',font:{size:10}},grid:{color:'rgba(0,0,0,0.05)'}}}},
      });

      renderBars('st-pays-bars',[
        {label:a.pays_1_nom,val:a.pays_1_pct,color:'#002EFF'},
        {label:a.pays_2_nom,val:a.pays_2_pct,color:'#002EFF'},
        {label:a.pays_3_nom,val:a.pays_3_pct,color:'#002EFF'},
        {label:a.pays_4_nom,val:a.pays_4_pct,color:'#002EFF'},
      ].filter(p=>p.label&&p.val>0),'#002EFF');

      renderBars('st-villes-bars',[
        {label:a.ville_1_nom,val:a.ville_1_pct,color:'#0077AA'},
        {label:a.ville_2_nom,val:a.ville_2_pct,color:'#0077AA'},
        {label:a.ville_3_nom,val:a.ville_3_pct,color:'#0077AA'},
        {label:a.ville_4_nom,val:a.ville_4_pct,color:'#0077AA'},
        {label:a.ville_5_nom,val:a.ville_5_pct,color:'#0077AA'},
        {label:a.ville_6_nom,val:a.ville_6_pct,color:'#0077AA'},
      ].filter(v=>v.label&&v.val>0),'#0077AA');

      const audEl=document.getElementById('st-audience-kpis');
      if(audEl) audEl.innerHTML=`
        <div style="display:flex;gap:12px;flex-wrap:wrap;margin-bottom:10px;">
          <div style="flex:1;min-width:100px;background:rgba(26,140,58,.08);border:1px solid rgba(26,140,58,.2);border-radius:8px;padding:12px 14px;">
            <div class="rs-kl">Nouveaux fans nets</div>
            <div style="font-size:22px;font-weight:700;font-family:'Syne',sans-serif;color:#1A8C3A;">+${fmtN(a.followers_nets||0)}</div>
          </div>
          <div style="flex:1;min-width:100px;background:rgba(204,0,34,.08);border:1px solid rgba(204,0,34,.2);border-radius:8px;padding:12px 14px;">
            <div class="rs-kl">Désabonnements</div>
            <div style="font-size:22px;font-weight:700;font-family:'Syne',sans-serif;color:#CC0022;">${fmtN(a.desabonnements||0)}</div>
          </div>
        </div>
        <div style="font-size:12px;color:var(--muted);">Évolution : <strong style="color:${(a.followers_delta_pct||0)>=0?'#1A8C3A':'#CC0022'};">${(a.followers_delta_pct||0)>=0?'+':''}${(a.followers_delta_pct||0).toFixed(1)}%</strong> vs période précédente</div>`;
    }
  }

  // ── Init ───────────────────────────────────────────────────
  window.rsPageActivated = function() {
    if (!window._rsReady) {
      window._rsReady = true;
      buildShell();
      window._rsLoad(false);
    }
  };

})();
