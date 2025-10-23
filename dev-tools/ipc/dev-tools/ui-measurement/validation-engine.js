"use strict";
// dev-tools/ui-measurement/validation-engine.ts
// Rule-based validation system for UI measurements
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateRule = validateRule;
exports.validateUI = validateUI;
exports.formatReport = formatReport;
const measurement_api_1 = require("./measurement-api");
/**
 * Validate a single rule
 */
function validateRule(rule) {
    try {
        // Prepare measurement options
        const measureOptions = {
            selector: rule.selector,
            dimensions: [rule.dimension],
            groupBy: rule.groupBy,
            filter: rule.filter,
            root: rule.root,
        };
        // Get measurements
        if (rule.groupBy && rule.expect === 'synchronized') {
            return validateSynchronizedGroups(rule, measureOptions);
        }
        else {
            return validateGlobalRule(rule, measureOptions);
        }
    }
    catch (error) {
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
function validateSynchronizedGroups(rule, options) {
    const groups = (0, measurement_api_1.measureElementsGrouped)(options);
    const tolerance = rule.tolerance ?? 1;
    const failedGroups = [];
    for (const group of groups) {
        const summary = group.summary.dimensions[rule.dimension];
        if (!summary)
            continue;
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
function validateGlobalRule(rule, options) {
    const measurements = (0, measurement_api_1.measureElements)(options);
    if (measurements.length === 0) {
        return {
            rule,
            passed: false,
            message: `No elements found matching selector: ${rule.selector}`,
        };
    }
    const values = measurements
        .map(m => m.dimensions[rule.dimension])
        .filter(v => v !== undefined);
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
            const failed = values.filter(v => Math.abs(v - rule.value) > tolerance);
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
            const failed = values.filter(v => v < rule.value);
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
            const failed = values.filter(v => v > rule.value);
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
            const failed = values.filter(v => v < rule.value || v > rule.maxValue);
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
function validateUI(rules) {
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
function formatReport(report) {
    const lines = [];
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
