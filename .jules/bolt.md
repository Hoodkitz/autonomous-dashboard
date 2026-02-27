## 2024-05-23 - Cloudflare Workers vs. Node.js FS
**Learning:** `app/lib/engine.ts` uses Node.js-specific modules (`fs`, `path`, `os`) at the top level. When this library is imported by API routes, those routes MUST explicitly opt-in to the Node.js runtime using `export const runtime = 'nodejs';`. Otherwise, Cloudflare Workers builds (which default to Edge/Standard runtime) will fail with bundling errors for these modules.
**Action:** When adding or modifying API routes that use `fs` or internal libraries like `engine.ts`, always ensure `export const runtime = 'nodejs';` is present.
