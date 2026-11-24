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
with ThreadPoolExecutor(max_workers=4) as pool:
    for f,args in [(fire,["Frieren","Naruto","One Piece","Kimetsu no Yaiba"]),(fhd,["Frieren","Kimetsu no Yaiba"]),(site,["https://animesbrasil.app/episodio/dragon-ball-super-beerus-2-episodio-7","https://animesonline.app","https://api-animesonline-cc.herokuapp.com/search/naruto"])]:
        for arg in args:pool.submit(test,f,arg)
