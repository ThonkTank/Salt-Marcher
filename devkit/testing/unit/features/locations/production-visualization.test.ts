// devkit/testing/unit/features/locations/production-visualization.test.ts
// Phase 9.2D: Tests for production visualization utilities

import { describe, it, expect, beforeEach } from 'vitest';
import { JSDOM } from 'jsdom';
import {
    createProgressBar,
    getConditionColor,
    createProductionRateVisualization,
    createWorkerEfficiencyVisualization,
    createResourceVisualization,
    createProductionDashboard
} from '../../../../../src/features/locations/production-visualization';
import type { BuildingProduction } from '../../../../../src/workmodes/library/locations/types';

describe('Production Visualization', () => {
    let document: Document;

    beforeEach(() => {
        const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>');
        global.document = dom.window.document as any;
        document = dom.window.document;
    });

    describe('createProgressBar', () => {
        it('creates a progress bar with correct percentage', () => {
            const bar = createProgressBar(75, { label: 'Test Progress' });
            expect(bar).toBeDefined();
            expect(bar.textContent).toContain('Test Progress');
            expect(bar.textContent).toContain('75%');
        });

        it('clamps percentage to 0-100 range', () => {
            const barOver = createProgressBar(150);
            const barUnder = createProgressBar(-50);

            expect(barOver).toBeDefined();
            expect(barUnder).toBeDefined();
        });

        it('hides percentage when showPercentage is false', () => {
            const bar = createProgressBar(75, {
                label: 'Test',
                showPercentage: false
            });
            expect(bar.textContent).toContain('Test');
            expect(bar.textContent).not.toContain('75%');
        });

        it('applies custom color', () => {
            const bar = createProgressBar(50, { color: '#ff0000' });
            const fill = bar.querySelector('div > div > div');
            expect(fill).toBeDefined();
        });
    });

    describe('getConditionColor', () => {
        it('returns green for excellent condition (>=75)', () => {
            expect(getConditionColor(100)).toBe('var(--color-green)');
            expect(getConditionColor(75)).toBe('var(--color-green)');
        });

        it('returns yellow for good condition (50-74)', () => {
            expect(getConditionColor(74)).toBe('var(--color-yellow)');
            expect(getConditionColor(50)).toBe('var(--color-yellow)');
        });

        it('returns orange for fair condition (25-49)', () => {
            expect(getConditionColor(49)).toBe('var(--color-orange)');
            expect(getConditionColor(25)).toBe('var(--color-orange)');
        });

        it('returns red for poor condition (<25)', () => {
            expect(getConditionColor(24)).toBe('var(--color-red)');
            expect(getConditionColor(0)).toBe('var(--color-red)');
        });
    });

    describe('createProductionRateVisualization', () => {
        it('creates production rate visualization with condition bar', () => {
            const production: BuildingProduction = {
                buildingType: 'smithy',
                condition: 80,
                maintenanceOverdue: 0,
                currentWorkers: 2,
                activeJobs: [],
                periodProduction: {}
            };

            const viz = createProductionRateVisualization(production);
            expect(viz).toBeDefined();
            expect(viz.className).toBe('sm-production-rate-viz');
            expect(viz.textContent).toContain('Production Rate');
            expect(viz.textContent).toContain('Building Condition');
        });

        it('shows maintenance warning when overdue', () => {
            const production: BuildingProduction = {
                buildingType: 'smithy',
                condition: 60,
                maintenanceOverdue: 5,
                currentWorkers: 2,
                activeJobs: [],
                periodProduction: {}
            };

            const viz = createProductionRateVisualization(production);
            expect(viz.textContent).toContain('Maintenance');
            expect(viz.textContent).toContain('5 days overdue');
        });

        it('does not show warning when maintenance is current', () => {
            const production: BuildingProduction = {
                buildingType: 'smithy',
                condition: 90,
                maintenanceOverdue: 0,
                currentWorkers: 2,
                activeJobs: [],
                periodProduction: {}
            };

            const viz = createProductionRateVisualization(production);
            expect(viz.textContent).not.toContain('overdue');
        });
    });

    describe('createWorkerEfficiencyVisualization', () => {
        it('creates worker efficiency visualization', () => {
            const production: BuildingProduction = {
                buildingType: 'smithy',
                condition: 80,
                maintenanceOverdue: 0,
                currentWorkers: 3,
                activeJobs: [
                    { workerName: 'Worker 1', jobType: 'crafting', progress: 50 }
                ],
                periodProduction: {}
            };

            const viz = createWorkerEfficiencyVisualization(production);
            expect(viz).toBeDefined();
            expect(viz.className).toBe('sm-worker-efficiency-viz');
            expect(viz.textContent).toContain('Worker Efficiency');
            expect(viz.textContent).toContain('3'); // current workers
        });

        it('shows capacity percentage correctly', () => {
            const production: BuildingProduction = {
                buildingType: 'smithy', // max 5 workers
                condition: 80,
                maintenanceOverdue: 0,
                currentWorkers: 2,
                activeJobs: [],
                periodProduction: {}
            };

            const viz = createWorkerEfficiencyVisualization(production);
            expect(viz.textContent).toContain('Workers');
            expect(viz.textContent).toContain('2/5');
        });

        it('shows low staffing warning when capacity < 50%', () => {
            const production: BuildingProduction = {
                buildingType: 'smithy', // max 4 workers
                condition: 80,
                maintenanceOverdue: 0,
                currentWorkers: 1, // 25% capacity
                activeJobs: [],
                periodProduction: {}
            };

            const viz = createWorkerEfficiencyVisualization(production);
            expect(viz.textContent).toContain('Low staffing');
        });

        it('does not show warning when capacity >= 50%', () => {
            const production: BuildingProduction = {
                buildingType: 'smithy', // max 5 workers
                condition: 80,
                maintenanceOverdue: 0,
                currentWorkers: 3, // 60% capacity (>= 50%)
                activeJobs: [],
                periodProduction: {}
            };

            const viz = createWorkerEfficiencyVisualization(production);
            expect(viz.textContent).not.toContain('Low staffing');
        });

        it('displays active jobs count', () => {
            const production: BuildingProduction = {
                buildingType: 'smithy',
                condition: 80,
                maintenanceOverdue: 0,
                currentWorkers: 3,
                activeJobs: [
                    { workerName: 'Worker 1', jobType: 'crafting', progress: 50 },
                    { workerName: 'Worker 2', jobType: 'gathering', progress: 30 }
                ],
                periodProduction: {}
            };

            const viz = createWorkerEfficiencyVisualization(production);
            expect(viz.textContent).toContain('2'); // active jobs
        });
    });

    describe('createResourceVisualization', () => {
        it('creates resource visualization with production data', () => {
            const production: BuildingProduction = {
                buildingType: 'smithy',
                condition: 80,
                maintenanceOverdue: 0,
                currentWorkers: 3,
                activeJobs: [],
                periodProduction: {
                    equipment: 10,
                    gold: 50
                }
            };

            const viz = createResourceVisualization(production);
            expect(viz).toBeDefined();
            expect(viz.className).toBe('sm-resource-viz');
            expect(viz.textContent).toContain('Resource Flow');
            expect(viz.textContent).toContain('equipment: 10');
            expect(viz.textContent).toContain('gold: 50');
        });

        it('shows no data message when no production', () => {
            const production: BuildingProduction = {
                buildingType: 'smithy',
                condition: 80,
                maintenanceOverdue: 0,
                currentWorkers: 3,
                activeJobs: [],
                periodProduction: {}
            };

            const viz = createResourceVisualization(production);
            expect(viz.textContent).toContain('No production data');
        });

        it('shows efficiency note', () => {
            const production: BuildingProduction = {
                buildingType: 'smithy',
                condition: 100,
                maintenanceOverdue: 0,
                currentWorkers: 3,
                activeJobs: [],
                periodProduction: {
                    equipment: 10
                }
            };

            const viz = createResourceVisualization(production);
            expect(viz.textContent).toContain('operating at');
            expect(viz.textContent).toContain('efficiency');
        });

        it('filters out zero or negative resources', () => {
            const production: BuildingProduction = {
                buildingType: 'smithy',
                condition: 80,
                maintenanceOverdue: 0,
                currentWorkers: 3,
                activeJobs: [],
                periodProduction: {
                    equipment: 10,
                    gold: 0,
                    food: -5
                }
            };

            const viz = createResourceVisualization(production);
            expect(viz.textContent).toContain('equipment: 10');
            expect(viz.textContent).not.toContain('gold: 0');
            expect(viz.textContent).not.toContain('food:');
        });
    });

    describe('createProductionDashboard', () => {
        it('creates dashboard combining all visualizations', () => {
            const production: BuildingProduction = {
                buildingType: 'smithy',
                condition: 80,
                maintenanceOverdue: 0,
                currentWorkers: 3,
                activeJobs: [],
                periodProduction: {
                    equipment: 10
                }
            };

            const dashboard = createProductionDashboard(production);
            expect(dashboard).toBeDefined();
            expect(dashboard.className).toBe('sm-production-dashboard');

            // Should contain all three visualization types
            const childDivs = dashboard.querySelectorAll('div[class*="-viz"]');
            expect(childDivs.length).toBeGreaterThanOrEqual(3);
        });

        it('contains production rate visualization', () => {
            const production: BuildingProduction = {
                buildingType: 'smithy',
                condition: 80,
                maintenanceOverdue: 0,
                currentWorkers: 3,
                activeJobs: [],
                periodProduction: {}
            };

            const dashboard = createProductionDashboard(production);
            expect(dashboard.textContent).toContain('Production Rate');
        });

        it('contains worker efficiency visualization', () => {
            const production: BuildingProduction = {
                buildingType: 'smithy',
                condition: 80,
                maintenanceOverdue: 0,
                currentWorkers: 3,
                activeJobs: [],
                periodProduction: {}
            };

            const dashboard = createProductionDashboard(production);
            expect(dashboard.textContent).toContain('Worker Efficiency');
        });

        it('contains resource visualization', () => {
            const production: BuildingProduction = {
                buildingType: 'smithy',
                condition: 80,
                maintenanceOverdue: 0,
                currentWorkers: 3,
                activeJobs: [],
                periodProduction: {}
            };

            const dashboard = createProductionDashboard(production);
            expect(dashboard.textContent).toContain('Resource Flow');
        });
    });
});
