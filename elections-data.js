// ══════════════════════════════════════════════════════════════
//  elections-data.js  —  Données statiques · Module Élections
//  MR Dashboard · v1.0
// ══════════════════════════════════════════════════════════════

window.EL_PARTIES = {
  'MR':          { label:'MR',           color:'#002EFF' },
  'PFF-MR':      { label:'MR',           color:'#002EFF' },
  'PS':          { label:'PS',           color:'#CC0066' },
  'ECOLO':       { label:'Écolo',        color:'#3DAA35' },
  'PTB':         { label:'PTB',          color:'#8B0000' },
  'LES ENGAGES': { label:'Les Engagés',  color:'#E87722' },
  'LE':          { label:'Les Engagés',  color:'#E87722' },
  'DEFI':        { label:'DéFI',         color:'#FF6600' },
  'CAP':         { label:'CAP',          color:'#9C27B0' },
  'N-VA':        { label:'N-VA',         color:'#D4AF37' },
  'NVA':         { label:'N-VA',         color:'#D4AF37' },
  'VB':          { label:'VB',           color:'#3C3C3C' },
  'VOORUIT':     { label:'Vooruit',      color:'#FF1493' },
  'CD&V':        { label:'CD&V',         color:'#FF8C00' },
  'OPEN VLD':    { label:'Open Vld',     color:'#003DA5' },
  'GROEN':       { label:'Groen',        color:'#2E8B57' },
  'PVDA':        { label:'PVDA',         color:'#CC0000' },
  'PDB':         { label:'PDB',          color:'#795548' },
  'SP':          { label:'SP',           color:'#F44336' },
  'CSP':         { label:'CSP',          color:'#FF9800' },
  'VIVANT':      { label:'Vivant',       color:'#009688' },
};

window.EL_CATALOG = [
  {
    id:'2024-06', label:'Juin 2024', date:'9 juin 2024', group:'Juin 2024',
    levels:[
      { key:'federal',   label:'Chambre des Représentants', icon:'🏛️', jsonFile:'2024_Chamber.json',            totalSeats:150 },
      { key:'wallon',    label:'Parlement wallon',           icon:'🌿', jsonFile:'2024_ParlementWallonia.json',  totalSeats:75  },
      { key:'bruxelles', label:'Parlement bruxellois',       icon:'🏙️', jsonFile:'2024_ParlementBrussels.json', totalSeats:89  },
      { key:'europeen',  label:'Parlement européen',         icon:'🇪🇺',jsonFile:'2024_ParlementEurope.json',   totalSeats:21  },
      { key:'flamand',   label:'Parlement flamand',          icon:'🦁', jsonFile:'2024_ParlementFlanders.json', totalSeats:124 },
      { key:'germano',   label:'Parlement germanophone',     icon:'🗺️', jsonFile:'2024_ParlementGermanRegion.json', totalSeats:25 },
    ]
  },
  {
    id:'2024-10', label:'Oct. 2024', date:'13 octobre 2024', group:'Oct. 2024',
    levels:[
      { key:'communal',   label:'Conseils communaux',   icon:'🏘️', jsonFile:'2024_Municipality.json', totalSeats:null },
      { key:'provincial', label:'Conseils provinciaux', icon:'🗺️', jsonFile:'2024_Province.json',     totalSeats:null },
    ]
  },
  {
    id:'2019-05', label:'Mai 2019', date:'26 mai 2019', group:'Mai 2019',
    levels:[
      { key:'federal',   label:'Chambre des Représentants', icon:'🏛️', jsonFile:'2019_Chamber.json',            totalSeats:150 },
      { key:'wallon',    label:'Parlement wallon',           icon:'🌿', jsonFile:'2019_ParlementWallonia.json',  totalSeats:75  },
      { key:'bruxelles', label:'Parlement bruxellois',       icon:'🏙️', jsonFile:'2019_ParlementBrussels.json', totalSeats:89  },
      { key:'europeen',  label:'Parlement européen',         icon:'🇪🇺',jsonFile:'2019_ParlementEurope.json',   totalSeats:21  },
      { key:'flamand',   label:'Parlement flamand',          icon:'🦁', jsonFile:'2019_ParlementFlanders.json', totalSeats:124 },
      { key:'germano',   label:'Parlement germanophone',     icon:'🗺️', jsonFile:'2019_ParlementGermanRegion.json', totalSeats:25 },
    ]
  },
  {
    id:'2018-10', label:'Oct. 2018', date:'14 octobre 2018', group:'Oct. 2018',
    levels:[
      { key:'communal',   label:'Conseils communaux',   icon:'🏘️', jsonFile:'2018_Municipality.json', totalSeats:null },
      { key:'provincial', label:'Conseils provinciaux', icon:'🗺️', jsonFile:'2018_Province.json',     totalSeats:null },
    ]
  },
  {
    id:'2014-05', label:'Mai 2014', date:'25 mai 2014', group:'Mai 2014',
    levels:[
      { key:'federal',   label:'Chambre des Représentants', icon:'🏛️', jsonFile:'2014_Chamber.json',            totalSeats:150 },
      { key:'wallon',    label:'Parlement wallon',           icon:'🌿', jsonFile:'2014_ParlementWallonia.json',  totalSeats:75  },
      { key:'bruxelles', label:'Parlement bruxellois',       icon:'🏙️', jsonFile:'2014_ParlementBrussels.json', totalSeats:89  },
      { key:'europeen',  label:'Parlement européen',         icon:'🇪🇺',jsonFile:'2014_ParlementEurope.json',   totalSeats:21  },
      { key:'flamand',   label:'Parlement flamand',          icon:'🦁', jsonFile:'2014_ParlementFlanders.json', totalSeats:124 },
    ]
  },
  {
    id:'2012-10', label:'Oct. 2012', date:'14 octobre 2012', group:'Oct. 2012',
    levels:[
      { key:'communal',   label:'Conseils communaux',   icon:'🏘️', jsonFile:'2012_Municipality.json', totalSeats:null },
      { key:'provincial', label:'Conseils provinciaux', icon:'🗺️', jsonFile:'2012_Province.json',     totalSeats:null },
    ]
  },
];

window.EL_XML_BASE = 'https://resultatselection.belgium.be/xml/';
window.EL_PROXY    = 'https://corsproxy.io/?';

window.elPartyColor = function(key){
  var k=(key||'').toUpperCase().trim();
  if(window.EL_PARTIES[k]) return window.EL_PARTIES[k].color;
  for(var pk in window.EL_PARTIES){ if(k.indexOf(pk)!==-1||pk.indexOf(k)!==-1) return window.EL_PARTIES[pk].color; }
  var h=0; for(var i=0;i<(key||'').length;i++) h=(key||'').charCodeAt(i)+((h<<5)-h);
  return 'hsl('+(Math.abs(h)%360)+',50%,42%)';
};
window.elPartyLabel = function(key){
  var k=(key||'').toUpperCase().trim();
  if(window.EL_PARTIES[k]) return window.EL_PARTIES[k].label;
  for(var pk in window.EL_PARTIES){ if(k.indexOf(pk)!==-1||pk.indexOf(k)!==-1) return window.EL_PARTIES[pk].label; }
  return key||'?';
};

console.log('[elections-data] ✓',window.EL_CATALOG.length,'scrutins chargés');
