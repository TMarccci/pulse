# Teljesítmény, erőforrás-használat és kapacitástervezés

Konkrét számok arról, mennyi RAM-ot, CPU-t, tárhelyet és hálózatot használ a Pulse, hogy
méretezni tudd a bevezetést. A számok a tényleges adatmodellből (`samples`,
`window_events`) és a szinkronprotokollból származnak. A fő változó a
**W = különböző előtér-ablakok percenként** (1, ha valaki egy appban marad, 3–4, ha sokat
vált); a példák eltérő jelzés nélkül **W = 2**-vel számolnak.

## Röviden

| Kérdés | Válasz |
|---|---|
| Ügynök RAM | ~80–150 MB működési készlet (jellemzően ~100 MB) |
| Ügynök CPU | ~0% tétlenkor (eseményvezérelt horgok + 1 mp-es időzítő) |
| Hálózat, élő mód | ~1,5 KB/perc kliensenként → **~6 kbps 30 kliensre** (elhanyagolható) |
| Hálózat, időzített mód | ~185 KB/nap kliensenként (~6×-tal kevesebb, mint az élő) |
| Kliens-puffer, 1 hét offline (12 óra/nap) | ~1,3 MB (kemény felső korlát ~5–7 MB) |
| Szerver DB, 30 kliens | ~2 GB/év jellemzően, ~4–5 GB/év legrosszabb eset |
| Legnagyobb átvitel | Ügynök-önfrissítés: ~62 MB kliensenként **kiadásonként**, a GitHubról |

## Egy megfigyelt perc költsége

Minden futó perc **1 `sample`** rekordot ad, plusz **percenként egy `window_events`
rekordot minden különböző előtér-ablakra** (`W`). Egy sample a leütésszámot, az
**egérkattintás-számot** és az aktív/tétlen másodperceket tartalmazza.

> **Az egérkattintás-követés** egyetlen egészt ad a `sample`-höz (néhány bájt), és a
> meglévő egérhorogban egy plusz interlocked növelést kattintásonként – nincs mérhető
> hatása a RAM-ra, CPU-ra, tárhelyre vagy hálózatra.

| Hol | Percenként (W = 2) |
|---|---|
| Kliens-puffer (JSONL szöveg) | ~85 B váz + ~80 B/ablak ≈ **~250 B** |
| Szerver DB (rekord + indexek) | ~210 B sample + ~155 B/ablak ≈ **~520 B** |
| Hálózat, élő szinkron (dróton, HTTPS) | ~1 KB adat+fejléc + keretezés ≈ **~1,5 KB** |

---

## Ügynök – rendszerhasználat

- **RAM:** ~80–150 MB (jellemzően ~100 MB). Ez normális egy önálló, egyfájlos
  **.NET + WPF** alkalmazásnál. Irodai gépeken (8–16 GB) elhanyagolható.
- **CPU:** tétlenkor gyakorlatilag 0%. A billentyűzet/egér horgok eseményvezéreltek; egy
  1 mp-es időzítő mintázza az előtér-ablakot és zárja le a perces vödröket.
- **Lemez (puffer):** lásd lent – legfeljebb néhány MB.

## Kliens-puffer – legrosszabb eset

A vödrök a `spool.jsonl`-be kerülnek, és minden sikeres szinkronnál törlődnek. Amíg a
szerver elérhetetlen, a fájl nő, de **kemény felső korlátja** `MaxBuckets = 20 160`
(~14 nap); azon túl a legrégebbi sorokat eldobja.

Példa – szerver egy hétig offline, gép napi 12 órát használva:

```
vödrök = 12 óra × 60 × 7 nap = 5 040
méret  = 5 040 × ~250 B       ≈ 1,3 MB
```

| Ablakváltás | Heti puffer |
|---|---|
| Kevés (W≈1) | ~0,8 MB |
| Jellemző (W≈2) | ~1,3 MB |
| Sok (W≈3–4, hosszú címek) | ~2,5 MB |

Hónapokig offline is legfeljebb **~5–7 MB**, majd újracsatlakozáskor szinkronizál és törlődik.

---

## Hálózati forgalom

### Élő mód (alap, 60 mp-es lekérdezés)

A forgalmat a HTTP/TLS **fejlécek** uralják, nem az adat, mert percenként apró vödör megy.

| Kör | Sávszélesség | Mennyiség |
|---|---|---|
| 1 kliens | ~1,5 KB/perc (~0,2 kbps) | ~90 KB/óra, ~1,1 MB / 12 órás nap |
| **30 kliens (átlag)** | ~45 KB/perc (**~6 kbps**) | ~32 MB/nap, ~1 GB/hó összesen |
| 30 kliens (egyszerre lökésben) | 30 × ~1,5 KB = ~45 KB | ~0,4 ms egy gigabites LAN-on |

Összevetésül: a 6 kbps az egész flottára kevesebb, mint egy VoIP-hívás tizede.

### Időzített mód – ~6×-tal kevesebb

Minden kliens egész nap pufferel, és egy kéréssel küld (~720 vödör ≈ ~185 KB).

| Kör | Mennyiség |
|---|---|
| 1 kliens | ~185 KB/nap |
| 30 kliens | ~5,5 MB/nap (egy lökésben, ha egyszerre; így is jelentéktelen) |

### Önfrissítés – az egyetlen nagyobb átvitel

Amikor **új ügynökkiadás jelenik meg**, minden gép 6 óránkénti ellenőrzése végül letölti a
**~62 MB-os telepítőt** – 30 kliensre ~1,9 GB összesen, a **GitHub CDN-ről, nem a te
szerveredről**, időben szétszórva. Alkalmi (kiadásonként), nem folyamatos.

---

## Szerver – adatbázis-növekedés

```
DB/év ≈ eszközök × (óra/nap × 60) × nap/év × (210 + W×155) bájt
```

| Forgatókönyv | Feltevések | DB méret / év |
|---|---|---|
| Reális iroda | 8 óra × 250 nap, W=2 | ~1,8–2,3 GB |
| Reális legrosszabb | 12 óra × 365 nap, W=2 | ~4,1–5 GB |
| Sok váltás | 12 óra × 365, W=3–4 | ~5,5–8 GB |
| Szélsőséges (0–24) | 24 óra × 365, W=3 | ~10–13 GB |

Kb. **65–170 MB gépenként évente**, létszámmal lineárisan. +15–25% az SQLite lap/WAL
többletre.

---

## Kapacitástervezési fogantyúk

- **Megőrzés (retention).** Alapból semmi nem törli a régi adatot, így a DB évről évre nő.
  Egy megőrzési szabály (N napnál régebbi `samples`/`window_events` törlése) a
  leghatékonyabb eszköz a hosszú távú méret korlátozására.
- **Szinkron mód / lekérdezési időköz.** Az időzített szinkron – vagy hosszabb élő időköz –
  többszörösére csökkenti az állandó hálózati forgalmat.
- **A `device_id` UUID-szövegként** minden rekordban és indexben tárolódik (a sor
  ~35–40%-a); egy egész számú eszköz-kulcs ~30%-kal csökkentené a DB méretét.
- **`VACUUM`** – az SQLite törlés után csak ezzel zsugorítja a fájlt.
- **Fordított proxy tömörítés** (gzip/br) tovább csökkenti az élő-szinkron válaszokat.
