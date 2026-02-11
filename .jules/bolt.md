## 2026-02-11 - [Sync I/O Anti-Pattern]
**Learning:** Avoid `existsSync` in async file operations. It blocks the event loop, degrading performance in high-concurrency environments like Next.js API routes.
**Action:** Use `try/catch` around `readFile` and unconditional `mkdir({ recursive: true })` instead.
## 2026-02-11 - [CI/Cloudflare Workers]
**Learning:** Cloudflare Workers/Pages builds require explicit `export const runtime = 'nodejs';` in API routes that use Node.js native modules like `fs` or `child_process`, even if `nodejs_compat` is enabled.
**Action:** Always add this export to API routes doing file I/O.
