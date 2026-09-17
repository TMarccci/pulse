# Pulse szerver

Node.js/Express API + React irányítópult, SQLite tárolással a beépített `node:sqlite`
modulon keresztül (Node **22.5+**, natív fordítási lépés nélkül).

Méretezéshez (adatbázis-növekedés, hálózati terhelés, RAM/CPU) lásd: [TELJESITMENY.md](TELJESITMENY.md).

## Környezeti változók

| Változó                   | Alapérték          | Célja                                               |
|---------------------------|--------------------|-----------------------------------------------------|
| `PULSE_PORT`             | `8080`             | HTTP figyelő port                                   |
| `PULSE_HOST`             | `0.0.0.0`          | Kötési cím                                           |
| `PULSE_DB`               | `./data/pulse.db`  | SQLite fájl útvonala                                 |
| `PULSE_PUBLIC`           | `./public`         | A lefordított SPA könyvtára                          |
| `PULSE_SESSION_TTL_MIN`  | `60`               | Admin munkamenet + CSRF token élettartama (perc)     |
| `PULSE_ONLINE_WINDOW_SEC`| `120`              | Ennyi másodperc csend után lesz „offline” egy eszköz |
| `PULSE_SECURE_COOKIES`   | `false`            | Sütik `Secure` jelzése (HTTPS mögött)               |
| `PULSE_ADMIN_USER`       | `admin`            | Kezdeti admin felhasználónév                         |
| `PULSE_ADMIN_PASS`       | *(üres)*           | Kezdeti admin jelszó (első indításkor jön létre)     |
| `PULSE_REPO`             | `TMarccci/pulse`   | Monorepó az ügynök- és szerverfrissítéshez           |
| `PULSE_AUTO_UPDATE`      | `false`            | Új `server-v*` kiadások automatikus alkalmazása      |
| `PULSE_IN_DOCKER`        | auto               | Kikapcsolja az önfrissítést; az image állítja be     |
| `TZ`                     | rendszer           | Helyi időzóna a munkaidő-szűréshez                   |

> A repó **bedrótozva** `TMarccci/pulse`, így a frissítésekhez nem kell konfiguráció.
> A `PULSE_REPO` csak akkor számít, ha forkolod.

## Windows – egyparancsos telepítés (ajánlott)

Az [`installer/server/install-server.ps1`](../../installer/server/install-server.ps1)
mindent elvégez: letölti a legújabb kiadást, hordozható Node.js-t csomagol, ha még nincs
telepítve, létrehoz egy admint, és Windows-szolgáltatásként telepíti a Pulse-t.

**Emelt jogú** PowerShell-ben:

```powershell
Set-ExecutionPolicy -Scope Process Bypass -Force   # engedélyezd a szkript futását ebben az ablakban
iwr -useb https://raw.githubusercontent.com/TMarccci/pulse/main/installer/server/install-server.ps1 -OutFile install-server.ps1
.\install-server.ps1
```

> A `Set-ExecutionPolicy -Scope Process Bypass` csak az aktuális PowerShell-ablakra hat
> (semmi nem marad meg). Nélküle a Windows *„a szkriptek futtatása le van tiltva”*
> hibával blokkolja a letöltött szkriptet. Alternatíva:
> `powershell -ExecutionPolicy Bypass -File .\install-server.ps1`.

Bekér egy admin felhasználót/jelszót, majd a `http://localhost:8080` címen szolgálja ki
az irányítópultot. Hasznos kapcsolók:

```powershell
.\install-server.ps1 -Port 9090 -TimeZone 'Europe/Budapest' `
                     -AdminUser admin -AdminPassword 'S3cret!' -InstallDir 'D:\Pulse'
