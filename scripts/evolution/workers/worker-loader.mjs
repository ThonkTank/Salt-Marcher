// Worker loader for TypeScript support
// Explicitly register tsx for TypeScript resolution

import { register } from 'node:module';
import { pathToFileURL } from 'node:url';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

console.log('[worker-loader] Starting...');
console.log('[worker-loader] Registering tsx...');

// Register tsx with the correct base URL
// This ensures all subsequent imports go through tsx
register('tsx', pathToFileURL(__dirname + '/'));

console.log('[worker-loader] tsx registered');

// Now import the TypeScript worker
console.log('[worker-loader] Importing evaluationWorker.ts...');
await import('./evaluationWorker.ts');
console.log('[worker-loader] Worker loaded successfully');
