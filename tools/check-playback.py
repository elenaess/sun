"""Exercise search, details, native decoding and resume through the installed debug APK."""
import itertools
import json
import subprocess
import time
import urllib.request
import xml.etree.ElementTree as ET

import websocket


def adb(*args):
    return subprocess.check_output(["adb", *args], text=True, timeout=25).strip()


def wait_for(read, seconds, label):
    deadline = time.monotonic() + seconds
    while time.monotonic() < deadline:
        value = read()
        if value:
            return value
        time.sleep(0.7)
    raise AssertionError(label)


def connect():
    pid = adb("shell", "pidof", "com.sun.stream")
    port = adb("forward", "tcp:0", "localabstract:webview_devtools_remote_" + pid)
    def page():
        try:
            with urllib.request.urlopen(f"http://127.0.0.1:{port}/json/list", timeout=3) as r:
                return next((p for p in json.load(r) if p.get("type")=="page"), None)
        except OSError:
            return None
    target = wait_for(page, 30, "WebView do APK")
    return websocket.create_connection(target["webSocketDebuggerUrl"], suppress_origin=True, timeout=10)


def evaluate(code):
    ident = next(seq)
    sock.send(json.dumps({"id":ident, "method":"Runtime.evaluate", "params":{"expression":code, "returnByValue":True}}))
    while True:
        msg=json.loads(sock.recv())
        if msg.get("id")!=ident:
            continue
        result=msg["result"]
        if result.get("exceptionDetails"):
            raise AssertionError(result["exceptionDetails"].get("text"))
        return result["result"].get("value")


def click(selector):
    code="(()=>{const e=document.querySelector("+json.dumps(selector)+");if(!e)return false;e.click();return true})()"
    wait_for(lambda:evaluate(code),55,"Controle ausente: "+selector)


def check(query, prefix):
    click('[data-action="nav"][data-value="search"]')
    box = "document.getElementById('search')"
    evaluate(f"{box}.value={json.dumps(query)};{box}.dispatchEvent(new Event('input',{{bubbles:true}}));true")
    selector=f'button[data-action="detail"][data-id^="{prefix}"]'
    click(selector)
    click('.detail .cta[data-action="watch"]')
    def first_frame():
        lines=adb("logcat","-d","-s","SunPlayback:I","*:S")
        return next((l for l in lines.splitlines() if "first-frame" in l),"")
    frame=wait_for(first_frame,115,"Nenhum quadro nativo para "+prefix)
    print(query,frame,flush=True)
    time.sleep(4)
    adb("shell","input","keyevent","4")
    time.sleep(0.7)
    prefs=ET.fromstring(adb("shell","run-as","com.sun.stream","cat","shared_prefs/native-position.xml"))
    seconds=max([int(n.get("value",0)) for n in prefs if n.get("name","").startswith(prefix)]+[0])/1000
    assert seconds>1.0,(prefix,seconds)
    print(f"PLAYED {prefix} ({query}) {seconds:.2f}s",flush=True)
    click('.detail [data-action="back"]')


seq=itertools.count(1)
adb("shell","settings","put","system","screen_off_timeout","1200000")
adb("shell","input","keyevent","KEYCODE_WAKEUP")
adb("shell","wm","dismiss-keyguard")
adb("shell","am","start","-W","-n","com.sun.stream/.MainActivity")
sock=connect()
try:
    for query,prefix in [("Frieren","fhd:series:"),("Frieren","drive:"),("Morevna","peertube:")]:
        adb("logcat","-c")
        check(query,prefix)
finally:
    print(adb("logcat","-d","-s","SunPlayback:I","SunCatalog:I","*:S")[-3600:],flush=True)
    print(str(evaluate("document.querySelector('main, .detail')?.innerText?.slice(0,460)")),flush=True)
    sock.close()
