// dev-tools/testing/test-context.ts
// Test context management for integration tests
// NOTE: This is a DEV-ONLY module, not included in production builds

import { logger } from '../../src/app/plugin-logger';

interface TestContext {
  testId: string;
  testName: string;
  startTime: number;
  markers: Array<{ timestamp: number; marker: string }>;
}

class TestContextManager {
  private activeTest: TestContext | null = null;

  /**
   * Start a new test context
   */
  startTest(testId: string, testName: string): void {
    this.activeTest = {
      testId,
      testName,
      startTime: Date.now(),
      markers: [],
    };

    logger.log(`[TEST:START] ID="${testId}" Name="${testName}"`);
  }

  /**
   * End the current test context
   */
  endTest(): TestContext | null {
    if (!this.activeTest) {
      logger.warn('[TEST:END] No active test to end');
      return null;
    }

    const duration = Date.now() - this.activeTest.startTime;
    logger.log(`[TEST:END] ID="${this.activeTest.testId}" Duration=${duration}ms`);

    const context = this.activeTest;
    this.activeTest = null;
    return context;
  }

  /**
   * Add a marker to the current test
   */
  addMarker(marker: string): void {
    if (!this.activeTest) {
      logger.warn('[TEST:MARKER] No active test for marker:', marker);
      return;
    }

    this.activeTest.markers.push({
      timestamp: Date.now(),
      marker,
    });

    logger.log(`[TEST:MARKER] ID="${this.activeTest.testId}" Marker="${marker}"`);
  }

  /**
   * Get the current test context
   */
  getActiveTest(): TestContext | null {
    return this.activeTest;
  }

  /**
   * Check if a test is currently active
   */
  isTestActive(): boolean {
    return this.activeTest !== null;
  }
}

// Singleton instance
export const testContext = new TestContextManager();
