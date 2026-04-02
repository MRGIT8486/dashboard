// ══════════════════════════════════════════════════════════════
//  elections.js  —  Module Résultats électoraux  v1.3
//  MR Dashboard
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
};

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
      b.onclick = function(){ S.levelKey=lv.key; S.data=null; S.seatsCircoKey='_national'; buildSelectors(); loadData(); };
      lw.appendChild(b);
    });
  }

  var vw = document.getElementById('el-view-tabs');
  if(vw){
    var views = [{k:'pct',l:'% des voix'},{k:'seats',l:'Assemblée / sièges'},{k:'map',l:'🗺 Carte'}];
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

// ── Chargement : JSON repo → proxy XML ───────────────────────
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
  ['el-sec-pct','el-sec-seats','el-sec-map'].forEach(function(id){
    var el=document.getElementById(id); if(el) el.style.display='none';
  });
  var sec=document.getElementById('el-sec-'+S.view);
  if(sec) sec.style.display='block';
  if(S.view==='pct')   renderPct();
  if(S.view==='seats') renderSeats();
  if(S.view==='map')   renderMap();
}

// ── Vue 1 : % des voix ───────────────────────────────────────
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

  // Barre de recherche de circonscription
  var subs=S.data.circos.filter(function(c){
    return c.description!=='Constituency'&&c.description!=='Country'&&c.description!=='Region';
  });
  if(subs.length>0){
    var box=document.createElement('div');
    box.className='el-circ-box'; box.id='el-circ-box-pct';

    // Bouton National
    var hdr=document.createElement('div');
    hdr.style.cssText='display:flex;align-items:center;gap:8px;margin-bottom:8px;flex-wrap:wrap;';

    var lbl=document.createElement('span');
    lbl.className='el-circ-lbl'; lbl.textContent='Circonscription :';

    var btnNat=document.createElement('button');
    btnNat.className='el-pill-xs active'; btnNat.id='el-circ-national';
    btnNat.textContent='🇧🇪 National';
    btnNat.onclick=function(){ elSelectCircoPct('_national',this); };

    // Input de recherche
    var inputWrap=document.createElement('div');
    inputWrap.style.cssText='position:relative;flex:1;min-width:180px;max-width:320px;';

    var inp=document.createElement('input');
    inp.type='text'; inp.id='el-circ-search';
    inp.placeholder='🔍 Chercher une circonscription…';
    inp.style.cssText='width:100%;box-sizing:border-box;padding:5px 12px;border:1px solid var(--border);border-radius:20px;font-size:12px;background:var(--surf2);color:var(--text);outline:none;';
    inp.oninput=function(){ elFilterCircos(this.value); };

    var dd=document.createElement('div');
    dd.id='el-circ-dropdown';
    dd.style.cssText='display:none;position:absolute;top:calc(100% + 4px);left:0;right:0;background:var(--surf);border:1px solid var(--border);border-radius:10px;box-shadow:0 8px 24px rgba(0,0,0,.15);max-height:280px;overflow-y:auto;z-index:999;';

    inputWrap.appendChild(inp);
    inputWrap.appendChild(dd);
    hdr.appendChild(lbl);
    hdr.appendChild(btnNat);
    hdr.appendChild(inputWrap);
    box.appendChild(hdr);
    wrap.appendChild(box);

    window._elSubCircosPct = subs;
    window._elLevelLabelsPct = {Province:'Province',Region:'Région',Arrondissement:'Arrondissement',Canton:'Canton',Municipality:'Commune'};

    // Fermer dropdown au clic ailleurs
    document.addEventListener('click',function(e){
      var d2=document.getElementById('el-circ-dropdown');
      var i2=document.getElementById('el-circ-search');
      if(d2&&!d2.contains(e.target)&&e.target!==i2) d2.style.display='none';
    });
  }

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

function elFilterCircos(query){
  var dd=document.getElementById('el-circ-dropdown'); if(!dd) return;
  var circos=window._elSubCircosPct||[];
  var lbls=window._elLevelLabelsPct||{};
  var q=(query||'').toLowerCase().trim();
  if(!q){ dd.style.display='none'; return; }

  var filtered=circos.filter(function(c){
    return c.label.toLowerCase().indexOf(q)!==-1 || (lbls[c.description]||'').toLowerCase().indexOf(q)!==-1;
  });

  dd.innerHTML='';
  if(filtered.length===0){
    var empty=document.createElement('div');
    empty.style.cssText='padding:12px 14px;color:var(--muted);font-size:12px';
    empty.textContent='Aucun résultat';
    dd.appendChild(empty);
  } else {
    filtered.slice(0,30).forEach(function(c){
      var item=document.createElement('div');
      item.className='el-dd-item';
      item.innerHTML='<span style="font-size:12px;font-weight:600;color:var(--text)">'+c.label+'</span>'
        +'<span class="el-dd-badge">'+(lbls[c.description]||c.description)+'</span>';
      item.onclick=(function(circ){ return function(){
        elSelectCircoPct(circ.label, null);
        var inp=document.getElementById('el-circ-search'); if(inp) inp.value=circ.label;
        var d2=document.getElementById('el-circ-dropdown'); if(d2) d2.style.display='none';
      }; })(c);
      dd.appendChild(item);
    });
    if(filtered.length>30){
      var more=document.createElement('div');
      more.style.cssText='padding:8px 14px;color:var(--muted);font-size:11px';
      more.textContent='… et '+(filtered.length-30)+' autres';
      dd.appendChild(more);
    }
  }
  dd.style.display='block';
}

