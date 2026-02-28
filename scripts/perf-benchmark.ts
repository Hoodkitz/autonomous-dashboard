import { existsSync } from 'fs';
import { join } from 'path';

function bench(name: string, iters: number, fn: () => void) {
  const start = process.hrtime.bigint();
  for (let i = 0; i < iters; i++) {
    fn();
  }
  const end = process.hrtime.bigint();
  const ms = Number(end - start) / 1_000_000;
  console.log(`${name}: ${ms.toFixed(2)}ms`);
}

const ENGINE_DIR = join(process.cwd(), ".autonomous-engine");

const knownDirs = new Set<string>();

function ensureDir(dir: string) {
    if (knownDirs.has(dir)) return;
    if (!existsSync(dir)) {
        // mock mkdir
    }
    knownDirs.add(dir);
}

const targetDir = join(ENGINE_DIR, "revenue");

bench("ensureDir with existsSync cache", 100000, () => {
    ensureDir(targetDir);
});

bench("ensureDir with existsSync NO CACHE", 100000, () => {
    if (!existsSync(targetDir)) {
        // mock
    }
});
