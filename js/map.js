const BASEMAPS={
  positron:'https://tiles.openfreemap.org/styles/positron',
  liberty:'https://tiles.openfreemap.org/styles/liberty',
  dark:'https://tiles.openfreemap.org/styles/dark'
};

maplibregl.addProtocol('cog', MaplibreCOGProtocol.cogProtocol);

const palette=['#386641','#6a994e','#a7c957','#bc6c25','#dda15e','#457b9d','#8d6e63','#7b2cbf','#2a9d8f','#e76f51','#5f6f52','#9c6644','#577590','#43aa8b','#f4a261','#8a817c','#669bbc','#9b5de5','#588157','#b56576'];
const layerState={bacia:true,municipios:false,sedes:true,geologia:false,solos:false,hidrografia:false,potencialidades:false,mapbiomas:false};
const cache=new Map();
const categoryColors={};
let baciaBounds=null;
let currentMapbiomasUrl=null;

const map=new maplibregl.Map({container:'map',style:BASEMAPS.positron,center:[-46.05,-4.45],zoom:6.2,attributionControl:true});
map.addControl(new maplibregl.NavigationControl({visualizePitch:true}),'top-right');
map.addControl(new maplibregl.ScaleControl({maxWidth:120,unit:'metric'}),'bottom-right');

const loading=document.getElementById('loading');
const sidebar=document.getElementById('sidebar');
const legendPanel=document.getElementById('legendPanel');
const legendContent=document.getElementById('legendContent');
const mapbiomasYear=document.getElementById('mapbiomasYear');
const mapbiomasStatus=document.getElementById('mapbiomasStatus');
function setLoading(v,label='Carregando camada…'){loading.textContent=label;loading.classList.toggle('hidden',!v)}

async function getData(key,url){
  if(cache.has(key)) return cache.get(key);
  setLoading(true);
  const r=await fetch(url);
  if(!r.ok) throw new Error(`Falha ao carregar ${url}`);
  const d=await r.json();
  cache.set(key,d);
  setLoading(false);
  return d;
}
function boundsFromGeoJSON(gj){
  const b=new maplibregl.LngLatBounds();
  const walk=(c)=>{if(typeof c?.[0]==='number'){b.extend(c);return;} c?.forEach(walk)};
  gj.features.forEach(f=>walk(f.geometry.coordinates));return b;
}
function colorFor(value,index){return palette[index%palette.length]}
function categoryMatch(field,values){
  const expr=['match',['get',field]];
  values.forEach((v,i)=>expr.push(v,colorFor(v,i)));
  expr.push('#b8c2bb'); return expr;
}
function uniqueValues(gj,field){return [...new Set(gj.features.map(f=>f.properties?.[field]).filter(v=>v!==null&&v!==undefined&&v!==''))].sort((a,b)=>String(a).localeCompare(String(b),'pt-BR'))}
function safe(v){return (v===null||v===undefined||v==='')?'—':String(v)}
function popupHtml(title,rows){return `<h3 class="popup-title">${safe(title)}</h3><div class="popup-table">${rows.map(([a,b])=>`<span>${a}</span><strong>${safe(b)}</strong>`).join('')}</div>`}
function hexToRgb(hex){const h=hex.replace('#','');return [parseInt(h.slice(0,2),16),parseInt(h.slice(2,4),16),parseInt(h.slice(4,6),16)]}
function firstBasemapLabelLayer(){return map.getStyle()?.layers?.find(l=>l.type==='symbol')?.id}
function mapbiomasClass(code){return MAPBIOMAS_CONFIG.classes[Number(code)]}
function mapbiomasFile(year){return MAPBIOMAS_CONFIG.cogs[Number(year)]}

