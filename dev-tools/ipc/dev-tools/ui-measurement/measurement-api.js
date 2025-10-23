"use strict";
// dev-tools/ui-measurement/measurement-api.ts
// Generic UI element measurement API
Object.defineProperty(exports, "__esModule", { value: true });
exports.measureElements = measureElements;
exports.measureElementsGrouped = measureElementsGrouped;
exports.summarizeMeasurements = summarizeMeasurements;
const dom_utils_1 = require("./dom-utils");
/**
 * Measure elements matching a selector
 */
function measureElements(options) {
    const { selector, dimensions, filter = dom_utils_1.isVisible, root = document, } = options;
    const elements = Array.from(root.querySelectorAll(selector))
        .filter(filter);
    return elements.map(element => {
        const bbox = (0, dom_utils_1.getDimensions)(element);
        const computed = (0, dom_utils_1.getComputedStyles)(element, dimensions);
        const result = {
            element,
            dimensions: {},
            styles: computed,
        };
        // Extract dimensional values
        for (const dim of dimensions) {
            if (dim === 'width')
                result.dimensions.width = bbox.width;
            else if (dim === 'height')
                result.dimensions.height = bbox.height;
            else if (computed[dim]) {
                // Parse CSS values (e.g., "10px" -> 10)
                const value = parseFloat(computed[dim]);
                if (!isNaN(value))
                    result.dimensions[dim] = value;
            }
        }
        return result;
    });
}
/**
 * Measure elements and group by ancestor
 */
function measureElementsGrouped(options) {
    if (!options.groupBy) {
        throw new Error('groupBy option required for grouped measurements');
    }
    const { groupBy } = options;
    const measurements = measureElements(options);
    // Extract elements from measurements
    const elements = measurements.map(m => m.element);
    const groups = (0, dom_utils_1.groupByAncestor)(elements, groupBy.ancestorSelector, groupBy.extractLabel);
    const results = [];
    for (const [groupLabel, groupElements] of groups.entries()) {
        const groupMeasurements = measurements.filter(m => groupElements.includes(m.element));
        // Add group label to each measurement
        groupMeasurements.forEach(m => {
            m.group = groupLabel;
        });
        // Calculate summary statistics
        const summary = {
            count: groupMeasurements.length,
            dimensions: {},
        };
        for (const dim of options.dimensions) {
            const values = groupMeasurements
                .map(m => m.dimensions[dim])
                .filter(v => v !== undefined);
            if (values.length > 0) {
                const min = Math.min(...values);
                const max = Math.max(...values);
                const avg = values.reduce((a, b) => a + b, 0) / values.length;
                const variance = max - min;
                summary.dimensions[dim] = { min, max, avg, variance };
            }
        }
        results.push({
            group: groupLabel,
            measurements: groupMeasurements,
            summary,
        });
    }
    return results;
}
/**
 * Get a summary of measurements for a specific dimension
 */
function summarizeMeasurements(measurements, dimension) {
    const values = measurements
        .map(m => m.dimensions[dimension])
        .filter(v => v !== undefined);
    if (values.length === 0)
        return null;
    const min = Math.min(...values);
    const max = Math.max(...values);
    const avg = values.reduce((a, b) => a + b, 0) / values.length;
    const variance = max - min;
    return { min, max, avg, variance };
}
