
import { join } from "path";
import { mkdir, rm, readFile } from "fs/promises";
import { existsSync } from "fs";

const TEST_HOME = join(process.cwd(), "test_home");

async function run() {
  process.env.USERPROFILE = TEST_HOME;
  process.env.HOME = TEST_HOME;

  await mkdir(TEST_HOME, { recursive: true });

  const { getEngineState, updateEngineState, writeJson, appendLog } = await import("../app/lib/engine");

  console.log("Testing getEngineState (missing file)...");
  const missingState = await getEngineState();
  if (missingState.status !== "offline") {
      throw new Error(`getEngineState failed on missing file: expected status 'offline', got '${missingState.status}'`);
  }

  console.log("Testing writeJson (creating state.json)...");
  const initialState = {
    status: "test",
    phase: null,
    currentStep: 0,
    totalSteps: 0,
    lastCheckpoint: new Date().toISOString(),
    currentStory: null,
    completedStories: [],
    failedAttempts: 0,
    executorTier: null,
    resumeInstructions: null,
    taskDescription: null,
    engineVersion: "1.0.0",
    cores: {},
  };

  await writeJson("state.json", initialState);

  console.log("Testing getEngineState (readJson wrapper)...");
  const state = await getEngineState();
  if (state.status !== "test") {
      throw new Error(`getEngineState failed: expected status 'test', got '${state.status}'`);
  }

  console.log("Testing updateEngineState...");
  await updateEngineState({ status: "updated" });
  const updatedState = await getEngineState();
  if (updatedState.status !== "updated") {
      throw new Error(`updateEngineState failed: expected status 'updated', got '${updatedState.status}'`);
  }

  console.log("Testing appendLog...");
  await appendLog("test log entry");

  const date = new Date().toISOString().split("T")[0];
  const logFile = join(TEST_HOME, ".autonomous-engine", "progress", `${date}.log`);
  if (!existsSync(logFile)) {
       throw new Error(`Log file missing at ${logFile}`);
  }
  const content = await readFile(logFile, "utf-8");
  if (!content.includes("test log entry")) {
      throw new Error("Log content mismatch");
  }

  console.log("All tests passed!");
  await rm(TEST_HOME, { recursive: true, force: true });
}

run().catch((err) => {
    console.error(err);
    process.exit(1);
});
