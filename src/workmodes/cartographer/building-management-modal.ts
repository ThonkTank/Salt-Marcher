// src/workmodes/cartographer/building-management-modal.ts
// Phase 9.2B: Building management modal for editing building state, workers, and production
//
// Provides a comprehensive interface for managing building entities:
// - Edit building condition and maintenance status
// - Assign/remove faction members as workers
// - View active jobs and production output
// - Save changes back to location file

import { App, Modal, Notice, Setting, TFile } from "obsidian";
import type { LocationData, BuildingProduction } from "../../workmodes/library/locations/types";
import type { FactionMember } from "../../workmodes/library/factions/types";
import {
    BUILDING_TEMPLATES,
    calculateProductionRate,
    calculateMaintenanceCost,
    getBuildingBonuses,
    repairBuilding
} from "../../features/locations/building-production";
import { readFrontmatter } from "../../features/data-manager/browse/frontmatter-utils";
import { logger } from "../../app/plugin-logger";

interface BuildingManagementModalOptions {
    /** Location file to manage */
    locationFile: TFile;
    /** Initial location data */
    locationData: LocationData;
    /** Callback when building is saved */
    onSave?: (updatedData: LocationData) => void;
}

/**
 * Modal for comprehensive building management
 */
export class BuildingManagementModal extends Modal {
    private options: BuildingManagementModalOptions;
    private production: BuildingProduction;
    private availableWorkers: FactionMember[] = [];
    private unsavedChanges = false;

    constructor(app: App, options: BuildingManagementModalOptions) {
        super(app);
        this.options = options;

        // Clone production data to avoid mutating original
        this.production = JSON.parse(JSON.stringify(
            options.locationData.building_production
        )) as BuildingProduction;
    }

    async onOpen() {
        const { contentEl } = this;
        contentEl.empty();
        contentEl.addClass("sm-building-management-modal");

        // Modal title
        const title = contentEl.createEl("h2", {
            text: `Manage Building: ${this.options.locationData.name}`
        });
        title.style.marginBottom = "1em";

        // Get building template
        const template = BUILDING_TEMPLATES[this.production.buildingType];
        if (!template) {
            new Notice("Invalid building type");
            this.close();
            return;
        }

        // Load available workers from factions (TODO: implement faction member lookup)
        // For now, this is a placeholder
        this.availableWorkers = [];

        // Create sections
        this.renderBuildingStatus(contentEl, template);
        this.renderWorkerManagement(contentEl, template);
        this.renderProductionTracking(contentEl, template);
        this.renderActionButtons(contentEl);
    }

    private renderBuildingStatus(container: HTMLElement, template: typeof BUILDING_TEMPLATES[string]) {
        const section = container.createDiv({ cls: "sm-building-section" });
        section.style.marginBottom = "1.5em";

        // Section header
        const header = section.createEl("h3", { text: "Building Status" });
        header.style.marginBottom = "0.5em";

        // Building type and category
        const infoDiv = section.createDiv({ cls: "sm-building-info" });
        infoDiv.style.marginBottom = "1em";
        infoDiv.createDiv({ text: `Type: ${template.name}` });
        infoDiv.createDiv({ text: `Category: ${template.category}` });
        infoDiv.createDiv({ text: `Max Workers: ${template.maxWorkers}` });

        // Condition slider
        new Setting(section)
            .setName("Condition")
            .setDesc(`Current: ${this.production.condition}% | Production Rate: ${(calculateProductionRate(this.production.buildingType, this.production.condition, this.production.maintenanceOverdue) * 100).toFixed(0)}%`)
            .addSlider(slider => slider
                .setLimits(0, 100, 1)
                .setValue(this.production.condition)
                .onChange(value => {
                    this.production.condition = value;
                    this.unsavedChanges = true;
                    // Update description
                    const productionRate = calculateProductionRate(
                        this.production.buildingType,
                        this.production.condition,
                        this.production.maintenanceOverdue
                    );
                    slider.sliderEl.parentElement?.querySelector('.setting-item-description')?.setText(
                        `Current: ${value}% | Production Rate: ${(productionRate * 100).toFixed(0)}%`
                    );
                })
            );

        // Maintenance overdue
        new Setting(section)
            .setName("Maintenance Overdue")
            .setDesc("Days since last maintenance")
            .addText(text => text
                .setValue(String(this.production.maintenanceOverdue))
                .onChange(value => {
                    const days = parseInt(value) || 0;
                    this.production.maintenanceOverdue = Math.max(0, days);
                    this.unsavedChanges = true;
                })
            );

        // Repair button
        const repairSetting = new Setting(section)
            .setName("Repair Building")
            .setDesc("Spend resources to improve condition")
            .addButton(btn => btn
                .setButtonText("Repair (+10 condition)")
                .onClick(() => {
                    // TODO: Integrate with faction resources
                    const repairAmount = repairBuilding(this.production, 1, 0.5);
                    new Notice(`Repaired building: +${repairAmount.toFixed(0)} condition`);
                    this.unsavedChanges = true;
                    this.refresh();
                })
            );

        // Maintenance cost display
        const maintenance = calculateMaintenanceCost(this.production.buildingType);
        const maintenanceText = Object.entries(maintenance)
            .filter(([, value]) => value && value > 0)
            .map(([key, value]) => `${key}: ${value}`)
            .join(", ");

        if (maintenanceText) {
            const maintenanceDiv = section.createDiv({ cls: "sm-maintenance-cost" });
            maintenanceDiv.style.fontSize = "0.9em";
            maintenanceDiv.style.color = "var(--text-muted)";
            maintenanceDiv.style.marginTop = "0.5em";
            maintenanceDiv.setText(`Daily maintenance: ${maintenanceText}`);
        }

        // Building bonuses
        const bonuses = getBuildingBonuses(this.production.buildingType);
        if (bonuses && Object.keys(bonuses).length > 0) {
            const bonusDiv = section.createDiv({ cls: "sm-building-bonuses" });
            bonusDiv.style.marginTop = "0.5em";
            bonusDiv.style.padding = "0.5em";
            bonusDiv.style.background = "var(--background-secondary)";
            bonusDiv.style.borderRadius = "4px";

            bonusDiv.createEl("div", {
                text: "Building Bonuses:",
                cls: "sm-bonus-header"
            }).style.fontWeight = "600";

            if (bonuses.qualityBonus) {
                bonusDiv.createDiv({
                    text: `✨ Quality: +${(bonuses.qualityBonus * 100).toFixed(0)}%`
                });
            }
            if (bonuses.trainingSpeed) {
                bonusDiv.createDiv({
                    text: `⚡ Training Speed: ${(bonuses.trainingSpeed * 100).toFixed(0)}%`
                });
            }
            if (bonuses.researchBonus) {
                bonusDiv.createDiv({
                    text: `📚 Research: +${(bonuses.researchBonus * 100).toFixed(0)}%`
                });
            }
        }
    }

