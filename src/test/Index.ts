// Test exports
export { TestHelpers } from './utils/TestHelpers.js';

export async function runTests(): Promise<void> {
  const { execSync } = require('node:child_process');
  try {
    execSync('npx vitest run', { stdio: 'inherit' });
  } catch {
    console.log('Some tests failed - check output above');
  }
}