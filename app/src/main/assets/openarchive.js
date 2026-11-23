/* Sun 0.5 — Internet Archive (conteúdos com indicação de licença aberta).
   Não busca cópias de conteúdo comercial, nem contorna acesso restrito. */
const OpenArchive = (() => {
  const SEARCH='https://archive.org/advancedsearch.php';
  const METADATA='https://archive.org/metadata/';
  const clean=s=>String(Array.isArray(s)?s[0]||'':s||'').replace(/<[^>]*>/g,'').replace(/&amp;/g,'&').slice(0,280);
  function licensed(url){
    const l=String(Array.isArray(url)?url[0]:url||'').toLowerCase();
    return /^https?:\/\/creativecommons\.org\/(?:licenses\/by(?:-sa)?\/\d+(?:\.\d+)?\/?|publicdomain\/(?:zero\/\d+(?:\.\d+)?\/?|mark\/\d+(?:\.\d+)?\/?))/.test(l);
  }
  const legalItem=r=>{
    const license=String(Array.isArray(r.licenseurl)?r.licenseurl[0]:r.licenseurl||'');
    const id=String(r.identifier||'');
    if(!licensed(license)||!/^[\w.\-]{3,95}$/.test(id))return null;
    return {id:'archive:'+id,remoteId:id,provider:'archive',
      name:clean(r.title||id),kind:'Filme',year:clean(r.year||'').slice(0,4),
      genre:'Animação livre',creator:clean(r.creator||''),license:'Licença aberta',
      licenseUrl:license,source:'https://archive.org/details/'+encodeURIComponent(id),
      description:clean(r.description||'Vídeo de acesso aberto do Internet Archive.'),
      coverImage:{large:'https://archive.org/services/img/'+encodeURIComponent(id)},
      bannerImage:'',streams:[]};
  };
  async function getJson(url,ms=9000){
    const ctrl=new AbortController();const clock=setTimeout(()=>ctrl.abort(),ms);
    try{const r=await fetch(url,{signal:ctrl.signal,credentials:'omit'});
      if(!r.ok)throw Error('Archive HTTP '+r.status);return await r.json();
    }finally{clearTimeout(clock);}
  }
  async function search(term='',skip=0){
    const keyword=String(term||'animation').trim().slice(0,75).replace(/[+\-!(){}\[\]^"~*?:\\/]/g,' ');
    const query=`mediatype:movies AND (${keyword||'animation'}) AND licenseurl:*`;
    const params=new URLSearchParams({q:query,'fl[]':'identifier',output:'json',rows:'24',page:String(1+Math.floor(Math.max(0,Number(skip)||0)/24))});
    // Os campos adicionais usam parâmetros repetidos, como documentado pela IA.
    for(const field of ['title','year','creator','licenseurl','description'])params.append('fl[]',field);
    try {
      const data=await getJson(SEARCH+'?'+params.toString());
      return (data.response?.docs||[]).map(legalItem).filter(Boolean);
    }catch{return [];}
  }
  async function detail(m){
    if(!m||m.provider!=='archive'||!/^[\w.\-]{3,95}$/.test(m.remoteId||''))throw Error('Item inválido');
    const metadata=await getJson(METADATA+encodeURIComponent(m.remoteId),10000);
    const license=metadata.metadata?.licenseurl;
    if(!licensed(license))throw Error('Sem licença aberta válida');
    const files=(metadata.files||[]).filter(f=>typeof f.name==='string'&&/\.(mp4|webm)$/i.test(f.name)
      && !/thumb|sample|preview/i.test(f.name)&&f.private!=='true');
    files.sort((a,b)=>Number(a.size||0)-Number(b.size||0));
    const variants=files.slice(0,6).map(f=>{
      const file=String(f.name).split('/').map(encodeURIComponent).join('/');
      const type=/\.webm$/i.test(f.name)?'video/webm':'video/mp4';
      return {url:'https://archive.org/download/'+encodeURIComponent(m.remoteId)+'/'+file,
        mimeType:type,quality:clean(f.format||f.name)};
    });
    if(!variants.length)throw Error('Este item não tem MP4 ou WebM compatível');
    return {...m,licenseUrl:String(license),streams:variants,description:clean(metadata.metadata?.description)||m.description};
  }
  return {search,detail,licensed,legalItem};
})();
