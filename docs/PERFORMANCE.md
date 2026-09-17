# Performance, resource usage & capacity planning

Concrete numbers for how much RAM, CPU, disk, and network Pulse uses, so you can
size deployments. Figures are derived from the actual data model (`samples`,
`window_events`) and sync protocol, not guesses. The main variable throughout is
**W = distinct focused windows per minute** (1 when someone stays in one app,
3–4 when they switch a lot); examples use **W = 2** unless noted.

## TL;DR

| Question | Answer |
|---|---|
| Agent RAM | ~80–150 MB working set (~100 MB typical) |
| Agent CPU | ~0% idle (event-driven hooks + a 1 s timer) |
| Network, live mode | ~1.5 KB/min per client → **~6 kbps for 30 clients** (negligible) |
| Network, timed mode | ~185 KB/day per client (~6× less than live) |
| Client spool, 1 week offline (12 h/day) | ~1.3 MB (hard-capped at ~5–7 MB) |
| Server DB, 30 clients | ~2 GB/year typical, ~4–5 GB/year worst-case |
| Biggest transfer | Agent self-update: ~62 MB per client **per release**, from GitHub |

## Unit cost of one monitored minute

Each minute the agent runs produces **1 `sample`** plus **one `window_events`
row per distinct focused window that minute** (`W`).

| Where | Per minute (W = 2) |
|---|---|
| Client spool (`spool.jsonl`, text) | ~85 B skeleton + ~80 B/window ≈ **~250 B** |
| Server DB (row + indexes) | ~210 B sample + ~155 B/window ≈ **~520 B** |
| Network, live sync (on the wire, HTTPS) | ~1 KB payload+headers + framing ≈ **~1.5 KB** |

---

## Agent — system usage

- **RAM:** ~80–150 MB working set (~100 MB typical). This is normal for a
  self-contained single-file **.NET + WPF** app — the bundle self-extracts and
  loads the CLR plus the WPF assemblies used by the first-run config window. On
  office PCs (8–16 GB) it is inconsequential. The only way to materially lower it
  is a redesign that splits the resident monitor (a ~20–30 MB console process)
  from the WPF config UI; not worth it for 100 MB.
- **CPU:** effectively 0% at idle. Keyboard/mouse hooks are event-driven and do a
  single interlocked increment; a 1 s timer samples the foreground window and
  rolls per-minute buckets.
- **Disk (spool):** see below — a few MB at most.

## Client spool — worst case

Buckets are written to `spool.jsonl` and cleared on each successful sync. While
the server is unreachable the file grows, but it is **hard-capped** at
`MaxBuckets = 20,160` (~14 days of per-minute buckets); beyond that the oldest
lines are dropped.

Example — server offline a week, machine used 12 h/day:

```
buckets = 12 h × 60 × 7 days = 5,040
size    = 5,040 × ~250 B     ≈ 1.3 MB
```

| Window churn | Weekly spool |
|---|---|
| Light (W≈1) | ~0.8 MB |
| Typical (W≈2) | ~1.3 MB |
| Heavy (W≈3–4, long titles) | ~2.5 MB |

Even offline for months the spool tops out at **~5–7 MB**, then syncs and clears
on reconnect. Per day it is only ~150–250 KB.

---

## Network traffic

### Live mode (default, 60 s poll)

Traffic is dominated by HTTP/TLS **headers**, not payload, because a tiny bucket
is sent every minute.

| Scope | Bandwidth | Volume |
|---|---|---|
| 1 client | ~1.5 KB/min (~0.2 kbps) | ~90 KB/hour, ~1.1 MB per 12 h day |
| **30 clients (avg)** | ~45 KB/min (**~6 kbps**) | ~32 MB/day, ~1 GB/month aggregate |
| 30 clients (synchronized burst) | 30 × ~1.5 KB = ~45 KB | ~0.4 ms on a gigabit LAN |

For scale, 6 kbps for the whole fleet is less than 1/10th of one VoIP call.
Server load is ~0.5 requests/second average (≤30 in a burst).

### Timed mode (one upload per day) — ~6× less

Each client buffers all day and sends one request (~720 buckets ≈ ~185 KB),
skipping the per-minute header overhead.

| Scope | Volume |
|---|---|
| 1 client | ~185 KB/day |
| 30 clients | ~5.5 MB/day (one burst if all fire the same minute; still trivial) |

### Self-update downloads — the only sizeable transfer

Steady-state sync is negligible, but when you **publish a new agent release**,
each machine's 6-hourly check eventually downloads the **~62 MB installer** —
~1.9 GB total for 30 clients. This comes from **GitHub's CDN, not your server**,
and is spread out because the checks aren't synchronized. It is occasional (per
release), not continuous.

---

## Server — database growth

```
DB/year ≈ devices × (hours/day × 60) × days/year × (210 + W×155) bytes
```

| Scenario | Assumptions | DB size / year |
|---|---|---|
| Realistic office | 8 h × 250 days, W=2 | ~1.8–2.3 GB |
| Worst realistic | 12 h × 365 days, W=2 | ~4.1–5 GB |
| Heavy switching | 12 h × 365, W=3–4 | ~5.5–8 GB |
| Extreme (24/7) | 24 h × 365, W=3 | ~10–13 GB |

Roughly **65–170 MB per machine per year**, scaling linearly with headcount.
Add ~15–25% for SQLite page/WAL overhead.

---

## Capacity-planning levers

- **Retention.** Nothing prunes old data by default, so the DB grows every year
  (year 2 ≈ 2×, …). A retention policy (delete `samples`/`window_events` older
  than N days) is the single biggest lever for bounding long-term size.
- **Sync mode / poll interval.** Timed sync — or a longer live poll interval —
  cuts steady-state network traffic several-fold.
- **`device_id` as a UUID string** is stored in every row and index (~35–40% of
  each row); an integer device FK would cut DB size ~30%.
- **`VACUUM`** — SQLite does not shrink the file after deletes without it.
- **Reverse-proxy compression** (gzip/br) on the API further shrinks live-sync
  responses, though the volumes are already trivial.
