#!/usr/bin/env node
// tests/integration/test-runner.mjs
// Integration test runner with YAML support
// Executes test sequences and validates results

import * as net from 'net';
import { randomBytes } from 'crypto';
import * as path from 'path';
import * as fs from 'fs/promises';
import { fileURLToPath } from 'url';
import yaml from 'js-yaml';

// Resolve paths
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const VAULT_PATH = path.resolve(__dirname, '../../../..');
const SOCKET_PATH = path.join(VAULT_PATH, '.obsidian/plugins/salt-marcher/ipc.sock');
const TEST_CASES_DIR = path.join(__dirname, 'test-cases');
const TEST_RESULTS_DIR = path.join(__dirname, 'results');
const TIMEOUT = 120000; // 120 seconds

/**
 * Execute a command via IPC and return the result
 */
async function executeCommand(command, args = [], timeout = TIMEOUT) {
  return new Promise((resolve, reject) => {
    const client = net.createConnection(SOCKET_PATH);
    const id = randomBytes(8).toString('hex');
    let buffer = '';

    const timeoutHandle = setTimeout(() => {
      client.destroy();
      reject(new Error(`Command timeout: ${command}`));
    }, timeout);

    client.on('connect', () => {
      const request = JSON.stringify({ command, args, id }) + '\n';
      client.write(request);
    });

    client.on('data', (data) => {
      buffer += data.toString();

      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (!line.trim()) continue;

        try {
          const response = JSON.parse(line);
          if (response.id === id) {
            clearTimeout(timeoutHandle);
            client.end();

            if (response.success) {
              resolve(response.data);
            } else {
              reject(new Error(response.error));
            }
          }
        } catch (error) {
          reject(error);
        }
      }
    });

    client.on('error', (error) => {
      clearTimeout(timeoutHandle);
      if (error.code === 'ENOENT') {
        reject(new Error('Plugin IPC server not running. Is the plugin loaded in Obsidian?'));
      } else {
        reject(error);
      }
    });
  });
}

/**
 * Wait for a specified duration
 */
function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Load a YAML test definition
 */
async function loadTestDefinition(testPath) {
  const content = await fs.readFile(testPath, 'utf-8');
  return yaml.load(content);
}

/**
 * Deep equality check for assertion validation
 */
function deepEqual(actual, expected) {
  if (actual === expected) return true;
  if (actual == null || expected == null) return false;
  if (typeof actual !== 'object' || typeof expected !== 'object') return false;

  const actualKeys = Object.keys(actual);
  const expectedKeys = Object.keys(expected);

  if (actualKeys.length !== expectedKeys.length) return false;

  for (const key of expectedKeys) {
    if (!actualKeys.includes(key)) return false;
    if (!deepEqual(actual[key], expected[key])) return false;
  }

  return true;
}

/**
 * Validate step result against expectations
 */
function validateExpectation(actual, expected) {
  const errors = [];

  for (const [key, expectedValue] of Object.entries(expected)) {
    const actualValue = actual[key];

    if (typeof expectedValue === 'object' && expectedValue !== null && !Array.isArray(expectedValue)) {
      // Nested object comparison
      if (!deepEqual(actualValue, expectedValue)) {
        errors.push(`Expected ${key} to deep equal ${JSON.stringify(expectedValue)}, got ${JSON.stringify(actualValue)}`);
      }
    } else if (actualValue !== expectedValue) {
      errors.push(`Expected ${key} to be ${expectedValue}, got ${actualValue}`);
    }
  }

  return errors;
}

/**
 * Execute a single test step
 */
async function executeStep(step, testId, stepIndex) {
  const stepName = step.name || `Step ${stepIndex + 1}`;
  console.log(`  → ${stepName}`);

  try {
    // Execute command
    const result = await executeCommand(step.command, step.args || []);

    // Wait if specified
    if (step.wait) {
      await wait(step.wait);
    }

    // Validate expectations if present
    if (step.expect) {
      const errors = validateExpectation(result, step.expect);
      if (errors.length > 0) {
        return {
          stepName,
          command: step.command,
          args: step.args,
          success: false,
          errors,
          result,
        };
      }
    }

    return {
      stepName,
      command: step.command,
      args: step.args,
      success: true,
      result,
    };
  } catch (error) {
    return {
      stepName,
      command: step.command,
      args: step.args,
      success: false,
      error: error.message,
    };
  }
}

/**
 * Execute a complete test definition
 */
