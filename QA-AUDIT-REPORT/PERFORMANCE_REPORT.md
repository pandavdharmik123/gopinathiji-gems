# Gopinathji Gems — Performance Report

**Audit date:** 2026-11-09
**Probe:** `server/qa/load-test.mjs` (Node 24 `fetch`, percentile calculation, warm-up, concurrency)
**Target:** `http://127.0.0.1:3912` against isolated `gopinathji_gems_qa`
**Datasets:**
- **Small:** 9 transactions / 3 parties (production-like fixture).
- **Large:** 30 000 synthetic transactions / 3 parties (scalability stress).
**Requests:** **320 per dataset**, twice = 640 total.
**HTTP failures:** **0** in both runs.
**Raw evidence:** `/tmp/qa-load.log`, `/tmp/qa-load-30k.log`

> k6 was not installed; the Node probe reproduces its core measurements (sequential latency percentiles, concurrent burst, mixed workload, throughput, payload size). Lighthouse was not available; frontend performance is assessed via production build output and rendering checks.

---

## 1. Small dataset (9 transactions)

### Sequential (20 requests each)

| Route | p50 | p90 | p95 | p99 | max | RPS | avg bytes |
|---|---|---|---|---|---|---|---|
| `/api/transactions?limit=50` | 0.9 ms | 1.0 | 1.1 | 2.3 | 2.3 | 1 030.7 | 3 726 |
| `/api/transactions?limit=50&page=2` | 0.5 | 0.6 | 0.6 | 0.6 | 0.6 | 1 852.7 | 75 |
| `/api/parties` | 0.7 | 1.0 | 1.0 | 1.8 | 1.8 | 1 308.4 | 1 150 |
| `/api/reports/summary` | 0.8 | 0.9 | 0.9 | 1.0 | 1.0 | 1 250.9 | 185 |
| `/api/reports/yearly?year=2026` | 0.5 | 0.5 | 0.5 | 0.7 | 0.7 | 2 026.1 | 779 |
| `/api/reports/outstanding` | 0.5 | 0.6 | 0.6 | 0.8 | 0.8 | 1 796.0 | 1 139 |

### Concurrent burst (20 users × 5 rounds)

| Route | n | Fail | p50 | p90 | p95 | p99 | max | RPS |
|---|---|---|---|---|---|---|---|---|
| `/api/transactions?limit=50` | 100 | 0 | 3.0 ms | 10.7 | 17.4 | 23.9 | 24.6 | 2 417.4 |

### Mixed workload (100 requests, concurrency 10)

| n | Fail | p50 | p90 | p95 | p99 | max | RPS |
|---|---|---|---|---|---|---|---|
| 100 | 0 | 1.6 ms | 2.7 | 2.8 | 3.4 | 3.4 | 5 316.2 |

### Unbounded limit probe

`GET /api/transactions?limit=100000` → **200**, **0.7 ms**, **3 730 bytes** (small dataset).

---

## 2. Large dataset (30 000 transactions)

### Sequential (20 requests each)

| Route | p50 | p90 | p95 | p99 | max | RPS | avg bytes |
|---|---|---|---|---|---|---|---|
| `/api/transactions?limit=50` | 4.8 ms | 5.0 | 6.1 | 6.4 | 6.4 | 211.0 | 19 731 |
| `/api/transactions?limit=50&page=2` | 4.0 | 4.8 | 4.9 | 5.0 | 5.0 | 237.1 | 19 673 |
| `/api/parties` | 99.8 | 102.1 | **106.8** | 110.1 | 110.1 | 10.0 | 1 159 |
| `/api/reports/summary` | 90.3 | 92.3 | 92.5 | 92.8 | 92.8 | 11.0 | 214 |
| `/api/reports/yearly?year=2026` | 72.8 | 76.2 | 76.5 | 78.0 | 78.0 | 13.7 | 892 |
| `/api/reports/outstanding` | 95.7 | 97.0 | 97.1 | 98.5 | 98.5 | 10.4 | 1 156 |

### Concurrent burst (20 users × 5 rounds)

| Route | n | Fail | p50 | p90 | p95 | p99 | max | RPS |
|---|---|---|---|---|---|---|---|---|
| `/api/transactions?limit=50` | 100 | 0 | 6.6 ms | 16.5 | 23.8 | 26.8 | 27.8 | 1 585.6 |

### Mixed workload (100 requests, concurrency 10)

| n | Fail | p50 | p90 | p95 | p99 | max | RPS |
|---|---|---|---|---|---|---|---|
| 100 | 0 | 212.4 ms | 334.3 | **367.8** | 407.4 | 456.6 | 47.2 |

### Unbounded limit probe

`GET /api/transactions?limit=100000` → **200**, **399.8 ms**, **11 770 722 bytes (11.77 MB)**.

