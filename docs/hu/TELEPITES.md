# Bevezetés – végigvezetve

Teljes bevezetés nulláról egy megfigyelt flottáig.

## 1. A szerver elindítása

Windowson a legegyszerűbb az egyparancsos telepítő (lásd [SZERVER.md](SZERVER.md)).
Dockerrel:

```bash
cp .env.example .env
# szerkeszd a .env-t: adj erős PULSE_ADMIN_PASS-t, és TZ=Europe/Budapest
docker compose up -d
```

Nyisd meg a `http://<szerver>:8080` címet, és jelentkezz be a kezdeti adminnal. Bármi
publikus előtt bontsd a TLS-t fordított proxyval, és állítsd `PULSE_SECURE_COOKIES=true`-ra.

## 2. Regisztrációs kulcs létrehozása

Irányítópult → **Beállítások → Regisztrációs kulcsok → Új kulcs**. Másold ki. (Készíthetsz
telephelyenként/kötegenként egy kulcsot, és később visszavonhatod; a visszavonás az új
regisztrációkat tiltja, a meglévő eszközöket nem.)

## 3. Monitorozási szabályok beállítása

Irányítópult → **Beállítások**:
- **Tétlenségi küszöb** – hány másodperc egértétlenség számít tétlennek (alap: 30).
- **Munkaidő** – napi ablak + munkanapok, amelyre az analitika szűkíthető.
- **Szinkron mód** – *Élő* (lekérdezési időköz) vagy *Időzített* (napi feltöltési idő).
- **Iroda színszabályok** – az Iroda vásznon használt küszöbök/színek.
- **Minimum ügynökverzió** – ez alatti ügynököket önfrissítésre kényszerít.

## 4. Az ügynök telepítőjének elkészítése

```powershell
pwsh scripts/build-agent.ps1 -Version 1.0.0
# → installer/client/Output/PulseAgentSetup-1.0.0.exe
```

Vagy hagyd, hogy az `agent-v1.0.0` tag a CI-ben építse, és egy GitHub Release-hez csatolja
(innen frissülnek is az ügynökök).

## 5. Munkaállomások regisztrálása

Minden gépen, a megfigyelendő fiókkal bejelentkezve, futtasd a telepítőt, add meg a
szervert + regisztrációs kulcsot + eszköznevet, és kattints a **Regisztráció és indítás**
gombra. Az eszköz egy szinkron-időközön belül megjelenik az irányítópulton.

## 6. Rendszerezés és üzemeltetés

- **Eszközök** – becenév, részletek megnyitása, eltávolított gépek archiválása.
- **Iroda** – húzd a monitorokat az alaprajzba; a színek élőben frissülnek.
- **Irányítópult** – munkahelyi analitika napi/egyéni időszakra; **Export** CSV/Excel/JSON-ba.
- **Felhasználók** – irányítópult-fiókok hozzáadása, jelszóváltás.

## 7. Frissítések kiadása

Tagelj `agent-vX.Y.Z`-t egy újabb telepítőhöz. Ha ki akarod kényszeríteni, emeld a
**Minimum ügynökverziót** a Beállításokban. Az ügynökök ~6 órán belül (vagy újraindításkor)
átveszik. A szerver a **Beállítások → Szerverfrissítések** alól frissül.

## Eltávolítás egy gépről

*Programok telepítése/törlése → Pulse Agent → Eltávolítás*. Utána archiváld az **Eszközök**
képernyőn.
