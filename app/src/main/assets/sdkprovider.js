/* Bridge to a configured, authorized anime-sdk compatible HTTPS API.
 * No third-party stream sources or scrapers are embedded in the Android APK.
 */
const SdkProvider = (() => {
  const native = location.hostname === 'appassets.androidplatform.net';
  const root = '/sun-api/sdk';
  let providersPromise = null;
  const encode = value => encodeURIComponent(String(value));
  const validId = id => /^[a-z0-9_-]{1,40}$/.test(id);
  const validUrl = url => {try{let v=new URL(url);return v.protocol==='https:'?v.href:''}catch{return ''}};
  async function get(path){
    if (!native) throw new Error('Este gateway requer o aplicativo Android.');
    const controller=new AbortController();
    const timeout=setTimeout(()=>controller.abort(),15000);
    try{
      const res=await fetch(root+path,{signal:controller.signal,cache:'no-store'});
      if(!res.ok)throw new Error('API indisponível ('+res.status+')');
      return await res.json();
    }finally{clearTimeout(timeout)}
  }
  async function providers(){
    if(!providersPromise)providersPromise=get('/health.json')
      .then(x=>x.ok&&Array.isArray(x.providers)?x.providers.filter(validId).slice(0,30):[])
      .catch(()=>[]);
    return providersPromise;
  }
  function refresh(){providersPromise=null;}
  function normalize(row,p){
    if(!row||!row.id||!row.title||row.catalogType==='MANGA')return null;
    return {id:'sdk:'+p+':'+row.id,provider:'sdk',sdkProvider:p,type:row.catalogType==='MOVIE'?'movie':'series',
      remoteId:String(row.id),name:String(row.title),kind:row.catalogType==='MOVIE'?'Filme':'Série',
      year:row.year||'',genre:'Anime',bannerImage:validUrl(row.thumbnailUrl),
      coverImage:{large:validUrl(row.thumbnailUrl)},description:'Fonte: '+p};
  }
  async function searchAll(term){
    if(!term||term.trim().length<2)return [];
    const sources=await providers();if(!sources.length)return [];
    const jobs=sources.map(async p=>{
      const data=await get('/search/'+encode(p)+'/'+encode(term.trim())+'.json');
      return Array.isArray(data)?data.slice(0,20).map(x=>normalize(x,p)).filter(Boolean):[];
    });
    const settled=await Promise.allSettled(jobs);
    const items=settled.flatMap(s=>s.status==='fulfilled'?s.value:[]);
    return [...new Map(items.map(x=>[x.id,x])).values()];
  }
  async function detail(m){
    if(m.provider!=='sdk'||!validId(m.sdkProvider))throw new Error('Fonte inválida');
    const data=await get('/content/'+encode(m.sdkProvider)+'/'+encode(m.remoteId)+'.json');
    if(!Array.isArray(data))throw new Error('Lista de episódios inválida');
    const episodes=data.filter(e=>e&&e.id).map((e,i)=>{
      const languages=Array.isArray(e.availableLanguages)?e.availableLanguages:[];
      const language=languages.includes('dub')?'dub':languages.includes('sub')?'sub':languages.includes('raw')?'raw':'sub';
      return {id:String(e.id),name:'E'+(Number(e.number)||i+1)+' · '+(e.title||'Episódio'),
        number:Number(e.number)||i+1,season:1,cover:validUrl(e.thumbnailUrl),language};
    });
    return {...m,providerEpisodes:episodes};
  }
  return {providers,refresh,searchAll,detail};
})();
