import { getConnectionString } from "../app/lib/supabase";

async function runBenchmark() {
  console.log("Starting benchmark for getConnectionString...");
  const iterations = 1000;
  const start = performance.now();

  for (let i = 0; i < iterations; i++) {
    await getConnectionString();
  }

  const end = performance.now();
  const totalTime = end - start;
  const avgTime = totalTime / iterations;

  console.log(`Total time for ${iterations} iterations: ${totalTime.toFixed(2)}ms`);
  console.log(`Average time per iteration: ${avgTime.toFixed(4)}ms`);
}

runBenchmark();
