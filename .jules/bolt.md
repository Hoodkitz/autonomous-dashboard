# Bolt's Journal

## 2026-02-07 - [Blocking FS Calls]
**Learning:** `existsSync` blocks the event loop and introduces TOCTOU race conditions. In high-frequency paths like `getEngineState`, replacing it with `try/catch` around async `readFile` improves concurrency.
**Action:** Audit other backend routes for `existsSync` and replace with async patterns.
