
import { join } from 'path';
import { mkdir, rm, readFile } from 'fs/promises';
import { existsSync } from 'fs';
import { tmpdir } from 'os';

async function run() {
  const TEST_HOME = join(process.cwd(), 'temp-test-home');
  // Set env var to redirect ENGINE_DIR
  process.env.USERPROFILE = TEST_HOME;

  // Clean up previous run
  await rm(TEST_HOME, { recursive: true, force: true });
  await mkdir(TEST_HOME, { recursive: true });

  console.log('Test HOME:', TEST_HOME);

  // Dynamic import to pick up the new env var
  // We need to use the absolute path or correct relative path.
  // Since we are running from root with node scripts/verify-engine.ts,
  // and this file is in scripts/, ../app/lib/engine.ts is correct relative to this file?
  // No, imports are relative to the file containing the import.
  const { writeJson, readJson, appendLog } = await import('../app/lib/engine.ts');

  console.log('Testing writeJson...');
  const testData = { foo: 'bar' };
  await writeJson('test.json', testData);

  // Verify file exists
  const engineDir = join(TEST_HOME, '.autonomous-engine');
  const testFile = join(engineDir, 'test.json');

  if (!existsSync(testFile)) throw new Error('writeJson failed to create file');
  const content = JSON.parse(await readFile(testFile, 'utf-8'));
  if (content.foo !== 'bar') throw new Error('writeJson wrote incorrect content');
  console.log('writeJson passed');

  console.log('Testing readJson...');
  const readData = await readJson('test.json', {});
  if ((readData as any).foo !== 'bar') throw new Error('readJson failed to read content');
  console.log('readJson passed');

  console.log('Testing appendLog...');
  await appendLog('log entry 1');
  await appendLog('log entry 2');

  // Check log file
  const today = new Date().toISOString().split('T')[0];
  const logFile = join(engineDir, 'progress', `${today}.log`);
  if (!existsSync(logFile)) throw new Error('appendLog failed to create log file');

  const logContent = await readFile(logFile, 'utf-8');
  if (!logContent.includes('log entry 1') || !logContent.includes('log entry 2')) {
    throw new Error('appendLog content missing');
  }
  console.log('appendLog passed');

  // Clean up
  await rm(TEST_HOME, { recursive: true, force: true });
  console.log('All tests passed!');
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
