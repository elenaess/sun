"""Check the public catalogue and follow links to real media data."""
import concurrent.futures
import json
import re
import urllib.parse as url
import urllib.request as req

BASE = "https://animesfhd.net/stremio"
AGENT = "SunAndroid/0.3 (+https://github.com/elenaess/sun)"
def open_url(address, timeout=32):
    return req.urlopen(req.Request(address, headers={"User-Agent": AGENT}), timeout=timeout)
def api(path):
    with open_url(BASE + path) as response:
        return json.load(response)
def check_media(address, label):
    for depth in range(5):
        with open_url(address, 38) as response:
            prefix = response.read(2048)
            print(label, depth, response.status, url.urlsplit(response.geturl()).hostname,
                  response.headers.get_content_type(), prefix[:12].hex(), flush=True)
            if not prefix.lstrip().startswith(b"#EXTM3U"):
                assert (0x47 in prefix[:188] or b"ftyp" in prefix or b"moof" in prefix or
                        b"styp" in prefix or prefix.startswith(bytes.fromhex("1a45dfa3"))), "unrecognized segment format"
                return
            lines = (prefix + response.read(1024*1024)).decode().splitlines()
            next_uri = next(line for line in lines if line.strip() and not line.startswith("#"))
            address = url.urljoin(response.geturl(), next_uri)
    raise ValueError("too many playlists")
def check_series(query):
    items = api("/catalog/series/afhd-populares/search=" + url.quote(query) + ".json")["metas"]
    item = items[0]
    eps = api("/meta/series/" + url.quote(item["id"],safe="") + ".json")["meta"]["videos"]
    print("EPISODES",query,len(eps),flush=True)
    streams = api("/stream/series/" + url.quote(eps[0]["id"],safe="") + ".json")["streams"]
    check_media(next(s["url"] for s in streams if s.get("url","").startswith("https://")),query)
def pages():
    first = api("/catalog/series/afhd-populares.json")["metas"]
    second = api("/catalog/series/afhd-populares/skip=50.json")["metas"]
    print("PAGES",len(first),len(second),"new",len({v["id"] for v in second}-{v["id"] for v in first}),flush=True)
with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
    jobs=[pool.submit(check_series,query) for query in ["Frieren","Shingeki no Kyojin","Kimetsu no Yaiba"]]+[pool.submit(pages)]
    errors=[]
    for f in concurrent.futures.as_completed(jobs):
        try: f.result()
        except Exception as e:
            errors.append(type(e).__name__)
            print("FAILED", type(e).__name__, str(e).split("https://")[0][:100],flush=True)
    if errors: raise SystemExit(1)
