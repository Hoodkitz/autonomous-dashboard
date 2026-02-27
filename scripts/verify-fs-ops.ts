
import { join } from "path";
import { homedir } from "os";
import { existsSync, readFileSync, rmSync } from "fs";
import { writeJson, appendLog } from "../app/lib/engine";

const HOME = process.env.USERPROFILE || homedir();
const ENGINE_DIR = join(HOME, ".autonomous-engine");
const TEST_SUBDIR = "verification_test";
const TEST_FILE = `${TEST_SUBDIR}/test.json`;

async function verifyFsOps() {
  console.log("Verifying FS operations...");

  // 1. Verify writeJson
  const testData = { success: true, timestamp: Date.now() };
  await writeJson(TEST_FILE, testData);

  const fullPath = join(ENGINE_DIR, TEST_FILE);
  if (!existsSync(fullPath)) {
    throw new Error(`writeJson failed: File ${fullPath} not created.`);
  }

  const content = JSON.parse(readFileSync(fullPath, "utf-8"));
  if (content.success !== true) {
    throw new Error(`writeJson failed: Content mismatch.`);
  }
  console.log("✅ writeJson verified.");

  // 2. Verify appendLog
  // appendLog writes to .autonomous-engine/progress/YYYY-MM-DD.log
  const date = new Date().toISOString().split("T")[0];
  const logFile = join(ENGINE_DIR, "progress", `${date}.log`);

  // Log a unique string to verify
  const uniqueToken = `VERIFY_${Date.now()}_${Math.random()}`;
  await appendLog(uniqueToken);

  if (!existsSync(logFile)) {
    throw new Error(`appendLog failed: Log file ${logFile} not created.`);
  }

  const logContent = readFileSync(logFile, "utf-8");
  if (!logContent.includes(uniqueToken)) {
    throw new Error(`appendLog failed: Token ${uniqueToken} not found in log.`);
  }
  console.log("✅ appendLog verified.");

  // Cleanup
  console.log("Cleaning up...");
  try {
      // Clean up the test file
      if (existsSync(fullPath)) rmSync(fullPath);
      const testDir = join(ENGINE_DIR, TEST_SUBDIR);
      if (existsSync(testDir)) rmSync(testDir, { recursive: true, force: true });
  } catch (e) {
      console.warn("Cleanup warning:", e);
  }

  console.log("✅ Verification complete.");
}

verifyFsOps().catch((err) => {
  console.error("❌ Verification failed:", err);
  process.exit(1);
});
