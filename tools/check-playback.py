"""Search a real provider, open an episode and check the native playback clock."""
import re
import subprocess
import time
import xml.etree.ElementTree as ET

def adb(*args):
    return subprocess.check_output(["adb", *args], text=True, timeout=30)

def find_node(label, partial=False, timeout=80):
    end = time.monotonic() + timeout
    labels = []
    while time.monotonic() < end:
        try:
            adb("shell","uiautomator","dump","--compressed","/sdcard/sun-window.xml")
            tree=ET.fromstring(adb("shell","cat","/sdcard/sun-window.xml"))
            labels=[]
            for node in tree.iter("node"):
                for prop in ("text","content-desc","resource-id"):
                    value=node.get(prop,"")
                    if value:labels.append(value[:110])
                    if (partial and label.casefold() in value.casefold()) or value==label:
                        return node
        except (ET.ParseError,subprocess.SubprocessError):
            pass
        time.sleep(1)
    raise AssertionError(f"Elemento ausente: {label}. Tela: {labels[:100]}")

def tap(label,partial=False):
    node=find_node(label,partial)
    x,y,r,b=map(int,re.findall(r"\d+",node.get("bounds")))
    assert r>x and b>y
    adb("shell","input","tap",str((x+r)//2),str((y+b)//2))

def player_log():
    return adb("logcat","-d","-s","SunPlayback:I","SunCatalog:I","*:S")

adb("shell","settings","put","system","screen_off_timeout","1200000")
adb("shell","input","keyevent","KEYCODE_WAKEUP")
adb("shell","wm","dismiss-keyguard")
adb("logcat","-c")
adb("shell","am","start","-W","-n","com.sun.stream/.MainActivity")
try:
    tap("Buscar")
    tap("Pesquisar anime",True)
    adb("shell","input","text","Frieren")
    find_node("Episódios no Sun")
    tap("Abrir Sousou no Frieren",True)
    tap("Assistir")
    until=time.monotonic()+150
    while time.monotonic()<until:
        log=player_log()
        if "first-frame afhd:" in log: break
        if "provider-error" in log: print(log[-900:],flush=True)
        time.sleep(3)
    else: raise AssertionError("Sem primeiro quadro do episódio no Android.")
    time.sleep(5)
    assert "PlayerActivity" in adb("shell","dumpsys","activity","activities")
    adb("shell","input","keyevent","4")
    time.sleep(1)
    saved=adb("shell","run-as","com.sun.stream","cat","shared_prefs/native-position.xml")
    pos=max(int(n.get("value","0")) for n in ET.fromstring(saved) if "afhd:" in n.get("name",""))
    assert pos>1000, pos
    print(f"Frieren: primeiro quadro nativo e progresso salvo em {pos} ms.",flush=True)
finally:
    print(player_log()[-4600:],flush=True)
