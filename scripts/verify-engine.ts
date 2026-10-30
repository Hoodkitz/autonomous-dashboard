import { appendLog, getEngineState, updateEngineState } from "../app/lib/engine";
import { join } from "path";
import { homedir } from "os";
import { readFile } from "fs/promises";

async function verify() {
  console.log("Verifying engine operations...");

  const HOME = process.env.USERPROFILE || homedir();
  const ENGINE_DIR = join(HOME, ".autonomous-engine");

  console.log(`Targeting ENGINE_DIR: ${ENGINE_DIR}`);

  // Test writeJson (via updateEngineState)
  console.log("Testing writeJson via updateEngineState...");
  const timestamp = Date.now();
  await updateEngineState({ taskDescription: `Test task ${timestamp}` });

  // Verify with getEngineState (uses readJson internally)
  console.log("Testing readJson via getEngineState...");
  const state = await getEngineState();

  if (state.taskDescription !== `Test task ${timestamp}`) {
    throw new Error(`State mismatch: expected "Test task ${timestamp}", got "${state.taskDescription}"`);
  }
  console.log("State update verified.");

  // Test appendLog
  console.log("Testing appendLog...");
  const logMsg = `Test log ${timestamp}`;
  await appendLog(logMsg);

  // Verify log file content
  const date = new Date().toISOString().split("T")[0];
  const logFile = join(ENGINE_DIR, "progress", `${date}.log`);
  const logContent = await readFile(logFile, "utf-8");

  if (!logContent.includes(logMsg)) {
    throw new Error(`Log mismatch: "${logMsg}" not found in ${logFile}`);
  }
  console.log("Log append verified.");

  console.log("Verification successful!");
}

verify().catch((err) => {
  console.error("Verification failed:", err);
  process.exit(1);
});
