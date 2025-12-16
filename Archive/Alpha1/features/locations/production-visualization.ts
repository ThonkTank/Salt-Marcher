// src/features/locations/production-visualization.ts
// Phase 9.2D: Simple HTML/CSS-based visualizations for building production tracking
//
// Provides lightweight visualization utilities for:
// - Production rate progress bars
// - Worker efficiency indicators
// - Resource production/consumption bars
//
// Design: Uses pure HTML/CSS (no external charting libraries) to keep bundle size small
// and maintain simplicity

import { calculateProductionRate, BUILDING_TEMPLATES } from "./building-production";
import type { BuildingProduction } from "./building-production";

/**
 * Create a horizontal progress bar element
 */
export function createProgressBar(
    percentage: number,
    label?: string,
    color?: string,
    options: {
        height?: string;
        showPercentage?: boolean;
    } = {}
): HTMLElement {
    const {
        height = "20px",
        showPercentage = true
    } = options;

    const container = document.createElement("div");
    container.style.marginBottom = "0.5em";

    // Label
    if (label) {
        const labelEl = document.createElement("div");
        labelEl.style.fontSize = "0.85em";
        labelEl.style.marginBottom = "0.25em";
        labelEl.style.display = "flex";
        labelEl.style.justifyContent = "space-between";
        labelEl.style.alignItems = "center";

        const labelText = document.createElement("span");
        labelText.textContent = label;
        labelEl.appendChild(labelText);

        if (showPercentage) {
            const percentText = document.createElement("span");
            percentText.textContent = `${percentage.toFixed(0)}%`;
            percentText.style.fontWeight = "600";
            labelEl.appendChild(percentText);
        }

        container.appendChild(labelEl);
    }

    // Progress bar track
    const track = document.createElement("div");
    track.style.width = "100%";
    track.style.height = height;
    track.style.background = "var(--background-modifier-border)";
    track.style.borderRadius = "4px";
    track.style.overflow = "hidden";
    track.style.position = "relative";
    container.appendChild(track);

    // Progress bar fill
    const fill = document.createElement("div");
    fill.style.width = `${Math.min(100, Math.max(0, percentage))}%`;
    fill.style.height = "100%";
    fill.style.background = color || "var(--interactive-accent)";
    fill.style.transition = "width 0.3s ease";
    track.appendChild(fill);

    return container;
}

/**
 * Get color for condition-based progress bar
 */
export function getConditionColor(condition: number): string {
    if (condition >= 75) return "var(--color-green)";
    if (condition >= 50) return "var(--color-yellow)";
    if (condition >= 25) return "var(--color-orange)";
    return "var(--color-red)";
}

/**
 * Get color for capacity-based progress bar
 */
export function getCapacityColor(percentage: number): string {
    if (percentage >= 90) return "#e74c3c"; // Red (near full)
    if (percentage >= 75) return "#f39c12"; // Orange
    if (percentage >= 50) return "#f1c40f"; // Yellow
    return "#2ecc71"; // Green (plenty of space)
}

/**
 * Create production rate visualization showing condition and maintenance impact
 */
export function createProductionRateVisualization(production: BuildingProduction): HTMLElement {
    const container = document.createElement("div");
    container.className = "sm-production-rate-viz";
    container.style.padding = "0.75em";
    container.style.background = "var(--background-secondary)";
    container.style.borderRadius = "4px";
    container.style.marginBottom = "1em";

    // Header
    const header = document.createElement("h4");
    header.textContent = "Production Rate";
    header.style.fontSize = "0.95em";
    header.style.marginBottom = "0.75em";
    header.style.marginTop = "0";
    container.appendChild(header);

    // Calculate current production rate
    const productionRate = calculateProductionRate(
        production.buildingType,
        production.condition,
        production.maintenanceOverdue
    );
    const productionPercentage = productionRate * 100;

    // Condition impact bar
    const conditionBar = createProgressBar(
        production.condition,
        "Building Condition",
        getConditionColor(production.condition),
        { showPercentage: true }
    );
    container.appendChild(conditionBar);

    // Overall production rate bar
    const rateColor = productionPercentage >= 75 ? "var(--color-green)" :
                      productionPercentage >= 50 ? "var(--color-yellow)" :
                      productionPercentage >= 25 ? "var(--color-orange)" : "var(--color-red)";

    const rateBar = createProgressBar(
        productionPercentage,
        "Effective Production Rate",
        rateColor,
        { showPercentage: true }
    );
    container.appendChild(rateBar);

    // Impact indicators
    if (production.maintenanceOverdue > 0) {
        const warningDiv = document.createElement("div");
        warningDiv.style.marginTop = "0.5em";
        warningDiv.style.padding = "0.5em";
        warningDiv.style.background = "var(--background-modifier-error)";
        warningDiv.style.borderRadius = "4px";
        warningDiv.style.fontSize = "0.85em";
        warningDiv.style.display = "flex";
        warningDiv.style.alignItems = "center";
        warningDiv.style.gap = "0.5em";

        const icon = document.createElement("span");
        icon.textContent = "⚠️";
        warningDiv.appendChild(icon);

        const text = document.createElement("span");
        text.textContent = `Maintenance ${production.maintenanceOverdue} days overdue (-${((1 - productionRate) * 100).toFixed(0)}% production)`;
        warningDiv.appendChild(text);

        container.appendChild(warningDiv);
    }

    return container;
}

