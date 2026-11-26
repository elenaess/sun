/* Sun 0.4: extensible Stremio JSON manifests, without embedded web-player or provider login. */
const AnimeProvider = (() => {
  const local = location.hostname === 'appassets.androidplatform.net';
  const base = local ? '/sun-api' : 'https://animesfhd.net/stremio';
  const catalogs = {popular:['series','afhd-populares'], latest:['series','afhd-lancamentos'], dub:['series','afhd-dublados'], films:['movie','afhd-filmes']};
  const cache = new Map();
  const id = text => encodeURIComponent(String(text));
  let sourcePromise;
  function clearCache(){cache.clear();sourcePromise=null;}
  function safeIndex(num){const v=Number(num);return Number.isInteger(v)&&v>=1&&v<=18?v:null;}
  async function json(path){
    if(cache.has(path))return cache.get(path);
    const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),18000);
    const promise=fetch(base+path,{signal:controller.signal}).then(async r=>{
      if(!r.ok)throw new Error('Fonte indisponível: '+r.status);
      return r.json();
    });
    if(!path.includes('/stream/')){
      if(cache.size>55)cache.delete(cache.keys().next().value);
      cache.set(path,promise);
    }
    try{return await promise;}catch(e){cache.delete(path);throw e;}finally{clearTimeout(timer);}
  }
  async function sources(){
    if(!local)return [];
    if(!sourcePromise)sourcePromise=json('/providers.json').then(d=>(d.plugins||[]).filter(p=>safeIndex(p.index))).catch(()=>[]);
    return sourcePromise;
  }
  function rawToItem(raw,type,index=0){
    return {id:index?'plug'+index+':'+type+':'+raw.id:'fhd:'+type+':'+raw.id,
      provider:index?'plugin':'fhd',sourceIndex:index,type,remoteId:raw.id,name:raw.name||raw.id,
      kind:type==='movie'?'Filme':'Série',year:String(raw.releaseInfo||raw.year||'').slice(0,4),
      genre:(raw.genres||[])[0]||'Anime',bannerImage:raw.background||raw.poster,
      coverImage:{large:raw.poster||raw.background},description:raw.description||''};
  }
  function extraPath(query,skip){
    let extras=[];if(query)extras.push('search='+id(query));if(skip)extras.push('skip='+Number(skip));
    return extras.length?'/'+extras.join('&'):'';
  }
  async function primaryCatalog(key,term,skip){
    const [type,collection]=catalogs[key];
    const aliases={'attack on titan':'Shingeki no Kyojin','ataque dos titãs':'Shingeki no Kyojin',
      'demon slayer':'Kimetsu no Yaiba','jujutsu kaisen':'Jujutsu Kaisen','my hero academia':'Boku no Hero Academia'};
    const search=aliases[term.toLocaleLowerCase()]||term;
    const response=await json('/catalog/'+type+'/'+collection+extraPath(search,skip)+'.json');
    return (response.metas||[]).filter(m=>m.id&&m.name&&!m.behaviorHints?.isAdult&&!m.isAdult).map(m=>rawToItem(m,type));
  }
  function supportsSearch(c){return (c.extra||[]).some(x=>x.name==='search');}
  async function extraCatalog(source,key,term,skip){
    const type=key==='films'?'movie':'series';
    const candidates=(source.catalogs||[]).filter(c=>c.type===type&&c.id&&(!term||supportsSearch(c)));
    if(!candidates.length)return [];
    // Search each distinct searchable catalog, rather than only the first one.
    // Keep browsing limited to one catalog to avoid excessive background requests.
    const entries=term?[...new Map(candidates.map(c=>[c.id,c])).values()]:candidates.slice(0,1);
    const settled=await Promise.allSettled(entries.map(async entry=>{
      const route='/plugin/'+source.index+'/catalog/'+type+'/'+id(entry.id)+extraPath(term,skip)+'.json';
      const response=await json(route);
      return (response.metas||[]).filter(m=>m.id&&m.name&&!m.behaviorHints?.isAdult&&!m.isAdult)
        .map(m=>rawToItem(m,type,source.index));
    }));
    if(settled.every(r=>r.status==='rejected'))throw new Error('Catálogos indisponíveis');
    return [...new Map(settled.flatMap(r=>r.status==='fulfilled'?r.value:[]).map(m=>[m.id,m])).values()];
  }
  async function catalog(key,query='',skip=0){
    if(!catalogs[key])return [];
    const term=query.trim(),plugins=await sources();
    // Busca também vídeos com licença aberta, sem depender do provedor principal.
    const tasks=[primaryCatalog(key,term,skip),...plugins.map(p=>extraCatalog(p,key,term,skip)),
      ...((key==='films'||key==='popular')?[OpenMedia.search(term,skip),OpenArchive.search(term,skip)]:[])];
    const settled=await Promise.allSettled(tasks),rows=[];
    for(const result of settled)if(result.status==='fulfilled')rows.push(...result.value);
    if(!rows.length&&settled.every(s=>s.status==='rejected'))throw new Error('Nenhum provedor disponível');
    return [...new Map(rows.map(x=>[x.id,x])).values()];
  }
  async function detail(m){
    if(m.provider==='open')return m;
    const index=m.provider==='plugin'?safeIndex(m.sourceIndex):null;
    if(m.provider==='plugin'&&!index)throw new Error('Plugin desconhecido');
    const route=(index?'/plugin/'+index:'')+'/meta/'+m.type+'/'+id(m.remoteId)+'.json';
    const response=await json(route);
    if(!response.meta)throw new Error('Ficha não disponível');
    const meta=response.meta,unique=new Set(),eps=[];
    if(meta.isAdult||meta.behaviorHints?.isAdult)throw new Error('Conteúdo indisponível');
    for(const v of meta.videos||[]){
      if(!v.id||unique.has(v.id))continue;unique.add(v.id);
      const season=Number(v.season??1),number=Number(v.episode??v.number??(eps.length+1));
      const title=v.title||v.name||'';
      eps.push({id:String(v.id),name:title&&title!==m.name?'E'+number+' · '+title:'Episódio '+number,
        season,number,cover:v.thumbnail||''});
    }
    if(!eps.length&&m.type==='movie')eps.push({id:String(meta.id),name:'Filme completo',number:1,season:1});
    eps.sort((a,b)=>a.season-b.season||a.number-b.number);
    return {...m,...rawToItem({...meta,poster:meta.poster||m.coverImage?.large,
      background:meta.background||m.bannerImage},m.type,index||0),providerEpisodes:eps};
  }
  function stream(m,e){
    const index=m.provider==='plugin'?safeIndex(m.sourceIndex):0;
    return json((index?'/plugin/'+index:'')+'/stream/'+m.type+'/'+id(e.id)+'.json');
  }
  return {catalog,detail,stream,sources,clearCache};
})();