async function addBacia(){
  const gj=await getData('bacia','data/limite_bacia.geojson');
  baciaBounds=boundsFromGeoJSON(gj);
  // Segunda garantia: mesmo que um COG tenha pixels externos, o navegador os torna transparentes.
  MaplibreCOGProtocol.setMask(gj);
  if(!map.getSource('bacia')) map.addSource('bacia',{type:'geojson',data:gj});
  map.addLayer({id:'bacia-fill',type:'fill',source:'bacia',paint:{'fill-color':'#2d7a53','fill-opacity':0.035}});
  map.addLayer({id:'bacia-line',type:'line',source:'bacia',paint:{'line-color':'#155d3c','line-width':['interpolate',['linear'],['zoom'],5,2.2,10,4]}});
  map.on('click','bacia-fill',e=>{const p=e.features?.[0]?.properties||{};new maplibregl.Popup().setLngLat(e.lngLat).setHTML(popupHtml(p.nome_bacia||'Bacia do Rio Pindaré',[["Curso principal",p.curso_prin],["Área total",Number(p.area_total||0).toLocaleString('pt-BR',{maximumFractionDigits:1})+' km²'],["Suprabacia",p.suprabacia],["Código Otto",p.cod_otto]])).addTo(map)});
}
async function addMunicipios(){
  const gj=await getData('municipios','data/municipios_bacia.geojson');
  if(!map.getSource('municipios')) map.addSource('municipios',{type:'geojson',data:gj});
  map.addLayer({id:'municipios-fill',type:'fill',source:'municipios',paint:{'fill-color':'#718078','fill-opacity':0.045}});
  map.addLayer({id:'municipios-line',type:'line',source:'municipios',paint:{'line-color':'#4b5b53','line-width':0.8,'line-opacity':0.75}});
  map.on('click','municipios-fill',e=>{const p=e.features?.[0]?.properties||{};new maplibregl.Popup().setLngLat(e.lngLat).setHTML(popupHtml(p.NM_MUN,[["Código IBGE",p.CD_MUN]])).addTo(map)});
  fillMunicipioSelect(gj);
}
async function addSedes(){
  const gj=await getData('sedes','data/sedes_municipais.geojson');
  if(!map.getSource('sedes')) map.addSource('sedes',{type:'geojson',data:gj});
  map.addLayer({id:'sedes-circle',type:'circle',source:'sedes',paint:{'circle-radius':['interpolate',['linear'],['zoom'],5,3,9,6],'circle-color':'#173126','circle-stroke-color':'#ffffff','circle-stroke-width':1.4}});
  map.addLayer({id:'sedes-label',type:'symbol',source:'sedes',minzoom:6.5,layout:{'text-field':['get','NOME_MUNIC'],'text-size':10,'text-offset':[0,1.2],'text-anchor':'top'},paint:{'text-color':'#173126','text-halo-color':'#ffffff','text-halo-width':1.2}});
  map.on('click','sedes-circle',e=>{const p=e.features?.[0]?.properties||{};new maplibregl.Popup().setLngLat(e.lngLat).setHTML(popupHtml(p.NOME_MUNIC,[["Código IBGE",p.GEOCODIGO_],["UF",String(p.UF||'').toUpperCase()]])).addTo(map)});
}
async function addGeologia(){
  const gj=await getData('geologia','data/geologia.geojson');const vals=uniqueValues(gj,'NOME_UNIDA');categoryColors.geologia=vals;
  if(!map.getSource('geologia')) map.addSource('geologia',{type:'geojson',data:gj});
  map.addLayer({id:'geologia-fill',type:'fill',source:'geologia',paint:{'fill-color':categoryMatch('NOME_UNIDA',vals),'fill-opacity':0.68}});
  map.addLayer({id:'geologia-line',type:'line',source:'geologia',paint:{'line-color':'rgba(55,44,32,.55)','line-width':0.6}});
  map.on('click','geologia-fill',e=>{const p=e.features?.[0]?.properties||{};new maplibregl.Popup().setLngLat(e.lngLat).setHTML(popupHtml('Geologia',[["Unidade",p.NOME_UNIDA],["Área informada",p['Área']?Number(p['Área']).toLocaleString('pt-BR',{maximumFractionDigits:2})+' km²':'—']])).addTo(map)});
}
async function addSolos(){
  const gj=await getData('solos','data/solos.geojson');const vals=uniqueValues(gj,'legenda');categoryColors.solos=vals;
  if(!map.getSource('solos')) map.addSource('solos',{type:'geojson',data:gj});
  map.addLayer({id:'solos-fill',type:'fill',source:'solos',paint:{'fill-color':categoryMatch('legenda',vals),'fill-opacity':0.66}});
  map.addLayer({id:'solos-line',type:'line',source:'solos',paint:{'line-color':'rgba(55,44,32,.45)','line-width':0.5}});
  map.on('click','solos-fill',e=>{const p=e.features?.[0]?.properties||{};new maplibregl.Popup().setLngLat(e.lngLat).setHTML(popupHtml('Solos',[["Classe",p.legenda],["Área informada",p['Área']?Number(p['Área']).toLocaleString('pt-BR',{maximumFractionDigits:2})+' km²':'—']])).addTo(map)});
}
async function addHidrografia(){
  const gj=await getData('hidrografia','data/hidrografia.geojson');if(!map.getSource('hidrografia')) map.addSource('hidrografia',{type:'geojson',data:gj});
  map.addLayer({id:'hidrografia-line',type:'line',source:'hidrografia',paint:{'line-color':'#2f7da0','line-width':['interpolate',['linear'],['zoom'],5,.45,9,1.3,13,2.2],'line-opacity':0.88}});
  map.addLayer({id:'hidrografia-label',type:'symbol',source:'hidrografia',minzoom:9,layout:{'symbol-placement':'line','text-field':['coalesce',['get','nome'],''],'text-size':10,'text-allow-overlap':false},paint:{'text-color':'#235d78','text-halo-color':'#ffffff','text-halo-width':1.2}});
  map.on('click','hidrografia-line',e=>{const p=e.features?.[0]?.properties||{};new maplibregl.Popup().setLngLat(e.lngLat).setHTML(popupHtml('Hidrografia',[["Nome",p.nome]])).addTo(map)});
}
async function addPotencialidades(){
  const gj=await getData('potencialidades','data/potencialidades.geojson');if(!map.getSource('potencialidades')) map.addSource('potencialidades',{type:'geojson',data:gj});
  map.addLayer({id:'potencialidades-circle',type:'circle',source:'potencialidades',paint:{'circle-radius':['interpolate',['linear'],['zoom'],5,4,10,7],'circle-color':'#d08a27','circle-stroke-color':'#ffffff','circle-stroke-width':1.5}});
  map.addLayer({id:'potencialidades-label',type:'symbol',source:'potencialidades',minzoom:8,layout:{'text-field':['get','Name'],'text-size':10,'text-offset':[0,1.25],'text-anchor':'top'},paint:{'text-color':'#6c4714','text-halo-color':'#ffffff','text-halo-width':1.2}});
  map.on('click','potencialidades-circle',e=>{const p=e.features?.[0]?.properties||{};new maplibregl.Popup().setLngLat(e.lngLat).setHTML(popupHtml('Potencialidade',[["Local",p.Name]])).addTo(map)});
}
async function addMapbiomas(){
  const year=Number(mapbiomasYear.value);
  const url=mapbiomasFile(year);
  if(!url) throw new Error(`Ano ${year} ainda não configurado.`);

  setLoading(true,`Carregando MapBiomas ${year}…`);
  mapbiomasStatus.textContent=`Verificando ${url}…`;
  const head=await fetch(url,{method:'HEAD'});
  if(!head.ok) throw new Error(`Arquivo ausente: ${url}`);

  currentMapbiomasUrl=url;
  MaplibreCOGProtocol.setColorFunction(url,(pixel,color,metadata)=>{
    const raw=Number(pixel?.[0]);
    if(!Number.isFinite(raw)||raw===0||raw===Number(metadata?.noData)){
      color.set([0,0,0,0]); return;
    }
    const code=Math.round(raw);
    const cls=mapbiomasClass(code);
    if(!cls){color.set([125,125,125,220]);return;}
    const [r,g,b]=hexToRgb(cls.color);
    color.set([r,g,b,232]);
  });

  if(!map.getSource('mapbiomas-source')){
    map.addSource('mapbiomas-source',{type:'raster',url:`cog://${url}`,tileSize:256});
  }
  if(!map.getLayer('mapbiomas-raster')){
    const before=firstBasemapLabelLayer();
    map.addLayer({
      id:'mapbiomas-raster',type:'raster',source:'mapbiomas-source',
      paint:{'raster-opacity':0.82,'raster-resampling':'nearest','raster-fade-duration':0}
    },before);
  }
  mapbiomasStatus.textContent=`MapBiomas ${year} • Coleção ${MAPBIOMAS_CONFIG.collection} • ${MAPBIOMAS_CONFIG.resolution}`;
  setLoading(false);
}
function removeMapbiomas(){
  if(map.getLayer('mapbiomas-raster')) map.removeLayer('mapbiomas-raster');
  if(map.getSource('mapbiomas-source')) map.removeSource('mapbiomas-source');
  currentMapbiomasUrl=null;
}
async function reloadMapbiomas(){removeMapbiomas();if(layerState.mapbiomas)await addMapbiomas();updateLegend()}