/**
 * Create worker efficiency visualization
 */
export function createWorkerEfficiencyVisualization(production: BuildingProduction): HTMLElement {
    const container = document.createElement("div");
    container.className = "sm-worker-efficiency-viz";
    container.style.padding = "0.75em";
    container.style.background = "var(--background-secondary)";
    container.style.borderRadius = "4px";
    container.style.marginBottom = "1em";

    // Header
    const header = document.createElement("h4");
    header.textContent = "Worker Efficiency";
    header.style.fontSize = "0.95em";
    header.style.marginBottom = "0.75em";
    header.style.marginTop = "0";
    container.appendChild(header);

    // Get building template
    const template = BUILDING_TEMPLATES[production.buildingType];
    if (!template) {
        const errorDiv = document.createElement("div");
        errorDiv.textContent = "Unknown building type";
        container.appendChild(errorDiv);
        return container;
    }

    // Worker capacity utilization
    const capacityPercentage = (production.currentWorkers / template.maxWorkers) * 100;
    const capacityColor = capacityPercentage >= 100 ? "var(--color-green)" :
                          capacityPercentage >= 75 ? "var(--color-yellow)" :
                          capacityPercentage >= 50 ? "var(--color-orange)" : "var(--color-red)";

    const capacityBar = createProgressBar(
        capacityPercentage,
        `Workers (${production.currentWorkers}/${template.maxWorkers})`,
        capacityColor,
        { showPercentage: true }
    );
    container.appendChild(capacityBar);

    // Efficiency breakdown
    const breakdownDiv = document.createElement("div");
    breakdownDiv.style.marginTop = "0.75em";
    breakdownDiv.style.fontSize = "0.85em";
    breakdownDiv.style.display = "grid";
    breakdownDiv.style.gridTemplateColumns = "1fr 1fr";
    breakdownDiv.style.gap = "0.5em";
    container.appendChild(breakdownDiv);

    // Worker count
    const workerInfo = document.createElement("div");
    workerInfo.style.padding = "0.5em";
    workerInfo.style.background = "var(--background-primary)";
    workerInfo.style.borderRadius = "4px";

    const workerLabel = document.createElement("div");
    workerLabel.textContent = "Active Workers";
    workerLabel.style.color = "var(--text-muted)";
    workerInfo.appendChild(workerLabel);

    const workerCount = document.createElement("div");
    workerCount.textContent = production.currentWorkers.toString();
    workerCount.style.fontWeight = "600";
    workerInfo.appendChild(workerCount);

    breakdownDiv.appendChild(workerInfo);

    // Active jobs
    const jobsInfo = document.createElement("div");
    jobsInfo.style.padding = "0.5em";
    jobsInfo.style.background = "var(--background-primary)";
    jobsInfo.style.borderRadius = "4px";

    const jobsLabel = document.createElement("div");
    jobsLabel.textContent = "Active Jobs";
    jobsLabel.style.color = "var(--text-muted)";
    jobsInfo.appendChild(jobsLabel);

    const jobsCount = document.createElement("div");
    jobsCount.textContent = (production.activeJobs?.length || 0).toString();
    jobsCount.style.fontWeight = "600";
    jobsInfo.appendChild(jobsCount);

    breakdownDiv.appendChild(jobsInfo);

    // Capacity warning
    if (capacityPercentage < 50) {
        const warningDiv = document.createElement("div");
        warningDiv.style.marginTop = "0.5em";
        warningDiv.style.padding = "0.5em";
        warningDiv.style.background = "var(--background-modifier-error)";
        warningDiv.style.borderRadius = "4px";
        warningDiv.style.fontSize = "0.85em";
        warningDiv.style.display = "flex";
        warningDiv.style.alignItems = "center";
        warningDiv.style.gap = "0.5em";

        const icon = document.createElement("span");
        icon.textContent = "⚠️";
        warningDiv.appendChild(icon);

        const text = document.createElement("span");
        text.textContent = `Low staffing - Building operating at ${capacityPercentage.toFixed(0)}% capacity`;
        warningDiv.appendChild(text);

        container.appendChild(warningDiv);
    }

    return container;
}

