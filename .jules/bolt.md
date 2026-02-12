## 2025-02-19 - Filesystem Caching Strategy
**Learning:** Frequent `mkdir -p` calls (even if the directory exists) add significant overhead (~1.4ms/op vs ~0.66ms/op when cached) compared to memory checks. `existsSync` blocks the event loop and must be avoided.
**Action:** Use an in-memory `Set` to cache known existing directories for write operations in high-frequency paths (like logging or state updates).
