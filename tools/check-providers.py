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
def fire(q):
    base="https://api.animefire.one"
    rows=api(base+"/animes/pesquisar?q="+U.quote(q))["data"]
    print("AnimeFire",q,len(rows),[(list(a),a.get("audio"),a.get("titles"),a.get("id")) for a in rows[:1]],flush=True)
    if not rows:return
    a=rows[0];ep=api(base+"/anime/"+U.quote(a["id"]))["data"]["episodes"]
    print("episodes",q,len(ep),[(e.get("id"),e.get("season"),e.get("number")) for e in ep[:1]],flush=True)
    e=sorted(ep,key=lambda x:(x.get("season") or 1,x.get("number") or 1))[0];streams=api(base+"/episode/"+U.quote(e["id"]))["data"]["streams"]
    print("sources",q,[(k.get("audio"),k.get("is_offline"),bool(k.get("url"))) for k in streams],flush=True)
    for track in streams[:3]:
        if track.get("url") and not track.get("is_offline"):
            try:media("AnimeFire "+q,track["url"]);return
            except Exception as e: print("media error",q,type(e).__name__,getattr(e,"code",None),flush=True)
def fhd(q):
    base="https://animesfhd.net/stremio"
    a=api(base+"/catalog/series/afhd-populares/search="+U.quote(q)+".json")["metas"][0]
    ep=api(base+"/meta/series/"+U.quote(a["id"],safe="")+".json")["meta"]["videos"]
    for e in ep[:1]:
        sources=api(base+"/stream/series/"+U.quote(e["id"],safe="")+".json")["streams"]
        print("FHD",q,len(ep),e["id"],[(list(v), U.urlsplit(v.get("url","")).path[:25]) for v in sources[:3]],flush=True)
        if sources:media("FHD "+q,sources[0]["url"])
class Sources(HTMLParser):
    def handle_starttag(self,tag,attrs):
        a=dict(attrs)
        if tag in ('video','source','iframe') or a.get("itemprop")=="contentUrl" or a.get("property","") in ('og:video','og:video:url'):
            u=a.get("src") or a.get("content") or "";print("HTML media",tag,U.urlsplit(u).hostname,U.urlsplit(u).path[-12:],flush=True)
def site(u):
    with conn(u) as r:
        print("Website",U.urlsplit(u).hostname,r.status,r.headers.get_content_type(),flush=True)
        Sources().feed(r.read(850000).decode(errors="replace"))
def test(f,arg):
    try:f(arg)
    except Exception as e:print("unavailable",f.__name__,arg,type(e).__name__,getattr(e,"code",None),flush=True)

class Links(HTMLParser):
    def __init__(self):super().__init__();self.links=[];self.media=[]
    def handle_starttag(self,tag,attrs):
        a=dict(attrs)
        if tag=='a' and a.get('href'): self.links.append(a['href'])
        if tag in ('source','video','iframe') and a.get('src'): self.media.append((tag,a['src']))
def page(u):
    p=Links()
    with conn(u) as r:p.feed(r.read(1600000).decode(errors='replace'))
    return p
def webseries(host):
    q='Frieren'
    p=page(host+'/?s='+q)
    urls=list(dict.fromkeys(U.urljoin(host,h) for h in p.links if '/anime/' in h and 'frieren' in h.lower()))
    print('SearchHTML',host,[U.urlsplit(u).path for u in urls[:3]],flush=True)
    if not urls:return
    p=page(urls[0]); eps=list(dict.fromkeys(U.urljoin(host,h) for h in p.links if '/episodio' in h or '/video/' in h))
    print('EpisodesHTML',host,len(eps),[U.urlsplit(u).path for u in eps[:2]],flush=True)
    if not eps:return
    p=page(eps[0]);print('EpisodeHTML',host,[(t,U.urlsplit(u).hostname,U.urlsplit(u).path[-8:]) for t,u in p.media],flush=True)
    for t,u in p.media:
        if t in ('source','video') and u.startswith('https://'):media(host,u);break
