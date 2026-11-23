(() => {
'use strict';
const KEY = 'sun:settings:v1';
const app = document.getElementById('app');
const videoOrigin = location.hostname === 'appassets.androidplatform.net';
const catalog = new Map();
let films = [], trending = [], results = [], heroIndex = 0, tab = 'home', filter = 'Início';
let selected = null, detailTab = 'Episódios', query = '', searchSerial = 0, searchTimer, toastTimer, editing = false;
const feed = {popular:[],latest:[],dub:[],films:[]}, more = {}, pageOffsets = {};
let loadingFeed=true, feedError=false, remoteSearch=[], searchOffset=0, canSearchMore=false, searchProviderError=false, browseKey='popular', season='1', episodePage=0, detailError=false, loadingSeries=false;
let discovering = false, searchFailed = false, historyTab = false, homeScroll = 0;
const defaults = {saved:{},history:{},sources:{},theme:'dark'};
let prefs;
try {prefs = Object.assign({}, defaults, JSON.parse(localStorage.getItem(KEY) || '{}'));} catch {prefs = {...defaults};}
const name = m => m.name || m.title?.english || m.title?.romaji || 'Sem título';
const format = m => m.kind || (m.format === 'MOVIE' ? 'Filme' : 'Série');
const year = m => m.year || m.seasonYear || '';
const external = value => {try {const u = new URL(value);return u.protocol === 'https:' ? u.href : '';} catch {return '';}};
const cover = (m,wide=false) => films.find(f => f.id === m.id)?.cover || (wide && external(m.bannerImage)) || external(m.coverImage?.large) || external(m.bannerImage);
const subtitle = m => [m.genre || m.genres?.[0],year(m)].filter(Boolean).join(' · ');
const node = (id) => catalog.get(String(id)) || prefs.saved[id]?.media || prefs.history[id]?.media;
const art = (m,wide=false) => cover(m,wide) ? `<img class="art" src="${esc(cover(m,wide))}" alt="" loading="lazy">` : '<span class="art blank"></span>';
const btn = (action,label,symbol,attrs='') => `<button data-action="${action}" aria-label="${esc(label)}" title="${esc(label)}" ${attrs}>${icon(symbol,22)}</button>`;
const persist = () => localStorage.setItem(KEY,JSON.stringify(prefs));
function toast(message) {
  const out=document.getElementById('notice');out.textContent=message;out.classList.add('shown');
  clearTimeout(toastTimer);toastTimer=setTimeout(()=>out.classList.remove('shown'),2600);
}
function tracks(m) {
  if(m.provider==='fhd')return m.providerEpisodes||[];
  const original = films.find(f=>f.id===m.id);
  const eps = original ? [{id:'main',name:original.episode,streams:original.streams,subtitle:original.subtitle}] : [];
  const extras = Array.isArray(prefs.sources[m.id]) ? prefs.sources[m.id] : [];
  return eps.concat(extras.filter(e=>e && external(e.streams?.[0]?.url)));
}
function playable(m){return m.provider==='fhd'||tracks(m).length>0;}
function known(m){
  const old=catalog.get(String(m.id));
  if(old?.providerEpisodes&&!m.providerEpisodes)return old;
  catalog.set(String(m.id),m);return m;
}
function compact(m){const {providerEpisodes,...record}=m;return record;}
const feedNames={popular:'Populares',latest:'Lançamentos',dub:'Dublados',films:'Filmes'};
function showGrid(items){return '<div class="grid">'+items.map(m=>card(m)).join('')+'</div>';}
async function fetchFeed(key,append=false){
  const offset=append?(pageOffsets[key]||0):0;
  const rows=(await AnimeProvider.catalog(key,'',offset)).map(known);
  const existing=append?feed[key]:[], ids=new Set(existing.map(m=>m.id));
  const fresh=rows.filter(m=>!ids.has(m.id));
  feed[key]=existing.concat(fresh);pageOffsets[key]=offset+rows.length;
  more[key]=rows.length>0&&fresh.length>0;
}
async function loadFeeds(){
  const state=await Promise.allSettled(Object.keys(feed).map(k=>fetchFeed(k)));
  loadingFeed=false;feedError=state.every(r=>r.status==='rejected');
  if(!selected&&['home','browse'].includes(tab))render();
}
function browse(){
  return `<h1>Biblioteca de animes</h1><div class="filters">${Object.entries(feedNames).map(([k,label])=>`<button data-action="collection" data-value="${k}" class="${k===browseKey?'active':''}">${label}</button>`).join('')}</div>
      ${showGrid(feed[browseKey])}${more[browseKey]?'<button class="row" data-action="next-page">Carregar mais títulos</button>':''}
      ${feedError||!feed[browseKey].length?'<button class="text-btn" data-action="reload-feed">Atualizar catálogo</button>':''}`;
}
function feedRail(label,key){
  if(!feed[key].length)return '';
  return `<section><h2><button class="collection-link" data-action="collection" data-value="${key}">${label}<span>→</span></button></h2><div class="rail">${feed[key].slice(0,12).map(m=>card(m)).join('')}</div></section>`;
}
function card(m,wide=false,continuing=false) {
  const hist=prefs.history[m.id], ep=hist?.episodes?.[hist.lastEpisode];
  const progress=ep?.duration?Math.min(100,Math.round(100*ep.position/ep.duration)):0;
  return `<button class="card ${wide?'wide':''}" aria-label="${esc((continuing?'Continuar ':'Abrir ')+name(m))}" data-action="${continuing?'watch':'detail'}" data-id="${esc(m.id)}">
    <span class="picture">${art(m,wide)}${wide?`<i class="playover">${icon('play',18)}</i>`:''}</span>
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
  const selector=filter==='Filmes'?'films':filter==='Animes'?'latest':'popular';
  if(loadingFeed && !feed[selector].length)return '<p class="muted">Carregando a biblioteca de animes…</p><button class="row" data-action="nav" data-value="search">Buscar anime</button>';
  const featured=feed[selector].slice(0,5),pool=featured.length?featured:filtered(films);
  if(!pool.length)return '<p class="muted">Carregando o acervo…</p>';
  const i=heroIndex%pool.length,m=pool[i];
  const ongoing=recent().filter(m=>{const h=prefs.history[m.id];return playable(m)&&!h?.episodes?.[h.lastEpisode]?.ended;});
  return `<div class="filters">${['Início','Animes','Séries','Filmes'].map(f=>`<button class="${f===filter?'active':''}" data-action="filter" data-value="${f}">${f}</button>`).join('')}</div>
    <article class="hero">${art(m,true)}<div class="shade"></div><button class="hero-info" data-action="detail" data-id="${m.id}"><span>${esc(format(m))} · ${year(m)}</span><h1>${esc(name(m))}</h1><small>${esc(m.genre)} ${m.duration?' · '+Math.ceil(m.duration/60)+' min':''}</small></button>
    ${btn('watch','Assistir '+name(m),'play',`class="hero-play" data-id="${m.id}"`)}</article>
    <div class="dots">${pool.map((f,n)=>`<button aria-label="Destaque ${esc(name(f))}" class="${n===i?'current':''}" data-action="slide" data-value="${n}"></button>`).join('')}</div>
    ${rail('Continuar assistindo',ongoing,true,true)}
    <button class="catalog-entry" data-action="collection" data-value="popular">Biblioteca de animes <span>Explorar tudo →</span></button>
    ${feedError?'<button class="row" data-action="reload-feed">Catálogo online indisponível · tentar novamente</button>':''}
    ${feedRail('Animes populares','popular')}${feedRail('Lançamentos','latest')}${feedRail('Dublados em português','dub')}${feedRail('Filmes','films')}${rail('Cinema aberto',filtered(films),true)}
    ${filter==='Início'||filter==='Animes'?rail('Clássicos japoneses',films.filter(f=>f.year<1950)):''}`;
}
function search(){
  const local=films.filter(f=>name(f).toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()));
  const remote=query.trim()?results:trending;
  return `<h1>Buscar</h1><label class="searchbox">${icon('search')}<input autocomplete="off" id="search" aria-label="Pesquisar anime" type="search" placeholder="Anime, série ou filme" value="${esc(query)}"></label>
    ${remoteSearch.length&&query.trim()?`<h2>Episódios no Sun</h2>${showGrid(remoteSearch)}${canSearchMore?'<button class="row" data-action="search-more">Mais resultados</button>':''}`:''}
    ${!query.trim()?feedRail('Explorar a biblioteca','popular'):''}
    ${searchProviderError?'<p class="muted">A busca de episódios está indisponível. Tente novamente.</p>':''}
    ${local.length?`<h2>Cinema aberto</h2><div class="grid">${local.map(m=>card(m)).join('')}</div>`:''}
    ${remote.length?`<h2>${query?'No catálogo AniList':'Em alta no AniList'}</h2><div class="grid">${remote.map(m=>card(m)).join('')}</div>`:''}
    ${discovering?'<p class="muted">Buscando no AniList…</p>':searchFailed?'<p class="muted">O AniList está indisponível agora.</p>':query&&!remoteSearch.length&&!local.length&&!remote.length?'<p class="muted">Nenhum título encontrado.</p>':''}`;
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
  return `<h1>Perfil</h1><div class="identity"><img src="./cinema/morevna.jpg" alt=""><div><strong>Meu perfil</strong><small>Sun 0.3.0</small></div></div>
    <button class="row" data-action="theme">${icon('moon')} Tema ${prefs.theme==='light'?'claro':'escuro'}</button>
    <button class="row" data-action="export">${icon('download')} Exportar biblioteca</button>
    <button class="row" data-action="import">${icon('upload')} Importar biblioteca</button>
    <h2>Extras oficiais</h2>${OFFICIAL_EPISODES.map(v=>`<a class="row" href="https://www.youtube.com/watch?v=${v.id}">${esc(v.title)} ${icon('external',16)}</a>`).join('')}`;
}
const screens={home,search,browse,library,videos:toolsPage,profile};
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
  const isOnline=m.provider==='fhd';
  const seasons=[...new Set(eps.map(e=>String(e.season??1)))];
  if(!seasons.includes(season))season=seasons[0]||'1';
  const group=eps.map((e,i)=>({e,i})).filter(v=>!isOnline||String(v.e.season??1)===season);
  const per=30,visible=group.slice(episodePage*per,(episodePage+1)*per);
  const seasonNav=isOnline&&seasons.length>1?`<label class="season">Temporada <select data-role="season">${seasons.map(n=>`<option value="${esc(n)}" ${n===season?'selected':''}>${esc(n)}</option>`).join('')}</select></label>`:'';
  const pager=group.length>per?`<div class="page-buttons"><button data-action="ep-prev" ${episodePage===0?'disabled':''}>← Anterior</button><span>${episodePage+1} / ${Math.ceil(group.length/per)}</span><button data-action="ep-next" ${(episodePage+1)*per>=group.length?'disabled':''}>Próxima →</button></div>`:'';
  const shorts=(isOnline?feed.popular:films).filter(f=>f.id!==m.id).slice(0,4);
  return `<article class="detail"><div class="detail-art">${art(m,true)}<div class="shade"></div>${btn('back','Voltar','back','class="round back"')}</div>
    <div class="detail-body"><div class="detail-heading"><div class="poster">${art(m)}</div><div><h1>${esc(name(m))}</h1><div class="tags"><b>${esc(format(m))}</b>${year(m)?`<span>${year(m)}</span>`:''}</div></div></div>
    <div class="actions">${eps.length?`<button class="cta" data-action="watch" data-id="${esc(m.id)}">${icon('play',19)} ${history?.episodes?.[history.lastEpisode]?.position?'Continuar':'Assistir'}</button>`:`<button class="cta secondary" data-action="${isOnline?'retry-detail':'link'}">${isOnline?(loadingSeries?'Carregando episódios…':'Atualizar episódios'):icon('plus',18)+' Vincular episódio'}</button>`}${btn('save',saved?'Remover da lista':'Salvar na lista',saved?'check':'library',`class="round save" data-id="${esc(m.id)}"`)}</div>
    <p class="desc">${esc((m.desc||m.description||'').replace(/<[^>]*>/g,'').slice(0,420))}</p>
    <div class="tabs">${['Episódios','Detalhes','Relacionados'].map(t=>`<button data-action="pane" data-value="${t}" class="${t===detailTab?'selected':''}">${t}</button>`).join('')}</div>
    ${detailTab==='Episódios'?`${seasonNav}${visible.map(({e,i})=>`<button class="episode" aria-label="Assistir episódio ${esc(String(e.number??i+1))}" data-action="watch" data-id="${esc(m.id)}" data-index="${i}"><span class="thumb">${external(e.cover)?`<img class="art" src="${esc(external(e.cover))}" loading="lazy" alt="">`:art(m)}</span><span><strong>${esc(e.name)}</strong><small>${m.duration?Math.ceil(m.duration/60)+' min': 'Fonte de vídeo'}</small></span><i>${icon('play',16)}</i></button>`).join('')}
      ${pager}${isOnline?(detailError?'<button class="row" data-action="retry-detail">Falha ao carregar · Tentar novamente</button>':!eps.length&&!loadingSeries?'<p class="muted">O provedor ainda não publicou episódios para esta ficha.</p>':''):eps.length?'<button class="text-btn" data-action="link">+ Vincular outro episódio</button>':'<p class="muted">Este título tem ficha no AniList. Para assistir no Sun, vincule um link direto de vídeo.</p>'}${editing?sourceForm(true):''}`:
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
  const kind=filter==='Filmes'?'films':filter==='Animes'?'latest':'popular';
  const count=Math.min(5,feed[kind].length)||filtered(films).length;if(!count)return;heroIndex=(heroIndex+(delta<0?1:-1)+count)%count;render();
},{passive:true});
const fields='id title {romaji english} format seasonYear genres description(asHtml:false) coverImage {large} bannerImage trailer {id site} externalLinks {site url type}';
function updateSearch(){
  if(selected||tab!=='search')return;
  const active=document.activeElement, focused=active?.id==='search', caret=focused?active.selectionStart:0;
  render();
  if(focused){const input=document.getElementById('search');input.focus({preventScroll:true});input.setSelectionRange(caret,caret);}
}
async function discover(term=''){
  const seq=++searchSerial;
  const ctrl=new AbortController(), timer=setTimeout(()=>ctrl.abort(),10000);
  try {
    if(term){
      try {
        const group=await Promise.allSettled([AnimeProvider.catalog('popular',term),AnimeProvider.catalog('films',term)]);
        if(seq!==searchSerial)return;
        const primary=group[0].value||[];searchOffset=primary.length;canSearchMore=primary.length>=50;
        remoteSearch=[...new Map(group.flatMap(r=>r.value||[]).map(m=>[m.id,known(m)])).values()];
        searchProviderError=group.every(r=>r.status==='rejected');
        updateSearch();
      }catch{if(seq===searchSerial)searchProviderError=true;}
    }
    const q='query($search:String,$sort:[MediaSort]){Page(perPage:15){media(type:ANIME,isAdult:false,search:$search,sort:$sort){'+fields+'}}}';
    const r=await fetch('https://graphql.anilist.co',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({query:q,variables:{search:term||null,sort:[term?'SEARCH_MATCH':'TRENDING_DESC']}}),signal:ctrl.signal});
    if(!r.ok)throw Error(r.status);const data=await r.json();
    if(seq!==searchSerial)return;const rows=(data.data?.Page?.media||[]).map(known);
    if(term)results=rows;else trending=rows;searchFailed=false;
  }catch{if(seq===searchSerial)searchFailed=true;}finally{
    clearTimeout(timer);
    if(seq===searchSerial){discovering=false;updateSearch();}
  }
}
async function launch(m,index){
  if(m.provider==='fhd'&&!m.providerEpisodes){
    try{m=known(await AnimeProvider.detail(m));}catch{enter(m);return;}
  }
  const eps=tracks(m);
  if(!eps.length){selected=m;detailTab='Episódios';render();return;}
  const h=prefs.history[m.id]||{}, last=eps.findIndex(e=>e.id===h.lastEpisode);
  const chosen=Number.isInteger(index)?index:Math.max(0,last);
  const windowStart=m.provider==='fhd'?Math.floor(chosen/30)*30:0;
  const queue=m.provider==='fhd'?eps.slice(windowStart,windowStart+30):eps;
  const data={provider:m.provider||'',mediaType:m.type||'',id:String(m.id),title:name(m),series:format(m)==='Série',credit:[m.creator,m.license].filter(Boolean).join(' · '),index:chosen-windowStart,
    episodes:queue.map(e=>({id:e.id,name:e.name,streams:e.streams,subtitle:e.subtitle,position:h.episodes?.[e.id]?.position||0}))};
  if(videoOrigin)location.href='sun://play?data='+encodeURIComponent(JSON.stringify(data));
  else {let streams=eps[chosen].streams;if(m.provider==='fhd'){try{streams=(await AnimeProvider.stream(m,eps[chosen])).streams;}catch{streams=[];}}
    const url=external(streams?.[0]?.url);if(!url){toast('Fonte indisponível.');return;}
    const video=document.createElement('video');video.controls=true;video.autoplay=true;video.src=url;document.getElementById('preview').replaceChildren(video);document.getElementById('web-player').showModal();}
}
window.sunProgress=raw=>{
  const p=JSON.parse(raw),m=node(p.id);if(!m)return;
  const old=prefs.history[p.id]||{};
  prefs.history[p.id]={...old,media:compact(m),last:Date.now(),lastEpisode:p.last,episodes:{...old.episodes,...p.episodes}};persist();render();
};
async function enter(m){
  if(!m)return;if(!selected)homeScroll=window.scrollY;
  selected=m;editing=false;detailTab='Episódios';season='1';episodePage=0;detailError=false;
  loadingSeries=m.provider==='fhd'&&!m.providerEpisodes;render();window.scrollTo(0,0);
  if(!loadingSeries)return;
  try{const full=known(await AnimeProvider.detail(m));if(selected?.id===m.id)selected=full;}
  catch{if(selected?.id===m.id)detailError=true;}
  finally{if(selected?.id===m.id){loadingSeries=false;render();}}
}
app.addEventListener('click',e=>{
  const b=e.target.closest('[data-action]');if(!b)return;
  const {action,id,value,index}=b.dataset, m=id?node(id):selected;
  switch(action){
    case 'detail': case 'retry-detail':enter(m);return;
    case 'reload-feed':loadFeeds();return;
    case 'collection':browseKey=value;tab='browse';window.scrollTo(0,0);break;
    case 'next-page':b.disabled=true;fetchFeed(browseKey,true).then(render).catch(()=>{b.disabled=false;toast('Falha ao buscar mais títulos.');});return;
    case 'search-more':{const target=query.trim();b.disabled=true;AnimeProvider.catalog('popular',target,searchOffset).then(rows=>{
      if(target!==query.trim())return;const ids=new Set(remoteSearch.map(f=>f.id));const fresh=rows.filter(f=>!ids.has(f.id)).map(known);remoteSearch.push(...fresh);searchOffset+=rows.length;canSearchMore=rows.length>=50&&!!fresh.length;render();
    }).catch(()=>{b.disabled=false;toast('Não foi possível carregar a próxima página.');});return;}
    case 'ep-next':episodePage++;break;
    case 'ep-prev':episodePage=Math.max(0,episodePage-1);break;
    case 'watch':if(m)launch(m,index===undefined?null:Number(index));return;
    case 'nav':selected=null;editing=false;tab=value;window.scrollTo(0,0);break;
    case 'back':back();return;
    case 'filter':filter=value;heroIndex=0;break;
    case 'slide':heroIndex=Number(value);break;
    case 'pane':detailTab=value;editing=false;break;
    case 'save':if(prefs.saved[id])delete prefs.saved[id];else prefs.saved[id]={media:compact(m),added:Date.now()};persist();break;
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
app.addEventListener('change',e=>{if(e.target.dataset.role==='season'){season=e.target.value;episodePage=0;render();}});
app.addEventListener('input',e=>{
  if(e.target.id!=='search')return;
  query=e.target.value;results=[];remoteSearch=[];searchProviderError=false;canSearchMore=false;searchFailed=false;discovering=!!query.trim();++searchSerial;clearTimeout(searchTimer);
  searchTimer=setTimeout(()=>discover(query.trim()),320);
});
app.addEventListener('submit',e=>{
  e.preventDefault();const url=external(document.getElementById('link-url').value.trim()), title=document.getElementById('link-name').value.trim();
  if(!url || !title){toast('Informe um título e um link HTTPS de vídeo.');return;}
  const ep={id:'link-'+Date.now(),name:title,streams:[{quality:'Original',url}]};
  const m=selected||known({id:'personal-'+Date.now(),name:title,kind:'Vídeo'});
  prefs.sources[m.id]=[...(prefs.sources[m.id]||[]),ep];
  if(!selected)prefs.saved[m.id]={media:compact(m),added:Date.now()};
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
  render();loadFeeds();discover();
}
start();
})();
