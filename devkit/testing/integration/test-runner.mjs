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

// Colors for terminal output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
};

// Spinner frames for progress indication
const spinnerFrames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
let spinnerIndex = 0;
let spinnerInterval = null;

function startSpinner(message) {
  process.stdout.write(`  ${colors.blue}${spinnerFrames[0]}${colors.reset} ${message}`);
  spinnerInterval = setInterval(() => {
    spinnerIndex = (spinnerIndex + 1) % spinnerFrames.length;
    process.stdout.write(`\r  ${colors.blue}${spinnerFrames[spinnerIndex]}${colors.reset} ${message}`);
  }, 80);
}

function stopSpinner(success, finalMessage) {
  if (spinnerInterval) {
    clearInterval(spinnerInterval);
    spinnerInterval = null;
  }
  const icon = success ? `${colors.green}✓${colors.reset}` : `${colors.red}✗${colors.reset}`;
  process.stdout.write(`\r  ${icon} ${finalMessage}\n`);
}

// Resolve paths
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const VAULT_PATH = path.resolve(__dirname, '../../../..');
const SOCKET_PATH = path.join(VAULT_PATH, '.obsidian/plugins/salt-marcher/ipc.sock');
const TEST_CASES_DIR = path.join(__dirname, 'cases');
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
  const startTime = Date.now();

  startSpinner(stepName);

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
        const duration = Date.now() - startTime;
        stopSpinner(false, `${stepName} ${colors.dim}(${duration}ms)${colors.reset}`);
        return {
          stepName,
          command: step.command,
          args: step.args,
          success: false,
          errors,
          result,
          duration,
        };
      }
    }

    const duration = Date.now() - startTime;
    stopSpinner(true, `${stepName} ${colors.dim}(${duration}ms)${colors.reset}`);

    return {
      stepName,
      command: step.command,
      args: step.args,
      success: true,
      result,
      duration,
    };
  } catch (error) {
    const duration = Date.now() - startTime;
    stopSpinner(false, `${stepName} ${colors.dim}(${duration}ms)${colors.reset}`);

    return {
      stepName,
      command: step.command,
      args: step.args,
      success: false,
      error: error.message,
      duration,
    };
  }
}

/**
 * Execute a complete test definition
 */
