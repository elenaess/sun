"""Check the Commons media and prepare mobile catalog entries and artwork."""
import concurrent.futures
import hashlib
import json
import subprocess
import tempfile
import urllib.parse
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / "app/src/main/assets"
OUTPUT = ASSETS / "cinema"
USER_AGENT = "SunAndroid/0.2 (https://github.com/elenaess/sun)"
def curl(url, path, *options):
    subprocess.run(["curl", "-fLsS", "--retry", "2", "--connect-timeout", "10", "--max-time", "75",
                    "-A", USER_AGENT, *options, url, "-o", str(path)], check=True)

def prepare(item):
    title = item["file"].replace(" ", "_")
    file = urllib.parse.quote(title, safe="")
    digest = hashlib.md5(title.encode()).hexdigest()
    key = f"{digest[0]}/{digest[:2]}/{file}"
    base = "https://upload.wikimedia.org/wikipedia/commons/"
    source = "https://commons.wikimedia.org/wiki/File:" + file
    with tempfile.TemporaryDirectory() as directory:
        temp = Path(directory)
        choices = []
        for size in (480, 360, 720):
            url = f"{base}transcoded/{key}/{file}.{size}p.vp9.webm"
            try:
                curl(url, temp/"head", "--range", "0-255")
                if (temp/"head").read_bytes()[:4] == b"\x1aE\xdf\xa3":
                    choices.append({"quality": f"{size}p", "url":url})
            except subprocess.CalledProcessError:
                continue
        if not choices:
            if item["id"] == "sol-levante":
                raise RuntimeError("Sol Levante requires a mobile rendition")
            choices.append({"quality":"Original", "url":base+key})
        # Download once and decode frames; this tests the actual video and its seekability.
        curl(choices[0]["url"], temp/"movie.webm")
        poster = OUTPUT / (item["id"] + ".jpg")
        subprocess.run(["ffmpeg","-v","error","-ss",str(item["frame"]),"-i",str(temp/"movie.webm"),
                        "-frames:v","1","-vf","scale=800:-2","-q:v","3","-y",str(poster)],check=True)
        if poster.stat().st_size < 1800: raise ValueError("Empty artwork: " + item["id"])
        subtitle = ""
        if item.get("subtitleLang"):
            raw = "https://commons.wikimedia.org/w/index.php?" + urllib.parse.urlencode({
                "title": "TimedText:"+item["file"]+"."+item["subtitleLang"]+".srt","action":"raw"})
            curl(raw, temp/"sub.srt")
            if "-->" not in (temp/"sub.srt").read_text(): raise ValueError("Expected SRT timings")
            subtitle = item["id"]+"-pt-BR.vtt"
            subprocess.run(["ffmpeg","-v","error","-i",str(temp/"sub.srt"),"-y",str(OUTPUT/subtitle)],check=True)
        print(f'{item["name"]}: {len(choices)} formats; first frame decoded',flush=True)
        return dict(item, source=source, streams=choices, cover="./cinema/"+poster.name, subtitle=subtitle)

if __name__ == "__main__":
    OUTPUT.mkdir(parents=True, exist_ok=True)
    items = json.loads((ROOT/"catalog/sources.json").read_text())
    with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
        catalog = list(pool.map(prepare, items))
    (OUTPUT/"catalog.json").write_text(json.dumps(catalog,ensure_ascii=False,indent=2)+"\n")
