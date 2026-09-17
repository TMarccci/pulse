# Pulse ügynök (agent)

Önálló (futtatókörnyezetet nem igénylő) Windows 10/11 háttéralkalmazás.

## Telepítési folyamat (a „pendrive-os odasétálás”)

1. Másold a `PulseAgentSetup-<ver>.exe`-t egy pendrive-ra.
2. A célgépen, **a megfigyelendő fiókkal bejelentkezve**, futtasd a telepítőt.
   - Felhasználói szintű telepítés (nem kell rendszergazda/UAC) ide:
     `%LOCALAPPDATA%\Programs\Pulse Agent`.
3. Megjelenik a **beállítóablak**. Add meg:
   - **Szerver címe** (hoszt/IP vagy beillesztett URL), **Port**, **HTTPS használata**
     (+ *Önaláírt tanúsítvány engedélyezése* helyi tanúsítványokhoz)
   - **Regisztrációs kulcs** (az irányítópult *Beállítások → Regisztrációs kulcsok* alól)
   - **Eszköznév**
4. Kattints a **Regisztráció és indítás** gombra. Az ügynök regisztrál, elmenti a
   beállításait, beállítja az automatikus indulást, majd elrejtőzik. Ettől kezdve
   láthatatlanul fut, és a Windowsszal együtt indul.

## Mit gyűjt

- Előtér-ablak **címe** és **alkalmazása** (pl. `chrome.exe`)
- **Billentyűleütések száma** (csak darabszám – a leütések tartalmát nem rögzíti)
- **Egérkattintások száma** – bármely gomblenyomás (bal/jobb/közép/oldal) egy kattintás;
  a pozíciót és a gombot nem különbözteti meg és nem tárolja
- **Aktív/tétlen egéridő (másodperc)** – egy másodperc *tétlen*, ha az utolsó
  egértevékenység óta több telt el, mint az `idleThresholdSeconds` (alapból 30); a küszöb
  központilag, a Beállításokban állítható.

Az adatok perces vödrökbe aggregálódnak, és az aktív **szinkron mód** szerint kerülnek át:
- **Élő** – ürítés + életjel N másodpercenként (az eszköz közel valós időben online).
- **Időzített** – egész napos pufferelés, napi egyszeri feltöltés adott időpontban.

## Rejtett működés

- Windows-alrendszerű exe: nincs konzol, a beállítás után nincs főablak, nincs
  tray/tálcaikon.
- Felhasználónként egy példány (névvel ellátott mutex).
- Automatikus indulás a `HKCU\...\Run` kulcson keresztül.
- Helyi fájlok a `%LOCALAPPDATA%\Pulse` alatt: `config.json` (az eszköz-token DPAPI-val
  titkosítva), `spool.jsonl` (pufferelt vödrök), `agent.log` (forgó napló).

## Önfrissítés

A frissítési repó **bedrótozva `TMarccci/pulse`** (a szerver felül tudja bírálni).
6 óránként az ügynök lekéri a repó kiadásait, kiválasztja a legújabb **`agent-v*`**
kiadást (a szerverkiadásokat figyelmen kívül hagyja), és ha az újabb a futó verziónál,
letölti a `*Setup*.exe` melléklet, majd csendben (`/VERYSILENT`) lefuttatja, ami lecseréli
a bináris állományt és újraindítja az ügynököt. A frissítés kikényszerítéséhez emeld a
**Minimum ügynökverzió** értékét a Beállításokban.

## Eltávolítás

*Beállítások → Alkalmazások → Pulse Agent → Eltávolítás* (vagy *Programok telepítése/törlése*).
Az eltávolító leállítja a futó ügynököt, törli az automatikus indulási bejegyzést és a
`%LOCALAPPDATA%\Pulse` mappát.

## Konfiguráció visszaállítása

Töröld a `%LOCALAPPDATA%\Pulse\config.json` fájlt, és indítsd újra az ügynököt – ekkor
ismét megjelenik a beállítóablak (pl. új szerverre való átállításhoz).

## Erőforrás-használat

~80–150 MB RAM (jellemzően ~100 MB, ami normális egy önálló .NET + WPF alkalmazásnál),
tétlenkor ~0% CPU, és egy néhány MB-os puffer, még akkor is, ha a szerver napokig
elérhetetlen. A részletes számok és a hálózati forgalom itt: [TELJESITMENY.md](TELJESITMENY.md).

## Távoli és otthoni munka forgatókönyvek

Hogy a Pulse mit rögzít, attól függ, **melyik gépen történik ténylegesen a munka**.

**Távoli belépés a megfigyelt gépre – rögzítve.** Ha valaki **RDP, VPN + RDP,
TeamViewer, AnyDesk, VNC vagy Chrome Remote Desktop** útján csatlakozik a munkagéphez, a
munka a megfigyelt gépen fut, az otthoni eszköz csak képernyő + billentyűzet. Az ügynök
abban a munkamenetben fut, és a távoli bevitel a horgok szintje alatt kerül a munkamenet
bemeneti sorába – így az alacsony szintű billentyűzet/egér horgok továbbra is számolnak
minden leütést és kattintást, az aktív/tétlen működik, és a `GetForegroundWindow` is a
fókuszban lévő alkalmazást/címet jelenti. Pontosan úgy rögzít, mintha az illető az
asztalnál ülne.

**Ügynök nélküli eszközön végzett munka – nincs rögzítve.** A Pulse csak azokat a gépeket
látja, amelyeken az ügynök telepítve van. Ha a munka egy ügynök nélküli magánlaptopon
történik, telepítsd oda is az ügynököt (hozzájárulással).

**Hazavitt céges laptop.** A tevékenység helyben rögzül és pufferelődik (~14 napig); akkor
töltődik fel, amikor a laptop eléri a szervert. Valódi távoli lefedettséghez a szervernek
kívülről is elérhetőnek kell lennie – **VPN**-en vagy **publikus HTTPS**-en keresztül –,
különben az adat a pufferben vár, és a hálózatra visszatérve szinkronizál.

Megjegyzések:
- **Felhasználónkénti telepítés** – ha *másik* Windows-fiók lép be (helyben vagy RDP-vel),
  az nincs megfigyelve, hacsak az ügynök arra a fiókra is nincs telepítve.
- **Több felhasználós gépek (Windows Server / RDS)** – minden felhasználó külön
  munkamenetet kap; telepítsd az ügynököt megfigyelt felhasználónként (az egy-példány
  védelem munkamenetenkénti, így több munkamenet külön-külön futtatja a sajátját).
- **Zárolt / lecsatlakoztatott munkamenet** nem termel tevékenységet (helyesen – senki sem
  dolgozik); újracsatlakozáskor folytatódik.
- **UAC / biztonságos asztal** kérések nem rögzülnek (a Windows itt tiltja a horgokat) –
  csak egy rövid vakfolt a jogosultságemelés idejére.

## Megjegyzés a horgokról és a vírusirtókról

Az ügynök globális, alacsony szintű billentyűzet/egér horgokat használ
(`SetWindowsHookEx`). Egyes EDR/AV eszközök jelzik a beviteli horgokat. Menedzselt
flottákhoz írd alá a telepítőt és az ügynököt a saját kódaláíró tanúsítványoddal, és vedd
fel az engedélyezőlistára a végpontvédelmedben.