async function executeTest(testDef, testPath) {
  const testName = testDef.name || path.basename(testPath, '.yaml');
  const testId = `test_${Date.now()}_${randomBytes(4).toString('hex')}`;

  console.log(`\n${colors.cyan}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}`);
  console.log(`${colors.bright}🧪 ${testName}${colors.reset}`);
  if (testDef.description) {
    console.log(`${colors.dim}   ${testDef.description}${colors.reset}`);
  }
  console.log(`${colors.cyan}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}`);

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
    startSpinner('Starting test context...');
    await executeCommand('start-test', [testId, testName]);
    stopSpinner(true, 'Test context initialized');

    // Set debug config if specified
    if (testDef.debugConfig) {
      startSpinner('Setting debug config...');
      await executeCommand('set-debug-config', [JSON.stringify(testDef.debugConfig)]);
      stopSpinner(true, 'Debug config applied');
    }

    // Run setup steps
    if (testDef.setup) {
      console.log(`\n  ${colors.bright}📋 Setup (${testDef.setup.length} steps)${colors.reset}`);
      for (const [i, step] of testDef.setup.entries()) {
        const result = await executeStep(step, testId, i);
        results.steps.push(result);
        if (!result.success) {
          results.success = false;
          if (result.errors) {
            result.errors.forEach(err => console.log(`     ${colors.red}→${colors.reset} ${err}`));
          } else if (result.error) {
            console.log(`     ${colors.red}→${colors.reset} ${result.error}`);
          }
          break;
        }
      }
    }

    // Run test steps (only if setup succeeded)
    if (results.success && testDef.steps) {
      console.log(`\n  ${colors.bright}🔄 Test Steps (${testDef.steps.length} steps)${colors.reset}`);
      for (const [i, step] of testDef.steps.entries()) {
        const result = await executeStep(step, testId, i);
        results.steps.push(result);
        if (!result.success) {
          results.success = false;
          if (result.errors) {
            result.errors.forEach(err => console.log(`     ${colors.red}→${colors.reset} ${err}`));
          } else if (result.error) {
            console.log(`     ${colors.red}→${colors.reset} ${result.error}`);
          }
          break;
        }
      }
    }

    // Run cleanup steps (always, even if tests failed)
    if (testDef.cleanup) {
      console.log(`\n  ${colors.bright}🧹 Cleanup (${testDef.cleanup.length} steps)${colors.reset}`);
      for (const [i, step] of testDef.cleanup.entries()) {
        const result = await executeStep(step, testId, i);
        // Don't fail the test if cleanup fails, but log it
        if (!result.success) {
          console.log(`     ${colors.yellow}⚠${colors.reset}  Cleanup warning: ${result.stepName}`);
        }
      }
    }

    // End test context and collect logs
    console.log();
    startSpinner('Collecting test logs...');
    const testContext = await executeCommand('end-test', []);
    results.duration = testContext.duration;
    results.markerCount = testContext.markerCount;

    // Get test logs
    const testLogs = await executeCommand('get-test-logs', [testId]);
    results.logs = testLogs.logs;
    results.logCount = testLogs.logCount;
    stopSpinner(true, `Collected ${testLogs.logCount} log entries`);

  } catch (error) {
    results.success = false;
    results.error = error.message;
    console.log(`  ❌ Test execution error: ${error.message}`);
  }

  results.endTime = Date.now();
  results.totalDuration = results.endTime - results.startTime;

  // Print result
  console.log();
  if (results.success) {
    console.log(`  ${colors.green}${colors.bright}✅ PASSED${colors.reset} ${colors.dim}(${results.totalDuration}ms)${colors.reset}`);
  } else {
    console.log(`  ${colors.red}${colors.bright}❌ FAILED${colors.reset} ${colors.dim}(${results.totalDuration}ms)${colors.reset}`);
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
  const totalDuration = allResults.reduce((sum, r) => sum + (r.totalDuration || 0), 0);

  console.log(`\n${colors.cyan}${'━'.repeat(60)}${colors.reset}`);
  console.log(`${colors.bright}📊 TEST SUMMARY${colors.reset}`);
  console.log(`${colors.cyan}${'━'.repeat(60)}${colors.reset}`);
  console.log(`${colors.bright}Total:${colors.reset}    ${total} tests`);
  console.log(`${colors.green}Passed:${colors.reset}   ${passed} ${colors.green}✓${colors.reset}`);
  console.log(`${colors.red}Failed:${colors.reset}   ${failed} ${colors.red}✗${colors.reset}`);
  console.log(`${colors.blue}Duration:${colors.reset} ${totalDuration}ms ${colors.dim}(avg: ${Math.round(totalDuration / total)}ms)${colors.reset}`);
  console.log(`${colors.cyan}${'━'.repeat(60)}${colors.reset}`);

  if (failed > 0) {
    console.log(`\n${colors.red}${colors.bright}Failed Tests:${colors.reset}`);
    allResults
      .filter(r => !r.success)
      .forEach(r => {
        console.log(`  ${colors.red}✗${colors.reset} ${r.testName}`);
        if (r.error) {
          console.log(`    ${colors.dim}${r.error}${colors.reset}`);
        }
      });
  }

  return { total, passed, failed, totalDuration };
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
    console.log('  <test-file>    Path to YAML test file (relative to cases/)');
    console.log('  all            Run all test files in cases/');
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
    // Run all YAML files in cases/
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

  console.log(`${colors.blue}Found ${testFiles.length} test(s) to run${colors.reset}\n`);

  const allResults = [];

  for (let i = 0; i < testFiles.length; i++) {
    const testFile = testFiles[i];
    const progress = `[${i + 1}/${testFiles.length}]`;

    console.log(`${colors.magenta}${progress}${colors.reset} ${colors.dim}${path.basename(testFile)}${colors.reset}`);

    try {
      const testDef = await loadTestDefinition(testFile);
      const results = await executeTest(testDef, testFile);
      allResults.push(results);

      if (saveResults_) {
        await saveResults(results);
      }
    } catch (error) {
      console.error(`${colors.red}✗ Failed to load/run test ${testFile}: ${error.message}${colors.reset}`);
      allResults.push({
        testName: path.basename(testFile),
        testPath: testFile,
        success: false,
        error: error.message,
        totalDuration: 0,
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
