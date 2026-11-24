"""Read public catalogue and media endpoints as an ordinary Sun client."""
from concurrent.futures import ThreadPoolExecutor
import json, re, urllib.parse as U, urllib.request as R
from html.parser import HTMLParser
UA="SunAndroid/0.7 (+https://github.com/elenaess/sun)"
def conn(u): return R.urlopen(R.Request(u,headers={"User-Agent":UA}),timeout=18)
def api(u):
    with conn(u) as r: return json.load(r)
def media(tag,u):
    for _ in range(4):
        with conn(u) as r:
            v=r.read(768)
            print(tag,"media",r.status,U.urlsplit(r.geturl()).hostname,U.urlsplit(u).path[-12:].split("/")[-1][-6:],r.headers.get_content_type(),v[:12].hex(),flush=True)
            if not v.startswith(b"#EXTM3U"): return
            lines=(v+r.read(250000)).decode().splitlines()
            u=U.urljoin(r.geturl(),next(x for x in lines if x.strip() and not x.startswith("#")))

def catalogue_size():
    def query(n):
        base='https://animesfhd.net/stremio/catalog/series/afhd-populares/skip='+str(50*n)+'.json'
        return len(api(base)['metas'])
    lo,hi=0,1
    while hi<256 and query(hi)==50:lo,hi=hi,hi*2
    while lo+1<hi:
        mid=(lo+hi)//2
        if query(mid)==50:lo=mid
        else:hi=mid
    print('CATALOGUE_ROWS',50*hi+query(hi),flush=True)
def episodes(term):
    base='https://animesfhd.net/stremio'
    a=api(base+'/catalog/series/afhd-populares/search='+U.quote(term)+'.json')['metas'][0]
    rows=api(base+'/meta/series/'+U.quote(a['id'],safe='')+'.json')['meta']['videos']
    if not rows:return
    print('SHOW',a['name'],len(rows),flush=True)
    for i in sorted({0,len(rows)//2,len(rows)-1}):
        ep=rows[i]; key=a['name']+' E'+str(ep.get('episode'))
        try:
            streams=api(base+'/stream/series/'+U.quote(ep['id'],safe='')+'.json')['streams']
            link=next(s['url'] for s in streams if s.get('url','').startswith('https://'))
            for depth in range(4):
                with conn(link) as res:
                    head=res.read(600)
                    if head.lstrip().startswith(b'#EXTM3U'):
                        full=(head+res.read(150000)).decode();link=U.urljoin(res.geturl(),next(line for line in full.splitlines() if line.strip() and not line.startswith('#')))
                    elif (head[0]==0x47 and head[188]==0x47) or b'ftyp' in head[:40] or head.startswith(bytes.fromhex('1a45dfa3')):
                        print('MEDIA_OK',key,flush=True);break
                    else:raise ValueError('tipo de mídia não reconhecido')
            else:raise ValueError('sem segmento')
        except Exception as e:print('MEDIA_FAILED',key,type(e).__name__,getattr(e,'code',None),flush=True)
with ThreadPoolExecutor(max_workers=3) as pool:
    jobs=[pool.submit(episodes,t) for t in ['Frieren','Shingeki no Kyojin','Kimetsu no Yaiba','Naruto','One Piece']]+[pool.submit(catalogue_size)]
    for j in jobs:
        try:j.result()
        except Exception as e:print('CHECK_FAILED',type(e).__name__,getattr(e,'code',None),flush=True)