/**
 * Create resource production/consumption visualization
 */
export function createResourceVisualization(production: BuildingProduction): HTMLElement {
    const container = document.createElement("div");
    container.className = "sm-resource-viz";
    container.style.padding = "0.75em";
    container.style.background = "var(--background-secondary)";
    container.style.borderRadius = "4px";
    container.style.marginBottom = "1em";

    // Header
    const header = document.createElement("h4");
    header.textContent = "Resource Flow";
    header.style.fontSize = "0.95em";
    header.style.marginBottom = "0.75em";
    header.style.marginTop = "0";
    container.appendChild(header);

    // Check if we have production data
    if (!production.periodProduction || Object.keys(production.periodProduction).length === 0) {
        const noDataDiv = document.createElement("div");
        noDataDiv.style.textAlign = "center";
        noDataDiv.style.color = "var(--text-muted)";
        noDataDiv.style.padding = "1em 0";
        noDataDiv.textContent = "No production data for this period";
        container.appendChild(noDataDiv);
        return container;
    }

    // Get building template to determine max production potential
    const template = BUILDING_TEMPLATES[production.buildingType];
    if (!template) {
        const errorDiv = document.createElement("div");
        errorDiv.textContent = "Unknown building type";
        container.appendChild(errorDiv);
        return container;
    }

    // Calculate production rate to determine "expected" vs "actual"
    const productionRate = calculateProductionRate(
        production.buildingType,
        production.condition,
        production.maintenanceOverdue
    );

    // Resource bars
    const resourcesDiv = document.createElement("div");
    resourcesDiv.style.display = "flex";
    resourcesDiv.style.flexDirection = "column";
    resourcesDiv.style.gap = "0.5em";
    container.appendChild(resourcesDiv);

    Object.entries(production.periodProduction).forEach(([resource, amount]) => {
        if (!amount || amount <= 0) return;

        // Estimate "max potential" based on production rate
        // If at 100% rate, current amount is the max. If at 50% rate, max would be double
        const estimatedMax = productionRate > 0 ? amount / productionRate : amount;
        const percentage = (amount / estimatedMax) * 100;

        // Show actual value with unit and efficiency context
        const actualValue = amount.toFixed(1);
        const maxValue = estimatedMax.toFixed(1);
        const efficiencyPercent = (productionRate * 100).toFixed(0);

        const resourceBar = createProgressBar(
            percentage,
            `${resource}: ${actualValue}/day (${efficiencyPercent}% efficiency, max: ${maxValue}/day)`,
            "var(--interactive-accent)",
            { showPercentage: false }
        );
        resourcesDiv.appendChild(resourceBar);
    });

    // Production efficiency note
    const efficiencyNote = document.createElement("div");
    efficiencyNote.style.marginTop = "0.75em";
    efficiencyNote.style.fontSize = "0.85em";
    efficiencyNote.style.color = "var(--text-muted)";
    efficiencyNote.style.fontStyle = "italic";
    efficiencyNote.textContent = `Currently operating at ${(productionRate * 100).toFixed(0)}% efficiency`;
    container.appendChild(efficiencyNote);

    return container;
}

/**
 * Create a comprehensive production dashboard combining all visualizations
 */
export function createProductionDashboard(production: BuildingProduction): HTMLElement {
    const dashboard = document.createElement("div");
    dashboard.className = "sm-production-dashboard";

    // Add all visualization components
    dashboard.appendChild(createProductionRateVisualization(production));
    dashboard.appendChild(createWorkerEfficiencyVisualization(production));
    dashboard.appendChild(createResourceVisualization(production));

    return dashboard;
}
