
import { join } from "path";
import { homedir } from "os";
import { writeFile, unlink, mkdir } from "fs/promises";
import { existsSync } from "fs";

// Mocking the behavior from app/lib/engine.ts to benchmark it in isolation
// or importing it if possible. Importing is better to test actual code.
// But importing might be tricky with relative paths if I'm in scripts/.
// Let's try to import.

import { readJson, writeJson, appendLog } from "../app/lib/engine";

const HOME = process.env.USERPROFILE || homedir();
const ENGINE_DIR = join(HOME, ".autonomous-engine");
const TEST_FILE = "benchmark_test.json";

async function runBenchmark() {
  console.log("Preparing benchmark...");
  // Ensure we have a file to read
  await writeJson(TEST_FILE, { test: "data" });

  const iterations = 1000;

  // Benchmark readJson (File Exists)
  console.log(`Benchmarking readJson (${iterations} iterations) - File Exists...`);
  const startRead = performance.now();
  for (let i = 0; i < iterations; i++) {
    await readJson(TEST_FILE, { test: "fallback" });
  }
  const endRead = performance.now();
  console.log(`readJson (Exists) took: ${(endRead - startRead).toFixed(2)}ms`);

  // Benchmark readJson (File Missing)
  const MISSING_FILE = "missing_benchmark_file.json";
  if (existsSync(join(ENGINE_DIR, MISSING_FILE))) {
    await unlink(join(ENGINE_DIR, MISSING_FILE));
  }

  console.log(`Benchmarking readJson (${iterations} iterations) - File Missing...`);
  const startReadMissing = performance.now();
  for (let i = 0; i < iterations; i++) {
    await readJson(MISSING_FILE, { test: "fallback" });
  }
  const endReadMissing = performance.now();
  console.log(`readJson (Missing) took: ${(endReadMissing - startReadMissing).toFixed(2)}ms`);


  // Benchmark appendLog
  console.log(`Benchmarking appendLog (${iterations} iterations)...`);
  const startLog = performance.now();
  for (let i = 0; i < iterations; i++) {
    await appendLog("Benchmark log entry");
  }
  const endLog = performance.now();
  console.log(`appendLog took: ${(endLog - startLog).toFixed(2)}ms`);

  console.log("Benchmark complete.");
}

runBenchmark().catch(console.error);
