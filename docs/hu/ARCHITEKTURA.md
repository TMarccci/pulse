# Pulse – Architektúra

A Pulse hozzájáruláson alapuló munkahelyi tevékenységfigyelő rendszer. Két fő részből áll:

1. **Pulse ügynök (agent)** – rejtett Windows háttérfolyamat (C#/.NET 10), minden
   megfigyelt munkaállomásra telepítve.
2. **Pulse szerver** – Node.js szinkronszerver + modern React irányítópult, központilag
   futtatva (helyben vagy egy VPS-en).

> **Hozzájárulási megjegyzés.** A szoftver olyan gépek megfigyelésére készült, amelyekre
> az üzemeltető jogosult, az azokat használó személyek tájékozott hozzájárulásával. A
> telepítő hozzájárulási figyelmeztetést jelenít meg, és a dokumentáció tartalmaz egy
> munkavállalói tájékoztató mintát.

---

## 1. Komponenstérkép

```
                          ┌────────────────────────────────────────┐
                          │              Pulse szerver              │
   ┌──────────────┐  HTTPS │  ┌──────────┐   ┌───────────────────┐  │
   │ Pulse ügynök │──────▶ │  │ REST API │──▶│ SQLite (node:     │  │
   │ (munkaáll.)  │ reg.   │  │ /api/... │   │ sqlite)           │  │
   │              │ szinkr.│  └────┬─────┘   └───────────────────┘  │
   └──────────────┘        │       │                                │
        ▲  önfrissítés      │       │ kiszolgálja a beépített SPA-t  │
        │ (GitHub Releases) │  ┌────▼──────────────────────────┐    │
        │                   │  │ React + Vite + Tailwind admin  │    │
   ┌────┴─────────┐         │  │  irányítópult / eszközök / …   │    │
   │ GitHub repó  │         │  └───────────────────────────────┘    │
   │  Releases    │         └────────────────────────────────────────┘
   └──────────────┘
```

## 2. Ügynök (munkaállomás)

- **Első indításkor** megjelenik egy WPF **beállítóablak**: szerver címe, port, TLS
  ki/be, regisztrációs kulcs és eszköznév. Teszteli a kapcsolatot, regisztrál, majd
  többé nem jelenít meg felületet.
- **Rejtett működés**: Windows-alrendszerű futtatható (nincs konzol), a beállítás után
  nincs ablak, nincs tray/tálcaikon.
- **Automatikus indítás**: a `HKCU\...\Run` kulcs alá regisztrálva (felhasználónként).
- **Gyűjtők**:
  - *Billentyűzet* – alacsony szintű `WH_KEYBOARD_LL` horog, a lenyomásokat számolja.
  - *Egér* – alacsony szintű `WH_MOUSE_LL` horog, számolja a kattintásokat (bármely gomb)
    és követi az utolsó tevékenység idejét; a szerveren beállított `idleThresholdSeconds`
    alapján minden másodpercet aktív/tétlen kategóriába sorol.
  - *Előtér-ablak* – a `GetForegroundWindow` lekérdezésével az ablakcím + a tulajdonos
    folyamat neve.
- **Pufferelés és szinkron**: a mérések perces „vödrökbe” (bucket) aggregálódnak egy
  helyi JSONL pufferbe (`spool.jsonl`, ~14 napos korlát), majd az aktív **szinkron mód**
  szerint kerülnek a szerverre:
  - *Élő szinkron* – ürítés + életjel N másodpercenként/percenként.
  - *Időzített szinkron* – egész napos pufferelés, napi egyszeri ürítés adott időpontban.
- **Beállítások lehúzása**: minden szinkronnál lehúzza az aktuális szabályokat, így a
  tétlenségi küszöb és a szinkron mód központilag módosítható.
- **Önfrissítés**: a GitHub Releases API-t ellenőrzi; ha újabb telepítő van, letölti és
  csendben lefuttatja, majd kilép.
- **Eltávolítás**: az Inno Setup telepítő regisztrálja a *Programok telepítése/törlése*
  listába.

Lásd: [AGENS.md](AGENS.md).

## 3. Szerver

- **Express** API két hitelesítési tartománnyal:
  - *Eszközhitelesítés* – `Bearer <eszköz-token>` a regisztrációkor (a `/api/agent/*`-hoz).
  - *Admin hitelesítés* – httpOnly munkamenet-süti + forgó, **lejáró CSRF token**; az SPA
    a token lejáratakor automatikusan kiléptet.
- **SQLite** tárolás a beépített `node:sqlite` modullal (Node 22.5+, natív build nélkül).
- **REST + SPA**: az API a lefordított React csomagot a `public/`-ból szolgálja ki.
- **Export**: CSV / Excel / JSON eszközönként vagy az egész munkahelyre.

Lásd: [SZERVER.md](SZERVER.md) és [API.md](API.md).

## 4. Adatmodell (SQLite)

| tábla            | célja                                                              |
|------------------|-------------------------------------------------------------------|
| `admins`         | irányítópult-fiókok (argon-szerű scrypt jelszó-hash)              |
| `sessions`       | admin munkamenet + CSRF token + lejárat                           |
| `enroll_keys`    | előre megosztott regisztrációs kulcsok                            |
| `devices`        | soronként egy munkaállomás (név, becenév, vászon x/y, archív…)    |
| `samples`        | perces tevékenység-vödrök (leütés, kattintás, aktív/tétlen, ablak)|
| `window_events`  | előtér-ablak használat idővel, alkalmazás/cím szerint            |
| `settings`       | monitorozási szabályok / módok / színszabályok JSON blobja        |
| `audit_log`      | admin műveletek                                                   |

A rekordonkénti méretekért, adatbázis-növekedésért, hálózati forgalomért és RAM/CPU
számokért lásd: [TELJESITMENY.md](TELJESITMENY.md).

**Sémamigráció.** Induláskor a `db.js` minden táblára lefuttat egy
`CREATE TABLE IF NOT EXISTS`-t (frissítéskor az új táblák automatikusan létrejönnek), és
minden új oszlopra egy idempotens `ensureColumn(tábla, oszlop, def)`-et (a
`pragma_table_info`-t ellenőrzi, és csak ha hiányzik, futtat `ALTER TABLE … ADD COLUMN`-t).
Így egy szerver frissítése új táblákat *vagy* új mezőket tartalmazó verzióra
automatikusan, adatvesztés nélkül migrálja a meglévő adatbázist.

## 5. Szinkronprotokoll (összefoglaló)

```
POST /api/agent/enroll     { enrollKey, deviceName, hostname, os, agentVersion }
      → { deviceId, deviceToken, settings }

POST /api/agent/sync       Bearer <deviceToken>
      { agentVersion, buckets:[{ ts, keypresses, mouseClicks, mouseActiveSec,
                                 mouseIdleSec, windows:[{app,title,seconds}] }] }
      → { ok, settings, serverTime }

GET  /api/agent/update-check?version=x.y.z   → { repo, minVersion, mandatory }
```

## 6. Fordítás és kiadás

GitHub Actions (`.github/workflows`):
- `agent-release.yml` – lefordítja a .NET ügynököt, összeállítja az Inno Setup telepítőt,
  és `PulseAgentSetup-x.y.z.exe` néven egy GitHub Release-hez csatolja.
- `server-release.yml` – lefordítja a React SPA-t + a backendet, `pulse-server-x.y.z.zip`-et
  és egy Docker imaget készít.

A verziózást git tagek vezérlik (`agent-vX.Y.Z`, `server-vX.Y.Z`). Lásd: [BUILD.md](BUILD.md).
