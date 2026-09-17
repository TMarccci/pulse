# Pulse

Hozzájáruláson alapuló munkahelyi tevékenységfigyelő rendszer: egy rejtett Windows
**ügynök (agent)**, amely egy központi **szinkronizációs szerverre** jelent, modern
webes irányítópulttal.

*(English version: [README.md](README.md).)*

> ⚠️ **Csak jogszerű használatra.** A Pulse-t kizárólag olyan eszközökön telepítsd,
> amelyek megfigyelésére jogosult vagy, és kizárólag az érintett személyek tájékozott
> hozzájárulásával. Egy munkavállalói tájékoztató minta a
> [`docs/hu/munkavallaloi-tajekoztato.md`](docs/hu/munkavallaloi-tajekoztato.md)
> fájlban található. Emberek megfigyelése jogalap és tudtuk nélkül több országban is
> jogellenes lehet.

---

## Mit csinál

**Ügynök (munkaállomásonként, rejtett):**
- Fókuszban lévő ablak **címe** és **alkalmazása** (pl. `chrome.exe`)
- Összes **billentyűleütés** és **egérkattintás**
- **Aktív vs. tétlen** egéridő (a tétlenségi küszöb központilag állítható)
- Rögzíti a **távoli munkameneteket** is (RDP / VPN / TeamViewer / AnyDesk …), amelyek a
  gépet vezérlik – lásd [távoli és otthoni munka forgatókönyvek](docs/hu/AGENS.md)
- Nincs tálcaikon, nincs értesítési (tray) ikon, Windowsszal indul, önfrissül a GitHub
  Releases alapján, és megjelenik a *Programok telepítése/törlése* listában.

**Szerver + irányítópult:**
- Munkahelyi és eszközönkénti analitika – előre beállított időszakokra **vagy egy adott
  napra / egyéni intervallumra**, billentyűzet/egér és aktív/tétlen grafikonokkal
- **Eszközök** képernyő – becenév, részletek, archiválás
- **Eszköz részletei** – egy alkalmazásra kattintva idővonalon látszanak az ablakcímei,
  plusz egy teljes előtér-ablak idővonal
- **Iroda** képernyő – monitorikonok szabad elrendezése vászonon, állapot szerinti
  színezéssel (a színszabályok testreszabhatók) és időzített szinkron figyelmeztetéssel
- **Felhasználók** – irányítópult-fiókok létrehozása és jelszóváltás
- **Beállítások** – tétlenségi küszöb, **munkaidő**, szinkron mód (élő/időzített),
  színszabályok, regisztrációs kulcsok, ügynök-frissítési minimumverzió
- Adatexport **CSV / Excel / JSON** formátumban
- **Szerver-önfrissítés** GitHub Releases alapján (Beállítások → Szerverfrissítések)
- Admin bejelentkezés lejáró munkamenettel + CSRF tokennel (automatikus kiléptetés)
- Automatikus **sémamigráció** frissítéskor (új táblák és mezők)

A teljes felépítést lásd: [`docs/hu/ARCHITEKTURA.md`](docs/hu/ARCHITEKTURA.md), a
teljesítményt/kapacitást pedig [`docs/hu/TELJESITMENY.md`](docs/hu/TELJESITMENY.md).

## Repó felépítése

```
agent/       C#/.NET 10 Windows ügynök (WPF beállítóablak + rejtett figyelő)
server/
  backend/   Node.js/Express API + SQLite (node:sqlite, natív függőség nélkül)
  frontend/  React + Vite + Tailwind irányítópult (a backend/public-ba épül)
installer/
  client/    Inno Setup szkript az ügynök telepítőjéhez
  server/    Windows-szolgáltatás (WinSW) + systemd + egyparancsos telepítő
scripts/     build-agent.ps1, build-server.ps1, make-icon.ps1
.github/     CI + kiadási (release) folyamatok
docs/        angol dokumentáció; docs/hu/ a magyar változat
```

## Gyors start (fejlesztés)

**Szerver** (két terminál):

```bash
cd server/backend
npm install
PULSE_ADMIN_USER=admin PULSE_ADMIN_PASS=secret123 npm run dev
```

```bash
cd server/frontend
npm install
npm run dev        # http://localhost:5173 (a /api-t a :8080-ra proxyzza)
```

Opcionális demóadatok: `cd server/backend && node src/demo.js` (létrehoz: `admin` / `secret123`).

**Ügynök** (fordítás + futtatás Windows gépen):

```bash
cd agent
dotnet build PulseAgent.slnx -c Debug
# futtasd: bin/Debug/net10.0-windows/win-x64/PulseAgent.exe  → megjelenik a beállítóablak
```

## Éles környezet

**Szerver Windowsra – egy paranccsal.** Emelt jogú (rendszergazdai) PowerShell-ben ez
letölti a legújabb kiadást, szükség esetén hordozható Node.js-t csomagol, kér egy admin
fiókot, és Windows-szolgáltatásként telepíti a Pulse-t (irányítópult: `http://localhost:8080`):

```powershell
Set-ExecutionPolicy -Scope Process Bypass -Force   # engedélyezd a szkript futását ebben az ablakban
iwr -useb https://raw.githubusercontent.com/TMarccci/pulse/main/installer/server/install-server.ps1 -OutFile install-server.ps1
.\install-server.ps1
```

További szerveropciók (Docker, kézi zip, systemd): [`docs/hu/SZERVER.md`](docs/hu/SZERVER.md).

**Ügynök:** a telepítőt a `pwsh scripts/build-agent.ps1 -Version X.Y.Z` építi
(kell hozzá az [Inno Setup](https://jrsoftware.org/isdl.php)), majd futtasd a
`PulseAgentSetup-X.Y.Z.exe`-t minden munkaállomáson. Lásd: [`docs/hu/AGENS.md`](docs/hu/AGENS.md).

## Kiadások és önfrissítés

Ez egy **monorepó** – az ügynök és a szerver is a
[`github.com/TMarccci/pulse`](https://github.com/TMarccci/pulse) címről kap kiadást
(bedrótozva, nem kell konfigurálni). A `agent-vX.Y.Z` vagy `server-vX.Y.Z` git tag
indítja a kiadási folyamatot ([`docs/hu/BUILD.md`](docs/hu/BUILD.md)):

- Az **ügynökök** a repó `agent-v*` kiadásait figyelik, és csendben telepítik az újabbat.
- A **szerver** a `server-v*` kiadásokat ellenőrzi, és a Beállítások → Szerverfrissítések
  alól önfrissül (vagy automatikusan a `PULSE_AUTO_UPDATE=true` mellett, Dockeren kívül).

Licenc: [MIT License](LICENSE).
