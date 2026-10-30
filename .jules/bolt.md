## 2024-02-25 - Synchronous I/O Bottleneck in Engine
**Learning:** Synchronous `existsSync` calls block the event loop. Replacing them with `fs/promises` and `try/catch` improves concurrency. Crucially, Cloudflare Workers/Pages builds fail on static `fs` imports. Using dynamic `import('fs/promises')` inside functions fixes the build while maintaining Node.js functionality.
**Action:** Audit shared libraries. If a file is imported by both API routes and Client Components (or shared code), ensure Node.js built-ins (`fs`, `path`, `os`) are imported dynamically.
