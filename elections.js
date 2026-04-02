// ══════════════════════════════════════════════════════════════
//  elections.js  v2.0
//  Nouvelles fonctionnalités :
//  - Onglet Évolution (comparaison 2014/2019/2024)
//  - Carte : mode parti avec dégradé de couleur
//  - Carte : tooltip avec % du parti
// ══════════════════════════════════════════════════════════════
(function(){

var S = {
  electionId   : '2024-06',
  levelKey     : 'germano',
  view         : 'pct',
  data         : null,
  loading      : false,
  geoJson      : null,
  leafletMap   : null,
  chartPct     : null,
  seatsCircoKey: '_national',
  mapLevel     : 'province',
  // Carte : mode
  mapMode      : 'winner',   // 'winner' ou 'parti'
  mapParti     : null,       // parti sélectionné en mode 'parti'
  // Évolution
  evoLevelKey  : null,
  evoCircoKey  : '_national',
  evoMetric    : 'pct',      // 'pct', 'votes', 'seats'
  evoData      : {},         // cache par levelKey
};

// Années disponibles pour l'évolution (qui ont des JSON)
var EVO_YEARS = ['2014', '2019', '2024'];
// Map electionId → année courte
function elecYear(id){ return id ? id.split('-')[0] : ''; }

// ── Point d'entrée ────────────────────────────────────────────
window.elLoad = function(){
  buildSelectors();
  loadData();
};

// ── Sélecteurs ────────────────────────────────────────────────
function buildSelectors(){
  var dw = document.getElementById('el-date-wrap');
  if(dw){
    dw.innerHTML = '';
    (window.EL_CATALOG||[]).forEach(function(e){
      var b = document.createElement('button');
      b.className = 'el-pill'+(e.id===S.electionId?' active':'');
      b.textContent = e.label;
      b.onclick = function(){ S.electionId=e.id; S.levelKey=e.levels[0].key; S.data=null; buildSelectors(); loadData(); };
      dw.appendChild(b);
    });
  }

  var lw = document.getElementById('el-level-wrap');
  if(lw){
    lw.innerHTML = '';
    var cat = getCat();
    if(!cat) return;
    cat.levels.forEach(function(lv){
      var b = document.createElement('button');
      b.className = 'el-pill el-pill-sm'+(lv.key===S.levelKey?' active':'');
      b.innerHTML = lv.icon+' '+lv.label;
      b.onclick = function(){ S.levelKey=lv.key; S.data=null; S.seatsCircoKey='_national'; S.evoData={}; buildSelectors(); loadData(); };
      lw.appendChild(b);
    });
  }

  var vw = document.getElementById('el-view-tabs');
  if(vw){
    var views = [{k:'pct',l:'% des voix'},{k:'seats',l:'Assemblée / sièges'},{k:'map',l:'🗺 Carte'},{k:'evo',l:'📈 Évolution'}];
    vw.innerHTML = '';
    views.forEach(function(v){
      var b = document.createElement('button');
      b.className = (v.k===S.view)?'active':'';
      b.textContent = v.l;
      b.onclick = function(){ S.view=v.k; buildSelectors(); renderCurrentView(); };
      vw.appendChild(b);
    });
  }
}

// ── Chargement données ────────────────────────────────────────
function getCat(){ return (window.EL_CATALOG||[]).find(function(e){ return e.id===S.electionId; }); }
function getLvl(){ var c=getCat(); return c?c.levels.find(function(l){ return l.key===S.levelKey; }):null; }

function loadData(){
  var lv = getLvl();
  if(!lv){ showError('Niveau introuvable.'); return; }
  setLoading(true); setStatus('loading','Chargement…');

  var jsonFile = lv.jsonFile || (lv.xmlFile||'').replace('.xml','.json');
  var xmlFile  = lv.xmlFile  || jsonFile.replace('.json','.xml');

  fetch('./'+jsonFile)
    .then(function(r){ if(!r.ok) throw new Error('404'); return r.json(); })
    .then(function(d){ S.data=normalizeJson(d); setLoading(false); setStatus('ok','Données chargées'); renderCurrentView(); })
    .catch(function(){
      var url = (window.EL_PROXY||'https://corsproxy.io/?') + encodeURIComponent('https://resultatselection.belgium.be/xml/'+xmlFile);
      fetch(url)
        .then(function(r){ if(!r.ok) throw new Error('HTTP '+r.status); return r.text(); })
        .then(function(txt){
          if(txt.indexOf('"error"')===0||txt.indexOf('Response exceeds')!==-1) throw new Error('PROXY_SIZE');
          S.data = parseXML(new DOMParser().parseFromString(txt,'text/xml'));
          setLoading(false); setStatus('ok','Données chargées'); renderCurrentView();
        })
        .catch(function(err){
          setLoading(false);
          if(err.message==='PROXY_SIZE') showSizeError(lv);
          else { setStatus('error','Erreur'); showError('Impossible de charger les données.<br><small>'+err.message+'</small>'); }
        });
    });
}

// Charger les données pour une année spécifique (évolution)
function loadDataForYear(year, levelKey, cb){
  var cat = (window.EL_CATALOG||[]).find(function(e){ return elecYear(e.id)===year; });
  if(!cat){ cb(null); return; }
  var lv = cat.levels.find(function(l){ return l.key===levelKey; });
  if(!lv){
    // Essayer le premier niveau disponible
    lv = cat.levels[0];
  }
  if(!lv){ cb(null); return; }

  var jsonFile = lv.jsonFile || (lv.xmlFile||'').replace('.xml','.json');
  var xmlFile  = lv.xmlFile  || jsonFile.replace('.json','.xml');

  fetch('./'+jsonFile)
    .then(function(r){ if(!r.ok) throw new Error('404'); return r.json(); })
    .then(function(d){ cb(normalizeJson(d)); })
    .catch(function(){
      var url = (window.EL_PROXY||'https://corsproxy.io/?') + encodeURIComponent('https://resultatselection.belgium.be/xml/'+xmlFile);
      fetch(url)
        .then(function(r){ if(!r.ok) throw new Error('ERR'); return r.text(); })
        .then(function(txt){
          if(txt.indexOf('Response exceeds')!==-1) throw new Error('TOO_BIG');
          cb(parseXML(new DOMParser().parseFromString(txt,'text/xml')));
        })
        .catch(function(){ cb(null); });
    });
}

// ── Parseurs ─────────────────────────────────────────────────
function normalizeJson(data){
  var circos=(data.circos||[]).map(function(c){
    var lists=(c.lists||[]).map(function(li){
      return {party:li.p, label:window.elPartyLabel(li.p), color:window.elPartyColor(li.p),
              votes:li.v, pct:li.pct, seats:(li.s!=null?li.s:null)};
    });
    return {description:c.desc, label:c.lbl, validVotes:c.vv, blankVotes:c.bv,
            registered:c.reg, participation:c.part, lists:lists};
  });
  return {type:data.type||'', date:data.date||'', circos:circos};
}

function parseXML(xml){
  var root=xml.documentElement;
  var circos=Array.from(root.children).filter(function(c){return c.tagName==='level';}).map(parseLevel);
  var ord={Region:0,Country:1,Constituency:2,Province:3,Arrondissement:4,Canton:5,Municipality:6};
  circos.sort(function(a,b){return (ord[a.description]||9)-(ord[b.description]||9);});
  return {type:root.getAttribute('type')||'', date:root.getAttribute('date')||'', circos:circos};
}

function parseLevel(lv){
  var desc=lv.getAttribute('description')||'';
  var vv=parseInt(lv.getAttribute('valid-votes')||'0');
  var bv=parseInt(lv.getAttribute('blank-votes')||'0');
  var reg=parseInt(lv.getAttribute('registered-voters-bb')||'0');
  var lel=lv.querySelector('labels > label[language="fr"]')||lv.querySelector('labels > label[language="nl"]')||lv.querySelector('labels > label');
  var label=lel?lel.textContent.trim():desc;
  var lists=Array.from(lv.querySelectorAll(':scope > lists > list')).map(function(li){
    var votes=parseInt(li.getAttribute('votes')||'0');
    var sa=li.getAttribute('seats');
    var seats=(sa!=null&&sa!=='')?parseInt(sa):null;
    var party=li.getAttribute('party')||li.getAttribute('abbreviation')||'?';
    var pct=vv>0?Math.round(votes/vv*1000)/10:0;
    return {party:party, label:window.elPartyLabel(party), color:window.elPartyColor(party),
            votes:votes, seats:seats, pct:pct};
  });
  lists.sort(function(a,b){return b.votes-a.votes;});
  return {description:desc, label:label, validVotes:vv, blankVotes:bv, registered:reg,
          participation:reg>0?Math.round((vv+bv)/reg*1000)/10:null, lists:lists};
}

// ── Routeur de vue ───────────────────────────────────────────
function renderCurrentView(){
  if(!S.data) return;
  ['el-sec-pct','el-sec-seats','el-sec-map','el-sec-evo'].forEach(function(id){
    var el=document.getElementById(id); if(el) el.style.display='none';
  });
  var sec=document.getElementById('el-sec-'+S.view);
  if(sec) sec.style.display='block';
  if(S.view==='pct')   renderPct();
  if(S.view==='seats') renderSeats();
  if(S.view==='map')   renderMap();
  if(S.view==='evo')   renderEvo();
}

// ══════════════════════════════════════════════════════════════
//  VUE 1 : % DES VOIX
// ══════════════════════════════════════════════════════════════
function renderPct(){
  var wrap=document.getElementById('el-pct-wrap');
  if(!wrap) return;
  wrap.innerHTML='';
  var national=getNational();
  if(!national){ wrap.innerHTML='<p class="el-empty">Aucune donnée nationale.</p>'; return; }

  var lv=getLvl();
  wrap.insertAdjacentHTML('beforeend',
    '<div class="kpi-grid" style="margin-bottom:16px">'
    +kpi('Votes valables',national.validVotes.toLocaleString('fr-BE'),'suffrages')
    +kpi('Participation',national.participation?national.participation+'%':'—','des électeurs inscrits')
    +kpi('Partis en lice',national.lists.length,'listes')
    +(lv&&lv.totalSeats?kpi('Sièges à pourvoir',lv.totalSeats,'mandats'):'')
    +'</div>'
  );

  var subs=S.data.circos.filter(function(c){
    return c.description!=='Constituency'&&c.description!=='Country'&&c.description!=='Region';
  });
  if(subs.length>0){ buildCircoSearch(wrap, subs, 'pct'); }

  var h=Math.max(260,Math.min(national.lists.length*38,640));
  wrap.insertAdjacentHTML('beforeend',
    '<div class="card" style="margin-bottom:16px">'
    +'<div class="card-title" id="el-pct-title">Résultats — '+national.label+'</div>'
    +'<div class="card-subtitle">% des suffrages valables exprimés</div>'
    +'<div class="chart-wrap" style="height:'+h+'px"><canvas id="el-chart-pct"></canvas></div>'
    +'</div>'
    +'<div class="card" id="el-pct-table-card">'
    +'<div class="card-title">Tableau détaillé</div>'
    +buildPctTable(national)
    +'</div>'
  );
  drawPctChart(national);
  window._elNational = national;
  window._elAllCircos = S.data.circos;
}

function buildPctTable(circ){
  var hasSeat=circ.lists.some(function(l){return l.seats!=null;});
  var h='<div class="table-wrap"><table><thead><tr><th>Parti</th><th style="text-align:right">Votes</th><th style="text-align:right">%</th>'
    +(hasSeat?'<th style="text-align:right">Sièges</th>':'')+'</tr></thead><tbody>';
  circ.lists.forEach(function(li){
    h+='<tr><td><span class="dot-party" style="background:'+li.color+'"></span><strong>'+li.label+'</strong></td>'
      +'<td style="text-align:right">'+li.votes.toLocaleString('fr-BE')+'</td>'
      +'<td style="text-align:right"><strong>'+li.pct+' %</strong></td>'
      +(hasSeat?'<td style="text-align:right">'+(li.seats!=null?li.seats:'—')+'</td>':'')
      +'</tr>';
  });
  return h+'</tbody></table></div>';
}

function drawPctChart(circ){
  var ctx=document.getElementById('el-chart-pct'); if(!ctx) return;
  if(S.chartPct){S.chartPct.destroy();S.chartPct=null;}
  var lists=circ.lists.slice(0,20);
  S.chartPct=new Chart(ctx,{
    type:'bar',
    data:{labels:lists.map(function(l){return l.label;}),
      datasets:[{label:'% des voix',data:lists.map(function(l){return l.pct;}),
        backgroundColor:lists.map(function(l){return l.color+'CC';}),
        borderColor:lists.map(function(l){return l.color;}),borderWidth:1,borderRadius:4}]},
    options:{indexAxis:'y',responsive:true,maintainAspectRatio:false,
      plugins:{legend:{display:false},tooltip:{callbacks:{label:function(c){
        var li=lists[c.dataIndex]; return ' '+li.pct+'% ('+li.votes.toLocaleString('fr-BE')+' voix)';
      }}}},
      scales:{
        x:{ticks:{callback:function(v){return v+'%';},color:'#4A5785',font:{size:11}},grid:{color:'rgba(0,46,255,0.06)'}},
        y:{ticks:{color:'#060D2E',font:{size:12,weight:'500'}},grid:{display:false}}
      }}
  });
}

function elSelectCircoPct(label){
  var circ = label==='_national' ? window._elNational
    : (window._elAllCircos||[]).find(function(c){return c.label===label;});
  if(!circ) return;
  var dd=document.getElementById('el-circ-dropdown'); if(dd) dd.style.display='none';
  var t=document.getElementById('el-pct-title'); if(t) t.textContent='Résultats — '+circ.label;
  var tc=document.querySelector('#el-pct-table-card .table-wrap');
  if(tc){ var tmp=document.createElement('div'); tmp.innerHTML=buildPctTable(circ); tc.replaceWith(tmp.firstElementChild); }
  var cv=document.getElementById('el-chart-pct');
  if(cv){ cv.parentElement.style.height=Math.max(260,Math.min(circ.lists.length*38,640))+'px'; }
  drawPctChart(circ);
}
window.elSelectCircoPct = elSelectCircoPct;

// ══════════════════════════════════════════════════════════════
//  VUE 2 : SIÈGES
// ══════════════════════════════════════════════════════════════
function renderSeats(){
  var wrap=document.getElementById('el-seats-wrap');
  if(!wrap) return;
  wrap.innerHTML='';

  var circosWithSeats=S.data.circos.filter(function(c){
    return c.lists.some(function(l){return l.seats!=null&&l.seats>0;});
  });

  if(circosWithSeats.length===0){
    wrap.innerHTML='<div class="card" style="text-align:center;padding:32px">'
      +'<div style="font-size:32px;margin-bottom:10px">🗳️</div>'
      +'<div style="font-weight:700;font-size:15px;margin-bottom:6px">Sièges non disponibles</div>'
      +'<div style="color:var(--muted);font-size:13px">Données de répartition des sièges non incluses dans ce fichier.</div></div>';
    return;
  }

  var currentCirco=circosWithSeats.find(function(c){return c.label===S.seatsCircoKey;})||circosWithSeats[0];
  if(circosWithSeats.length>1){ buildCircoSearch(wrap, circosWithSeats, 'seats'); }
  renderSeatsForCirco(currentCirco, wrap);
}

function renderSeatsForCirco(circ, wrap){
  wrap.querySelectorAll('.el-seats-content').forEach(function(el){el.remove();});
  var withSeats=circ.lists.filter(function(l){return l.seats!=null&&l.seats>0;});
  var total=withSeats.reduce(function(s,l){return s+l.seats;},0);
  var lv=getLvl();
  var isNat=(circ.description==='Constituency'||circ.description==='Country'||circ.description==='Region');
  var officialTotal=(isNat&&lv&&lv.totalSeats)?lv.totalSeats:total;

  var div=document.createElement('div');
  div.className='el-seats-content';
  div.innerHTML=
    '<div class="kpi-grid" style="margin-bottom:16px">'
    +kpi('Sièges attribués',total,'sur '+officialTotal+' mandats')
    +kpi('Partis représentés',withSeats.length,'dans l\'assemblée')
    +kpi(withSeats[0].label,withSeats[0].seats+' sièges',withSeats[0].pct+'% des voix')
    +'</div>'
    +'<div class="card" style="margin-bottom:16px">'
    +'<div class="card-title">Composition — '+circ.label+'</div>'
    +'<div class="card-subtitle">'+total+' sièges attribués</div>'
    +'<div id="el-hemicycle" style="text-align:center;padding:8px 0"></div>'
    +'</div>';

  var bars='<div class="card"><div class="card-title">Répartition des sièges</div><div style="margin-top:12px">';
  withSeats.forEach(function(li){
    var pcts=Math.round(li.seats/total*1000)/10;
    bars+='<div class="bar-row">'
      +'<span class="bar-label" title="'+li.label+'">'+li.label+'</span>'
      +'<div class="bar-track"><div class="bar-fill" style="width:'+pcts+'%;background:'+li.color+'"></div></div>'
      +'<span class="bar-val"><strong>'+li.seats+'</strong> <span style="color:var(--muted);font-size:11px">('+pcts+'%)</span></span>'
      +'</div>';
  });
  bars+='</div></div>';
  div.insertAdjacentHTML('beforeend',bars);
  wrap.appendChild(div);
  drawHemicycle(withSeats,total);
}

function elSelectSeatsCirco(label){
  S.seatsCircoKey=label;
  var circ=(S.data.circos||[]).find(function(c){return c.label===label;});
  var inp=document.getElementById('el-seats-search'); if(inp&&circ) inp.value=circ.label;
  var dd=document.getElementById('el-seats-dropdown'); if(dd) dd.style.display='none';
  if(circ) renderSeatsForCirco(circ, document.getElementById('el-seats-wrap'));
}
window.elSelectSeatsCirco = elSelectSeatsCirco;

function drawHemicycle(lists,total){
  var wrap=document.getElementById('el-hemicycle'); if(!wrap) return;
  var W=500,H=270,cx=250,cy=255,ro=230,ri=120, angle=Math.PI;
  var svg='<svg viewBox="0 0 '+W+' '+H+'" xmlns="http://www.w3.org/2000/svg" style="max-width:500px;width:100%">';
  lists.forEach(function(li){
    var frac=li.seats/total, sw=frac*Math.PI;
    var x1=cx+ro*Math.cos(angle),y1=cy+ro*Math.sin(angle);
    var x2=cx+ro*Math.cos(angle+sw),y2=cy+ro*Math.sin(angle+sw);
    var x3=cx+ri*Math.cos(angle+sw),y3=cy+ri*Math.sin(angle+sw);
    var x4=cx+ri*Math.cos(angle),y4=cy+ri*Math.sin(angle);
    var lg=sw>Math.PI?1:0;
    svg+='<path d="M'+x1+' '+y1+' A'+ro+' '+ro+' 0 '+lg+' 1 '+x2+' '+y2
        +' L'+x3+' '+y3+' A'+ri+' '+ri+' 0 '+lg+' 0 '+x4+' '+y4+' Z"'
        +' fill="'+li.color+'" stroke="#fff" stroke-width="1.5">'
        +'<title>'+li.label+' — '+li.seats+' siège(s)</title></path>';
    if(frac>0.06){
      var ma=angle+sw/2, rm=(ro+ri)/2;
      svg+='<text x="'+(cx+rm*Math.cos(ma))+'" y="'+(cy+rm*Math.sin(ma))+'"'
          +' text-anchor="middle" dominant-baseline="middle" font-size="11" font-weight="700" fill="#fff">'+li.seats+'</text>';
    }
    angle+=sw;
  });
  svg+='<text x="'+cx+'" y="'+(cy-20)+'" text-anchor="middle" font-size="26" font-weight="800" fill="var(--text)">'+total+'</text>';
  svg+='<text x="'+cx+'" y="'+(cy+6)+'" text-anchor="middle" font-size="11" fill="var(--muted)">sièges</text></svg>';
  wrap.innerHTML=svg;
}

// ══════════════════════════════════════════════════════════════
//  VUE 3 : CARTE (avec mode parti + dégradé + tooltip %)
// ══════════════════════════════════════════════════════════════
function renderMap(){
  var sec=document.getElementById('el-sec-map'); if(!sec) return;

  // Barre de contrôles carte
  var bar=document.getElementById('el-map-ctrl-bar');
  if(!bar){ bar=document.createElement('div'); bar.id='el-map-ctrl-bar'; sec.insertBefore(bar,sec.firstChild); }
  buildMapControls(bar);

  if(!document.getElementById('el-leaflet-map')){
    var mw=document.createElement('div');
    mw.innerHTML='<div id="el-leaflet-map" style="height:520px;border-radius:12px;overflow:hidden;border:1px solid var(--border)"></div>'
      +'<div id="el-map-legend" style="margin-top:12px"></div>';
    sec.appendChild(mw);
  }
  initLeaflet();
}

function buildMapControls(bar){
  bar.innerHTML='';
  var row=document.createElement('div');
  row.style.cssText='display:flex;align-items:center;gap:12px;flex-wrap:wrap;padding-bottom:12px;';

  // Mode : Parti gagnant / Parti
  var modeWrap=document.createElement('div');
  modeWrap.style.cssText='display:flex;align-items:center;gap:6px;';
  var modeLbl=document.createElement('span');
  modeLbl.style.cssText='font-size:12px;color:var(--muted)';
  modeLbl.textContent='Mode :';

  var btnWinner=document.createElement('button');
  btnWinner.className='el-pill-xs'+(S.mapMode==='winner'?' active':'');
  btnWinner.textContent='🏆 Parti gagnant';
  btnWinner.onclick=function(){ S.mapMode='winner'; S.mapParti=null; buildMapControls(bar); refreshMap(); };

  var btnParti=document.createElement('button');
  btnParti.className='el-pill-xs'+(S.mapMode==='parti'?' active':'');
  btnParti.textContent='🎨 Score d\'un parti';
  btnParti.onclick=function(){ S.mapMode='parti'; buildMapControls(bar); refreshMap(); };

  modeWrap.appendChild(modeLbl); modeWrap.appendChild(btnWinner); modeWrap.appendChild(btnParti);
  row.appendChild(modeWrap);

  // Sélecteur de parti (visible seulement en mode 'parti')
  if(S.mapMode==='parti'){
    var partiWrap=document.createElement('div');
    partiWrap.style.cssText='display:flex;align-items:center;gap:6px;flex-wrap:wrap;';
    var partiLbl=document.createElement('span');
    partiLbl.style.cssText='font-size:12px;color:var(--muted)';
    partiLbl.textContent='Parti :';
    partiWrap.appendChild(partiLbl);

    // Récupérer la liste des partis présents dans les données actuelles
    var partisPresents=getPartisPresents();
    partisPresents.forEach(function(p){
      var bp=document.createElement('button');
      var isActive=S.mapParti===p.party;
      bp.className='el-pill-xs'+(isActive?' active':'');
      bp.style.cssText=isActive?'border-color:'+p.color+';background:'+p.color+'22;color:'+p.color+';':'';
      bp.innerHTML='<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:'+p.color+';margin-right:5px;vertical-align:middle"></span>'+p.label;
      bp.onclick=(function(parti){ return function(){
        S.mapParti=parti.party;
        buildMapControls(bar);
        refreshMap();
      }; })(p);
      partiWrap.appendChild(bp);
    });
    row.appendChild(partiWrap);
  }

  bar.appendChild(row);
}

function getPartisPresents(){
  if(!S.data) return [];
  var national=getNational();
  if(!national) return [];
  return national.lists.slice(0,12).map(function(l){ return {party:l.party,label:l.label,color:l.color}; });
}

function refreshMap(){
  if(S.geoJson && S.leafletMap) applyGeo(S.geoJson);
  else initLeaflet();
}

function initLeaflet(){
  if(window.L){ initLeafletReady(); return; }
  var css=document.createElement('link'); css.rel='stylesheet'; css.href='https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'; document.head.appendChild(css);
  var js=document.createElement('script'); js.src='https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
  js.onload=function(){ initLeafletReady(); };
  document.head.appendChild(js);
}

function initLeafletReady(){
  var el=document.getElementById('el-leaflet-map'); if(!el) return;
  if(S.leafletMap){ try{S.leafletMap.remove();}catch(e){} S.leafletMap=null; }
  S.leafletMap=window.L.map('el-leaflet-map',{center:[50.5,4.4],zoom:8});
  window.L.tileLayer('https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}{r}.png',{
    attribution:'© OpenStreetMap © CARTO',maxZoom:14
  }).addTo(S.leafletMap);
  loadGeoJson(function(geo){ applyGeo(geo); });
}

function loadGeoJson(cb){
  if(S.geoJson){ cb(S.geoJson); return; }
  setStatus('loading','Chargement carte…');
  var paths=['./communesgemeente-belgium.geojson','/dashboard/communesgemeente-belgium.geojson'];
  function tryPath(i){
    if(i>=paths.length){
      fetch((window.EL_PROXY||'https://corsproxy.io/?')+encodeURIComponent('https://www.odwb.be/api/explore/v2.1/catalog/datasets/communesgemeente-belgium/exports/geojson?limit=-1'))
        .then(function(r){return r.json();}).then(function(d){S.geoJson=d;setStatus('ok','Carte chargée');cb(d);})
        .catch(function(){setStatus('error','Carte indisponible');});
      return;
    }
    fetch(paths[i]).then(function(r){if(!r.ok)throw 0;return r.json();})
      .then(function(d){S.geoJson=d;setStatus('ok','Carte chargée');cb(d);})
      .catch(function(){tryPath(i+1);});
  }
  tryPath(0);
}

function applyGeo(geo){
  if(!S.leafletMap||!S.data) return;
  S.leafletMap.eachLayer(function(l){if(l._elLayer) S.leafletMap.removeLayer(l);});

  var isPartiMode = S.mapMode==='parti' && S.mapParti;
  var dataIndex = isPartiMode ? buildPartiIndex(S.mapParti) : buildWinners();

  var layer=window.L.geoJSON(geo,{
    style:function(f){
      var name=getFeatureName(f);
      var d=dataIndex[norm(name)];
      if(!d) return {fillColor:'#E8E8E8',fillOpacity:0.5,color:'#ccc',weight:0.6};
      if(isPartiMode){
        return {fillColor:d.color, fillOpacity:d.opacity, color:'#fff', weight:0.6};
      }
      return {fillColor:d.color, fillOpacity:0.75, color:'#fff', weight:0.8};
    },
    onEachFeature:function(f,l){
      var name=getFeatureName(f);
      var d=dataIndex[norm(name)];
      var tip='<strong>'+name+'</strong>';
      if(d){
        if(isPartiMode){
          // Mode parti : afficher le % du parti sélectionné
          var partiLabel=window.elPartyLabel(S.mapParti);
          tip+='<br><span style="color:'+d.baseColor+'">■</span> <strong>'+partiLabel+'</strong> : '+d.pct+'%';
          tip+='<br><span style="color:var(--muted);font-size:11px">'+d.votes.toLocaleString('fr-BE')+' voix</span>';
        } else {
          // Mode gagnant : afficher le parti gagnant + son %
          tip+='<br><span style="color:'+d.color+'">■</span> <strong>'+d.party+'</strong> : '+d.pct+'%';
          if(d.seats) tip+=' · '+d.seats+' sièges';
        }
      } else {
        tip+='<br><em style="color:#999">Donnée non disponible</em>';
      }
      l.bindTooltip(tip,{sticky:true,className:'el-map-tooltip'});
    }
  });
  layer._elLayer=true; layer.addTo(S.leafletMap);

  if(isPartiMode) renderPartiLegend(S.mapParti);
  else renderMapLegend(dataIndex);
}

// Index mode gagnant
function buildWinners(){
  var idx={};
  (S.data.circos||[]).forEach(function(c){
    if(!c.lists.length) return;
    var w=c.lists[0];
    var entry={party:w.label,color:w.color,pct:w.pct,seats:w.seats};
    var n=norm(c.label);
    idx[n]=entry;
    idx[n.replace(/saint/g,'st')]=entry;
    idx[n.replace(/^st/,'saint')]=entry;
  });
  return idx;
}

// Index mode parti : dégradé de couleur selon le score
function buildPartiIndex(partyKey){
  var idx={};
  var baseColor = window.elPartyColor(partyKey);
  // Trouver le score max parmi toutes les circos pour calibrer l'échelle
  var maxPct=0;
  (S.data.circos||[]).forEach(function(c){
    var li=c.lists.find(function(l){return l.party===partyKey;});
    if(li&&li.pct>maxPct) maxPct=li.pct;
  });
  if(maxPct===0) maxPct=1;

  (S.data.circos||[]).forEach(function(c){
    var li=c.lists.find(function(l){return l.party===partyKey;});
    if(!li) return;
    // Opacité proportionnelle au score (min 0.12, max 0.92)
    var ratio=li.pct/maxPct;
    var opacity=0.12+ratio*0.80;
    var entry={baseColor:baseColor, color:baseColor, opacity:opacity, pct:li.pct, votes:li.votes};
    var n=norm(c.label);
    idx[n]=entry;
    idx[n.replace(/saint/g,'st')]=entry;
    idx[n.replace(/^st/,'saint')]=entry;
  });
  return idx;
}

function renderPartiLegend(partyKey){
  var el=document.getElementById('el-map-legend'); if(!el) return;
  var color=window.elPartyColor(partyKey);
  var label=window.elPartyLabel(partyKey);
  el.innerHTML='<div class="card"><div class="card-title">Score de '+label+' par zone</div>'
    +'<div style="display:flex;align-items:center;gap:8px;margin-top:10px;">'
    +'<span style="font-size:12px;color:var(--muted)">Score faible</span>'
    +'<div style="flex:1;height:14px;border-radius:7px;background:linear-gradient(to right,'+color+'20,'+color+'EE)"></div>'
    +'<span style="font-size:12px;color:var(--muted)">Score élevé</span>'
    +'</div></div>';
}

function renderMapLegend(winners){
  var el=document.getElementById('el-map-legend'); if(!el) return;
  var cnt={};
  Object.values(winners).forEach(function(w){ if(!cnt[w.party]) cnt[w.party]={color:w.color,n:0}; cnt[w.party].n++; });
  var sorted=Object.entries(cnt).sort(function(a,b){return b[1].n-a[1].n;});
  var h='<div class="card"><div class="card-title">Parti en tête par zone</div><div style="display:flex;flex-wrap:wrap;gap:10px;margin-top:8px">';
  sorted.forEach(function(e){
    h+='<span style="font-size:12px;display:flex;align-items:center;gap:5px">'
      +'<span style="display:inline-block;width:13px;height:13px;border-radius:3px;background:'+e[1].color+'"></span>'
      +e[0]+' <span style="color:var(--muted)">('+e[1].n+')</span></span>';
  });
  el.innerHTML=h+'</div></div>';
}

window.elSetMapLevel=function(level,btn){
  S.mapLevel=level;
  document.querySelectorAll('#el-map-level-bar .el-pill-xs').forEach(function(b){b.classList.remove('active');});
  if(btn&&btn.classList) btn.classList.add('active');
  if(S.geoJson&&S.leafletMap) applyGeo(S.geoJson);
};

// ══════════════════════════════════════════════════════════════
//  VUE 4 : ÉVOLUTION TEMPORELLE
// ══════════════════════════════════════════════════════════════
function renderEvo(){
  var sec=document.getElementById('el-sec-evo'); if(!sec) return;
  sec.innerHTML='';

  // Récupérer la liste des partis disponibles pour le niveau actuel
  var national=getNational();
  var partis=national?national.lists.slice(0,15):[];

  // Contrôles
  var ctrl=document.createElement('div');
  ctrl.style.cssText='padding:0 0 16px 0;';

  // Métrique
  ctrl.insertAdjacentHTML('beforeend','<div style="margin-bottom:12px"><div class="el-circ-lbl" style="margin-bottom:6px">Afficher</div><div id="evo-metric-row"></div></div>');

  // Circonscription
  ctrl.insertAdjacentHTML('beforeend','<div style="margin-bottom:12px"><div class="el-circ-lbl" style="margin-bottom:6px">Circonscription</div><div id="evo-circ-row"></div></div>');

  // Partis à afficher
  ctrl.insertAdjacentHTML('beforeend','<div style="margin-bottom:16px"><div class="el-circ-lbl" style="margin-bottom:6px">Partis à comparer</div><div id="evo-partis-row"></div></div>');

  sec.appendChild(ctrl);

  // Zone graphique
  sec.insertAdjacentHTML('beforeend',
    '<div class="card" id="evo-chart-card" style="margin-bottom:16px">'
    +'<div class="card-title" id="evo-chart-title">Évolution</div>'
    +'<div class="card-subtitle" id="evo-chart-sub"></div>'
    +'<div id="evo-loading" style="display:none;padding:40px;text-align:center;color:var(--muted)">Chargement des données…</div>'
    +'<div class="chart-wrap" id="evo-chart-wrap" style="height:360px;display:none"><canvas id="el-chart-evo"></canvas></div>'
    +'</div>'
    +'<div id="evo-table-wrap"></div>'
  );

  // Initialiser les contrôles
  buildEvoMetricRow();
  buildEvoCircoRow();
  buildEvoPartisRow(partis);

  // Charger et afficher
  loadEvoData();
}

function buildEvoMetricRow(){
  var row=document.getElementById('evo-metric-row'); if(!row) return;
  row.innerHTML='';
  var metrics=[{k:'pct',l:'% des voix'},{k:'votes',l:'Nombre de voix'},{k:'seats',l:'Sièges'}];
  metrics.forEach(function(m){
    var b=document.createElement('button');
    b.className='el-pill-sm'+(S.evoMetric===m.k?' active':'');
    b.textContent=m.l;
    b.onclick=function(){ S.evoMetric=m.k; buildEvoMetricRow(); drawEvoChart(); };
    row.appendChild(b);
    row.insertAdjacentHTML('beforeend',' ');
  });
}

function buildEvoCircoRow(){
  var row=document.getElementById('evo-circ-row'); if(!row) return;
  row.innerHTML='';

  // Bouton national
  var bn=document.createElement('button');
  bn.className='el-pill-xs'+(S.evoCircoKey==='_national'?' active':'');
  bn.textContent='🇧🇪 National';
  bn.onclick=function(){ S.evoCircoKey='_national'; buildEvoCircoRow(); drawEvoChart(); };
  row.appendChild(bn);

  // Barre de recherche pour les autres
  var searchWrap=document.createElement('div');
  searchWrap.style.cssText='display:inline-block;position:relative;margin-left:8px;';

  var inp=document.createElement('input');
  inp.type='text'; inp.id='evo-circ-search';
  inp.placeholder='🔍 Autre circonscription…';
  inp.style.cssText='padding:3px 10px;border:1px solid var(--border);border-radius:12px;font-size:11px;background:var(--surf2);color:var(--text);outline:none;width:200px;';
  if(S.evoCircoKey!=='_national') inp.value=S.evoCircoKey;
  inp.oninput=function(){
    var q=this.value.toLowerCase().trim();
    var dd=document.getElementById('evo-circ-dd'); if(!dd) return;
    if(!q){ dd.style.display='none'; return; }
    var subs=(S.data?S.data.circos:[]).filter(function(c){
      return c.description!=='Constituency'&&c.description!=='Country'&&c.description!=='Region'
        && c.label.toLowerCase().indexOf(q)!==-1;
    });
    dd.innerHTML='';
    subs.slice(0,15).forEach(function(c){
      var item=document.createElement('div'); item.className='el-dd-item';
      item.innerHTML='<span>'+c.label+'</span><span class="el-dd-badge">'+c.description+'</span>';
      item.onclick=(function(circ){ return function(){
        S.evoCircoKey=circ.label;
        inp.value=circ.label;
        dd.style.display='none';
        buildEvoCircoRow();
        drawEvoChart();
      }; })(c);
      dd.appendChild(item);
    });
    dd.style.display=subs.length?'block':'none';
  };

  var dd2=document.createElement('div'); dd2.id='evo-circ-dd';
  dd2.style.cssText='display:none;position:absolute;top:calc(100% + 4px);left:0;width:280px;background:var(--surf);border:1px solid var(--border);border-radius:10px;box-shadow:0 8px 24px rgba(0,0,0,.15);max-height:200px;overflow-y:auto;z-index:999;';

  searchWrap.appendChild(inp); searchWrap.appendChild(dd2);
  row.appendChild(searchWrap);
}

// Partis sélectionnés pour l'évolution
var _evoSelectedPartis = null;

function buildEvoPartisRow(partis){
  var row=document.getElementById('evo-partis-row'); if(!row) return;
  // Init selection : top 5 partis par défaut
  if(!_evoSelectedPartis){
    _evoSelectedPartis={};
    partis.slice(0,5).forEach(function(p){ _evoSelectedPartis[p.party]=true; });
  }
  row.innerHTML='';
  partis.forEach(function(p){
    var b=document.createElement('button');
    var isOn=!!_evoSelectedPartis[p.party];
    b.className='el-pill-xs'+(isOn?' active':'');
    if(isOn) b.style.cssText='border-color:'+p.color+';background:'+p.color+'22;color:'+p.color+';';
    b.innerHTML='<span style="display:inline-block;width:7px;height:7px;border-radius:50%;background:'+p.color+';margin-right:4px;vertical-align:middle"></span>'+p.label;
    b.onclick=(function(parti, btn){ return function(){
      _evoSelectedPartis[parti.party]=!_evoSelectedPartis[parti.party];
      buildEvoPartisRow(partis);
      drawEvoChart();
    }; })(p, b);
    row.appendChild(b);
    row.insertAdjacentHTML('beforeend',' ');
  });
}

// Cache des données d'évolution par "levelKey|year"
var _evoCache={};

function loadEvoData(){
  var loading=document.getElementById('evo-loading');
  var chartWrap=document.getElementById('evo-chart-wrap');
  if(loading) loading.style.display='block';
  if(chartWrap) chartWrap.style.display='none';

  var pending=0;
  EVO_YEARS.forEach(function(year){
    var key=S.levelKey+'|'+year;
    if(_evoCache[key]!==undefined) return; // déjà en cache
    pending++;
    _evoCache[key]=null; // marqueur "en cours"
    loadDataForYear(year, S.levelKey, function(data){
      _evoCache[key]=data;
      pending--;
      if(pending===0){ if(loading) loading.style.display='none'; if(chartWrap) chartWrap.style.display='block'; drawEvoChart(); }
    });
  });

  if(pending===0){
    if(loading) loading.style.display='none';
    if(chartWrap) chartWrap.style.display='block';
    drawEvoChart();
  }
}

function getCircoFromData(data, circoKey){
  if(!data) return null;
  if(circoKey==='_national') return getNationalFromData(data);
  return data.circos.find(function(c){ return c.label===circoKey; });
}

function getNationalFromData(data){
  if(!data) return null;
  var order=['Region','Country','Constituency'];
  for(var i=0;i<order.length;i++){
    var f=data.circos.find(function(c){ return c.description===order[i]&&c.validVotes>0; });
    if(f) return f;
  }
  return data.circos.slice().sort(function(a,b){return b.validVotes-a.validVotes;})[0]||null;
}

function drawEvoChart(){
  var canvas=document.getElementById('el-chart-evo'); if(!canvas) return;

  // Rassembler les partis sélectionnés
  var selPartis=Object.keys(_evoSelectedPartis||{}).filter(function(k){ return _evoSelectedPartis[k]; });
  if(!selPartis.length){ canvas.getContext('2d').clearRect(0,0,canvas.width,canvas.height); return; }

  // Construire les séries par parti
  var datasets=[];
  var labels=EVO_YEARS.map(function(y){ return 'Juin '+y; });

  selPartis.forEach(function(partyKey){
    var color=window.elPartyColor(partyKey);
    var label=window.elPartyLabel(partyKey);
    var data=EVO_YEARS.map(function(year){
      var cacheKey=S.levelKey+'|'+year;
      var d=_evoCache[cacheKey];
      var circ=getCircoFromData(d, S.evoCircoKey);
      if(!circ) return null;
      var li=circ.lists.find(function(l){ return l.party===partyKey; });
      if(!li) return null;
      if(S.evoMetric==='pct')   return li.pct;
      if(S.evoMetric==='votes') return li.votes;
      if(S.evoMetric==='seats') return li.seats;
      return null;
    });
    datasets.push({
      label:label,
      data:data,
      borderColor:color,
      backgroundColor:color+'33',
      pointBackgroundColor:color,
      pointRadius:6,
      pointHoverRadius:9,
      borderWidth:3,
      fill:false,
      tension:0.3,
      spanGaps:true,
    });
  });

  // Mettre à jour le titre
  var titleEl=document.getElementById('evo-chart-title');
  var subEl=document.getElementById('evo-chart-sub');
  var metricLabel={pct:'% des voix',votes:'Nombre de voix',seats:'Sièges'}[S.evoMetric];
  var circoLabel=S.evoCircoKey==='_national'?'Niveau national':S.evoCircoKey;
  if(titleEl) titleEl.textContent='Évolution — '+metricLabel;
  if(subEl) subEl.textContent=circoLabel+' · Juin 2014 / Juin 2019 / Juin 2024';

  // Détruire le chart précédent
  if(window._evoChart){ window._evoChart.destroy(); window._evoChart=null; }

  window._evoChart=new Chart(canvas,{
    type:'line',
    data:{labels:labels, datasets:datasets},
    options:{
      responsive:true, maintainAspectRatio:false,
      interaction:{mode:'index',intersect:false},
      plugins:{
        legend:{display:true,position:'bottom',labels:{boxWidth:16,padding:16,font:{size:12}}},
        tooltip:{callbacks:{
          label:function(ctx){
            var v=ctx.raw;
            if(v==null) return ctx.dataset.label+' : —';
            if(S.evoMetric==='pct') return ctx.dataset.label+' : '+v+'%';
            if(S.evoMetric==='votes') return ctx.dataset.label+' : '+v.toLocaleString('fr-BE')+' voix';
            if(S.evoMetric==='seats') return ctx.dataset.label+' : '+v+' siège(s)';
            return ctx.dataset.label+' : '+v;
          }
        }}
      },
      scales:{
        y:{
          ticks:{
            callback:function(v){
              if(S.evoMetric==='pct') return v+'%';
              if(S.evoMetric==='votes') return (v/1000).toFixed(0)+'k';
              return v;
            },
            color:'#4A5785',font:{size:11}
          },
          grid:{color:'rgba(0,46,255,0.06)'}
        },
        x:{ticks:{color:'#060D2E',font:{size:12,weight:'500'}},grid:{display:false}}
      }
    }
  });

  // Tableau récapitulatif
  buildEvoTable(selPartis);
}

function buildEvoTable(selPartis){
  var wrap=document.getElementById('evo-table-wrap'); if(!wrap) return;
  var metricLabel={pct:'%',votes:'Voix',seats:'Sièges'}[S.evoMetric];

  var html='<div class="card"><div class="card-title">Tableau récapitulatif</div>'
    +'<div class="table-wrap"><table><thead><tr><th>Parti</th>';
  EVO_YEARS.forEach(function(y){ html+='<th style="text-align:right">Juin '+y+'</th>'; });
  html+='<th style="text-align:right">Évol. 2014→2024</th></tr></thead><tbody>';

  selPartis.forEach(function(partyKey){
    var color=window.elPartyColor(partyKey);
    var label=window.elPartyLabel(partyKey);
    html+='<tr><td><span class="dot-party" style="background:'+color+'"></span><strong>'+label+'</strong></td>';
    var vals=EVO_YEARS.map(function(year){
      var d=_evoCache[S.levelKey+'|'+year];
      var circ=getCircoFromData(d,S.evoCircoKey);
      if(!circ) return null;
      var li=circ.lists.find(function(l){return l.party===partyKey;});
      if(!li) return null;
      if(S.evoMetric==='pct')   return li.pct;
      if(S.evoMetric==='votes') return li.votes;
      if(S.evoMetric==='seats') return li.seats;
      return null;
    });
    vals.forEach(function(v){
      html+='<td style="text-align:right">';
      if(v==null) html+='—';
      else if(S.evoMetric==='pct') html+='<strong>'+v+'%</strong>';
      else if(S.evoMetric==='votes') html+=v.toLocaleString('fr-BE');
      else html+=v;
      html+='</td>';
    });
    // Delta 2014 → 2024
    html+='<td style="text-align:right">';
    if(vals[0]!=null&&vals[2]!=null){
      var delta=S.evoMetric==='pct'?Math.round((vals[2]-vals[0])*10)/10:vals[2]-vals[0];
      var sign=delta>0?'+':'';
      var col=delta>0?'#1a9e4a':delta<0?'#CC0022':'var(--muted)';
      var disp=S.evoMetric==='pct'?sign+delta+'%':S.evoMetric==='votes'?sign+delta.toLocaleString('fr-BE'):sign+delta;
      html+='<strong style="color:'+col+'">'+disp+'</strong>';
    } else html+='—';
    html+='</td></tr>';
  });
  wrap.innerHTML=html+'</tbody></table></div></div>';
}

// ══════════════════════════════════════════════════════════════
//  HELPER COMMUN : barre de recherche de circonscription
// ══════════════════════════════════════════════════════════════
function buildCircoSearch(container, circos, mode){
  var box=document.createElement('div');
  box.className='el-circ-box';
  box.id='el-circ-box-'+mode;

  var hdr=document.createElement('div');
  hdr.style.cssText='display:flex;align-items:center;gap:8px;margin-bottom:8px;flex-wrap:wrap;';

  var lbl=document.createElement('span'); lbl.className='el-circ-lbl'; lbl.textContent='Circonscription :';

  var btnNat=document.createElement('button');
  btnNat.className='el-pill-xs active'; btnNat.textContent='🇧🇪 National';
  btnNat.onclick=function(){
    if(mode==='pct') elSelectCircoPct('_national');
    else elSelectSeatsCirco('_national');
    box.querySelectorAll('.el-pill-xs').forEach(function(b){b.classList.remove('active');});
    btnNat.classList.add('active');
  };

  var iWrap=document.createElement('div');
  iWrap.style.cssText='position:relative;flex:1;min-width:180px;max-width:320px;';

  var inp=document.createElement('input');
  inp.type='text'; inp.id='el-'+mode+'-search';
  inp.placeholder='🔍 Chercher une circonscription…';
  inp.style.cssText='width:100%;box-sizing:border-box;padding:5px 12px;border:1px solid var(--border);border-radius:20px;font-size:12px;background:var(--surf2);color:var(--text);outline:none;';

  var lblMap={Province:'Province',Region:'Région',Arrondissement:'Arrondissement',Canton:'Canton',Municipality:'Commune'};
  var dd=document.createElement('div'); dd.id='el-'+mode+'-dropdown';
  dd.style.cssText='display:none;position:absolute;top:calc(100% + 4px);left:0;right:0;background:var(--surf);border:1px solid var(--border);border-radius:10px;box-shadow:0 8px 24px rgba(0,0,0,.15);max-height:280px;overflow-y:auto;z-index:999;';

  inp.oninput=function(){
    var q=this.value.toLowerCase().trim();
    dd.innerHTML='';
    if(!q){ dd.style.display='none'; return; }
    var filtered=circos.filter(function(c){ return c.label.toLowerCase().indexOf(q)!==-1; });
    filtered.slice(0,30).forEach(function(c){
      var item=document.createElement('div'); item.className='el-dd-item';
      item.innerHTML='<span style="font-size:12px;font-weight:600;color:var(--text)">'+c.label+'</span>'
        +'<span class="el-dd-badge">'+(lblMap[c.description]||c.description)+'</span>';
      item.onclick=(function(circ){ return function(){
        inp.value=circ.label;
        dd.style.display='none';
        box.querySelectorAll('.el-pill-xs').forEach(function(b){b.classList.remove('active');});
        if(mode==='pct') elSelectCircoPct(circ.label);
        else elSelectSeatsCirco(circ.label);
      }; })(c);
      dd.appendChild(item);
    });
    if(filtered.length>30){
      var m=document.createElement('div'); m.style.cssText='padding:8px 14px;color:var(--muted);font-size:11px';
      m.textContent='… et '+(filtered.length-30)+' autres'; dd.appendChild(m);
    }
    dd.style.display=filtered.length?'block':'none';
  };

  document.addEventListener('click',function(e){
    if(!dd.contains(e.target)&&e.target!==inp) dd.style.display='none';
  });

  iWrap.appendChild(inp); iWrap.appendChild(dd);
  hdr.appendChild(lbl); hdr.appendChild(btnNat); hdr.appendChild(iWrap);
  box.appendChild(hdr);
  container.insertBefore(box, container.firstChild);
}

// ── Utilitaires ───────────────────────────────────────────────
function getNational(){
  if(!S.data) return null;
  var order=['Region','Country','Constituency'];
  for(var i=0;i<order.length;i++){
    var f=S.data.circos.find(function(c){ return c.description===order[i]&&c.validVotes>0; });
    if(f) return f;
  }
  return S.data.circos.slice().sort(function(a,b){return b.validVotes-a.validVotes;})[0]||null;
}

function getFeatureName(f){
  var p=f.properties||{};
  function v(x){ return Array.isArray(x)?x[0]||'':x||''; }
  return v(p.mun_name_fr)||v(p.mun_name_nl)||v(p.mun_name_de)||v(p.name_fr)||v(p.name)||v(p.nom)||'';
}
function norm(s){ return (s||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[-\s'\u2019]/g,''); }

function kpi(lbl,val,sub){
  return '<div class="kpi"><div class="kpi-label">'+lbl+'</div>'
    +'<div class="kpi-value c-accent" style="font-size:20px">'+val+'</div>'
    +'<div class="kpi-sub">'+sub+'</div></div>';
}
function setLoading(on){
  var sp=document.getElementById('el-loading'); if(sp) sp.style.display=on?'flex':'none';
  var ct=document.getElementById('el-content'); if(ct) ct.style.display=on?'none':'block';
}
function setStatus(s,t){ window.setGlobalStatus&&window.setGlobalStatus(s,t); }
function showError(msg){
  setLoading(false);
  var ct=document.getElementById('el-content'); if(ct) ct.style.display='block';
  var area=document.getElementById('el-pct-wrap')||document.getElementById('el-seats-wrap')||document.getElementById('el-sec-map');
  if(area) area.innerHTML='<div class="el-error-box">⚠️ '+msg+'</div>';
}
function showSizeError(lv){
  setLoading(false);
  var ct=document.getElementById('el-content'); if(ct) ct.style.display='block';
  var area=document.getElementById('el-pct-wrap')||document.getElementById('el-seats-wrap');
  if(area) area.innerHTML='<div class="card" style="text-align:center;padding:32px">'
    +'<div style="font-size:36px;margin-bottom:12px">📦</div>'
    +'<div style="font-weight:700;font-size:15px;margin-bottom:8px">Fichier non encore converti</div>'
    +'<div style="color:var(--muted);font-size:13px;max-width:500px;margin:0 auto;line-height:1.8">'
    +'Lancez <strong>convertir_xml_elections.py</strong> puis déposez <code>'+(lv.jsonFile||'...')+'</code> sur GitHub.'
    +'</div></div>';
}

})();
