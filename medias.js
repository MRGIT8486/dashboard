// ============================================================
//  MODULE MÉDIAS v7 — Dashboard MR
//  - KPIs filtrés MR uniquement
//  - Partis lus depuis Personnalités (colonnes sans en-têtes)
//  - Croisement Sujet → Parti via la map
// ============================================================
(function () {

  var SHEET_ID         = '1EQQWKnakfh4663UVoHcds18sx3JnF9PVaBi_dCRi8g8';
  var GID_ART          = '0';
  var SHEET_PERSO_NAME = 'Personnalités';

  // Personnalités MR connues (fallback si Personnalités non lisible)
  // Le code essaie d'abord l'onglet, puis utilise cette liste
  var MR_CONNUS = [
    'MR','GLB','Georges-Louis Bouchez','Bouchez',
    'David Clarinval','Mathieu Bihet','Bernard Quintin',
    'Eléonore Simonet','Adrien Dolimont','Pierre-Yves Jeholet',
    'Cécile Neven','Anne-Catherine Dalcq','Valérie Glatigny',
    'Yvan Verougstraete','Boris Dilliès','Audrey Henry',
    'Jacqueline Galant','Gregor Freches','Elisabeth Degryse',
    'Valérie Lescrenier'
  ];

  var PARTI_COLORS = {
    'MR':            '#002EFF',
    'PS':            '#CC0000',
    'Engagés':       '#F07800',
    'Les Engagés':   '#F07800',
    'PTB':           '#8B0000',
    'Écolo':         '#1A8C3A',
    'Ecolo':         '#1A8C3A',
    'Groen':         '#2ECC71',
    'N-VA':          '#FFAE00',
    'CD&V':          '#F5A623',
    'Open Vld':      '#003F9A',
    'Vooruit':       '#E63946',
    'Vlaams Belang': '#4A0080',
    'DéFI':          '#E91E8C',
    'Autre':         '#9AA5C8'
  };

  var C_POS = '#1A8C3A';
  var C_NEU = '#B86800';
  var C_NEG = '#CC0022';
  var C_DIM = '#9AA5C8';
  var charts = {};

  // ── Navigation ──────────────────────────────────────────────
  window.showTabMedias = function (id, btn) {
    document.querySelectorAll('#page-medias .tab-section').forEach(function (s) { s.classList.remove('active'); });
    document.querySelectorAll('#page-medias .subnav button').forEach(function (b) { b.classList.remove('active'); });
    document.getElementById('med-tab-' + id).classList.add('active');
    btn.classList.add('active');
  };

  var _loaded = false;
  var _origShowPage = window.showPage;
  window.showPage = function (id, btn) {
    if (_origShowPage) _origShowPage(id, btn);
    if (id === 'medias' && !_loaded) { _loaded = true; charger(); }
  };
  window.mediasRefresh = function () { _loaded = true; charger(); };

  function destroyChart(id) { if (charts[id]) { charts[id].destroy(); delete charts[id]; } }
  function showLoading() {
    document.getElementById('medias-loading').style.display = 'flex';
    document.getElementById('medias-content').style.display = 'none';
  }
  function showContent() {
    document.getElementById('medias-loading').style.display = 'none';
    document.getElementById('medias-content').style.display = 'block';
  }
  function showError(msg) {
    document.getElementById('medias-loading').innerHTML =
      '<p style="color:var(--red);font-size:13px;max-width:420px;text-align:center;line-height:1.6;">' + msg + '</p>';
  }

  // ── Date "Date(2026,2,28)" → "2026-03-28" ───────────────────
  function parseDate(v) {
    if (!v) return null;
    var m = String(v).match(/Date\((\d+),(\d+),(\d+)/);
    if (m) return m[1]+'-'+('0'+(+m[2]+1)).slice(-2)+'-'+('0'+m[3]).slice(-2);
    if (typeof v==='string' && /^\d{4}-\d{2}-\d{2}/.test(v)) return v.slice(0,10);
    if (typeof v==='number') return new Date(Math.round((v-25569)*86400000)).toISOString().slice(0,10);
    try { return new Date(v).toISOString().slice(0,10); } catch(e) { return null; }
  }

  function parseGviz(raw) {
    try {
      var json = JSON.parse(raw.replace(/^[^(]+\(/, '').replace(/\);\s*$/, ''));
      var cols = json.table.cols.map(function(c){ return c.label; });
      return (json.table.rows||[]).map(function(r){
        var obj = {};
        r.c.forEach(function(cell,i){ obj[cols[i]||('col'+i)] = cell ? cell.v : null; });
        return obj;
      });
    } catch(e){ return []; }
  }

  function getColor(parti) {
    if (!parti) return PARTI_COLORS['Autre'];
    if (PARTI_COLORS[parti]) return PARTI_COLORS[parti];
    var keys = Object.keys(PARTI_COLORS);
    for (var i=0; i<keys.length; i++) {
      if (parti.toLowerCase().indexOf(keys[i].toLowerCase())!==-1 ||
          keys[i].toLowerCase().indexOf(parti.toLowerCase())!==-1) {
        return PARTI_COLORS[keys[i]];
      }
    }
    return PARTI_COLORS['Autre'];
  }

  // ── Chargement ──────────────────────────────────────────────
  function charger() {
    showLoading();
    var base = 'https://docs.google.com/spreadsheets/d/'+SHEET_ID+'/gviz/tq?tqx=out:json&';
    Promise.all([
      fetch(base+'gid='+GID_ART).then(function(r){ return r.text(); }),
      fetch(base+'sheet='+encodeURIComponent(SHEET_PERSO_NAME)).then(function(r){ return r.text(); })
    ]).then(function(res) {
      afficher(parseGviz(res[0]), parseGviz(res[1]));
    }).catch(function(e) {
      showError('Erreur de chargement. Vérifiez que le Sheet est public en lecture.');
      console.error('Médias:', e);
    });
  }

  // ── Construire la map Nom → Parti depuis l'onglet Personnalités ─
  // Les colonnes n'ont pas de labels → Google renvoie col0, col1, col2
  // La ligne 1 contient les en-têtes comme données : "Nom","Parti","Mots-Clés"
  // Les vraies données commencent ligne 2
  function buildPersoMap(rawPersos) {
    var map = {};
    rawPersos.forEach(function(r) {
      // Lire par position : col0=Nom, col1=Parti
      var nom   = (r['col0'] || r['Nom']   || '').trim();
      var parti = (r['col1'] || r['Parti'] || '').trim();
      // Ignorer la ligne d'en-tête et les lignes vides
      if (!nom || nom === 'Nom' || !parti || parti === 'Parti') return;
      map[nom] = parti;
      // Ajouter aussi les mots-clés comme alias vers le même parti
      var kws = (r['col2'] || r['Mots-Clés'] || '').split(',');
      kws.forEach(function(kw) {
        var k = kw.trim();
        if (k && k !== nom) map[k] = parti;
      });
    });
    return map;
  }

  // ── Affichage ───────────────────────────────────────────────
  function afficher(rawArts, rawPersos) {

    // Construire la map Nom → Parti
    var persoMap = buildPersoMap(rawPersos);

    // Fallback : si la map est vide, utiliser la liste MR_CONNUS
    var mapVide = Object.keys(persoMap).length === 0;
    if (mapVide) {
      MR_CONNUS.forEach(function(n){ persoMap[n] = 'MR'; });
    }

    // Normaliser les articles
    var arts = rawArts.map(function(r) {
      var ton = (r['Ton']||'').toLowerCase().trim();
      if (ton==='n\u00e9gatif') ton='negatif';

      var perso = (
        r['Personnalit\u00e9'] || r['Personnalite'] ||
        r['Sujet (MR ou GLB)'] || ''
      ).trim();

      // Résoudre le parti
      var parti = (r['Parti']||'').trim();
      if (!parti && perso) parti = persoMap[perso] || '';
      // Cas "GLB" → MR
      if (!parti && perso==='GLB') parti='MR';
      if (!parti) parti='Autre';

      return {
        _d:    parseDate(r['Date']),
        media: (r['M\u00e9dia']||r['Media']||'Inconnu').trim(),
        perso: perso,
        parti: parti,
        ton:   ton
      };
    }).filter(function(r){ return r._d; });

    if (!arts.length) {
      showError('Aucune donnée trouvée. Lancez le script Apps Script et actualisez.');
      return;
    }

    var auj  = new Date().toISOString().slice(0,10);
    var il7j = new Date(Date.now()-  7*86400000).toISOString().slice(0,10);
    var il30 = new Date(Date.now()-30*86400000).toISOString().slice(0,10);

    var arts30  = arts.filter(function(a){ return a._d>=il30; });
    var arts7j  = arts.filter(function(a){ return a._d>=il7j; });
    var artsAuj = arts.filter(function(a){ return a._d===auj; });

    // ── KPIs — filtrés MR uniquement ──────────────────────────
    var mr30  = arts30.filter(function(a){ return a.parti==='MR'; });
    var mr7j  = arts7j.filter(function(a){ return a.parti==='MR'; });
    var mrAuj = artsAuj.filter(function(a){ return a.parti==='MR'; });

    var mrPos = mr30.filter(function(a){ return a.ton==='positif'; }).length;
    var mrNeg = mr30.filter(function(a){ return a.ton==='negatif'; }).length;

    var tonLabel, tonColor;
    if (!mr30.length)                     { tonLabel='—';        tonColor='var(--muted)'; }
    else if (mrPos/mr30.length>=0.45)     { tonLabel='Positif';  tonColor=C_POS; }
    else if (mrNeg/mr30.length>=0.45)     { tonLabel='Négatif';  tonColor=C_NEG; }
    else                                  { tonLabel='Neutre';   tonColor=C_NEU; }

    document.getElementById('med-k-today').textContent = mrAuj.length;
    document.getElementById('med-k-7j').textContent    = mr7j.length;
    document.getElementById('med-k-30j').textContent   = mr30.length;
    document.getElementById('med-k-ton').style.color   = tonColor;
    document.getElementById('med-k-ton').textContent   = tonLabel;

    // ── Agrégation personnalités (hors "MR"/"GLB" génériques) ─
    var persoAgg = {};
    arts30.forEach(function(a) {
      if (!a.perso || a.perso==='MR' || a.perso==='GLB') return;
      if (!persoAgg[a.perso]) persoAgg[a.perso]={total:0,pos:0,neg:0,parti:a.parti};
      persoAgg[a.perso].total++;
      if (a.ton==='positif') persoAgg[a.perso].pos++;
      if (a.ton==='negatif') persoAgg[a.perso].neg++;
    });

    // Trier par mentions décroissantes (toutes couleurs confondues)
    var persoSorted = Object.keys(persoAgg)
      .map(function(k){ return Object.assign({nom:k},persoAgg[k]); })
      .sort(function(a,b){ return b.total-a.total; });

    // ── Agrégation partis ─────────────────────────────────────
    var partiAgg = {};
    arts30.forEach(function(a) {
      var p=a.parti||'Autre';
      if (!partiAgg[p]) partiAgg[p]={total:0,pos:0,neg:0};
      partiAgg[p].total++;
      if (a.ton==='positif') partiAgg[p].pos++;
      if (a.ton==='negatif') partiAgg[p].neg++;
    });
    var partiSorted=Object.keys(partiAgg)
      .map(function(k){ return Object.assign({nom:k},partiAgg[k]); })
      .sort(function(a,b){ return b.total-a.total; });

    // ── Top 10 personnalités — triées par parti puis mentions ─
    var top10=persoSorted.slice(0,10);
    destroyChart('persoTop');
    if (top10.length) {
      charts['persoTop']=new Chart(document.getElementById('med-ch-perso-top').getContext('2d'),{
        type:'bar',
        data:{
          labels:top10.map(function(p){ return p.nom; }),
          datasets:[{
            label:'Mentions',
            data: top10.map(function(p){ return p.total; }),
            backgroundColor:top10.map(function(p){ return getColor(p.parti)+'CC'; }),
            borderColor:    top10.map(function(p){ return getColor(p.parti); }),
            borderWidth:1, borderRadius:4
          }]
        },
        options:{
          responsive:true, maintainAspectRatio:false, indexAxis:'y',
          plugins:{
            legend:{display:false},
            tooltip:{callbacks:{label:function(ctx){
              var p=persoAgg[ctx.label];
              return ' '+ctx.parsed.x+' articles · '+(p?p.parti:'?')+
                ' · +'+(p&&p.total?Math.round(p.pos/p.total*100):0)+'%'+
                ' / −'+(p&&p.total?Math.round(p.neg/p.total*100):0)+'%';
            }}}
          },
          scales:{
            x:{beginAtZero:true,ticks:{color:C_DIM,font:{size:11}},grid:{color:'rgba(0,0,0,0.05)'}},
            y:{ticks:{color:'#4A5785',font:{size:12}},grid:{display:false}}
          }
        }
      });
    }

    // ── Top médias ────────────────────────────────────────────
    var mAgg={};
    arts30.forEach(function(a){
      if (!mAgg[a.media]) mAgg[a.media]={total:0,pos:0,neg:0};
      mAgg[a.media].total++;
      if (a.ton==='positif') mAgg[a.media].pos++;
      if (a.ton==='negatif') mAgg[a.media].neg++;
    });
    var mSorted=Object.keys(mAgg)
      .map(function(k){ return Object.assign({nom:k},mAgg[k]); })
      .sort(function(a,b){ return b.total-a.total; }).slice(0,8);

    var barsEl=document.getElementById('med-bars-medias');
    if (barsEl) {
      barsEl.innerHTML='';
      var maxM=mSorted.length?mSorted[0].total:1;
      mSorted.forEach(function(m){
        var pct=Math.round(m.total/maxM*100);
        var pp=m.total?Math.round(m.pos/m.total*100):0;
        var pn=m.total?Math.round(m.neg/m.total*100):0;
        barsEl.innerHTML+=
          '<div class="bar-row">'+
          '<div class="bar-label" title="'+m.nom+'">'+m.nom+'</div>'+
          '<div class="bar-track"><div class="bar-fill" style="width:'+pct+'%;background:var(--accent);"></div></div>'+
          '<div style="font-size:11px;width:110px;flex-shrink:0;text-align:right;">'+
            '<span style="color:var(--muted)">'+m.total+'</span>&nbsp;'+
            '<span style="color:'+C_POS+'">+'+pp+'%</span>&nbsp;'+
            '<span style="color:'+C_NEG+'">−'+pn+'%</span>'+
          '</div></div>';
      });
    }

    // ── Tableau personnalités (trié par parti + mentions) ─────
    var tbody=document.getElementById('med-tbl-perso');
    if (tbody) {
      tbody.innerHTML='';
      if (!persoSorted.length) {
        tbody.innerHTML='<tr><td colspan="5" style="color:var(--muted);text-align:center;padding:24px;">Aucune personnalité sur 30 jours</td></tr>';
      } else {
        var lastParti='';
        persoSorted.forEach(function(p){
          var pctPos=p.total?Math.round(p.pos/p.total*100):0;
          var pctNeg=p.total?Math.round(p.neg/p.total*100):0;
          var c=getColor(p.parti);
          // Ligne de séparation par parti
          if (p.parti!==lastParti) {
            tbody.innerHTML+=
              '<tr style="background:'+c+'0A;">'+
              '<td colspan="5" style="font-size:11px;font-weight:700;color:'+c+';padding:6px 12px;letter-spacing:.5px;">'+
                p.parti.toUpperCase()+'</td></tr>';
            lastParti=p.parti;
          }
          tbody.innerHTML+=
            '<tr>'+
            '<td style="font-weight:500;">'+p.nom+'</td>'+
            '<td><span style="display:inline-block;padding:2px 8px;border-radius:10px;font-size:11px;font-weight:600;'+
              'background:'+c+'18;color:'+c+';border:1px solid '+c+'44;">'+p.parti+'</span></td>'+
            '<td style="font-family:\'Syne\',sans-serif;font-weight:700;">'+p.total+'</td>'+
            '<td><span style="color:'+C_POS+';font-weight:600;">+'+pctPos+'%</span></td>'+
            '<td><span style="color:'+C_NEG+';font-weight:600;">−'+pctNeg+'%</span></td>'+
            '</tr>';
        });
      }
    }

    // ── Mentions par parti ────────────────────────────────────
    destroyChart('partiBar');
    if (partiSorted.length) {
      charts['partiBar']=new Chart(document.getElementById('med-ch-parti-bar').getContext('2d'),{
        type:'bar',
        data:{
          labels:partiSorted.map(function(p){ return p.nom; }),
          datasets:[{
            label:'Mentions (30j)',
            data: partiSorted.map(function(p){ return p.total; }),
            backgroundColor:partiSorted.map(function(p){ return getColor(p.nom)+'CC'; }),
            borderColor:    partiSorted.map(function(p){ return getColor(p.nom); }),
            borderWidth:1, borderRadius:4
          }]
        },
        options:{
          responsive:true, maintainAspectRatio:false,
          plugins:{legend:{display:false},
            tooltip:{callbacks:{label:function(ctx){
              var p=partiAgg[ctx.label];
              return ' '+ctx.parsed.y+' articles · +'+
                (p&&p.total?Math.round(p.pos/p.total*100):0)+'% pos · −'+
                (p&&p.total?Math.round(p.neg/p.total*100):0)+'% nég';
            }}}
          },
          scales:{
            x:{ticks:{color:'#4A5785',font:{size:12}},grid:{display:false}},
            y:{beginAtZero:true,ticks:{color:C_DIM,font:{size:11}},grid:{color:'rgba(0,0,0,0.05)'}}
          }
        }
      });
    }

    // ── Ton par parti (100% empilé) ───────────────────────────
    destroyChart('partiTon');
    if (partiSorted.length) {
      charts['partiTon']=new Chart(document.getElementById('med-ch-parti-ton').getContext('2d'),{
        type:'bar',
        data:{
          labels:partiSorted.map(function(p){ return p.nom; }),
          datasets:[
            {label:'Positif',data:partiSorted.map(function(p){ return p.total?Math.round(p.pos/p.total*100):0; }),backgroundColor:C_POS+'CC',borderColor:C_POS,borderWidth:1},
            {label:'Neutre', data:partiSorted.map(function(p){ return p.total?Math.round((p.total-p.pos-p.neg)/p.total*100):0; }),backgroundColor:C_NEU+'CC',borderColor:C_NEU,borderWidth:1},
            {label:'Négatif',data:partiSorted.map(function(p){ return p.total?Math.round(p.neg/p.total*100):0; }),backgroundColor:C_NEG+'CC',borderColor:C_NEG,borderWidth:1}
          ]
        },
        options:{
          responsive:true, maintainAspectRatio:false,
          plugins:{
            legend:{labels:{color:'#4A5785',font:{family:'DM Sans',size:11}}},
            tooltip:{callbacks:{label:function(ctx){ return ' '+ctx.dataset.label+' : '+ctx.parsed.y+'%'; }}}
          },
          scales:{
            x:{stacked:true,ticks:{color:'#4A5785',font:{size:12}},grid:{display:false}},
            y:{stacked:true,beginAtZero:true,max:100,
               ticks:{color:C_DIM,font:{size:11},callback:function(v){return v+'%';}},
               grid:{color:'rgba(0,0,0,0.05)'}}
          }
        }
      });
    }

    // ── Évolution 30j ─────────────────────────────────────────
    var days30=[];
    for (var i=29;i>=0;i--) days30.push(new Date(Date.now()-i*86400000).toISOString().slice(0,10));
    var lEvo=days30.map(function(d){ return d.slice(8)+'/'+d.slice(5,7); });

    var byDayParti={}, byDayTot={};
    arts30.forEach(function(a){
      byDayTot[a._d]=(byDayTot[a._d]||0)+1;
      if (!byDayParti[a._d]) byDayParti[a._d]={};
      byDayParti[a._d][a.parti]=(byDayParti[a._d][a.parti]||0)+1;
    });

    var top5=partiSorted.slice(0,5).map(function(p){ return p.nom; });
    var evoDsets=top5.map(function(parti){
      return {
        label:parti,
        data:days30.map(function(d){ return (byDayParti[d]||{})[parti]||0; }),
        borderColor:getColor(parti), backgroundColor:getColor(parti)+'33',
        borderWidth:2, pointRadius:2, fill:false, tension:0.3
      };
    });
    evoDsets.unshift({
      label:'Total',
      data:days30.map(function(d){ return byDayTot[d]||0; }),
      borderColor:'#060D2E', borderDash:[4,3],
      borderWidth:2, pointRadius:0, fill:false, tension:0.3
    });

    destroyChart('evo');
    charts['evo']=new Chart(document.getElementById('med-ch-evolution').getContext('2d'),{
      type:'line',
      data:{labels:lEvo, datasets:evoDsets},
      options:{
        responsive:true, maintainAspectRatio:false,
        plugins:{legend:{labels:{color:'#4A5785',font:{family:'DM Sans',size:11},boxWidth:14}}},
        scales:{
          x:{ticks:{color:C_DIM,font:{size:10},maxTicksLimit:10},grid:{display:false}},
          y:{beginAtZero:true,ticks:{color:C_DIM,font:{size:11}},grid:{color:'rgba(0,0,0,0.05)'}}
        }
      }
    });

    showContent();
  }

})();
