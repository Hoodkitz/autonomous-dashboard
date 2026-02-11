## 2026-02-11 - [Sync I/O Anti-Pattern]
**Learning:** Avoid `existsSync` in async file operations. It blocks the event loop, degrading performance in high-concurrency environments like Next.js API routes.
**Action:** Use `try/catch` around `readFile` and unconditional `mkdir({ recursive: true })` instead.
