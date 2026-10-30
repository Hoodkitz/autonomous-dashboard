import { existsSync, mkdirSync, writeFileSync, rmSync } from "fs";
import { readFile } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";

const TEST_DIR = join(tmpdir(), "bolt-benchmark-" + Date.now());
const TEST_FILE = join(TEST_DIR, "test.json");

mkdirSync(TEST_DIR, { recursive: true });
writeFileSync(TEST_FILE, JSON.stringify({ hello: "world" }));

const ITERATIONS = 10000;

async function runBenchmark() {
  console.log(`Running ${ITERATIONS} iterations...`);

  // Measure Sync Check + Async Read
  const startSyncCheck = process.hrtime.bigint();
  for (let i = 0; i < ITERATIONS; i++) {
    if (existsSync(TEST_FILE)) {
      await readFile(TEST_FILE, "utf-8");
    }
  }
  const endSyncCheck = process.hrtime.bigint();

  // Measure Async Read + Catch
  const startAsyncRead = process.hrtime.bigint();
  for (let i = 0; i < ITERATIONS; i++) {
    try {
      await readFile(TEST_FILE, "utf-8");
    } catch {
      // ignore
    }
  }
  const endAsyncRead = process.hrtime.bigint();

  const syncCheckTime = Number(endSyncCheck - startSyncCheck) / 1e6; // ms
  const asyncReadTime = Number(endAsyncRead - startAsyncRead) / 1e6; // ms

  console.log(`Sync Check + Async Read: ${syncCheckTime.toFixed(2)}ms`);
  console.log(`Async Read + Catch:      ${asyncReadTime.toFixed(2)}ms`);

  const diff = syncCheckTime - asyncReadTime;
  const pct = (diff / syncCheckTime) * 100;

  console.log(`Improvement:             ${diff.toFixed(2)}ms (${pct.toFixed(2)}%)`);

  rmSync(TEST_DIR, { recursive: true, force: true });
}

runBenchmark();
