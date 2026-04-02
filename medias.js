// ============================================================
//  MODULE MÉDIAS v9 — Dashboard MR
//  Nouveautés :
//  - Filtre langue global (Tous / FR / NL)
//  - Top médias filtrable par parti
//  - KPI "Part MR hier" (% articles MR parmi tous les articles J-1)
//  - Top médias limité aux articles MR uniquement (vue ensemble)
// ============================================================
(function () {

  var SHEET_ID         = '1EQQWKnakfh4663UVoHcds18sx3JnF9PVaBi_dCRi8g8';
  var GID_ART          = '0';
  var SHEET_PERSO_NAME = 'Personnalités';

  var MR_CONNUS = ['MR','GLB','Georges-Louis Bouchez','Bouchez',
    'David Clarinval','Mathieu Bihet','Bernard Quintin','Eléonore Simonet',
    'Adrien Dolimont','Pierre-Yves Jeholet','Cécile Neven','Anne-Catherine Dalcq',
    'Valérie Glatigny','Yvan Verougstraete','Boris Dilliès','Audrey Henry',
    'Jacqueline Galant','Gregor Freches','Elisabeth Degryse','Valérie Lescrenier'];

  var PC = {
    'MR':'#002EFF','PS':'#CC0000','Engagés':'#F07800','Les Engagés':'#F07800',
    'PTB':'#8B0000','Écolo':'#1A8C3A','Ecolo':'#1A8C3A','Groen':'#2ECC71',
    'N-VA':'#FFAE00','CD&V':'#F5A623','Open Vld':'#003F9A','Vooruit':'#E63946',
    'Vlaams Belang':'#4A0080','DéFI':'#E91E8C','Autre':'#9AA5C8'
  };
  var C_POS='#1A8C3A', C_NEU='#B86800', C_NEG='#CC0022', C_DIM='#9AA5C8';
  var charts = {};

  // État global — recalculé à chaque changement de filtre langue
  var _allArts    = [];   // tous les articles normalisés (30j)
  var _filteredArts = []; // après filtre langue

  function gc(p){ return PC[p]||'#9AA5C8'; }

  // ── Filtre langue courant ───────────────────────────────────
  function getLangFilter() {
    var el = document.getElementById('med-lang-filter');
    return el ? el.value : '';
  }

  // Appliquer le filtre langue sur les 30 derniers jours
  function applyLangFilter() {
    var lang = getLangFilter();
    _filteredArts = lang
      ? _allArts.filter(function(a){ return a.langue === lang; })
      : _allArts.slice();
    renderAll();
  }

  // ── Navigation ──────────────────────────────────────────────
  window.showTabMedias = function(id, btn) {
    document.querySelectorAll('#page-medias .tab-section').forEach(function(s){ s.classList.remove('active'); });
    document.querySelectorAll('#page-medias .subnav button').forEach(function(b){ b.classList.remove('active'); });
    var tab = document.getElementById('med-tab-'+id);
    if (tab) tab.classList.add('active');
    if (btn) btn.classList.add('active');
  };

  // ── Déclenchement robuste ────────────────────────────────────
  var _loaded = false;
  function patchShowPage() {
    if (!window.showPage) return;
    clearInterval(_patchTimer);
    var orig = window.showPage;
    window.showPage = function(id, btn) {
      orig(id, btn);
      if (id === 'medias' && !_loaded) { _loaded = true; charger(); }
    };
  }
  var _patchTimer = setInterval(patchShowPage, 50);

  window.mediasRefresh    = function() { _loaded = true; charger(); };

  // WEB_APP_URL : à renseigner après déploiement Apps Script
  var WEB_APP_URL = '';

  window.mediasActualiser = function() {
    var btn = document.getElementById('med-btn-refresh');
    if (!WEB_APP_URL) { _loaded = true; charger(); return; }
    if (btn) { btn.textContent='⏳ Scan en cours…'; btn.disabled=true; }
    fetch(WEB_APP_URL, {method:'GET', mode:'no-cors'})
      .then(function(){ return new Promise(function(r){ setTimeout(r,30000); }); })
      .then(function(){ _loaded=true; charger(); })
      .catch(function(){ _loaded=true; charger(); })
      .finally(function(){
        if(btn){ btn.textContent='↻ Actualiser'; btn.disabled=false; }
      });
  };

  // ── Helpers ─────────────────────────────────────────────────
  function destroyChart(id){ if(charts[id]){ charts[id].destroy(); delete charts[id]; } }
  function showLoading(){
    var el=document.getElementById('medias-loading');
    var ct=document.getElementById('medias-content');
    if(el) el.style.display='flex';
    if(ct) ct.style.display='none';
  }
  function showContent(){
    var el=document.getElementById('medias-loading');
    var ct=document.getElementById('medias-content');
    if(el) el.style.display='none';
    if(ct) ct.style.display='block';
  }
  function showError(msg){
    var el=document.getElementById('medias-loading');
    if(el) el.innerHTML='<p style="color:var(--red);font-size:13px;max-width:420px;text-align:center;line-height:1.6;">'+msg+'</p>';
  }

  function parseDate(v){
    if(!v) return null;
    var m=String(v).match(/Date\((\d+),(\d+),(\d+)/);
    if(m) return m[1]+'-'+('0'+(+m[2]+1)).slice(-2)+'-'+('0'+m[3]).slice(-2);
    if(typeof v==='string'&&/^\d{4}-\d{2}-\d{2}/.test(v)) return v.slice(0,10);
    if(typeof v==='number') return new Date(Math.round((v-25569)*86400000)).toISOString().slice(0,10);
    try{ return new Date(v).toISOString().slice(0,10); }catch(e){ return null; }
  }

  function parseGviz(raw){
    try{
      var json=JSON.parse(raw.replace(/^[^(]+\(/,'').replace(/\);\s*$/,''));
      var cols=json.table.cols.map(function(c){ return c.label; });
      return (json.table.rows||[]).map(function(r){
        var obj={};
        r.c.forEach(function(cell,i){ obj[cols[i]||('col'+i)]=cell?cell.v:null; });
        return obj;
      });
    }catch(e){ return []; }
  }

  function buildPersoMap(rawPersos){
    var map={};
    rawPersos.forEach(function(r){
      var nom  =(r['col0']||r['Nom']  ||'').trim();
      var parti=(r['col1']||r['Parti']||'').trim();
      if(!nom||nom==='Nom'||!parti||parti==='Parti') return;
      map[nom]=parti;
      var kws=(r['col2']||r['Mots-Clés']||'').split(',');
      kws.forEach(function(kw){ var k=kw.trim(); if(k&&k!==nom) map[k]=parti; });
    });
    if(Object.keys(map).length===0) MR_CONNUS.forEach(function(n){ map[n]='MR'; });
    return map;
  }

  // ── Chargement ──────────────────────────────────────────────
  function charger(){
    showLoading();
    var base='https://docs.google.com/spreadsheets/d/'+SHEET_ID+'/gviz/tq?tqx=out:json&';
    Promise.all([
      fetch(base+'gid='+GID_ART).then(function(r){ return r.text(); }),
      fetch(base+'sheet='+encodeURIComponent(SHEET_PERSO_NAME)).then(function(r){ return r.text(); })
    ]).then(function(res){
      preparer(parseGviz(res[0]), parseGviz(res[1]));
    }).catch(function(e){
      showError('Erreur de chargement. Vérifiez que le Sheet est public en lecture.');
    });
  }

  // ── Préparation des données brutes ──────────────────────────
  function preparer(rawArts, rawPersos){
    var persoMap = buildPersoMap(rawPersos);
    var il30 = new Date(Date.now()-30*86400000).toISOString().slice(0,10);

    _allArts = rawArts.map(function(r){
      var ton=(r['Ton']||'').toLowerCase().trim();
      if(ton==='n\u00e9gatif') ton='negatif';
      var perso=(r['Personnalit\u00e9']||r['Personnalite']||r['Sujet (MR ou GLB)']||'').trim();
      var parti=(r['Parti']||'').trim();
      if(!parti&&perso) parti=persoMap[perso]||'';
      if(!parti&&perso==='GLB') parti='MR';
      if(!parti) parti='Autre';
      return {
        _d:     parseDate(r['Date']),
        langue: (r['Langue']||'').toUpperCase().trim(),
        media:  (r['M\u00e9dia']||r['Media']||'Inconnu').trim(),
        perso:  perso,
        parti:  parti,
        ton:    ton,
        titre:  (r['Titre']||'').trim(),
        lien:   (r['Lien'] ||'').trim()
      };
    }).filter(function(r){ return r._d && r._d >= il30; });

    if(!_allArts.length){
      showError('Aucune donnée. Lancez le script Apps Script et actualisez.');
      return;
    }

    // Appliquer le filtre langue et afficher
    applyLangFilter();
  }

  // ── Rendu complet (appelé après chaque changement de filtre) ─
  function renderAll(){
    var arts30  = _filteredArts;
    var auj     = new Date().toISOString().slice(0,10);
    var hier    = new Date(Date.now()-86400000).toISOString().slice(0,10);
    var il7j    = new Date(Date.now()-7*86400000).toISOString().slice(0,10);

    var arts7j  = arts30.filter(function(a){ return a._d>=il7j; });
    var artsAuj = arts30.filter(function(a){ return a._d===auj; });
    var artsHier= arts30.filter(function(a){ return a._d===hier; });

    // ── KPI 1-3 : Mentions MR ─────────────────────────────────
    var mr30  = arts30.filter(function(a){ return a.parti==='MR'; });
    var mr7j  = arts7j.filter(function(a){ return a.parti==='MR'; });
    var mrAuj = artsAuj.filter(function(a){ return a.parti==='MR'; });

    document.getElementById('med-k-today').textContent = mrAuj.length;
    document.getElementById('med-k-7j').textContent    = mr7j.length;
    document.getElementById('med-k-30j').textContent   = mr30.length;

    // ── KPI 4 : Part MR parmi TOUS les articles d'hier ────────
    var mrHier   = artsHier.filter(function(a){ return a.parti==='MR'; });
    var partMR   = artsHier.length ? Math.round(mrHier.length/artsHier.length*100) : null;
    var kPartEl  = document.getElementById('med-k-part');
    var kPartSub = document.getElementById('med-k-part-sub');
    if(kPartEl){
      kPartEl.textContent = partMR !== null ? partMR+'%' : '—';
      var c = partMR === null ? 'var(--muted)' : partMR >= 50 ? C_POS : partMR >= 30 ? C_NEU : C_NEG;
      kPartEl.style.color = c;
    }
    if(kPartSub) kPartSub.textContent = artsHier.length
      ? mrHier.length+'/'+artsHier.length+' articles hier'
      : 'Aucun article hier';

    // ── Top médias — MR uniquement ────────────────────────────
    renderTopMedias(arts30, 'MR');

    // ── Top personnalités ─────────────────────────────────────
    var persoAgg={};
    arts30.forEach(function(a){
      if(!a.perso||a.perso==='MR'||a.perso==='GLB') return;
      if(!persoAgg[a.perso]) persoAgg[a.perso]={total:0,pos:0,neg:0,parti:a.parti};
      persoAgg[a.perso].total++;
      if(a.ton==='positif') persoAgg[a.perso].pos++;
      if(a.ton==='negatif') persoAgg[a.perso].neg++;
    });
    var persoSorted=Object.keys(persoAgg)
      .map(function(k){ return Object.assign({nom:k},persoAgg[k]); })
      .sort(function(a,b){ return b.total-a.total; });

    var top10=persoSorted.slice(0,10);
    destroyChart('persoTop');
    if(top10.length){
      charts['persoTop']=new Chart(document.getElementById('med-ch-perso-top').getContext('2d'),{
        type:'bar',
        data:{
          labels:top10.map(function(p){ return p.nom; }),
          datasets:[{label:'Mentions',data:top10.map(function(p){ return p.total; }),
            backgroundColor:top10.map(function(p){ return gc(p.parti)+'CC'; }),
            borderColor:    top10.map(function(p){ return gc(p.parti); }),
            borderWidth:1,borderRadius:4}]
        },
        options:{responsive:true,maintainAspectRatio:false,indexAxis:'y',
          plugins:{legend:{display:false},tooltip:{callbacks:{label:function(ctx){
            var p=persoAgg[ctx.label];
            return ' '+ctx.parsed.x+' · '+(p?p.parti:'?')+
              ' · +'+(p&&p.total?Math.round(p.pos/p.total*100):0)+'%'+
              ' / −'+(p&&p.total?Math.round(p.neg/p.total*100):0)+'%';
          }}}},
          scales:{
            x:{beginAtZero:true,ticks:{color:C_DIM,font:{size:11}},grid:{color:'rgba(0,0,0,0.05)'}},
            y:{ticks:{color:'#4A5785',font:{size:12}},grid:{display:false}}
          }
        }
      });
    }

    // ── Tableau personnalités ─────────────────────────────────
    var tbody=document.getElementById('med-tbl-perso');
    if(tbody){
      tbody.innerHTML='';
      persoSorted.forEach(function(p){
        var pp=p.total?Math.round(p.pos/p.total*100):0;
        var pn=p.total?Math.round(p.neg/p.total*100):0;
        var c=gc(p.parti);
        tbody.innerHTML+='<tr>'+
          '<td style="font-weight:500;">'+p.nom+'</td>'+
          '<td><span style="display:inline-block;padding:2px 8px;border-radius:10px;font-size:11px;font-weight:600;background:'+c+'18;color:'+c+';border:1px solid '+c+'44;">'+p.parti+'</span></td>'+
          '<td style="font-weight:700;">'+p.total+'</td>'+
          '<td><span style="color:'+C_POS+';font-weight:600;">+'+pp+'%</span></td>'+
          '<td><span style="color:'+C_NEG+';font-weight:600;">−'+pn+'%</span></td>'+
          '</tr>';
      });
    }

    // ── Partis ────────────────────────────────────────────────
    var partiAgg={};
    arts30.forEach(function(a){
      var p=a.parti||'Autre';
      if(!partiAgg[p]) partiAgg[p]={total:0,pos:0,neg:0};
      partiAgg[p].total++;
      if(a.ton==='positif') partiAgg[p].pos++;
      if(a.ton==='negatif') partiAgg[p].neg++;
    });
    var partiSorted=Object.keys(partiAgg)
      .map(function(k){ return Object.assign({nom:k},partiAgg[k]); })
      .sort(function(a,b){ return b.total-a.total; });

    destroyChart('partiBar');
    if(partiSorted.length){
      charts['partiBar']=new Chart(document.getElementById('med-ch-parti-bar').getContext('2d'),{
        type:'bar',
        data:{labels:partiSorted.map(function(p){ return p.nom; }),
          datasets:[{label:'Mentions (30j)',
            data:partiSorted.map(function(p){ return p.total; }),
            backgroundColor:partiSorted.map(function(p){ return gc(p.nom)+'CC'; }),
            borderColor:partiSorted.map(function(p){ return gc(p.nom); }),
            borderWidth:1,borderRadius:4}]},
        options:{responsive:true,maintainAspectRatio:false,
          plugins:{legend:{display:false},tooltip:{callbacks:{label:function(ctx){
            var p=partiAgg[ctx.label];
            return ' '+ctx.parsed.y+' · +'+(p&&p.total?Math.round(p.pos/p.total*100):0)+'% / −'+(p&&p.total?Math.round(p.neg/p.total*100):0)+'%';
          }}}},
          scales:{x:{ticks:{color:'#4A5785',font:{size:12}},grid:{display:false}},
                  y:{beginAtZero:true,ticks:{color:C_DIM,font:{size:11}},grid:{color:'rgba(0,0,0,0.05)'}}}}
      });
    }

    destroyChart('partiTon');
    if(partiSorted.length){
      charts['partiTon']=new Chart(document.getElementById('med-ch-parti-ton').getContext('2d'),{
        type:'bar',
        data:{labels:partiSorted.map(function(p){ return p.nom; }),
          datasets:[
            {label:'Positif',data:partiSorted.map(function(p){ return p.total?Math.round(p.pos/p.total*100):0; }),backgroundColor:C_POS+'CC',borderColor:C_POS,borderWidth:1},
            {label:'Neutre', data:partiSorted.map(function(p){ return p.total?Math.round((p.total-p.pos-p.neg)/p.total*100):0; }),backgroundColor:C_NEU+'CC',borderColor:C_NEU,borderWidth:1},
            {label:'Négatif',data:partiSorted.map(function(p){ return p.total?Math.round(p.neg/p.total*100):0; }),backgroundColor:C_NEG+'CC',borderColor:C_NEG,borderWidth:1}
          ]},
        options:{responsive:true,maintainAspectRatio:false,
          plugins:{legend:{labels:{color:'#4A5785',font:{family:'DM Sans',size:11}}},
            tooltip:{callbacks:{label:function(ctx){ return ' '+ctx.dataset.label+' : '+ctx.parsed.y+'%'; }}}},
          scales:{x:{stacked:true,ticks:{color:'#4A5785',font:{size:12}},grid:{display:false}},
                  y:{stacked:true,beginAtZero:true,max:100,
                     ticks:{color:C_DIM,font:{size:11},callback:function(v){ return v+'%'; }},
                     grid:{color:'rgba(0,0,0,0.05)'}}}}
      });
    }

    // ── Évolution ─────────────────────────────────────────────
    var days30=[];
    for(var i=29;i>=0;i--) days30.push(new Date(Date.now()-i*86400000).toISOString().slice(0,10));
    var lEvo=days30.map(function(d){ return d.slice(8)+'/'+d.slice(5,7); });
    var byDayParti={},byDayTot={};
    arts30.forEach(function(a){
      byDayTot[a._d]=(byDayTot[a._d]||0)+1;
      if(!byDayParti[a._d]) byDayParti[a._d]={};
      byDayParti[a._d][a.parti]=(byDayParti[a._d][a.parti]||0)+1;
    });
    var top5=partiSorted.slice(0,5).map(function(p){ return p.nom; });
    var evoDsets=top5.map(function(parti){
      return {label:parti,data:days30.map(function(d){ return (byDayParti[d]||{})[parti]||0; }),
        borderColor:gc(parti),backgroundColor:gc(parti)+'33',borderWidth:2,pointRadius:2,fill:false,tension:0.3};
    });
    evoDsets.unshift({label:'Total',data:days30.map(function(d){ return byDayTot[d]||0; }),
      borderColor:'#060D2E',borderDash:[4,3],borderWidth:2,pointRadius:0,fill:false,tension:0.3});
    destroyChart('evo');
    charts['evo']=new Chart(document.getElementById('med-ch-evolution').getContext('2d'),{
      type:'line',data:{labels:lEvo,datasets:evoDsets},
      options:{responsive:true,maintainAspectRatio:false,
        plugins:{legend:{labels:{color:'#4A5785',font:{family:'DM Sans',size:11},boxWidth:14}}},
        scales:{x:{ticks:{color:C_DIM,font:{size:10},maxTicksLimit:10},grid:{display:false}},
                y:{beginAtZero:true,ticks:{color:C_DIM,font:{size:11}},grid:{color:'rgba(0,0,0,0.05)'}}}}
    });

    // Mise à jour du sélecteur de parti pour top médias
    updatePartiSelector(partiSorted);

    // Articles
    renderArticles('','');
    showContent();
  }

  // ── Top médias (recalculable par parti) ───────────────────────
  function renderTopMedias(arts30, filterParti){
    var artsFiltered = filterParti
      ? arts30.filter(function(a){ return a.parti===filterParti; })
      : arts30;

    var mAgg={};
    artsFiltered.forEach(function(a){
      if(!mAgg[a.media]) mAgg[a.media]={total:0,pos:0,neg:0};
      mAgg[a.media].total++;
      if(a.ton==='positif') mAgg[a.media].pos++;
      if(a.ton==='negatif') mAgg[a.media].neg++;
    });
    var mSorted=Object.keys(mAgg)
      .map(function(k){ return Object.assign({nom:k},mAgg[k]); })
      .sort(function(a,b){ return b.total-a.total; }).slice(0,8);

    var barsEl=document.getElementById('med-bars-medias');
    if(!barsEl) return;
    if(!mSorted.length){
      barsEl.innerHTML='<p style="color:var(--muted);font-size:12px;margin-top:8px;">Aucune donnée pour ce filtre.</p>';
      return;
    }
    barsEl.innerHTML='';
    var maxM=mSorted[0].total;
    mSorted.forEach(function(m){
      var pct=Math.round(m.total/maxM*100);
      var pp=m.total?Math.round(m.pos/m.total*100):0;
      var pn=m.total?Math.round(m.neg/m.total*100):0;
      barsEl.innerHTML+='<div class="bar-row">'+
        '<div class="bar-label" title="'+m.nom+'">'+m.nom+'</div>'+
        '<div class="bar-track"><div class="bar-fill" style="width:'+pct+'%;background:var(--accent);"></div></div>'+
        '<div style="font-size:11px;width:110px;flex-shrink:0;text-align:right;">'+
          '<span style="color:var(--muted)">'+m.total+'</span>&nbsp;'+
          '<span style="color:'+C_POS+'">+'+pp+'%</span>&nbsp;'+
          '<span style="color:'+C_NEG+'">−'+pn+'%</span>'+
        '</div></div>';
    });
  }

  // ── Sélecteur parti pour top médias ──────────────────────────
  function updatePartiSelector(partiSorted){
    var sel = document.getElementById('med-top-media-parti');
    if(!sel) return;
    var current = sel.value;
    // Reconstruire les options
    var opts = '<option value="MR">MR</option>';
    partiSorted.forEach(function(p){
      if(p.nom!=='MR' && p.nom!=='Autre'){
        opts += '<option value="'+p.nom+'">'+p.nom+'</option>';
      }
    });
    opts += '<option value="">Tous les partis</option>';
    sel.innerHTML = opts;
    // Restaurer la sélection précédente si possible
    if(current) sel.value = current;
    if(!sel.value) sel.value = 'MR';
  }

  // Appelée par le sélecteur de parti dans le HTML
  window.mediasTopMediaParti = function(parti){
    renderTopMedias(_filteredArts, parti);
  };

  // Appelée par le filtre langue
  window.mediasLangFilter = function(){
    applyLangFilter();
    // Resynchroniser la recherche articles
    var inp = document.getElementById('med-search');
    renderArticles(inp?inp.value:'','');
  };

  // ── Recherche d'articles ─────────────────────────────────────
  window.mediasSearch = function(query){
    var tonEl = document.getElementById('med-filter-ton');
    renderArticles(query||'', tonEl?tonEl.value:'');
  };

  function renderArticles(query, ton){
    var q=query.toLowerCase().trim();
    var filtered=_filteredArts.filter(function(a){
      var matchQ=!q||
        (a.perso||'').toLowerCase().indexOf(q)!==-1||
        (a.parti||'').toLowerCase().indexOf(q)!==-1||
        (a.media||'').toLowerCase().indexOf(q)!==-1||
        (a.titre||'').toLowerCase().indexOf(q)!==-1;
      var matchTon=!ton||a.ton===ton;
      return matchQ&&matchTon;
    });
    filtered=filtered.slice().sort(function(a,b){ return b._d.localeCompare(a._d); });

    var info=document.getElementById('med-search-info');
    if(info) info.textContent=filtered.length+' article'+(filtered.length>1?'s':'')+' sur 30 jours'+(q||ton?' · filtré':'');

    var list=document.getElementById('med-articles-list');
    if(!list) return;
    if(!_filteredArts.length){
      list.innerHTML='<p style="color:var(--muted);font-size:13px;padding:24px 0;text-align:center;">Données en cours de chargement…</p>';
      return;
    }
    if(!filtered.length){
      list.innerHTML='<p style="color:var(--muted);font-size:13px;padding:24px 0;text-align:center;">Aucun article trouvé.</p>';
      return;
    }
    function tb(t){
      var c=t==='positif'?C_POS:t==='negatif'?C_NEG:C_NEU;
      var l=t==='positif'?'Positif':t==='negatif'?'Négatif':'Neutre';
      return '<span style="font-size:10px;padding:1px 7px;border-radius:8px;font-weight:600;background:'+c+'18;color:'+c+';border:1px solid '+c+'33;">'+l+'</span>';
    }
    var html='',lastDate='';
    filtered.forEach(function(a){
      if(a._d!==lastDate){
        var p=a._d.split('-');
        html+='<div style="font-size:11px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.5px;padding:14px 0 6px;border-top:1px solid var(--border);margin-top:4px;">'+
          parseInt(p[2])+'/'+parseInt(p[1])+'/'+p[0]+'</div>';
        lastDate=a._d;
      }
      var pc=gc(a.parti);
      html+='<div style="display:flex;align-items:flex-start;gap:12px;padding:10px 0;border-bottom:1px solid rgba(0,0,0,0.06);">'+
        '<div style="flex-shrink:0;margin-top:3px;"><span style="display:inline-block;padding:2px 7px;border-radius:8px;font-size:10px;font-weight:700;background:'+pc+'15;color:'+pc+';border:1px solid '+pc+'33;">'+a.parti+'</span></div>'+
        '<div style="flex:1;min-width:0;">'+
          '<div style="font-size:13px;font-weight:500;color:var(--text);line-height:1.45;margin-bottom:5px;">'+
            '<a href="'+(a.lien||'#')+'" target="_blank" rel="noopener" style="color:inherit;text-decoration:none;" onmouseover="this.style.color=\'var(--accent)\'" onmouseout="this.style.color=\'inherit\'">'+(a.titre||'(sans titre)')+'</a>'+
          '</div>'+
          '<div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;">'+
            '<span style="font-size:11px;color:var(--muted);">'+a.media+'</span>'+
            '<span style="color:var(--border);">·</span>'+
            '<span style="font-size:11px;color:var(--muted);">'+a.perso+'</span>'+
            '<span style="color:var(--border);">·</span>'+
            '<span style="font-size:11px;background:rgba(0,0,0,0.05);padding:1px 5px;border-radius:4px;color:var(--muted);">'+a.langue+'</span>'+
            '<span style="color:var(--border);">·</span>'+
            tb(a.ton)+
            '<span style="color:var(--border);">·</span>'+
            '<a href="'+(a.lien||'#')+'" target="_blank" rel="noopener" style="font-size:11px;color:var(--accent);text-decoration:none;font-weight:500;">Lire →</a>'+
          '</div>'+
        '</div></div>';
    });
    list.innerHTML=html;
  }

})();