async function executeTest(testDef, testPath) {
  const testName = testDef.name || path.basename(testPath, '.yaml');
  const testId = `test_${Date.now()}_${randomBytes(4).toString('hex')}`;

  console.log(`\n🧪 Running test: ${testName}`);
  if (testDef.description) {
    console.log(`   ${testDef.description}`);
  }

  const results = {
    testName,
    testId,
    testPath,
    startTime: Date.now(),
    steps: [],
    success: true,
  };

  try {
    // Start test context
    console.log('  ⏱  Starting test context...');
    await executeCommand('start-test', [testId, testName]);

    // Set debug config if specified
    if (testDef.debugConfig) {
      console.log('  ⚙  Setting debug config...');
      await executeCommand('set-debug-config', [JSON.stringify(testDef.debugConfig)]);
    }

    // Run setup steps
    if (testDef.setup) {
      console.log('  📋 Running setup...');
      for (const [i, step] of testDef.setup.entries()) {
        const result = await executeStep(step, testId, i);
        results.steps.push(result);
        if (!result.success) {
          results.success = false;
          console.log(`    ❌ Setup failed: ${result.stepName}`);
          break;
        }
      }
    }

    // Run test steps (only if setup succeeded)
    if (results.success && testDef.steps) {
      console.log('  🔄 Running test steps...');
      for (const [i, step] of testDef.steps.entries()) {
        const result = await executeStep(step, testId, i);
        results.steps.push(result);
        if (!result.success) {
          results.success = false;
          console.log(`    ❌ Step failed: ${result.stepName}`);
          if (result.errors) {
            result.errors.forEach(err => console.log(`       • ${err}`));
          } else if (result.error) {
            console.log(`       • ${result.error}`);
          }
          break;
        }
      }
    }

    // Run cleanup steps (always, even if tests failed)
    if (testDef.cleanup) {
      console.log('  🧹 Running cleanup...');
      for (const [i, step] of testDef.cleanup.entries()) {
        const result = await executeStep(step, testId, i);
        // Don't fail the test if cleanup fails, but log it
        if (!result.success) {
          console.log(`    ⚠  Cleanup warning: ${result.stepName}`);
        }
      }
    }

    // End test context and collect logs
    console.log('  📊 Collecting test logs...');
    const testContext = await executeCommand('end-test', []);
    results.duration = testContext.duration;
    results.markerCount = testContext.markerCount;

    // Get test logs
    const testLogs = await executeCommand('get-test-logs', [testId]);
    results.logs = testLogs.logs;
    results.logCount = testLogs.logCount;

  } catch (error) {
    results.success = false;
    results.error = error.message;
    console.log(`  ❌ Test execution error: ${error.message}`);
  }

  results.endTime = Date.now();
  results.totalDuration = results.endTime - results.startTime;

  // Print result
  if (results.success) {
    console.log(`  ✅ Test passed (${results.totalDuration}ms)`);
  } else {
    console.log(`  ❌ Test failed (${results.totalDuration}ms)`);
  }

  return results;
}

/**
 * Save test results to disk
 */
async function saveResults(results) {
  await fs.mkdir(TEST_RESULTS_DIR, { recursive: true });

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `${results.testId}_${timestamp}.json`;
  const filepath = path.join(TEST_RESULTS_DIR, filename);

  await fs.writeFile(filepath, JSON.stringify(results, null, 2));
  console.log(`\n📁 Results saved to: ${path.relative(process.cwd(), filepath)}`);

  return filepath;
}

/**
 * Generate a summary report
 */
function generateSummary(allResults) {
  const total = allResults.length;
  const passed = allResults.filter(r => r.success).length;
  const failed = total - passed;

  console.log('\n' + '='.repeat(60));
  console.log('📊 TEST SUMMARY');
  console.log('='.repeat(60));
  console.log(`Total:  ${total}`);
  console.log(`Passed: ${passed} ✅`);
  console.log(`Failed: ${failed} ❌`);
  console.log('='.repeat(60));

  if (failed > 0) {
    console.log('\n❌ Failed tests:');
    allResults
      .filter(r => !r.success)
      .forEach(r => {
        console.log(`  • ${r.testName}`);
        if (r.error) {
          console.log(`    ${r.error}`);
        }
      });
  }

  return { total, passed, failed };
}

/**
 * Main CLI interface
 */
async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0 || args[0] === '--help') {
    console.log('Usage: test-runner.mjs <test-file-or-pattern> [options]');
    console.log('');
    console.log('Arguments:');
    console.log('  <test-file>    Path to YAML test file (relative to test-cases/)');
    console.log('  all            Run all test files in test-cases/');
    console.log('');
    console.log('Options:');
    console.log('  --save         Save test results to disk (always on)');
    console.log('  --verbose      Show detailed output');
    console.log('');
    console.log('Examples:');
    console.log('  ./test-runner.mjs save-proficiency-toggle.yaml');
    console.log('  ./test-runner.mjs all');
    process.exit(0);
  }

  const testPattern = args[0];
  const saveResults_ = true; // Always save results

  let testFiles = [];

  if (testPattern === 'all') {
    // Run all YAML files in test-cases/
    const files = await fs.readdir(TEST_CASES_DIR);
    testFiles = files
      .filter(f => f.endsWith('.yaml') || f.endsWith('.yml'))
      .map(f => path.join(TEST_CASES_DIR, f));
  } else {
    // Single test file
    const testPath = path.isAbsolute(testPattern)
      ? testPattern
      : path.join(TEST_CASES_DIR, testPattern);
    testFiles = [testPath];
  }

  if (testFiles.length === 0) {
    console.error('❌ No test files found');
    process.exit(1);
  }

  console.log(`Found ${testFiles.length} test(s) to run`);

  const allResults = [];

  for (const testFile of testFiles) {
    try {
      const testDef = await loadTestDefinition(testFile);
      const results = await executeTest(testDef, testFile);
      allResults.push(results);

      if (saveResults_) {
        await saveResults(results);
      }
    } catch (error) {
      console.error(`❌ Failed to load/run test ${testFile}: ${error.message}`);
      allResults.push({
        testName: path.basename(testFile),
        testPath: testFile,
        success: false,
        error: error.message,
      });
    }
  }

  // Generate summary
  const summary = generateSummary(allResults);

  // Exit with appropriate code
  process.exit(summary.failed > 0 ? 1 : 0);
}

// Run main
main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
