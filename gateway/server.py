"""Sun gateway: metadata and direct playback for curated, permissioned media."""
import json
import os
import re
import unicodedata
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlsplit, parse_qs

ROOT = Path(__file__).resolve().parents[1]
ID = re.compile(r"[a-z0-9_-]{1,100}\Z")

def https(value):
    if not isinstance(value, str):
        return False
    try:
        u = urlsplit(value)
        return u.scheme == "https" and bool(u.hostname) and not u.username and not u.password
    except ValueError:
        return False

def normal(s):
    return "".join(c for c in unicodedata.normalize("NFKD", str(s).casefold())
                   if not unicodedata.combining(c))

def cinema():
    rows = json.loads((ROOT / "app/src/main/assets/cinema/catalog.json").read_text())
    return [{
        "id": x["id"], "title": x["name"], "year": x["year"],
        "catalogType": "MOVIE" if x["kind"] == "Filme" else "ANIME",
        "creator": x["creator"], "license": x["license"],
        "licenseUrl": x.get("licenseUrl", ""), "source": x.get("source", ""),
        "description": x.get("desc", ""), "audience": "general",
        "episodes": [{"id": x["id"] + "-1", "number": 3 if x["id"] == "morevna" else 1,
                      "title": x["episode"], "streams": [
                          {"sourceUrl": s["url"], "quality": s["quality"],
                           "language": "raw", "isHLS": False}
                          for s in x["streams"] if https(s["url"])]}]
    } for x in rows]

def valid_rows(rows):
    if not isinstance(rows, list):
        raise ValueError("catalog must be a list")
    output = []
    ids, units = set(), set()
    for row in rows:
        if not isinstance(row, dict) or row.get("audience") not in ("general", "teen"):
            continue
        if not ID.fullmatch(str(row.get("id", ""))) or not row.get("title") or not row.get("license"):
            continue
        if row["id"] in ids or row.get("catalogType") not in ("ANIME", "MOVIE"):
            continue
        episodes = []
        for ep in row.get("episodes", []):
            if not ID.fullmatch(str(ep.get("id", ""))) or ep["id"] in units:
                continue
            streams = []
            for s in ep.get("streams", []):
                if not https(s.get("sourceUrl")) or s.get("language") not in ("raw", "sub", "dub"):
                    continue
                safe = {"sourceUrl": s["sourceUrl"], "quality": str(s.get("quality", "auto")),
                        "language": s["language"], "isHLS": s.get("isHLS") is True,
                        "subtitles": [{"url": t["url"], "language": str(t.get("language", "und"))}
                                      for t in s.get("subtitles", []) if https(t.get("url"))]}
                streams.append(safe)
            if streams:
                units.add(ep["id"])
                episodes.append({**ep, "streams": streams})
        if episodes:
            ids.add(row["id"])
            output.append({**row, "episodes": episodes})
    return output

def load():
    data = {"cinema": valid_rows(cinema())}
    extra = os.environ.get("SUN_AUTHORIZED_CATALOG")
    if extra:
        data["licensed"] = valid_rows(json.loads(Path(extra).read_text()))
    return data

def dispatch(data, path, params):
    if path == "/health":
        return 200, {"ok": True, "providers": list(data), "version": "1.0.0"}
    if path not in ("/search", "/content", "/stream"):
        return 404, {"error": "route not found"}
    provider = params.get("provider", "")
    if provider not in data:
        return 404, {"error": "unknown provider"}
    rows = data[provider]
    if path == "/search":
        q = normal(params.get("q", "")).strip()
        if not q or len(q) > 120:
            return 400, {"error": "invalid query"}
        matches = [r for r in rows if all(t in normal(" ".join(
            str(r.get(k, "")) for k in ("title", "description", "creator", "aliases")))
            for t in q.split())]
        return 200, [{k: r[k] for k in ("id", "title", "year", "catalogType", "creator",
                         "license", "licenseUrl", "source", "description", "thumbnailUrl") if k in r}
                     for r in matches[:40]]
    if path == "/content":
        row = next((r for r in rows if r["id"] == params.get("mediaId")), None)
        if row is None:
            return 404, {"error": "unknown title"}
        return 200, [{"id": e["id"], "number": e.get("number", i+1),
                      "title": e.get("title", "Episodio"),
                      "availableLanguages": sorted({s["language"] for s in e["streams"]})}
                     for i, e in enumerate(row["episodes"])]
    lang = params.get("language", "raw")
    if lang not in ("raw", "sub", "dub"):
        return 400, {"error": "invalid language"}
    for r in rows:
        for e in r["episodes"]:
            if e["id"] == params.get("unitId"):
                return 200, {"type": "video", "streams": [s for s in e["streams"]
                    if s["language"] == lang], "license": r["license"], "creator": r.get("creator", "")}
    return 404, {"error": "unknown episode"}

class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        if len(self.path) > 1800:
            status, result = 414, {"error": "request too long"}
        else:
            parsed = urlsplit(self.path)
            params = {k: v[0] for k, v in parse_qs(parsed.query).items()}
            status, result = dispatch(self.server.catalog, parsed.path, params)
        body = json.dumps(result, ensure_ascii=False).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "public, max-age=60" if status == 200 else "no-store")
        self.send_header("X-Content-Type-Options", "nosniff")
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, fmt, *args):
        # Do not store users' search terms.
        pass

if __name__ == "__main__":
    server = ThreadingHTTPServer(("0.0.0.0", int(os.environ.get("PORT", "8080"))), Handler)
    server.catalog = load()
    server.serve_forever()