```

- **Rendszergazdaként** futtatva valódi Windows-szolgáltatást telepít (rendszerindításkor
  indul). Emelt jog nélkül felhasználói **bejelentkezési feladatot** regisztrál helyette.
- Az újbóli futtatás helyben frissít (a kódot lecseréli, a `data/`-t megőrzi).
- Eltávolítás: `installer/server/uninstall-windows-service.ps1` (vagy a `PulseServer`
  ütemezett feladat törlése), majd a telepítési könyvtár törlése.

## Futtatás Dockerrel

```bash
cp .env.example .env      # állítsd be a PULSE_ADMIN_PASS-t stb.
docker compose up -d
# irányítópult: http://<hoszt>:8080
```

Az adatok a `./data` mappában maradnak. Tegyél elé TLS-t bontó fordított proxyt
(Caddy/nginx/Traefik), és állítsd be a `PULSE_SECURE_COOKIES=true`-t.

## Futtatás a zip csomagból (kézi)

A `scripts/build-server.ps1` (vagy a Server Release folyamat) `pulse-server-<ver>.zip`-et
állít elő, amely tartalmazza a `src/`-t, `public/`-t és az éles `node_modules`-t.

```bash
unzip pulse-server-<ver>.zip -d pulse-server && cd pulse-server
node src/seed.js admin felhasznalo jelszo   # admin létrehozása
PULSE_PORT=8080 node src/index.js
```

- **Windows-szolgáltatás (kézi):** másold be az [`installer/server`](../../installer/server)
  fájljait, és futtasd az `install-windows-service.ps1`-et (emelt joggal). Node kell a PATH-on.
- **Linux:** használd az [`installer/server/pulse.service`](../../installer/server/pulse.service) unitot.

## Admin fiókok

```bash
node src/seed.js admin <felhasznalo> <jelszo>   # admin létrehozása/frissítése
node src/seed.js key   [cimke]                  # regisztrációs kulcs generálása
```

Az irányítópulton is kezelhetők: **Felhasználók** oldal (irányítópult-fiókok), illetve
**Beállítások → Regisztrációs kulcsok** (ügynök-regisztráció).

## Szerver-önfrissítés

A szerver 6 óránként és induláskor ellenőrzi a repó `server-vX.Y.Z` kiadásait. A
**Beállítások → Szerverfrissítések** mutatja az állapotot **Ellenőrzés most** /
**Frissítés most** gombokkal; az alkalmazás letölti a kiadás zip-jét, felülírja a
programfájlokat, és kilép, hogy a szolgáltatáskezelő újraindítsa az új verzión. A
`PULSE_AUTO_UPDATE=true` automatikussá teszi. Dockerben ez ki van kapcsolva – ott az
image-et frissítsd.

## Munkaidő és időzóna

A **Beállítások → Munkaidő** egy napi ablakot (kezdet/vég + munkanapok) határoz meg, amely
a **Munkaidő** kapcsoló bekapcsolásakor (irányítópult / eszközoldal) az analitikát és az
exportot szűkíti. A szűrés a **szerver helyi időzónájában** történik, ezért állítsd a
konténer/gép `TZ`-jét a munkahelyhez – pl. a `docker-compose.yml`-ben:

```yaml
    environment:
      TZ: "Europe/Budapest"
```

Ellenkező esetben (Docker alapból UTC) a 9–16 ablakot UTC szerint alkalmazná.

## Távoli / hálózaton kívüli kliensek

Az irodai LAN-t elhagyó gépeken futó ügynökök (hazavitt laptopok, távdolgozók) csak akkor
tudnak feltölteni, ha elérik ezt a szervert. Két lehetőség:

- **VPN** – a céges VPN-en lévő kliensek a belső címen érik el a szervert; mást nem kell
  publikálni.
- **Publikus HTTPS** – tegyél a szerver elé fordított proxyt TLS-tanúsítvánnyal és publikus
  hosztnévvel, és állítsd `PULSE_SECURE_COOKIES=true`-ra. Az ügynököket erre a hosztnévre
  irányítsd.

Amíg a kliens nem éri el a szervert, helyben pufferel (~14 nap), és újracsatlakozáskor
szinkronizál. Hogy mi rögzül és mi nem, lásd a [AGENS.md](AGENS.md) „Távoli és otthoni
munka forgatókönyvek” szakaszát.

## Biztonsági megjegyzések

- A jelszavak scrypt-tel hashelve; az eszköz-tokenek csak SHA-256 hashként tárolva.
- Az admin hitelesítés httpOnly munkamenet-süti + minden állapotváltó kéréshez szükséges
  CSRF token; a kettő együtt jár le, és az SPA a lejáratkor kiléptet.
- Éles környezetben mindig HTTPS-en szolgáld ki, hogy az eszköz-tokenek és admin
  munkamenetek titkosítva legyenek.