function elSelectCircoPct(labelOrEnc, btn){
  var label = (labelOrEnc==='_national') ? '_national' : decodeURIComponent(labelOrEnc);
  var box=document.getElementById('el-circ-box-pct');
  if(box) box.querySelectorAll('.el-pill-xs').forEach(function(b){b.classList.remove('active');});
  if(btn&&btn.classList) btn.classList.add('active');

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
// Exposer globalement
window.elSelectCircoPct = elSelectCircoPct;

// ── Vue 2 : Sièges ───────────────────────────────────────────
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

  if(circosWithSeats.length>1){
    var sw=document.createElement('div');
    sw.id='el-seats-search-wrap';
    sw.style.cssText='display:flex;align-items:center;gap:8px;margin-bottom:14px;flex-wrap:wrap;';

    var slbl=document.createElement('span');
    slbl.className='el-circ-lbl'; slbl.textContent='Circonscription :';

    var swrap=document.createElement('div');
    swrap.style.cssText='position:relative;flex:1;min-width:180px;max-width:320px;';

    var sinp=document.createElement('input');
    sinp.type='text'; sinp.id='el-seats-search';
    sinp.placeholder='🔍 Chercher une circonscription…';
    sinp.value=currentCirco.label;
    sinp.style.cssText='width:100%;box-sizing:border-box;padding:5px 12px;border:1px solid var(--border);border-radius:20px;font-size:12px;background:var(--surf2);color:var(--text);outline:none;';
    sinp.oninput=function(){ elFilterSeatsCircos(this.value); };

    var sdd=document.createElement('div');
    sdd.id='el-seats-dropdown';
    sdd.style.cssText='display:none;position:absolute;top:calc(100% + 4px);left:0;right:0;background:var(--surf);border:1px solid var(--border);border-radius:10px;box-shadow:0 8px 24px rgba(0,0,0,.15);max-height:280px;overflow-y:auto;z-index:999;';

    swrap.appendChild(sinp); swrap.appendChild(sdd);
    var scnt=document.createElement('span');
    scnt.style.cssText='font-size:11px;color:var(--muted)';
    scnt.textContent=circosWithSeats.length+' circonscriptions';

    sw.appendChild(slbl); sw.appendChild(swrap); sw.appendChild(scnt);
    wrap.appendChild(sw);
    window._elCircosWithSeats=circosWithSeats;
  }

  renderSeatsForCirco(currentCirco, wrap);
}

