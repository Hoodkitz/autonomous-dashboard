## 2024-02-25 - Synchronous I/O Bottleneck in Engine
**Learning:** Synchronous `existsSync` calls in high-frequency paths (like `writeJson` and `appendLog`) block the Node.js event loop. Replacing them with a `knownDirs` cache and `fs/promises` `mkdir` reduced directory check overhead from ~8ms to <1ms in benchmarks.
**Action:** Audit shared libraries for `import ... from "fs"` and replace with `fs/promises`. Use `try/catch` patterns for file existence instead of pre-checking.
