## 2025-05-15 - Parallelize Research Scans
**Learning:** Sequential execution of independent AI-bound tasks significantly increases latency. Using `Promise.allSettled` allows for parallel execution while remaining resilient to individual failures. Batching state updates after parallel operations prevents race conditions and redundant I/O.
**Action:** Always identify independent high-latency operations and parallelize them. Replace internal HTTP requests with direct function calls when refactoring within the same API domain.
