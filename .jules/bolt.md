## 2024-05-23 - Optimizing File System Checks
**Learning:** `fs.existsSync` is significantly faster than `try/catch` around `fs.readFile` when the file is frequently missing (benchmark showed ~17ms vs ~665ms for 5000 iterations). However, for *existing* files, the overhead is negligible.
**Action:** Retain `existsSync` checks for `readJson` where missing files are a common expected state. Optimize `writeJson` and `appendLog` by caching known existing directories in a `Set<string>` to skip redundant `mkdir -p` calls.

## 2024-05-23 - TypeScript Build Issues
**Learning:** Next.js build is strict about types. Several API routes had hidden type errors (`round` vs `rounds`, `NoticeBoard` casting, Playwright types) that were not caught by linting but failed the build.
**Action:** Always run `npm run build` locally before submitting changes, even for backend-only changes, as Next.js compiles everything together.
