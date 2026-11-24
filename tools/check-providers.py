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

class Content(HTMLParser):
    def __init__(self):super().__init__();self.links=[];self.sources=[]
    def handle_starttag(self,t,a):
        a=dict(a)
        if t=='a' and a.get('href'):self.links.append(a['href'])
        if t in ('source','video') and a.get('src'):self.sources.append(a['src'])
def page(u):
    with conn(u) as r:
        doc=Content();doc.feed(r.read(2200000).decode(errors='replace'));return doc
def run():
    host='https://animesdrive.cloud'
    found=list(dict.fromkeys(U.urljoin(host,u) for u in page(host+'/?s=Naruto').links if '/anime/' in u and 'naruto' in u.lower()))
    print('VERSIONS',[U.urlsplit(u).path for u in found],flush=True)
    for title in found:
        path=U.urlsplit(title).path
        if any(tag in path for tag in ['shipp','boruto','movie','filme','road','legend','last','blood','clash']):continue
        eps=list(dict.fromkeys(U.urljoin(host,u) for u in page(title).links if '/episodio/' in u))
        if not eps: continue
        for ep in [eps[0], eps[len(eps)//2]]:
            print('EP',path,U.urlsplit(ep).path,len(eps),flush=True)
            for link in page(ep).sources[:2]:
                try:media('classic '+path,link)
                except Exception as e:print('OFF',type(e).__name__,getattr(e,'code',None),flush=True)
run()
