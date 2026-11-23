(() => {
'use strict';
const KEY = 'sun:settings:v1';
const app = document.getElementById('app');
const videoOrigin = location.hostname === 'appassets.androidplatform.net';
const catalog = new Map();
let films = [], trending = [], results = [], heroIndex = 0, tab = 'home', filter = 'Início';
let selected = null, detailTab = 'Episódios', query = '', searchSerial = 0, searchTimer, toastTimer, editing = false;
let discovering = false, searchFailed = false, historyTab = false, homeScroll = 0;
const defaults = {saved:{},history:{},sources:{},theme:'dark'};
let prefs;
try {prefs = Object.assign({}, defaults, JSON.parse(localStorage.getItem(KEY) || '{}'));} catch {prefs = {...defaults};}
const name = m => m.name || m.title?.english || m.title?.romaji || 'Sem título';
const format = m => m.kind || (m.format === 'MOVIE' ? 'Filme' : 'Série');
const year = m => m.year || m.seasonYear || '';
const external = value => {try {const u = new URL(value);return u.protocol === 'https:' ? u.href : '';} catch {return '';}};
const cover = m => films.find(f => f.id === m.id)?.cover || external(m.bannerImage) || external(m.coverImage?.large);
const subtitle = m => [m.genre || m.genres?.[0],year(m)].filter(Boolean).join(' · ');
const node = (id) => catalog.get(String(id)) || prefs.saved[id]?.media || prefs.history[id]?.media;
const art = m => cover(m) ? `<img class="art" src="${esc(cover(m))}" alt="" loading="lazy">` : '<span class="art blank"></span>';
const btn = (action,label,symbol,attrs='') => `<button data-action="${action}" aria-label="${esc(label)}" title="${esc(label)}" ${attrs}>${icon(symbol,22)}</button>`;
const persist = () => localStorage.setItem(KEY,JSON.stringify(prefs));
function toast(message) {
  const out=document.getElementById('notice');out.textContent=message;out.classList.add('shown');
  clearTimeout(toastTimer);toastTimer=setTimeout(()=>out.classList.remove('shown'),2600);
}
function tracks(m) {
  const original = films.find(f=>f.id===m.id);
  const eps = original ? [{id:'main',name:original.episode,streams:original.streams,subtitle:original.subtitle}] : [];
  const extras = Array.isArray(prefs.sources[m.id]) ? prefs.sources[m.id] : [];
  return eps.concat(extras.filter(e=>e && external(e.streams?.[0]?.url)));
}
function playable(m){return tracks(m).length>0;}
function known(m){catalog.set(String(m.id),m);return m;}
function card(m,wide=false,continuing=false) {
  const hist=prefs.history[m.id], ep=hist?.episodes?.[hist.lastEpisode];
  const progress=ep?.duration?Math.min(100,Math.round(100*ep.position/ep.duration)):0;
  return `<button class="card ${wide?'wide':''}" data-action="${continuing?'watch':'detail'}" data-id="${esc(m.id)}">
    <span class="picture">${art(m)}${wide?`<i class="playover">${icon('play',18)}</i>`:''}</span>
    <strong>${esc(name(m))}</strong><small>${esc(continuing && ep?.position ? Math.max(1,Math.ceil((ep.duration-ep.position)/60000))+' min restantes' : subtitle(m) || format(m))}</small>
    ${continuing?`<span class="track"><i style="width:${progress}%"></i></span>`:''}</button>`;
}
function rail(label,items,wide=false,continuing=false) {
  if(!items.length)return '';
  return `<section><h2>${label}</h2><div class="rail">${items.map(m=>card(m,wide,continuing)).join('')}</div></section>`;
}
function filtered(items) {
  if(filter==='Séries')return items.filter(m=>format(m)==='Série');
  if(filter==='Filmes')return items.filter(m=>format(m)==='Filme');
  return items;
}
function recent() {
  return Object.values(prefs.history).sort((a,b)=>b.last-a.last).map(h=>h.media && (node(h.media.id)||h.media)).filter(Boolean);
}
function home(){
  const pool=filtered(films);
  if(!pool.length)return '<p class="muted">Carregando o acervo…</p>';
  const i=heroIndex%pool.length,m=pool[i];
  const ongoing=recent().filter(m=>{const h=prefs.history[m.id];return playable(m)&&!h?.episodes?.[h.lastEpisode]?.ended;});
  return `<div class="filters">${['Início','Animes','Séries','Filmes'].map(f=>`<button class="${f===filter?'active':''}" data-action="filter" data-value="${f}">${f}</button>`).join('')}</div>
    <article class="hero">${art(m)}<div class="shade"></div><button class="hero-info" data-action="detail" data-id="${m.id}"><span>${esc(format(m))} · ${year(m)}</span><h1>${esc(name(m))}</h1><small>${esc(m.genre)} · ${Math.ceil(m.duration/60)} min</small></button>
    ${btn('watch','Assistir '+name(m),'play',`class="hero-play" data-id="${m.id}"`)}</article>
    <div class="dots">${pool.map((f,n)=>`<button aria-label="Destaque ${esc(name(f))}" class="${n===i?'current':''}" data-action="slide" data-value="${n}"></button>`).join('')}</div>
    ${rail('Continuar assistindo',ongoing,true,true)}
    ${rail('Assistir no Sun',pool,true)}
    ${rail('Em alta no AniList',filtered(trending).slice(0,12))}
    ${filter==='Início'||filter==='Animes'?rail('Clássicos japoneses',films.filter(f=>f.year<1950)):''}`;
}
function search(){
  const local=films.filter(f=>name(f).toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()));
  const remote=query.trim()?results:trending;
  return `<h1>Buscar</h1><label class="searchbox">${icon('search')}<input autocomplete="off" id="search" type="search" placeholder="Anime, série ou filme" value="${esc(query)}"></label>
    ${local.length?`<h2>Assistir no Sun</h2><div class="grid">${local.map(m=>card(m)).join('')}</div>`:''}
    ${remote.length?`<h2>${query?'No catálogo AniList':'Em alta no AniList'}</h2><div class="grid">${remote.map(m=>card(m)).join('')}</div>`:''}
    ${discovering?'<p class="muted">Buscando no AniList…</p>':searchFailed?'<p class="muted">O AniList está indisponível agora.</p>':query&&!local.length&&!remote.length?'<p class="muted">Nenhum título encontrado.</p>':''}`;
}
function library(){
  const items=historyTab?recent():Object.values(prefs.saved).map(a=>a.media&&(node(a.media.id)||a.media)).filter(Boolean);
  return `<h1>Biblioteca</h1><div class="filters"><button data-action="saved" class="${historyTab?'':'active'}">Minha lista</button><button data-action="recent" class="${historyTab?'active':''}">Recentes</button></div>
    ${items.length?`<div class="grid">${items.map(m=>card(m)).join('')}</div>`:`<p class="empty">${historyTab?'Os vídeos que você assistir aparecem aqui.':'Toque no marcador de um título para guardar na sua lista.'}</p>`}`;
}
function toolsPage(){
  return `<h1>Meus vídeos</h1><button class="row" data-action="file">${icon('film')} Abrir arquivo do celular</button>
    <button class="row" data-action="link">${icon('plus')} Abrir link de vídeo</button>${editing?sourceForm(false):''}`;
}
function profile(){
  return `<h1>Perfil</h1><div class="identity"><img src="./cinema/morevna.jpg" alt=""><div><strong>Meu perfil</strong><small>Sun 0.2.0</small></div></div>
    <button class="row" data-action="theme">${icon('moon')} Tema ${prefs.theme==='light'?'claro':'escuro'}</button>
    <button class="row" data-action="export">${icon('download')} Exportar biblioteca</button>
    <button class="row" data-action="import">${icon('upload')} Importar biblioteca</button>
    <h2>Extras oficiais</h2>${OFFICIAL_EPISODES.map(v=>`<a class="row" href="https://www.youtube.com/watch?v=${v.id}">${esc(v.title)} ${icon('external',16)}</a>`).join('')}`;
}
const screens={home,search,library,videos:toolsPage,profile};
function nav(){
  return `<nav aria-label="Navegação principal">${[['home','Início','home'],['search','Buscar','search'],['videos','Meus vídeos','tv'],['library','Biblioteca','library'],['profile','Perfil','user']].map(([k,label,ic])=>
    `<button data-action="nav" data-value="${k}" aria-label="${label}" title="${label}" class="${tab===k?'here':''}">${k==='profile'?'<img class="avatar" src="./cinema/morevna.jpg" alt="">':icon(ic)}<span>${label}</span></button>`).join('')}</nav>`;
}
function sourceForm(named){
  return `<form id="source-form"><label>${named?'Nome do episódio':'Nome do vídeo'}<input id="link-name" required maxlength="120" placeholder="${named?'Ex. Episódio 1':'Meu vídeo'}"></label><label>Link direto HTTPS<input id="link-url" required type="url" placeholder="https://…/video.mp4 ou lista.m3u8"></label><button class="cta">${named?'Salvar episódio':'Reproduzir'}</button></form>`;
}
function detail(m){
  const eps=tracks(m), saved=!!prefs.saved[m.id], history=prefs.history[m.id];
  const source=external(m.source), license=external(m.licenseUrl);
  const links=(Array.isArray(m.externalLinks)?m.externalLinks:[]).filter(l=>external(l.url)&&l.type==='STREAMING').slice(0,5);
  const shorts=films.filter(f=>f.id!==m.id).slice(0,4);
  return `<article class="detail"><div class="detail-art">${art(m)}<div class="shade"></div>${btn('back','Voltar','back','class="round back"')}</div>
    <div class="detail-body"><div class="detail-heading"><div class="poster">${art(m)}</div><div><h1>${esc(name(m))}</h1><div class="tags"><b>${esc(format(m))}</b>${year(m)?`<span>${year(m)}</span>`:''}</div></div></div>
    <div class="actions">${eps.length?`<button class="cta" data-action="watch" data-id="${esc(m.id)}">${icon('play',19)} ${history?.episodes?.[history.lastEpisode]?.position?'Continuar':'Assistir'}</button>`:`<button class="cta secondary" data-action="link">${icon('plus',18)} Vincular episódio</button>`}${btn('save',saved?'Remover da lista':'Salvar na lista',saved?'check':'library',`class="round save" data-id="${esc(m.id)}"`)}</div>
    <p class="desc">${esc((m.desc||m.description||'').replace(/<[^>]*>/g,'').slice(0,420))}</p>
    <div class="tabs">${['Episódios','Detalhes','Relacionados'].map(t=>`<button data-action="pane" data-value="${t}" class="${t===detailTab?'selected':''}">${t}</button>`).join('')}</div>
    ${detailTab==='Episódios'?`${eps.map((e,i)=>`<button class="episode" data-action="watch" data-id="${esc(m.id)}" data-index="${i}"><span class="thumb">${art(m)}</span><span><strong>${esc(e.name)}</strong><small>${m.duration?Math.ceil(m.duration/60)+' min': 'Fonte de vídeo'}</small></span><i>${icon('play',16)}</i></button>`).join('')}
      ${eps.length?'<button class="text-btn" data-action="link">+ Vincular outro episódio</button>':'<p class="muted">Este título tem ficha no AniList. Para assistir no Sun, vincule um link direto de vídeo.</p>'}${editing?sourceForm(true):''}`:
      detailTab==='Detalhes'?`<h2>Sobre o título</h2><p>${esc(subtitle(m))}</p>${m.creator?`<p>${esc(m.creator)} · ${esc(m.license)}</p>`:''}
       ${source?`<a class="row" href="${esc(source)}">Ficha da fonte ${icon('external',16)}</a>`:''}${license?`<a class="row" href="${esc(license)}">Licença da obra ${icon('external',16)}</a>`:''}
       ${m.trailer?.site?.toLowerCase()==='youtube'&&/^[\w-]{11}$/.test(m.trailer.id)?`<a class="row" href="https://www.youtube.com/watch?v=${esc(m.trailer.id)}">Trailer no YouTube</a>`:''}
       ${links.map(l=>`<a class="row" href="${esc(external(l.url))}">${esc(l.site)} ${icon('external',16)}</a>`).join('')}`:
      `<div class="grid">${shorts.map(f=>card(f)).join('')}</div>`}</div></article>`;
}
function render(){
  document.documentElement.dataset.theme=prefs.theme==='light'?'light':'dark';
  app.innerHTML=selected?detail(selected):`<div class="frame"><header><button aria-label="Início" data-action="nav" data-value="home"><img class="symbol" src="./symbol.png" alt="Sun"></button><div></div>${btn('nav','Buscar','search','data-value="search"')}${btn('recent','Histórico','clock')}<button data-action="nav" data-value="profile" aria-label="Perfil"><img class="avatar" src="./cinema/morevna.jpg" alt=""></button></header><main>${screens[tab]()}</main>${nav()}</div>`;
}
function back(){
  if(editing){editing=false;render();return true;}
  if(selected){selected=null;render();window.scrollTo(0,homeScroll);return true;}
  if(tab!=='home'){tab='home';render();window.scrollTo(0,0);return true;}
  return false;
}
window.sunBack=back;
let swipeStart=null;
app.addEventListener('touchstart',e=>{swipeStart=e.target.closest('.hero')?e.touches[0].clientX:null;},{passive:true});
app.addEventListener('touchend',e=>{
  if(swipeStart===null)return;
  const delta=e.changedTouches[0].clientX-swipeStart;
  swipeStart=null;
  if(Math.abs(delta)<55)return;
  const count=filtered(films).length;heroIndex=(heroIndex+(delta<0?1:-1)+count)%count;render();
},{passive:true});
const fields='id title {romaji english} format seasonYear genres description(asHtml:false) coverImage {large} bannerImage trailer {id site} externalLinks {site url type}';
async function discover(term=''){
  const seq=++searchSerial;
  const ctrl=new AbortController(), timer=setTimeout(()=>ctrl.abort(),10000);
  try {
    const q='query($search:String,$sort:[MediaSort]){Page(perPage:15){media(type:ANIME,isAdult:false,search:$search,sort:$sort){'+fields+'}}}';
    const r=await fetch('https://graphql.anilist.co',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({query:q,variables:{search:term||null,sort:[term?'SEARCH_MATCH':'TRENDING_DESC']}}),signal:ctrl.signal});
    if(!r.ok)throw Error(r.status);const data=await r.json();
    if(seq!==searchSerial)return;const rows=(data.data?.Page?.media||[]).map(known);
    if(term)results=rows;else trending=rows;searchFailed=false;
  }catch{if(seq===searchSerial)searchFailed=true;}finally{
    clearTimeout(timer);
    if(seq===searchSerial){discovering=false;if(!selected&&(tab==='home'||tab==='search')){const focus=document.activeElement?.id==='search';const caret=focus?document.activeElement.selectionStart:0;render();if(focus){const input=document.getElementById('search');input.focus();input.setSelectionRange(caret,caret);}}}
  }
}
function launch(m,index){
  const eps=tracks(m);
  if(!eps.length){selected=m;detailTab='Episódios';render();return;}
  const h=prefs.history[m.id]||{}, last=eps.findIndex(e=>e.id===h.lastEpisode);
  const chosen=Number.isInteger(index)?index:Math.max(0,last);
  const data={id:String(m.id),title:name(m),series:format(m)==='Série',credit:[m.creator,m.license].filter(Boolean).join(' · '),index:chosen,
    episodes:eps.map(e=>({...e,position:h.episodes?.[e.id]?.position||0}))};
  if(videoOrigin)location.href='sun://play?data='+encodeURIComponent(JSON.stringify(data));
  else {const video=document.createElement('video');video.controls=true;video.autoplay=true;video.src=eps[chosen].streams[0].url;document.getElementById('preview').replaceChildren(video);document.getElementById('web-player').showModal();}
}
window.sunProgress=raw=>{
  const p=JSON.parse(raw),m=node(p.id);if(!m)return;
  const old=prefs.history[p.id]||{};
  prefs.history[p.id]={...old,media:m,last:Date.now(),lastEpisode:p.last,episodes:{...old.episodes,...p.episodes}};persist();render();
};
function enter(m){if(!m)return;if(!selected)homeScroll=window.scrollY;selected=m;editing=false;detailTab='Episódios';render();window.scrollTo(0,0);}
app.addEventListener('click',e=>{
  const b=e.target.closest('[data-action]');if(!b)return;
  const {action,id,value,index}=b.dataset, m=id?node(id):selected;
  switch(action){
    case 'detail':enter(m);return;
    case 'watch':if(m)launch(m,index===undefined?null:Number(index));return;
    case 'nav':selected=null;editing=false;tab=value;window.scrollTo(0,0);break;
    case 'back':back();return;
    case 'filter':filter=value;heroIndex=0;break;
    case 'slide':heroIndex=Number(value);break;
    case 'pane':detailTab=value;editing=false;break;
    case 'save':if(prefs.saved[id])delete prefs.saved[id];else prefs.saved[id]={media:m,added:Date.now()};persist();break;
    case 'saved':case 'recent':tab='library';historyTab=action==='recent';break;
    case 'theme':prefs.theme=prefs.theme==='light'?'dark':'light';persist();break;
    case 'file':if(videoOrigin)location.href='sun://file';else document.getElementById('localVideo').click();return;
    case 'link':editing=!editing;detailTab='Episódios';break;
    case 'import':document.getElementById('importData').click();return;
    case 'export':if(videoOrigin)location.href='sun://export?data='+encodeURIComponent(JSON.stringify(prefs));return;
    default:return;
  }
  render();if(editing)document.getElementById('source-form')?.scrollIntoView({block:'nearest'});
});
app.addEventListener('input',e=>{
  if(e.target.id!=='search')return;
  query=e.target.value;results=[];searchFailed=false;discovering=!!query.trim();++searchSerial;clearTimeout(searchTimer);
  searchTimer=setTimeout(()=>discover(query.trim()),320);
});
app.addEventListener('submit',e=>{
  e.preventDefault();const url=external(document.getElementById('link-url').value.trim()), title=document.getElementById('link-name').value.trim();
  if(!url || !title){toast('Informe um título e um link HTTPS de vídeo.');return;}
  const ep={id:'link-'+Date.now(),name:title,streams:[{quality:'Original',url}]};
  const m=selected||known({id:'personal-'+Date.now(),name:title,kind:'Vídeo'});
  prefs.sources[m.id]=[...(prefs.sources[m.id]||[]),ep];
  if(!selected)prefs.saved[m.id]={media:m,added:Date.now()};
  persist();editing=false;render();if(!selected)launch(m,0);else toast('Episódio vinculado.');
});
document.getElementById('importData').addEventListener('change',async e=>{
  try{const file=e.target.files[0];if(!file)return;if(file.size>5000000)throw Error();const p=JSON.parse(await file.text());
    if(!p.saved||typeof p.saved!=='object'||!p.history||typeof p.history!=='object')throw Error();
    prefs={saved:p.saved,history:p.history,sources:p.sources||{},theme:p.theme==='light'?'light':'dark'};persist();render();toast('Biblioteca restaurada.');}
  catch{toast('Não foi possível restaurar esse arquivo.');}e.target.value='';
});
document.getElementById('close-preview').onclick=()=>{document.getElementById('preview').replaceChildren();document.getElementById('web-player').close();};
document.getElementById('localVideo').onchange=e=>{const file=e.target.files[0];if(!file)return;const v=document.createElement('video');v.src=URL.createObjectURL(file);v.autoplay=true;v.controls=true;document.getElementById('preview').replaceChildren(v);document.getElementById('web-player').showModal();};
document.addEventListener('keydown',e=>{if(e.key==='Escape')back();});
async function start(){
  try {const response=await fetch('./cinema/catalog.json');films=(await response.json()).map(known);}
  catch{app.innerHTML='<p class="empty">Não foi possível abrir o acervo do Sun.</p>';return;}
  render();discover();
}
start();
})();
