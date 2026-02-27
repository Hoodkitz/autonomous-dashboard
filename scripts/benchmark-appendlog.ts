
import { join, dirname } from "path";
import { homedir } from "os";
import { writeFile, mkdir, appendFile } from "fs/promises";
import { existsSync } from "fs";

const HOME = process.env.USERPROFILE || homedir();
const ENGINE_DIR = join(HOME, ".autonomous-engine");
const LOG_DIR = join(ENGINE_DIR, "benchmark_logs");

// Original implementation
async function appendLogOriginal(i: number) {
  if (!existsSync(LOG_DIR)) await mkdir(LOG_DIR, { recursive: true });
  await appendFile(join(LOG_DIR, "test.log"), `Log entry ${i}\n`, "utf-8");
}

// Optimized implementation
const knownDirs = new Set<string>();
async function appendLogOptimized(i: number) {
  if (!knownDirs.has(LOG_DIR)) {
      // For benchmark fairness, we use the same sync check logic, just gated by the Set
      if (!existsSync(LOG_DIR)) await mkdir(LOG_DIR, { recursive: true });
      knownDirs.add(LOG_DIR);
  }
  await appendFile(join(LOG_DIR, "test.log"), `Log entry ${i}\n`, "utf-8");
}

async function runBenchmark() {
    // Setup
    if (existsSync(LOG_DIR)) {
        // Clean up previous run if needed, but for append we might want to start fresh or not.
        // Let's just ensure it exists for the 'exists' test case mostly.
    }

    const iterations = 10000;

    console.log(`Benchmarking appendLog (${iterations} iterations)...`);

    // 1. Original
    const startOriginal = performance.now();
    for (let i = 0; i < iterations; i++) {
        await appendLogOriginal(i);
    }
    const endOriginal = performance.now();
    console.log(`Original: ${(endOriginal - startOriginal).toFixed(2)}ms`);

    // 2. Optimized
    const startOptimized = performance.now();
    for (let i = 0; i < iterations; i++) {
        await appendLogOptimized(i);
    }
    const endOptimized = performance.now();
    console.log(`Optimized: ${(endOptimized - startOptimized).toFixed(2)}ms`);
}

runBenchmark().catch(console.error);
