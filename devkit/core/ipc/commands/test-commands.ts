// devkit/core/ipc/commands/test-commands.ts
// Test-specific IPC commands for integration testing
// NOTE: This is a DEV-ONLY module, not included in production builds

import { App } from 'obsidian';
import type { CommandHandler } from '../../../../src/app/ipc-server';
import { logger } from '../../../../src/app/plugin-logger';
import { testContext } from '../../../testing/integration/test-context';
import { debugLogger } from '../../../../src/app/debug-logger';

/**
 * Start a new test context
 */
export const startTest: CommandHandler = async (app: App, args: string[]) => {
  const [testId, testName] = args;

  if (!testId) {
    return {
      success: false,
      error: 'Test ID required. Usage: start-test <test-id> [test-name]'
    };
  }

  testContext.startTest(testId, testName || testId);

  logger.log('[IPC-TEST] Test started:', { testId, testName });

  return {
    success: true,
    testId,
    testName: testName || testId,
    message: 'Test context started'
  };
};

/**
 * End the current test context and return collected data
 */
export const endTest: CommandHandler = async (app: App, args: string[]) => {
  const context = testContext.endTest();

  if (!context) {
    return {
      success: false,
      error: 'No active test to end'
    };
  }

  logger.log('[IPC-TEST] Test ended:', { testId: context.testId });

  return {
    success: true,
    testId: context.testId,
    testName: context.testName,
    duration: Date.now() - context.startTime,
    markerCount: context.markers.length,
    message: 'Test context ended'
  };
};

/**
 * Add a custom marker to the current test
 */
export const logMarker: CommandHandler = async (app: App, args: string[]) => {
  const marker = args.join(' ');

  if (!marker) {
    return {
      success: false,
      error: 'Marker text required. Usage: log-marker <marker-text>'
    };
  }

  testContext.addMarker(marker);

  return {
    success: true,
    marker,
    message: 'Marker logged'
  };
};

/**
 * Set debug configuration dynamically
 */
export const setDebugConfig: CommandHandler = async (app: App, args: string[]) => {
  const configJson = args.join(' ');

  if (!configJson) {
    return {
      success: false,
      error: 'Config JSON required. Usage: set-debug-config \'{"enabled": true, ...}\''
    };
  }

  try {
    const newConfig = JSON.parse(configJson);

    // Update the debug logger config via private property access
    // This is a dev-only hack, safe because it's only in dev-tools
    (debugLogger as any).config = newConfig;

    logger.log('[IPC-TEST] Debug config updated:', newConfig);

    return {
      success: true,
      config: newConfig,
      message: 'Debug configuration updated'
    };
  } catch (error) {
    logger.error('[IPC-TEST] Failed to set debug config:', error);
    return {
      success: false,
      error: String(error)
    };
  }
};

/**
 * Get current debug configuration
 */
export const getDebugConfig: CommandHandler = async (app: App, args: string[]) => {
  const config = debugLogger.getConfig();

  logger.log('[IPC-TEST] Debug config retrieved:', config);

  return {
    success: true,
    config,
  };
};

/**
 * Get logs for the current test (filtered by test markers)
 */
export const getTestLogs: CommandHandler = async (app: App, args: string[]) => {
  const [testId] = args;

  if (!testId) {
    return {
      success: false,
      error: 'Test ID required. Usage: get-test-logs <test-id>'
    };
  }

  try {
    const fs = require('fs');
    const path = require('path');
    const logPath = path.join(app.vault.adapter.basePath, 'CONSOLE_LOG.txt');

    const content = fs.readFileSync(logPath, 'utf-8');
    const allLines = content.split('\n');

    // Find test start and end markers
    const startMarker = `[TEST:START] ID="${testId}"`;
    const endMarker = `[TEST:END] ID="${testId}"`;

    let startIndex = -1;
    let endIndex = -1;

    for (let i = 0; i < allLines.length; i++) {
      if (allLines[i].includes(startMarker)) {
        startIndex = i;
      }
      if (startIndex !== -1 && allLines[i].includes(endMarker)) {
        endIndex = i;
        break;
      }
    }

    if (startIndex === -1) {
      return {
        success: false,
        error: `No logs found for test ID: ${testId}`
      };
    }

    // Extract logs between markers (or to end if no end marker)
    const testLogs = allLines.slice(startIndex, endIndex !== -1 ? endIndex + 1 : undefined);

    logger.log('[IPC-TEST] Test logs retrieved:', {
      testId,
      lineCount: testLogs.length,
      hasEnd: endIndex !== -1
    });

    return {
      success: true,
      testId,
      logCount: testLogs.length,
      logs: testLogs,
    };
  } catch (error) {
    logger.error('[IPC-TEST] Failed to get test logs:', error);
    return {
      success: false,
      error: String(error)
    };
  }
};

/**
 * Assert that a log contains specific text
 */
export const assertLogContains: CommandHandler = async (app: App, args: string[]) => {
  const [testId, ...patterns] = args;

  if (!testId || patterns.length === 0) {
    return {
      success: false,
      error: 'Test ID and pattern required. Usage: assert-log-contains <test-id> <pattern1> [pattern2] ...'
    };
  }

  try {
    // Get test logs
    const logsResult = await getTestLogs(app, [testId]);
    if (!logsResult.success) {
      return logsResult;
    }

    const logs = (logsResult as any).logs as string[];
    const results: Array<{ pattern: string; found: boolean; line?: string }> = [];

    // Check each pattern
    for (const pattern of patterns) {
      const foundLine = logs.find(line => line.includes(pattern));
      results.push({
        pattern,
        found: !!foundLine,
        line: foundLine,
      });
    }

    const allPassed = results.every(r => r.found);

    logger.log('[IPC-TEST] Assertion result:', {
      testId,
      passed: allPassed,
      results
    });

    return {
      success: allPassed,
      testId,
      passed: allPassed,
      results,
      message: allPassed ? 'All patterns found' : 'Some patterns not found'
    };
  } catch (error) {
    logger.error('[IPC-TEST] Assertion failed:', error);
    return {
      success: false,
      error: String(error)
    };
  }
};
