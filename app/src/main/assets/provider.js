/* Public Stremio protocol. Catalog and metadata can be cached; video URLs are resolved at play time. */
const AnimeProvider = (() => {
  const base = location.hostname === 'appassets.androidplatform.net' ? '/sun-api' : 'https://animesfhd.net/stremio';
  const catalogs = {popular:['series','afhd-populares'],latest:['series','afhd-lancamentos'],dub:['series','afhd-dublados'],films:['movie','afhd-filmes']};
  const cache = new Map();
  const id = s => encodeURIComponent(String(s));
  async function json(path) {
    if(cache.has(path))return cache.get(path);
    const ctrl = new AbortController();
    const timeout = setTimeout(()=>ctrl.abort(),22000);
    const promise = fetch(base+path,{signal:ctrl.signal}).then(async r=>{
      if(!r.ok)throw new Error('Catálogo indisponível');
      return r.json();
    });
    if(!path.startsWith('/stream/')){
      if(cache.size>=45)cache.delete(cache.keys().next().value);
      cache.set(path,promise);
    }
    try{return await promise;}catch(e){cache.delete(path);throw e;}finally{clearTimeout(timeout);}
  }
  function item(raw,type){
    return {id:'fhd:'+type+':'+raw.id,provider:'fhd',type,remoteId:raw.id,name:raw.name||raw.id,
      kind:type==='movie'?'Filme':'Série',year:String(raw.releaseInfo||raw.year||'').slice(0,4),genre:(raw.genres||[])[0]||'Anime',
      bannerImage:raw.background||raw.poster,coverImage:{large:raw.poster||raw.background},description:raw.description||''};
  }
  function catalog(key,query='',skip=0){
    const [type,collection]=catalogs[key];const extras=[];
    const aliases={'attack on titan':'Shingeki no Kyojin','ataque dos titãs':'Shingeki no Kyojin','demon slayer':'Kimetsu no Yaiba','jujutsu kaisen':'Jujutsu Kaisen','my hero academia':'Boku no Hero Academia'};
    const search=aliases[query.trim().toLocaleLowerCase()]||query.trim();
    if(search)extras.push('search='+id(search));
    if(skip)extras.push('skip='+Number(skip));
    const suffix=extras.length?'/'+extras.join('&'):'';
    return json('/catalog/'+type+'/'+collection+suffix+'.json').then(data=>(data.metas||[]).filter(m=>m.id&&m.name&&!m.behaviorHints?.isAdult).map(m=>item(m,type)));
  }
  function detail(m){
    return json('/meta/'+m.type+'/'+id(m.remoteId)+'.json').then(data=>{
      if(!data.meta)throw new Error('Ficha indisponível');
      const meta=data.meta, unique=new Set(), eps=[];
      for(const v of meta.videos||[]){
        if(!v.id||unique.has(v.id))continue;unique.add(v.id);
        const season=Number(v.season??1), number=Number(v.episode??v.number??(eps.length+1));
        const title=v.title||v.name||'';
        eps.push({id:String(v.id),name:title&&title!==m.name?'E'+number+' · '+title:'Episódio '+number,
          number,season,cover:v.thumbnail||''});
      }
      if(!eps.length&&m.type==='movie')eps.push({id:String(meta.id),name:'Filme completo',number:1,season:1});
      eps.sort((a,b)=>a.season-b.season||a.number-b.number);
      return {...m,...item({...meta,poster:meta.poster||m.coverImage?.large,background:meta.background||m.bannerImage},m.type),providerEpisodes:eps};
    });
  }
  return {catalog,detail,stream:(m,e)=>json('/stream/'+m.type+'/'+id(e.id)+'.json')};
})();
