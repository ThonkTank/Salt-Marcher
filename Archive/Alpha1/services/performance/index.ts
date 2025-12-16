// src/services/performance/index.ts
// Performance monitoring and metrics tracking
//
// Provides centralized performance measurement utilities:
// - Statistical metrics tracking (mean, median, p95, p99)
// - Operation timing with auto-recording
// - Async function performance measurement

// ============================================================================
// Types
// ============================================================================

export type { PerformanceStats } from "./metrics";

// ============================================================================
// Metrics
// ============================================================================

export {
    PerformanceMetrics,
    getPerformanceMetrics,
    resetPerformanceMetrics
} from "./metrics";

// ============================================================================
// Timing Utilities
// ============================================================================

export {
    PerformanceTimer,
    measurePerformance
} from "./timer";