const adders={bacia:addBacia,municipios:addMunicipios,sedes:addSedes,geologia:addGeologia,solos:addSolos,hidrografia:addHidrografia,potencialidades:addPotencialidades,mapbiomas:addMapbiomas};
const ids={bacia:['bacia-fill','bacia-line'],municipios:['municipios-fill','municipios-line'],sedes:['sedes-circle','sedes-label'],geologia:['geologia-fill','geologia-line'],solos:['solos-fill','solos-line'],hidrografia:['hidrografia-line','hidrografia-label'],potencialidades:['potencialidades-circle','potencialidades-label'],mapbiomas:['mapbiomas-raster']};
function exists(key){return ids[key].some(id=>map.getLayer(id))}
async function setLayer(key,on){
  layerState[key]=on;
  try{
    if(on&&!exists(key)) await adders[key]();
    ids[key].forEach(id=>{if(map.getLayer(id))map.setLayoutProperty(id,'visibility',on?'visible':'none')});
    updateLegend();
  }catch(err){
    setLoading(false);console.error(err);
    layerState[key]=false;
    const input=document.querySelector(`input[data-layer="${key}"]`);if(input)input.checked=false;
    if(key==='mapbiomas') mapbiomasStatus.textContent='Raster ainda não foi enviado para data/rasters/.';
    alert(key==='mapbiomas'?'O arquivo MapBiomas ainda não está no GitHub. Exporte o COG e envie para data/rasters/mapbiomas_2024.tif.':'Não foi possível carregar esta camada.');
  }
}
function updateLegend(){
  let html='';
  if(layerState.mapbiomas){
    const year=mapbiomasYear.value;
    const items=MAPBIOMAS_CONFIG.legendIds.map(id=>[id,MAPBIOMAS_CONFIG.classes[id]]).filter(([,c])=>c);
    html+=`<div class="legend-title">Uso e cobertura — ${year}</div><span class="mapbiomas-chip">MapBiomas • Coleção ${MAPBIOMAS_CONFIG.collection}</span><details class="legend-details" open><summary>Classes</summary><div class="legend-list">${items.map(([id,c])=>`<div class="legend-item"><i class="swatch" style="background:${c.color}"></i><span>${c.name}${c.provisionalColor?' *':''}</span></div>`).join('')}</div></details><p class="legend-note">* A cor cinza da classe Usina Fotovoltaica é provisória até confirmarmos a paleta oficial da Coleção 10.1.</p>`;
  }
  if(layerState.geologia&&categoryColors.geologia){html+='<div class="legend-title">Geologia</div><div class="legend-list">'+categoryColors.geologia.map((v,i)=>`<div class="legend-item"><i class="swatch" style="background:${colorFor(v,i)}"></i><span>${v}</span></div>`).join('')+'</div>'}
  if(layerState.solos&&categoryColors.solos){html+='<div class="legend-title">Solos</div><div class="legend-list">'+categoryColors.solos.map((v,i)=>`<div class="legend-item"><i class="swatch" style="background:${colorFor(v,i)}"></i><span>${v}</span></div>`).join('')+'</div>'}
  if(layerState.hidrografia){html+='<div class="legend-title">Hidrografia</div><div class="legend-item"><i class="line-swatch" style="background:#2f7da0"></i><span>Cursos d\'água</span></div>'}
  legendContent.innerHTML=html;legendPanel.classList.toggle('hidden',!html);
}
async function fillMunicipioSelect(gj){
  const sel=document.getElementById('municipioSelect');if(sel.options.length>1)return;
  gj.features.slice().sort((a,b)=>a.properties.NM_MUN.localeCompare(b.properties.NM_MUN,'pt-BR')).forEach(f=>{const o=document.createElement('option');o.value=f.properties.CD_MUN;o.textContent=f.properties.NM_MUN;sel.appendChild(o)});
}
async function zoomMunicipio(){
  const code=document.getElementById('municipioSelect').value;if(!code)return;
  const gj=await getData('municipios','data/municipios_bacia.geojson');const f=gj.features.find(x=>String(x.properties.CD_MUN)===String(code));if(f)map.fitBounds(boundsFromGeoJSON({features:[f]}),{padding:70,duration:700});
}
async function rehydrate(){for(const [k,on] of Object.entries(layerState)){if(on) await adders[k]();}updateLegend()}

