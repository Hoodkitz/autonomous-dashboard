## 2024-05-22 - File System Latency Optimization
**Learning:** `fs.existsSync` is synchronous and blocks the event loop. In high-frequency paths like engine state reads/writes, this adds significant overhead. Cached directory checks (`Set<string>`) combined with `fs/promises` `mkdir` (which is fast if dir exists) reduce write check latency by >90%.
**Action:** Replace `existsSync` with `try/catch` around async `readFile`, and use a `knownDirs` cache for `mkdir` calls, ensuring `ENOENT` is handled by clearing the cache and retrying.
