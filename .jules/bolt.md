## 2025-02-14 - Blocking I/O vs Try/Catch
**Learning:** `existsSync` is much faster (~0.003ms) than `try/catch` with `readFile` (~0.12ms) for *missing* files in a single-threaded benchmark. However, `existsSync` blocks the entire Node.js event loop.
**Action:** Prioritize non-blocking I/O (EAFP) over micro-benchmarks for "miss" cases in high-concurrency apps, but be aware of the exception overhead. For frequent misses, `fs.promises.stat` (or `access`) might be better than `try/catch` to avoid stack trace generation.
