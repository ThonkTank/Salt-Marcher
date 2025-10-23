// dev-tools/ui-measurement/measurement-api.ts
// Generic UI element measurement API

import { getDimensions, getComputedStyles, groupByAncestor, isVisible } from './dom-utils';

export interface MeasureOptions {
  /** CSS selector for elements to measure */
  selector: string;

  /** Dimensions to measure (e.g., ['width', 'height', 'minWidth']) */
  dimensions: string[];

  /** Optional grouping by ancestor */
  groupBy?: {
    ancestorSelector: string;
    extractLabel: string;
  };

  /** Optional filter function */
  filter?: (el: HTMLElement) => boolean;

  /** Root element to search within (defaults to document) */
  root?: HTMLElement | Document;
}

export interface MeasurementResult {
  element: HTMLElement;
  dimensions: Record<string, number>;
  styles: Record<string, string>;
  label?: string;
  group?: string;
}

export interface GroupedMeasurements {
  group: string;
  measurements: MeasurementResult[];
  summary: {
    count: number;
    dimensions: Record<string, { min: number; max: number; avg: number; variance: number }>;
  };
}

/**
 * Measure elements matching a selector
 */
export function measureElements(options: MeasureOptions): MeasurementResult[] {
  const {
    selector,
    dimensions,
    filter = isVisible,
    root = document,
  } = options;

  const elements = Array.from(root.querySelectorAll<HTMLElement>(selector))
    .filter(filter);

  return elements.map(element => {
    const bbox = getDimensions(element);
    const computed = getComputedStyles(element, dimensions);

    const result: MeasurementResult = {
      element,
      dimensions: {},
      styles: computed,
    };

    // Extract dimensional values
    for (const dim of dimensions) {
      if (dim === 'width') result.dimensions.width = bbox.width;
      else if (dim === 'height') result.dimensions.height = bbox.height;
      else if (computed[dim]) {
        // Parse CSS values (e.g., "10px" -> 10)
        const value = parseFloat(computed[dim]);
        if (!isNaN(value)) result.dimensions[dim] = value;
      }
    }

    return result;
  });
}

/**
 * Measure elements and group by ancestor
 */
export function measureElementsGrouped(options: MeasureOptions): GroupedMeasurements[] {
  if (!options.groupBy) {
    throw new Error('groupBy option required for grouped measurements');
  }

  const { groupBy } = options;
  const measurements = measureElements(options);

  // Extract elements from measurements
  const elements = measurements.map(m => m.element);
  const groups = groupByAncestor(elements, groupBy.ancestorSelector, groupBy.extractLabel);

  const results: GroupedMeasurements[] = [];

  for (const [groupLabel, groupElements] of groups.entries()) {
    const groupMeasurements = measurements.filter(m => groupElements.includes(m.element));

    // Add group label to each measurement
    groupMeasurements.forEach(m => {
      m.group = groupLabel;
    });

    // Calculate summary statistics
    const summary: GroupedMeasurements['summary'] = {
      count: groupMeasurements.length,
      dimensions: {},
    };

    for (const dim of options.dimensions) {
      const values = groupMeasurements
        .map(m => m.dimensions[dim])
        .filter(v => v !== undefined) as number[];

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
export function summarizeMeasurements(
  measurements: MeasurementResult[],
  dimension: string
): { min: number; max: number; avg: number; variance: number } | null {
  const values = measurements
    .map(m => m.dimensions[dimension])
    .filter(v => v !== undefined) as number[];

  if (values.length === 0) return null;

  const min = Math.min(...values);
  const max = Math.max(...values);
  const avg = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = max - min;

  return { min, max, avg, variance };
}
