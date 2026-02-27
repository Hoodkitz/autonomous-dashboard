## 2024-05-23 - Robust Cloudflare Compatibility
**Learning:** Even with `export const runtime = 'nodejs'`, importing Node.js-specific modules (`fs`, `os`) at the top level of a shared library can cause build failures in Cloudflare Workers if the bundler attempts to process that file in a non-Node context (e.g., shared chunks or default analysis).
**Action:** For maximum compatibility in hybrid environments (Next.js + Cloudflare), wrap Node.js-specific imports in `await import(...)` inside functions. This prevents build-time evaluation of these modules in incompatible runtimes.
