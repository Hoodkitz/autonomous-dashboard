## 2026-02-13 - [Async FS Pattern]
**Learning:** The codebase relies heavily on local JSON state in `~/.autonomous-engine`. Using synchronous `existsSync` checks before file operations creates unnecessary blocking syscalls and race conditions.
**Action:** Replace `existsSync` + `readFile` with `readFile` + `catch ENOENT`. Use an in-memory `Set` cache for created directories to avoid redundant `mkdir` calls.
