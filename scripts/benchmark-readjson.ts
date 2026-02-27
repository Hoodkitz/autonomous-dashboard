
import { join } from "path";
import { homedir } from "os";
import { readFile, writeFile, unlink, mkdir } from "fs/promises";
import { existsSync } from "fs";

const HOME = process.env.USERPROFILE || homedir();
const ENGINE_DIR = join(HOME, ".autonomous-engine");
const TEST_FILE = "benchmark_test.json";

// Original implementation
async function readJsonOriginal<T>(relPath: string, fallback: T): Promise<T> {
  try {
    const full = join(ENGINE_DIR, relPath);
    if (!existsSync(full)) return fallback;
    const data = await readFile(full, "utf-8");
    return JSON.parse(data) as T;
  } catch {
    return fallback;
  }
}

// Optimized implementation
async function readJsonOptimized<T>(relPath: string, fallback: T): Promise<T> {
  try {
    const full = join(ENGINE_DIR, relPath);
    const data = await readFile(full, "utf-8");
    return JSON.parse(data) as T;
  } catch (error: any) {
    return fallback;
  }
}

async function runBenchmark() {
  // Setup
  const dir = join(ENGINE_DIR);
  if (!existsSync(dir)) await mkdir(dir, { recursive: true });
  const fullPath = join(ENGINE_DIR, TEST_FILE);
  await writeFile(fullPath, JSON.stringify({ test: "data" }));

  const iterations = 5000;

  console.log(`Benchmarking readJson (${iterations} iterations)...`);

  // 1. File Exists - Original
  const startOriginal = performance.now();
  for (let i = 0; i < iterations; i++) {
    await readJsonOriginal(TEST_FILE, { test: "fallback" });
  }
  const endOriginal = performance.now();
  console.log(`Original (Exists): ${(endOriginal - startOriginal).toFixed(2)}ms`);

  // 2. File Exists - Optimized
  const startOptimized = performance.now();
  for (let i = 0; i < iterations; i++) {
    await readJsonOptimized(TEST_FILE, { test: "fallback" });
  }
  const endOptimized = performance.now();
  console.log(`Optimized (Exists): ${(endOptimized - startOptimized).toFixed(2)}ms`);

  // 3. File Missing - Original
  const MISSING_FILE = "missing.json";
  if (existsSync(join(ENGINE_DIR, MISSING_FILE))) await unlink(join(ENGINE_DIR, MISSING_FILE));

  const startOriginalMiss = performance.now();
  for (let i = 0; i < iterations; i++) {
    await readJsonOriginal(MISSING_FILE, { test: "fallback" });
  }
  const endOriginalMiss = performance.now();
  console.log(`Original (Missing): ${(endOriginalMiss - startOriginalMiss).toFixed(2)}ms`);

  // 4. File Missing - Optimized
  const startOptimizedMiss = performance.now();
  for (let i = 0; i < iterations; i++) {
    await readJsonOptimized(MISSING_FILE, { test: "fallback" });
  }
  const endOptimizedMiss = performance.now();
  console.log(`Optimized (Missing): ${(endOptimizedMiss - startOptimizedMiss).toFixed(2)}ms`);
}

runBenchmark().catch(console.error);