function renderSeatsForCirco(circ, wrap){
  wrap.querySelectorAll('.el-seats-content').forEach(function(el){el.remove();});
  var withSeats=circ.lists.filter(function(l){return l.seats!=null&&l.seats>0;});
  var total=withSeats.reduce(function(s,l){return s+l.seats;},0);
  var lv=getLvl();
  var isNational=(circ.description==='Constituency'||circ.description==='Country'||circ.description==='Region');
  var officialTotal=(isNational&&lv&&lv.totalSeats)?lv.totalSeats:total;

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

function elFilterSeatsCircos(query){
  var dd=document.getElementById('el-seats-dropdown'); if(!dd) return;
  var circos=window._elCircosWithSeats||[];
  var q=(query||'').toLowerCase().trim();
  dd.innerHTML='';
  if(!q){ dd.style.display='none'; return; }
  var filtered=circos.filter(function(c){ return c.label.toLowerCase().indexOf(q)!==-1; });
  if(filtered.length===0){
    var e=document.createElement('div'); e.style.cssText='padding:12px 14px;color:var(--muted);font-size:12px';
    e.textContent='Aucun résultat'; dd.appendChild(e);
  } else {
    filtered.slice(0,30).forEach(function(c){
      var item=document.createElement('div'); item.className='el-dd-item';
      item.innerHTML='<span style="font-size:12px;font-weight:600;color:var(--text)">'+c.label+'</span>'
        +'<span class="el-dd-badge">'+c.description+'</span>';
      item.onclick=(function(circ){ return function(){
        S.seatsCircoKey=circ.label;
        var i2=document.getElementById('el-seats-search'); if(i2) i2.value=circ.label;
        var d2=document.getElementById('el-seats-dropdown'); if(d2) d2.style.display='none';
        renderSeatsForCirco(circ, document.getElementById('el-seats-wrap'));
      }; })(c);
      dd.appendChild(item);
    });
  }
  dd.style.display='block';
}

// ── Vue 3 : Carte ────────────────────────────────────────────
function renderMap(){
  var sec=document.getElementById('el-sec-map'); if(!sec) return;

  var bar=document.getElementById('el-map-level-bar');
  if(!bar){ bar=document.createElement('div'); bar.id='el-map-level-bar'; sec.insertBefore(bar,sec.firstChild); }
  var mapLevels=[{k:'commune',l:'Communes'},{k:'arrondissement',l:'Arrondissements'},{k:'province',l:'Provinces'}];
  bar.innerHTML='';
  var bwrap=document.createElement('div');
  bwrap.style.cssText='display:flex;align-items:center;gap:6px;flex-wrap:wrap;padding:0 0 12px 0';
  var lsp=document.createElement('span');
  lsp.style.cssText='font-size:12px;color:var(--muted);margin-right:4px'; lsp.textContent='Niveau :';
  bwrap.appendChild(lsp);
  mapLevels.forEach(function(ml){
    var mb=document.createElement('button');
    mb.className='el-pill-xs'+(S.mapLevel===ml.k?' active':'');
    mb.textContent=ml.l;
    mb.onclick=(function(k){ return function(){ window.elSetMapLevel(k,this); }; })(ml.k);
    bwrap.appendChild(mb);
  });
  bar.appendChild(bwrap);

  if(!document.getElementById('el-leaflet-map')){
    var mw=document.createElement('div');
    mw.innerHTML='<div id="el-leaflet-map" style="height:520px;border-radius:12px;overflow:hidden;border:1px solid var(--border)"></div>'
      +'<div id="el-map-legend" style="margin-top:12px"></div>';
    sec.appendChild(mw);
  }
  initLeaflet();
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
  var winners=buildWinners();
  S.leafletMap.eachLayer(function(l){if(l._elLayer) S.leafletMap.removeLayer(l);});
  var layer=window.L.geoJSON(geo,{
    style:function(f){ var w=winners[norm(getFeatureName(f))]; return {fillColor:w?w.color:'#E0E0E0',fillOpacity:0.72,color:'#fff',weight:0.8}; },
    onEachFeature:function(f,l){
      var name=getFeatureName(f), w=winners[norm(name)];
      var tip='<strong>'+name+'</strong>';
      if(w) tip+='<br><span style="color:'+w.color+'">■</span> '+w.party+' — '+w.pct+'%'+(w.seats?' · '+w.seats+' sièges':'');
      else  tip+='<br><em style="color:#999">Donnée non disponible</em>';
      l.bindTooltip(tip,{sticky:true,className:'el-map-tooltip'});
    }
  });
  layer._elLayer=true; layer.addTo(S.leafletMap);
  renderMapLegend(winners);
}

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

function getFeatureName(f){
  var p=f.properties||{};
  function v(x){ return Array.isArray(x)?x[0]||'':x||''; }
  return v(p.mun_name_fr)||v(p.mun_name_nl)||v(p.mun_name_de)||v(p.name_fr)||v(p.name)||v(p.nom)||'';
}

function norm(s){ return (s||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[-\s'\u2019]/g,''); }

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

// ── Utilitaires ───────────────────────────────────────────────
function getNational(){
  if(!S.data) return null;
  // Priorité : Region (ex: Parlement wallon) > Country > Constituency (ex: circonscription locale)
  // Pour le Parlement wallon, 'Region' = total wallon ; 'Constituency' = circonscription locale
  var order = ['Region','Country','Constituency'];
  for(var i=0; i<order.length; i++){
    var found = S.data.circos.find(function(c){ return c.description===order[i] && c.validVotes > 0; });
    if(found) return found;
  }
  // Fallback : la circo avec le plus de votes (= la plus agrégée)
  return S.data.circos.slice().sort(function(a,b){ return b.validVotes - a.validVotes; })[0] || null;
}
function kpi(lbl,val,sub){
  return '<div class="kpi"><div class="kpi-label">'+lbl+'</div>'
    +'<div class="kpi-value c-accent" style="font-size:20px">'+val+'</div>'
    +'<div class="kpi-sub">'+sub+'</div></div>';
}
function setLoading(on){
  S.loading=on;
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
