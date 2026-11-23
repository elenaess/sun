"""Smoke test publicly documented catalogue, episode and direct media endpoints."""
import concurrent.futures
import json
import urllib.parse as url
import urllib.request as req
from urllib.error import HTTPError
UA="SunAndroid/0.3 (+https://github.com/elenaess/sun)"
def get(endpoint):
    with req.urlopen(req.Request(endpoint,headers={"User-Agent":UA,"Accept":"application/json"}),timeout=18) as r:
        if "json" not in r.headers.get("Content-Type",""): raise ValueError("Not a JSON API")
        return json.load(r)
def media(url_):
    if not url_.startswith("https://"):return "no direct HTTPS"
    with req.urlopen(req.Request(url_,headers={"User-Agent":UA,"Range":"bytes=0-511"}),timeout=15) as r:
        data=r.read(512)
        return (r.status,r.headers.get_content_type(), 'media' if b'ftyp' in data[:32] or data[:4]==bytes.fromhex('1a45dfa3') or data.lstrip().startswith(b'#EXTM3U') else 'unknown')
def addon(base):
    m=get(base+'/manifest.json')
    print('MANIFEST',base,m.get('name'),[(c['type'],c['id']) for c in m.get('catalogs',[])],flush=True)
    cats=m.get('catalogs',[])
    if not cats:return
    c=next((a for a in cats if a['type']=='series' and any(e['name']=='search' for e in a.get('extra',[]))),cats[0])
    for q in ['','Frieren','Shingeki no Kyojin']:
        extra='/search='+url.quote(q) if q else ''
        ms=get(f"{base}/catalog/{c['type']}/{c['id']}{extra}.json").get('metas') or []
        print('CATALOG',base,q,len(ms),[(x.get('name'),x.get('id')) for x in ms[:4]],flush=True)
        if not ms or not q:continue
        item=ms[0]
        meta=get(f"{base}/meta/{item['type']}/{url.quote(str(item['id']),safe='')}.json").get('meta') or {}
        vid=meta.get('videos') or []
        print('EPISODES',base,q,len(vid),[(v.get('season'),v.get('episode')) for v in vid[:2]],flush=True)
        if vid:
            streams=get(f"{base}/stream/{item['type']}/{url.quote(str(vid[0]['id']),safe='')}.json").get('streams') or []
            print('SHAPE',list(meta),list(vid[0]),str(vid[0].get('id')),[(s.get('name'),list(s),[sub.get('lang') for sub in s.get('subtitles',[])],list((s.get('behaviorHints') or {}).keys())) for s in streams[:3]],flush=True)
            for s in streams[:2]:
                if s.get('url'):
                    print('VIDEO',base,q,media(s['url']),flush=True)
                    u=s['url']
                    for depth in range(3):
                        with req.urlopen(req.Request(u,headers={'User-Agent':UA}),timeout=12) as stream:
                            first=stream.read(4096)
                            if not first.lstrip().startswith(b'#EXTM3U'):
                                print('SEGMENT',q,stream.status,stream.headers.get_content_type(),'size>=',len(first),flush=True);break
                            lines=[l.strip() for l in first.decode(errors='replace').splitlines() if l and not l.startswith('#')]
                            if not lines:break
                            u=url.urljoin(stream.geturl(),lines[0])
                    break
def archive():
    query='mediatype:movies AND (subject:"anime" OR subject:"Japanese animation") AND -access-restricted-item:true AND (format:"MPEG4" OR format:"h.264" OR format:"Matroska" OR format:"WebM")'
    for term in ['', 'Frieren','Attack on Titan','Cowboy Bebop']:
        ext=' AND title:"'+term+'"' if term else ''
        endpoint='https://archive.org/advancedsearch.php?'+url.urlencode({'q':query+ext,'rows':4,'fl[]':['identifier','title'],'sort[]':'downloads desc','output':'json'},doseq=True)
        body=get(endpoint)['response'];print('ARCHIVE',term,body['numFound'],[d['title'] for d in body['docs']],flush=True)
        if not term:continue
        for d in body['docs'][:2]:
            id_=d['identifier'];item=get('https://archive.org/metadata/'+url.quote(id_));files=[f for f in item.get('files',[]) if not f.get('private') and str(f.get('name','')).lower().endswith(('.mp4','.webm','.mkv'))]
            if files:
                print('FILE',term,id_,len(files),files[0]['name'][:90],media('https://archive.org/download/'+url.quote(id_)+'/'+url.quote(files[0]['name'])),flush=True)
                break
def check(f,*args):
    try:f(*args)
    except Exception as e:print('UNAVAILABLE',f.__name__,args,type(e).__name__,str(e)[:100],flush=True)
with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool:
    for base in ['https://animesfhd.net/stremio','https://stremio-anitube-forpublic.vercel.app','https://animes-br-self.vercel.app']:pool.submit(check,addon,base)
    pool.submit(check,archive)
