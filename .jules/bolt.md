## 2024-05-23 - Blocking I/O in Async Functions
**Learning:** `existsSync` is a synchronous operation that blocks the Node.js event loop, even when used inside an `async` function. This can degrade server throughput significantly under load, as the single thread is occupied during the syscall.
**Action:** Replace `existsSync` with `fs.promises.stat` or simply `try/catch` around `readFile`/`mkdir` for non-blocking execution. Use in-memory caching (e.g., `Set<string>`) for immutable checks like directory existence to avoid redundant syscalls.