def archive_channels(q):
    from urllib.parse import urlencode
    u='https://sepiasearch.org/api/v1/search/videos?'+urlencode({'search':q,'count':7,'categoryOneOf':2,'nsfw':'false'})
    body=api(u)
    print('PeerTube',q,body.get('total'), [(v.get('name'),v.get('url'),v.get('license')) for v in body.get('data',[])[:3]],flush=True)
    for v in body.get('data',[])[:3]:
        if not v.get('url'):continue
        pub=U.urlsplit(v['url']);vd=api(pub.scheme+'://'+pub.netloc+'/api/v1/videos/'+v['uuid'])
        files=vd.get('files') or [];pls=vd.get('streamingPlaylists') or []
        if pls and pls[0].get('playlistUrl'):
            media('PeerTube '+q,pls[0]['playlistUrl']);break
        elif files:media('PeerTube '+q,files[0]['fileUrl']);break

def samples(arg):
    host,q=arg
    p=page(host+'/?s='+U.quote(q)); title=next(U.urljoin(host,h) for h in p.links if '/anime/' in h and q.split()[0].lower() in h.lower())
    p=page(title);eps=list(dict.fromkeys(U.urljoin(host,h) for h in p.links if re.search('/(episodio|video)/[^?]+',h)))
    print('list',host,q,U.urlsplit(title).path,len(eps),[U.urlsplit(u).path for u in eps[:2]],flush=True)
    p=page(eps[0])
    for kind,u in p.media:
        u=U.urljoin(host,u);url=U.urlsplit(u);query=U.parse_qs(url.query)
        print('PUBLIC',q,kind,url.hostname,url.path[:60],list(query),flush=True)
        if kind in ('video','source'):test_media(q,u);continue
        if url.hostname!=U.urlsplit(host).hostname:continue
        for key in ['d']:
            direct=query.get(key,[''])[0]
            if direct.startswith('https://'):test_media(q,direct)
        if not query:
            with conn(u) as resp:
                if resp.headers.get_content_type() in ('video/mp4','video/webm'):test_media(q,u)
                elif resp.headers.get_content_type()=='text/html':
                    frame=Links();frame.feed(resp.read(300000).decode(errors='replace'))
                    for t,x in frame.media:
                        if t in ('video','source'):test_media(q,U.urljoin(u,x))
def test_media(q,u):
    try:media(q,u)
    except Exception as e: print('media error',q,type(e).__name__,getattr(e,'code',None),flush=True)

def digital(q):
    base="https://animesdigital.org"
    search=page(base+'/?s='+U.quote(q))
    title=next(U.urljoin(base,h) for h in search.links if '/anime/' in h and q.split()[0].lower() in h.lower())
    detail=page(title)
    ep=next(U.urljoin(base,h) for h in detail.links if '/video/' in h)
    for tag,src in page(ep).media:
        if tag!='iframe':continue
        url=U.urlsplit(U.urljoin(base,src))
        if url.hostname!='api.anivideo.net':continue
        with conn(url.geturl()) as resp:
            buf=resp.read(260000);kind=resp.headers.get_content_type()
            print('Player',q,resp.status,kind,flush=True)
            if buf.startswith(b'#EXTM3U'):test_media(q,url.geturl());continue
            if kind!='text/html':continue
            markup=buf.decode(errors='replace')
            body=Links();body.feed(markup)
            for t,u in body.media:
                print('Element',q,t,U.urlsplit(u).hostname,flush=True)
                if t in ('source','video'):test_media(q,U.urljoin(url.geturl(),u))
            from html import unescape
            plain=re.findall(r"""https://[^\s'"<>\\]+?\.m3u8(?:\?[^\s'"<>\\]*)?""",markup)
            for u in list(dict.fromkeys(plain))[:2]:
                print('Playlist',q,U.urlsplit(u).hostname,flush=True)
                test_media(q,unescape(u))
def countcatalog(skip):
    ls=api('https://animesfhd.net/stremio/catalog/series/afhd-populares/skip='+str(skip)+'.json')['metas']
    print('WINDOW',skip,len(ls),[m['id'] for m in ls[:2]],flush=True)
with ThreadPoolExecutor(max_workers=3) as pool:
    for term in ['Frieren','Kimetsu','Naruto']:pool.submit(test,digital,term)
    for n in [0,50,500,1000,2000,5000]:pool.submit(test,countcatalog,n)