    private renderWorkerManagement(container: HTMLElement, template: typeof BUILDING_TEMPLATES[string]) {
        const section = container.createDiv({ cls: "sm-worker-section" });
        section.style.marginBottom = "1.5em";

        // Section header
        const header = section.createEl("h3", { text: "Worker Management" });
        header.style.marginBottom = "0.5em";

        // Current workers count
        new Setting(section)
            .setName("Current Workers")
            .setDesc(`Assigned: ${this.production.currentWorkers}/${template.maxWorkers}`)
            .addText(text => text
                .setValue(String(this.production.currentWorkers))
                .onChange(value => {
                    const workers = parseInt(value) || 0;
                    this.production.currentWorkers = Math.max(0, Math.min(template.maxWorkers, workers));
                    this.unsavedChanges = true;
                    // Update description
                    text.inputEl.parentElement?.querySelector('.setting-item-description')?.setText(
                        `Assigned: ${this.production.currentWorkers}/${template.maxWorkers}`
                    );
                })
            );

        // Allowed jobs display
        const jobsDiv = section.createDiv({ cls: "sm-allowed-jobs" });
        jobsDiv.style.marginTop = "0.5em";
        jobsDiv.style.padding = "0.5em";
        jobsDiv.style.background = "var(--background-secondary)";
        jobsDiv.style.borderRadius = "4px";

        jobsDiv.createEl("div", {
            text: "Allowed Jobs:",
            cls: "sm-jobs-header"
        }).style.fontWeight = "600";

        template.allowedJobs.forEach(job => {
            jobsDiv.createDiv({ text: `• ${job}` });
        });

        // TODO: Worker assignment UI will be implemented in a future iteration
        // This would show a list of available faction members and allow drag-and-drop assignment
        const placeholderDiv = section.createDiv({ cls: "sm-worker-placeholder" });
        placeholderDiv.style.marginTop = "1em";
        placeholderDiv.style.padding = "1em";
        placeholderDiv.style.background = "var(--background-secondary)";
        placeholderDiv.style.borderRadius = "4px";
        placeholderDiv.style.border = "1px dashed var(--background-modifier-border)";
        placeholderDiv.style.textAlign = "center";
        placeholderDiv.style.color = "var(--text-muted)";
        placeholderDiv.setText("Worker assignment UI: Coming in future update");
        placeholderDiv.createDiv({ text: "(Drag faction members here to assign as workers)" })
            .style.fontSize = "0.85em";
    }

