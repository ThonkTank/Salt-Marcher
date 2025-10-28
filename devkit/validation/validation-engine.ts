// dev-tools/ui-measurement/validation-engine.ts
// Rule-based validation system for UI measurements

import { measureElements, measureElementsGrouped, type MeasureOptions, type MeasurementResult, type GroupedMeasurements } from './measurement-api';

export type ExpectationType = 'synchronized' | 'range' | 'exact' | 'min' | 'max';

export interface ValidationRule {
  /** Human-readable rule name */
  name: string;

  /** CSS selector for elements */
  selector: string;

  /** Optional grouping by ancestor */
  groupBy?: {
    ancestorSelector: string;
    extractLabel: string;
  };

  /** Dimension to validate (e.g., 'width', 'height') */
  dimension: string;

  /** Validation expectation type */
  expect: ExpectationType;

  /** Expected value (for 'exact', 'min', 'max', 'range') */
  value?: number;

  /** Max allowed value (for 'range') */
  maxValue?: number;

  /** Tolerance for variance (for 'synchronized') */
  tolerance?: number;

  /** Optional filter function */
  filter?: (el: HTMLElement) => boolean;

  /** Root element to search within */
  root?: HTMLElement | Document;
}

export interface ValidationResult {
  rule: ValidationRule;
  passed: boolean;
  message: string;
  details?: any;
}

export interface ValidationReport {
  totalRules: number;
  passedRules: number;
  failedRules: number;
  results: ValidationResult[];
}

/**
 * Validate a single rule
 */
export function validateRule(rule: ValidationRule): ValidationResult {
  try {
    // Prepare measurement options
    const measureOptions: MeasureOptions = {
      selector: rule.selector,
      dimensions: [rule.dimension],
      groupBy: rule.groupBy,
      filter: rule.filter,
      root: rule.root,
    };

    // Get measurements
    if (rule.groupBy && rule.expect === 'synchronized') {
      return validateSynchronizedGroups(rule, measureOptions);
    } else {
      return validateGlobalRule(rule, measureOptions);
    }
  } catch (error) {
    return {
      rule,
      passed: false,
      message: `Validation error: ${error}`,
    };
  }
}

/**
 * Validate synchronized groups (each group should have synchronized values)
 */
function validateSynchronizedGroups(rule: ValidationRule, options: MeasureOptions): ValidationResult {
  const groups = measureElementsGrouped(options);
  const tolerance = rule.tolerance ?? 1;

  const failedGroups: Array<{ group: string; variance: number }> = [];

  for (const group of groups) {
    const summary = group.summary.dimensions[rule.dimension];
    if (!summary) continue;

    if (summary.variance > tolerance) {
      failedGroups.push({
        group: group.group,
        variance: summary.variance,
      });
    }
  }

  const passed = failedGroups.length === 0;

  return {
    rule,
    passed,
    message: passed
      ? `All groups have synchronized ${rule.dimension} (tolerance: ${tolerance}px)`
      : `${failedGroups.length} group(s) failed synchronization`,
    details: {
      groups: groups.map(g => ({
        group: g.group,
        count: g.summary.count,
        ...g.summary.dimensions[rule.dimension],
      })),
      failedGroups,
    },
  };
}

/**
 * Validate global rule (all elements together)
 */
