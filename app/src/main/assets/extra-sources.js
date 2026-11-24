const ExtraSources=(()=>{
  const https=value=>{try{const u=new URL(value);return u.protocol==='https:'&&!u.username&&!u.password?u.href:'';}catch{return '';}};
  async function get(path) {
    const controller=new AbortController(),clock=setTimeout(()=>controller.abort(),13000);
    try{
      const result=await fetch(path,{signal:controller.signal,credentials:'omit'});
      if(!result.ok)throw Error('Fonte indisponível');
      return await result.json();
    }finally{clearTimeout(clock);}
  }
  const drive=(method,value)=>get('/sun-api/drive/'+method+'/'+encodeURIComponent(value));
  async function searchDrive(term){
    if(location.hostname!=='appassets.androidplatform.net'||term.length<2)return [];
    const aliases={'attack on titan':'Shingeki no Kyojin','demon slayer':'Kimetsu no Yaiba','sousou no frieren':'Frieren'};
    const rows=await drive('search',aliases[term.toLowerCase()]||term);
    return rows.map(row=>({id:'drive:'+row.id,remoteId:row.id,provider:'drive',type:'series',name:row.name,
      genre:'AnimesDrive',kind:'Anime',coverImage:{large:https(row.poster)},source:'https://animesdrive.cloud/anime/'+row.id}));
  }
  async function searchPeer(term,skip=0){
    const params=new URLSearchParams({search:term,categoryOneOf:'2',nsfw:'false',count:'20',start:String(skip)});
    const data=await get('https://sepiasearch.org/api/v1/search/videos?'+params);
    return (data.data||[]).filter(v=>!v.nsfw&&v.uuid&&https(v.url||v.originUrl)).map(v=>{
      const origin=new URL(v.url||v.originUrl).origin;
      const image=v.thumbnailUrl||v.previewUrl||v.thumbnailPath;
      return {id:'peertube:'+v.uuid,remoteId:v.uuid,provider:'peertube',origin,name:v.name,kind:'Vídeo',genre:'PeerTube',
        creator:v.channel?.displayName||'',source:https(v.url||v.originUrl),description:v.description||'',
        coverImage:{large:image?https(new URL(image,origin).href):''}};
    });
  }
  async function detail(m) {
    if(m.provider==='drive'){
      const rows=await drive('episodes',m.remoteId);
      return {...m,providerEpisodes:rows.sort((a,b)=>a.season-b.season||(a.number??Infinity)-(b.number??Infinity))};
    }
    const u=new URL(m.source);
    if(u.protocol!=='https:'||!/^[-a-f0-9]{36}$/i.test(m.remoteId))throw Error('Vídeo inválido');
    const video=await get(u.origin+'/api/v1/videos/'+encodeURIComponent(m.remoteId));
    if(video.uuid!==m.remoteId||video.nsfw||video.privacy?.id!==1||video.embedEnabled===false)throw Error('Vídeo indisponível');
    const streams=[],seen=new Set();
    function add(link,mimeType,quality){const url=https(link);if(url&&!seen.has(url)){streams.push({url,mimeType,quality});seen.add(url);}}
    for(const list of video.streamingPlaylists||[])add(list.playlistUrl,'application/vnd.apple.mpegurl','PeerTube · automática');
    for(const file of video.files||[])add(file.fileUrl,file.mimeType||'',file.resolution?.label||'PeerTube');
    if(!streams.length)throw Error('Vídeo sem fonte direta');
    return {...m,providerEpisodes:[{id:m.remoteId,name:video.name,number:1,season:1,streams}]};
  }
  return {searchDrive,searchPeer,detail};
})();