    private renderProductionTracking(container: HTMLElement, template: typeof BUILDING_TEMPLATES[string]) {
        const section = container.createDiv({ cls: "sm-production-section" });
        section.style.marginBottom = "1.5em";

        // Section header
        const header = section.createEl("h3", { text: "Production Tracking" });
        header.style.marginBottom = "0.5em";

        // Active jobs list
        if (this.production.activeJobs && this.production.activeJobs.length > 0) {
            const jobsHeader = section.createEl("h4", { text: "Active Jobs" });
            jobsHeader.style.fontSize = "0.95em";
            jobsHeader.style.marginTop = "0.5em";
            jobsHeader.style.marginBottom = "0.5em";

            const jobsList = section.createDiv({ cls: "sm-active-jobs-list" });

            this.production.activeJobs.forEach((job, index) => {
                const jobDiv = jobsList.createDiv({ cls: "sm-job-item" });
                jobDiv.style.padding = "0.5em";
                jobDiv.style.marginBottom = "0.5em";
                jobDiv.style.background = "var(--background-secondary)";
                jobDiv.style.borderRadius = "4px";

                jobDiv.createDiv({ text: `${job.workerName} - ${job.jobType}` })
                    .style.fontWeight = "600";

                jobDiv.createDiv({ text: `Progress: ${job.progress}%` });

                if (job.startedAt) {
                    jobDiv.createDiv({ text: `Started: ${job.startedAt}` })
                        .style.fontSize = "0.85em";
                }

                // Remove job button
                const removeBtn = jobDiv.createEl("button", { text: "Remove" });
                removeBtn.style.marginTop = "0.5em";
                removeBtn.onclick = () => {
                    this.production.activeJobs.splice(index, 1);
                    this.unsavedChanges = true;
                    this.refresh();
                };
            });
        } else {
            const noJobsDiv = section.createDiv({ cls: "sm-no-jobs" });
            noJobsDiv.style.padding = "1em";
            noJobsDiv.style.background = "var(--background-secondary)";
            noJobsDiv.style.borderRadius = "4px";
            noJobsDiv.style.textAlign = "center";
            noJobsDiv.style.color = "var(--text-muted)";
            noJobsDiv.setText("No active jobs");
        }

        // Period production display
        if (this.production.periodProduction && Object.keys(this.production.periodProduction).length > 0) {
            const prodHeader = section.createEl("h4", { text: "Period Production" });
            prodHeader.style.fontSize = "0.95em";
            prodHeader.style.marginTop = "1em";
            prodHeader.style.marginBottom = "0.5em";

            const prodDiv = section.createDiv({ cls: "sm-period-production" });
            prodDiv.style.padding = "0.5em";
            prodDiv.style.background = "var(--background-secondary)";
            prodDiv.style.borderRadius = "4px";

            Object.entries(this.production.periodProduction)
                .filter(([, value]) => value && value > 0)
                .forEach(([resource, amount]) => {
                    prodDiv.createDiv({ text: `${resource}: ${amount}` });
                });
        }
    }

    private renderActionButtons(container: HTMLElement) {
        const buttonContainer = container.createDiv({ cls: "sm-button-container" });
        buttonContainer.style.display = "flex";
        buttonContainer.style.gap = "0.5em";
        buttonContainer.style.justifyContent = "flex-end";
        buttonContainer.style.marginTop = "1.5em";
        buttonContainer.style.paddingTop = "1em";
        buttonContainer.style.borderTop = "1px solid var(--background-modifier-border)";

        // Cancel button
        const cancelBtn = buttonContainer.createEl("button", { text: "Cancel" });
        cancelBtn.onclick = () => {
            if (this.unsavedChanges) {
                const confirmed = confirm("You have unsaved changes. Are you sure you want to cancel?");
                if (!confirmed) return;
            }
            this.close();
        };

        // Save button
        const saveBtn = buttonContainer.createEl("button", { text: "Save Changes", cls: "mod-cta" });
        saveBtn.onclick = async () => {
            await this.saveChanges();
        };
    }

    private async saveChanges() {
        try {
            // Use Obsidian's processFrontMatter API to update building_production field
            await this.app.fileManager.processFrontMatter(
                this.options.locationFile,
                (frontmatter) => {
                    // Update the building_production field
                    frontmatter.building_production = this.production;
                }
            );

            logger.info('[building-management] Saved building changes', {
                location: this.options.locationData.name,
                buildingType: this.production.buildingType,
                condition: this.production.condition,
                workers: this.production.currentWorkers
            });

            new Notice("Building changes saved");

            // Callback for parent components
            if (this.options.onSave) {
                // Update the locationData with new production state
                const updatedData = { ...this.options.locationData };
                updatedData.building_production = this.production;
                this.options.onSave(updatedData);
            }

            this.unsavedChanges = false;
            this.close();
        } catch (error) {
            logger.error('[building-management] Failed to save building changes', { error });
            new Notice("Failed to save changes. Check console for details.");
        }
    }

    private refresh() {
        // Re-render the modal content
        this.onOpen();
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }
}
