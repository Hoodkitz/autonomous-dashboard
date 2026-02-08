## 2026-02-08 - Avoid Synchronous File System Checks
**Learning:** Using `existsSync` before async file operations (like `readFile` or `mkdir`) blocks the Node.js event loop and introduces potential race conditions.
**Action:** Prefer `try/catch` around `readFile` (catching ENOENT) and using `mkdir({ recursive: true })` unconditionally. This improves throughput under load.
