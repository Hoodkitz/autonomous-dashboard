## 2025-02-26 - Filesystem Cache Optimization
**Learning:** Checking file/directory existence with `existsSync` before writing is a significant bottleneck (2x slower) compared to caching known directories in memory, especially in high-frequency logging or state updates.
**Action:** Use a `Set<string>` to cache confirmed directories and avoid redundant FS calls. Prefer `mkdir({ recursive: true })` over existence checks.
