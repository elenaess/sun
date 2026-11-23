"""Exercise the installed Sun APK on an Android emulator, using its public UI."""
import re
import subprocess
import time
import xml.etree.ElementTree as ET

def adb(*args):
    return subprocess.check_output(["adb", *args], text=True, timeout=25)

def find_node(label, timeout=55):
    deadline = time.monotonic() + timeout
    last = ""
    while time.monotonic() < deadline:
        try:
            adb("shell", "uiautomator", "dump", "--compressed", "/sdcard/sun-window.xml")
            last = adb("shell", "cat", "/sdcard/sun-window.xml")
            for node in ET.fromstring(last).iter("node"):
                if label in [node.get("text"),node.get("content-desc")]:
                    return node
        except (ET.ParseError, subprocess.SubprocessError):
            pass
        time.sleep(1)
    print(last[-22000:])
    raise AssertionError("Elemento não encontrado: " + label)

def tap(label):
    node = find_node(label)
    x,y,r,b=map(int,re.findall(r"\d+",node.get("bounds")))
    adb("shell","input","tap",str((x+r)//2),str((y+b)//2))

adb("shell","settings","put","system","screen_off_timeout","1200000")
adb("shell","input","keyevent","KEYCODE_WAKEUP")
adb("shell","wm","dismiss-keyguard")
adb("shell","am","start","-W","-n","com.sun.stream/.MainActivity")
tap("Assistir Sol Levante")
find_node("Vídeo em reprodução",90)
assert "PlayerActivity" in adb("shell","dumpsys","activity","activities")
time.sleep(3)
adb("shell","input","keyevent","4")
find_node("Continuar assistindo")
print("Sol Levante abriu pelo destaque, exibiu o primeiro quadro no Media3 e entrou no histórico.")
