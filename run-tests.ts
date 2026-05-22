/**
 * @file run-tests.ts
 * @description Test runner that sets up temporary path overrides for Bun test,
 *              preventing Flow compilation errors in React Native while keeping
 *              normal TypeScript type-checking intact.
 */

import { spawnSync } from 'child_process';
import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

const tsconfigPath = join(process.cwd(), 'tsconfig.json');
const originalContent = readFileSync(tsconfigPath, 'utf8');

// Parse original config
const tsconfig = JSON.parse(originalContent);

// Add temporary test path mappings
tsconfig.compilerOptions = tsconfig.compilerOptions || {};
tsconfig.compilerOptions.baseUrl = '.';
tsconfig.compilerOptions.paths = tsconfig.compilerOptions.paths || {};
tsconfig.compilerOptions.paths['react-native'] = ['./react-native-mock.ts'];
tsconfig.compilerOptions.paths['expo-sqlite'] = ['./expo-sqlite-mock.ts'];

let exitStatus = 0;
try {
  // Write the modified tsconfig.json
  writeFileSync(tsconfigPath, JSON.stringify(tsconfig, null, 2), 'utf8');

  console.log('[test-runner] tsconfig.json updated with mock path mappings.');

  // Run bun test
  const result = spawnSync('bun', ['test'], { stdio: 'inherit', shell: true });

  exitStatus = result.status ?? 0;
} finally {
  // Always restore the original tsconfig.json
  writeFileSync(tsconfigPath, originalContent, 'utf8');
  console.log('[test-runner] tsconfig.json restored.');
}

process.exit(exitStatus);