function validateGlobalRule(rule: ValidationRule, options: MeasureOptions): ValidationResult {
  const measurements = measureElements(options);

  if (measurements.length === 0) {
    return {
      rule,
      passed: false,
      message: `No elements found matching selector: ${rule.selector}`,
    };
  }

  const values = measurements
    .map(m => m.dimensions[rule.dimension])
    .filter(v => v !== undefined) as number[];

  switch (rule.expect) {
    case 'synchronized': {
      const tolerance = rule.tolerance ?? 1;
      const min = Math.min(...values);
      const max = Math.max(...values);
      const variance = max - min;
      const passed = variance <= tolerance;

      return {
        rule,
        passed,
        message: passed
          ? `All ${values.length} elements have synchronized ${rule.dimension} (variance: ${variance.toFixed(2)}px, tolerance: ${tolerance}px)`
          : `Elements not synchronized (variance: ${variance.toFixed(2)}px, tolerance: ${tolerance}px)`,
        details: { min, max, variance, count: values.length },
      };
    }

    case 'exact': {
      if (rule.value === undefined) {
        return { rule, passed: false, message: 'Exact validation requires value parameter' };
      }

      const tolerance = rule.tolerance ?? 0;
      const failed = values.filter(v => Math.abs(v - rule.value!) > tolerance);
      const passed = failed.length === 0;

      return {
        rule,
        passed,
        message: passed
          ? `All ${values.length} elements have ${rule.dimension} = ${rule.value}px (tolerance: ${tolerance}px)`
          : `${failed.length} element(s) don't match expected value ${rule.value}px`,
        details: { expected: rule.value, failedCount: failed.length, totalCount: values.length },
      };
    }

    case 'min': {
      if (rule.value === undefined) {
        return { rule, passed: false, message: 'Min validation requires value parameter' };
      }

      const failed = values.filter(v => v < rule.value!);
      const passed = failed.length === 0;

      return {
        rule,
        passed,
        message: passed
          ? `All ${values.length} elements have ${rule.dimension} >= ${rule.value}px`
          : `${failed.length} element(s) below minimum ${rule.value}px`,
        details: { min: rule.value, failedCount: failed.length, totalCount: values.length },
      };
    }

    case 'max': {
      if (rule.value === undefined) {
        return { rule, passed: false, message: 'Max validation requires value parameter' };
      }

      const failed = values.filter(v => v > rule.value!);
      const passed = failed.length === 0;

      return {
        rule,
        passed,
        message: passed
          ? `All ${values.length} elements have ${rule.dimension} <= ${rule.value}px`
          : `${failed.length} element(s) above maximum ${rule.value}px`,
        details: { max: rule.value, failedCount: failed.length, totalCount: values.length },
      };
    }

    case 'range': {
      if (rule.value === undefined || rule.maxValue === undefined) {
        return { rule, passed: false, message: 'Range validation requires value and maxValue parameters' };
      }

      const failed = values.filter(v => v < rule.value! || v > rule.maxValue!);
      const passed = failed.length === 0;

      return {
        rule,
        passed,
        message: passed
          ? `All ${values.length} elements have ${rule.dimension} in range [${rule.value}, ${rule.maxValue}]px`
          : `${failed.length} element(s) outside range [${rule.value}, ${rule.maxValue}]px`,
        details: { min: rule.value, max: rule.maxValue, failedCount: failed.length, totalCount: values.length },
      };
    }

    default:
      return {
        rule,
        passed: false,
        message: `Unknown expectation type: ${rule.expect}`,
      };
  }
}

/**
 * Validate multiple rules and generate a report
 */
export function validateUI(rules: ValidationRule[]): ValidationReport {
  const results = rules.map(validateRule);
  const passedRules = results.filter(r => r.passed).length;
  const failedRules = results.filter(r => !r.passed).length;

  return {
    totalRules: rules.length,
    passedRules,
    failedRules,
    results,
  };
}

/**
 * Format validation report as human-readable text
 */
export function formatReport(report: ValidationReport): string {
  const lines: string[] = [];
  lines.push(`\n=== UI Validation Report ===`);
  lines.push(`Total Rules: ${report.totalRules}`);
  lines.push(`Passed: ${report.passedRules}`);
  lines.push(`Failed: ${report.failedRules}`);
  lines.push('');

  for (const result of report.results) {
    const icon = result.passed ? '✓' : '✗';
    lines.push(`${icon} ${result.rule.name}`);
    lines.push(`  ${result.message}`);

    if (result.details && !result.passed) {
      lines.push(`  Details: ${JSON.stringify(result.details, null, 2)}`);
    }
    lines.push('');
  }

  return lines.join('\n');
}
