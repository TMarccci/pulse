# Fordítás és kiadás

A verziózást **git tagek** vezérlik. Az ügynök és a szerver egymástól függetlenül adódik ki.

| Tag              | Folyamat                | Eredmény                                        |
|------------------|-------------------------|-------------------------------------------------|
| `agent-vX.Y.Z`   | `agent-release.yml`     | `PulseAgentSetup-X.Y.Z.exe` egy GitHub Release-en |
| `server-vX.Y.Z`  | `server-release.yml`    | `pulse-server-X.Y.Z.zip` + GHCR Docker image    |

A `ci.yml` minden push/PR esetén lefordítja mindkettőt, kiadás nélkül.

## Kiadás készítése

```bash
# Ügynök
git tag agent-v1.2.0 && git push origin agent-v1.2.0

# Szerver
git tag server-v1.2.0 && git push origin server-v1.2.0
```

Az ügynök verziója a `dotnet publish -p:Version=...`-szal kerül a binárisba, így az
`AppInfo.Version` és a telepítő neve egyezik a taggal. A telepített ügynökök önfrissülnek
az új `agent-v*` kiadásra, amint az lesz a legújabb.

A GitHub Release-eket **először vázlatként** hozzuk létre, majd a `gh release edit
--draft=false` publikálja – ez az „Immutable Releases” beállítással is működik (a
publikált/immutábilis kiadáshoz nem lehet mellékletet feltölteni).

## Helyi fordítás

```powershell
# Ügynök (önálló, egyfájlos exe + telepítő, ha van Inno Setup)
pwsh scripts/build-agent.ps1 -Version 1.2.0

# Szerver (irányítópult build + backend + éles függőségek, zip-be csomagolva)
pwsh scripts/build-server.ps1 -Version 1.2.0

# Ikon (assets/pulse.ico + favicon) újragenerálása
pwsh scripts/make-icon.ps1 -OutDir assets
```

Előfeltételek: .NET 10 SDK, Node 24, és (az ügynök telepítőjéhez) a
[Inno Setup 6](https://jrsoftware.org/isdl.php) a `PATH`-on (`iscc`).

## Kézi indítás

Mindkét kiadási folyamat elfogad `workflow_dispatch`-et `version` bemenettel, így az
Actions fülről tageléssel nem járó, egyszeri telepítő/image is építhető.

## Sémamigráció frissítéskor

Adatbázis-változásnál nem kell külön migrációs szkript: a `db.js` induláskor
`CREATE TABLE IF NOT EXISTS`-szel létrehozza az új táblákat, és `ensureColumn`-nal
hozzáadja a hiányzó oszlopokat egy meglévő adatbázishoz (lásd
[ARCHITEKTURA.md](ARCHITEKTURA.md)). Ezért egy szerverfrissítés adatvesztés nélkül
migrál előre.
