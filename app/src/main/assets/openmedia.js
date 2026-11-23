/* Sun 0.5 - Wikimedia Commons: videos livres, sem scraping, cookies ou login.
   Os metadados de licença são declarados pelos autores na plataforma.
   O Sun não confirma independentemente a titularidade dos direitos. */
const OpenMedia = (() => {
  const ENDPOINT = 'https://commons.wikimedia.org/w/api.php';
  const TEST_VIDEO = 'https://storage.googleapis.com/exoplayer-test-media-0/BigBuckBunny_320x180.mp4';
  const sample = () => ({
    id:'open:media3-bbb', provider:'open', name:'Big Buck Bunny — demonstração do player',
    kind:'Filme', year:'2008', genre:'Animação livre', creator:'Blender Foundation',
    license:'CC BY 3.0', licenseUrl:'https://creativecommons.org/licenses/by/3.0/',
    description:'Curta de animação livre utilizado para testar a reprodução nativa. Esta versão é uma amostra de baixa resolução, não um catálogo de anime comercial.',
    source:'https://peach.blender.org/',
    coverImage:{large:''}, bannerImage:'',
    streams:[{quality:'MP4 · teste Media3',url:TEST_VIDEO, mimeType:'video/mp4'}]
  });
  const clean = html => String(html||'').replace(/<[^>]*>/g,'').replace(/&nbsp;/g,' ').replace(/&amp;/g,'&').trim().slice(0,360);
  const licensed = item => {
    const license = String(item?.LicenseShortName?.value || '').trim();
    // Seleção conservadora; não incluir vídeo de licença indefinida ou restritiva.
    return /^(?:CC\s+BY(?:-SA)?(?:\s+\d+(?:\.\d+)?)?|CC0(?:\s+\d+(?:\.\d+)?)?|Public domain|PD(?:-old)?)$/i.test(license) ? license : '';
  };
  function toMedia(page) {
    const info=page.imageinfo?.[0];
    if(!info || !['video/webm','video/mp4'].includes(info.mime)) return null;
    const license=licensed(info.extmetadata);
    if(!license || !/^https:\/\//.test(info.url || ''))return null;
    const title=String(page.title||'').replace(/^File:/,'').replace(/\.(webm|mp4)$/i,'').replace(/_/g,' ').slice(0,110);
    const credit=clean(info.extmetadata?.Artist?.value || 'Autor no Wikimedia Commons');
    const path='https://commons.wikimedia.org/wiki/'+encodeURIComponent(String(page.title||'').replace(/ /g,'_'));
    const licenseUrl=String(info.extmetadata?.LicenseUrl?.value || '');
    return {
      id:'open:commons:'+page.pageid, provider:'open', name:title, kind:'Filme', genre:'Animação livre',
      year:'', creator:credit, license, licenseUrl:licenseUrl.startsWith('https://')?licenseUrl:'',
      description:clean(info.extmetadata?.ImageDescription?.value) || 'Vídeo de licença aberta no Wikimedia Commons.',
      source:path, coverImage:{large:info.thumburl||''}, bannerImage:info.thumburl||'',
      streams:[{quality:info.mime==='video/webm'?'WebM':'MP4',url:info.url,mimeType:info.mime}]
    };
  }
  async function search(term='',skip=0){
    const t=String(term||'').trim().slice(0,80);
    const sampleRows=skip===0 && (!t || /big\s*buck\s*bunny|teste|blender/i.test(t)) ? [sample()] : [];
    const query=t || 'Japanese animation';
    const params=new URLSearchParams({action:'query',generator:'search',gsrsearch:'filetype:video '+query,
      gsrnamespace:'6',gsrlimit:'35',gsroffset:String(Math.max(0,Number(skip)||0)),
      prop:'imageinfo',iiprop:'url|mime|extmetadata',iiurlwidth:'360',format:'json',formatversion:'2',origin:'*'});
    const controller=new AbortController();const timeout=setTimeout(()=>controller.abort(),9500);
    try {
      const response=await fetch(ENDPOINT+'?'+params.toString(),{signal:controller.signal,credentials:'omit'});
      if(!response.ok)throw Error('Wikimedia HTTP '+response.status);
      const data=await response.json();
      const candidates=(data.query?.pages||[]).map(toMedia).filter(Boolean);
      return [...new Map(sampleRows.concat(candidates).map(v=>[v.id,v])).values()];
    } catch(error) {
      // Um serviço externo falhar não impede que o teste local apareça no catálogo.
      return sampleRows;
    } finally {clearTimeout(timeout);}
  }
  return {search, sample, toMedia, licensed};
})();