---

## 3. Analysis

### Latency scaling
- Exit-criteria-friendly on the small dataset: every p95 ≤ **1.1 ms** sequentially, mixed p95 **2.8 ms**.
- On 30 000 rows, list endpoints stay fast (**p95 6.1 ms**) because of indexing and limit 50.
- Report endpoints and `/parties` degrade to **p95 92–107 ms** sequentially. These endpoints load transactions into memory (and `/outstanding` includes all transactions per party), so cost grows with row count. Still under 200 ms at 30 k rows, but the trend is linear and will breach 500 ms as data grows.
- Mixed workload p95 **367.8 ms** is dominated by the unfiltered `/parties` and `/outstanding` queries running under concurrency. Throughput drops from **5 316 RPS** (small) to **47 RPS** (30 k) for the mixed set.

### Payload size
- Transaction list pages are ~19.7 KB for 50 rows at 30 k rows (fine).
- **Unbounded limit is the standout risk:** 11.77 MB in 399.8 ms from a single unauthenticated-by-cap request. A handful of concurrent calls can exhaust memory/bandwidth (see QA-015).

### No failures
- 0 HTTP failures across 640 requests, including concurrency 20. The server is stable under the tested load; no crashes, timeouts, or 5xx.

### Memory/algorithmic concerns (source)
- `/api/reports/outstanding` (`reports.ts:210-227`) pulls every party with **all** related transactions and reduces in JS. This is O(total transactions) per request and duplicates data already aggregated elsewhere. Push aggregation into SQL (`groupBy`) and filter by the active year.
- `/api/reports/summary` similarly fetches year transactions and reduces in JS.
- `/api/parties` likely computes balances by loading transactions; consider a DB aggregate or a materialized balance.

---

## 4. Frontend build & payload

| Metric | Value |
|---|---|
| Production build | ✅ succeeds |
| Single JS bundle | **1 635.91 kB** |
| Gzipped | **500.03 kB** |
| Route-level code splitting | ❌ none |
| Lazy loading | ❌ none |
| Source maps | Not assessed |

**Impact.** ~500 KB gzip is heavy for a mobile-first Gujarati SME app, especially on 3G/4G in rural areas. All pages, Ant Design, charting and the PDF generator load up front. First interaction is delayed.

**Recommendation.** Use `React.lazy` + `Suspense` per route, split vendor chunks (`antd`, charts, PDF), import AntD components individually (tree-shaking already helps but bundle is large), and preload only the dashboard. Target < 250 KB gzip initial.

---

## 5. Responsive / rendering performance

- Playwright mobile (412 px) run: **no horizontal overflow** (`scrollWidth 412 = innerWidth 412`) on login and dashboard, and mobile navigation opens/works.
- No layout-shift or jank measurement was possible without Lighthouse. Rendering was stable across the 12 E2E sessions (no timeouts except intentional 15 s waits in failing RBAC tests).
- AntD deprecation warnings fire on every render (`Card`, `Space`, `Drawer`, `Modal`, `Alert`) — console noise, not measured as CPU.

---

## 6. Bottleneck ranking

| Rank | Issue | Evidence | Fix |
|---|---|---|---|
| 1 | Unbounded `limit` | 11.77 MB / 399.8 ms | Cap at 200; cursor pagination |
| 2 | In-JS report aggregation | p95 92–107 ms at 30 k; linear growth | SQL `groupBy`/aggregates, year filter |
| 3 | `/parties` balance computation | p95 106.8 ms at 30 k | DB aggregate / cached balance |
| 4 | Mixed concurrency collapse | p95 367.8 ms, 47 RPS | Fix 1–3; add cache |
| 5 | 500 KB gzip initial bundle | Build output | Code splitting |
| 6 | No caching layer | Repeated identical report calls recompute | Short-TTL cache/ETag |

---

## 7. Capacity estimate (extrapolated)

At 30 k transactions the sequential report p95 is ~100 ms. Assuming roughly linear growth (in-memory reductions), 100 k transactions would put report p95 near ~350 ms and mixed-workload p95 near 1 s+. For a growing gem-trading ledger this is reachable within a few years. **Fix the aggregation queries before that point**, not after.

Concurrency 20 was stable. No load test beyond 20 concurrent users was run; a k6/ZAP-scale test is recommended before launch.

---

## 8. Limitations

| Requested | Status | Substitute |
|---|---|---|
| k6 | Not installed | Node fetch probe with percentiles/concurrency |
| Lighthouse | Not installed | Build size, Playwright mobile render, axe |
| APM/profiling | Not available | Source-level algorithmic review |
| Production network conditions | Not simulated | Localhost loopback (latency excludes network) |

Latency figures therefore represent server processing time, not real-world round-trip time. Add 50–200 ms for mobile networks.