map.on('load',async()=>{await rehydrate();if(baciaBounds)map.fitBounds(baciaBounds,{padding:55,duration:900});const mun=await getData('municipios','data/municipios_bacia.geojson');fillMunicipioSelect(mun)});

// Consulta do valor bruto do COG no ponto clicado.
map.on('click',async e=>{
  if(!layerState.mapbiomas||!currentMapbiomasUrl)return;
  const vectorLayers=['sedes-circle','potencialidades-circle','hidrografia-line','municipios-fill','geologia-fill','solos-fill','bacia-fill'].filter(id=>map.getLayer(id));
  if(vectorLayers.length&&map.queryRenderedFeatures(e.point,{layers:vectorLayers}).length)return;
  try{
    const values=await MaplibreCOGProtocol.locationValues(currentMapbiomasUrl,{latitude:e.lngLat.lat,longitude:e.lngLat.lng},map.getZoom());
    const raw=Number(values?.[0]);if(!Number.isFinite(raw)||raw===0)return;
    const code=Math.round(raw);const cls=mapbiomasClass(code);
    new maplibregl.Popup().setLngLat(e.lngLat).setHTML(popupHtml('Uso e Cobertura da Terra',[["Ano",mapbiomasYear.value],["Classe",cls?.name||'Classe não cadastrada'],["Código",code],["Fonte",`MapBiomas • Coleção ${MAPBIOMAS_CONFIG.collection}`]])).addTo(map);
  }catch(err){console.warn('Falha ao consultar pixel MapBiomas:',err)}
});

document.querySelectorAll('input[data-layer]').forEach(el=>el.addEventListener('change',e=>setLayer(e.target.dataset.layer,e.target.checked)));
document.getElementById('menuBtn').addEventListener('click',()=>{sidebar.classList.toggle('closed');document.body.classList.toggle('sidebar-closed');setTimeout(()=>map.resize(),260)});
document.getElementById('homeBtn').addEventListener('click',()=>{if(baciaBounds)map.fitBounds(baciaBounds,{padding:55,duration:700})});
document.getElementById('zoomMunicipioBtn').addEventListener('click',zoomMunicipio);
document.getElementById('municipioSelect').addEventListener('keydown',e=>{if(e.key==='Enter')zoomMunicipio()});
mapbiomasYear.addEventListener('change',async()=>{try{if(layerState.mapbiomas)await reloadMapbiomas()}catch(err){console.error(err);setLayer('mapbiomas',false)}});
document.getElementById('basemapSelect').addEventListener('change',e=>{setLoading(true,'Trocando mapa-base…');map.setStyle(BASEMAPS[e.target.value]);map.once('style.load',async()=>{await rehydrate();setLoading(false)})});
