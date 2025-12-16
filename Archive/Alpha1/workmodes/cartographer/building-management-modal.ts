// src/workmodes/cartographer/building-management-modal.ts
// Phase 9.2B: Building management modal for editing building state, workers, and production
//
// Provides a comprehensive interface for managing building entities:
// - Edit building condition and maintenance status
// - Assign/remove faction members as workers
// - View active jobs and production output
// - Save changes back to location file

import type { App, TFile } from "obsidian";
import { Modal, Notice, Setting } from "obsidian";
import { configurableLogger } from "@services/logging/configurable-logger";

const logger = configurableLogger.forModule("cartographer-building-management-modal");
import {
    BUILDING_TEMPLATES,
    calculateProductionRate,
    calculateMaintenanceCost,
    getBuildingBonuses,
    calculateRepairCosts,
} from "@features/locations/building-production";
import {
    createProductionDashboard,
    createProgressBar,
    getCapacityColor
} from "@features/locations/production-visualization";
import {
    loadAllFactions,
    repairBuildingWithResources,
    saveBuildingChanges,
    type BuildingPersistenceDeps
} from "./building-modal-persistence";
import type { FactionMember, FactionData } from "../../workmodes/library/factions/faction-types";
import type { LocationData, BuildingProduction } from "../../workmodes/library/locations/location-types";

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
    private availableWorkers: Array<{ faction: FactionData; member: FactionMember }> = [];
    private assignedWorkers: Array<{ faction: FactionData; member: FactionMember }> = [];
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

        // Load available workers from factions
        await this.loadAvailableWorkers();

        // Create sections
        this.renderBuildingStatus(contentEl, template);
        this.renderWorkerManagement(contentEl, template);
        this.renderProductionTracking(contentEl, template);
        this.renderActionButtons(contentEl);
    }

    /**
     * Load available faction members that can work at this building
     */
    private async loadAvailableWorkers() {
        try {
            // Load all factions from the vault (using extracted persistence function)
            const factions = await loadAllFactions(this.app);

            // Get building template to check allowed jobs
            const template = BUILDING_TEMPLATES[this.production.buildingType];
            if (!template) return;

            // Filter members by:
            // 1. At the same location (POI) as this building
            // 2. Unassigned or assigned to this building
            // 3. Not already doing a job (unless it's at this building)
            const locationName = this.options.locationData.name;

            for (const faction of factions) {
                if (!faction.members) continue;

                for (const member of faction.members) {
                    // Check if member is at this location
                    const isAtLocation = member.position?.type === "poi" &&
                                       member.position?.location_name === locationName;
                    const isUnassigned = !member.position || member.position.type === "unassigned";

                    if (!isAtLocation && !isUnassigned) continue;

                    // Check if member already has a job at this building
                    const hasJobHere = member.job?.building === locationName;

                    if (hasJobHere) {
                        // Already assigned to this building
                        this.assignedWorkers.push({ faction, member });
                    } else if (!member.job) {
                        // Available for assignment
                        this.availableWorkers.push({ faction, member });
                    }
                }
            }

            logger.info('Loaded workers', {
                available: this.availableWorkers.length,
                assigned: this.assignedWorkers.length,
            });
        } catch (error) {
            logger.error('Failed to load workers', { error });
            new Notice("Failed to load faction members");
        }
    }

    private renderBuildingStatus(container: HTMLElement, template: typeof BUILDING_TEMPLATES[string]) {
        const section = container.createDiv({ cls: "sm-building-section" });
        section.style.marginBottom = "1.5em";

        // Section header with capacity chip
        const headerContainer = section.createDiv({ cls: "sm-building-header-container" });
        const header = headerContainer.createEl("h3", { text: "Building Status" });
        header.style.marginBottom = "0.5em";

        const currentCount = this.assignedWorkers.length;
        const maxCount = template.maxWorkers;

        const capacityChip = headerContainer.createEl("span", {
            cls: "sm-capacity-chip",
            text: `${currentCount}/${maxCount} Workers`
        });

        // Building type and category
        const infoDiv = section.createDiv({ cls: "sm-building-info" });
        infoDiv.style.marginBottom = "1em";
        infoDiv.createDiv({ text: `Type: ${template.name}` });
        infoDiv.createDiv({ text: `Category: ${template.category}` });
        infoDiv.createDiv({ text: `Max Workers: ${template.maxWorkers}` });

        // Capacity progress bar (immediately visible)
        const percentage = (currentCount / maxCount) * 100;
        const capacityBar = createProgressBar(
            percentage,
            `Workers (${currentCount}/${maxCount})`,
            getCapacityColor(percentage),
            { showPercentage: true }
        );
        infoDiv.appendChild(capacityBar);

        // Condition slider
        new Setting(section)
            .setName("Condition")
            .setDesc(`Bedingung beeinflusst Produktionsrate und Haltbarkeit des Gebäudes.\nCurrent: ${this.production.condition}% | Production Rate: ${(calculateProductionRate(this.production.buildingType, this.production.condition, this.production.maintenanceOverdue) * 100).toFixed(0)}%`)
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
                        `Bedingung beeinflusst Produktionsrate und Haltbarkeit des Gebäudes.\nCurrent: ${value}% | Production Rate: ${(productionRate * 100).toFixed(0)}%`
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
        const repairAmount = 10;
        const repairCosts = calculateRepairCosts(this.production.condition, repairAmount);
        const repairSetting = new Setting(section)
            .setName("Repair Building")
            .setDesc(`Cost: ${repairCosts.gold} gold, ${repairCosts.equipment} equipment`)
            .addButton(btn => btn
                .setButtonText(`Repair (+${repairAmount} condition)`)
                .onClick(async () => {
                    await this.repairBuilding(repairCosts.gold, repairCosts.equipment, repairAmount);
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

    private buildCapacityWarning(section: HTMLElement, template: typeof BUILDING_TEMPLATES[string]): void {
        const remaining = template.maxWorkers - this.assignedWorkers.length;

        if (remaining <= 2) {
            const warning = section.createDiv({ cls: "sm-capacity-warning" });
            warning.createSpan({
                text: remaining === 0
                    ? "⚠️ Building at max capacity"
                    : `⚠️ Only ${remaining} slot${remaining === 1 ? '' : 's'} remaining`
            });
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

        // Capacity warning (preventive)
        this.buildCapacityWarning(section, template);

        // Assigned workers list
        const assignedHeader = section.createEl("h4", { text: "Assigned Workers" });
        assignedHeader.style.fontSize = "0.95em";
        assignedHeader.style.marginTop = "1em";
        assignedHeader.style.marginBottom = "0.5em";

        const assignedDiv = section.createDiv({ cls: "sm-assigned-workers" });
        assignedDiv.style.minHeight = "80px";
        assignedDiv.style.padding = "0.5em";
        assignedDiv.style.background = "var(--background-secondary)";
        assignedDiv.style.borderRadius = "4px";
        assignedDiv.style.border = "1px dashed var(--background-modifier-border)";

        if (this.assignedWorkers.length === 0) {
            const emptyDiv = assignedDiv.createDiv();
            emptyDiv.style.textAlign = "center";
            emptyDiv.style.color = "var(--text-muted)";
            emptyDiv.style.padding = "1.5em 0";
            emptyDiv.setText("No workers assigned");
        } else {
            this.assignedWorkers.forEach((worker, idx) => {
                const workerCard = this.createWorkerCard(worker, "assigned", idx);
                assignedDiv.appendChild(workerCard);
            });
        }

        // Available workers list
        const availableHeader = section.createEl("h4", { text: "Available Workers" });
        availableHeader.style.fontSize = "0.95em";
        availableHeader.style.marginTop = "1em";
        availableHeader.style.marginBottom = "0.5em";

        const availableDiv = section.createDiv({ cls: "sm-available-workers" });
        availableDiv.style.minHeight = "80px";
        availableDiv.style.maxHeight = "200px";
        availableDiv.style.overflowY = "auto";
        availableDiv.style.padding = "0.5em";
        availableDiv.style.background = "var(--background-secondary)";
        availableDiv.style.borderRadius = "4px";
        availableDiv.style.border = "1px dashed var(--background-modifier-border)";

        if (this.availableWorkers.length === 0) {
            const emptyDiv = availableDiv.createDiv();
            emptyDiv.style.textAlign = "center";
            emptyDiv.style.color = "var(--text-muted)";
            emptyDiv.style.padding = "1.5em 0";
            emptyDiv.setText("No available workers at this location");
        } else {
            this.availableWorkers.forEach((worker, idx) => {
                const workerCard = this.createWorkerCard(worker, "available", idx);
                availableDiv.appendChild(workerCard);
            });
        }
    }

    /**
     * Create a draggable worker card
     */
    private createWorkerCard(
        worker: { faction: FactionData; member: FactionMember },
        pool: "available" | "assigned",
        index: number
    ): HTMLElement {
        const card = document.createElement("div");
        card.className = "sm-worker-card";
        card.style.padding = "0.5em";
        card.style.marginBottom = "0.5em";
        card.style.background = "var(--background-primary)";
        card.style.borderRadius = "4px";
        card.style.border = "1px solid var(--background-modifier-border)";
        card.style.cursor = "grab";
        card.draggable = true;

        // Check job compatibility for available workers
        const template = BUILDING_TEMPLATES[this.production.buildingType];
        const workerJobType = worker.member.job?.type;
        const isJobCompatible = !workerJobType || (template && template.allowedJobs.includes(workerJobType));

        // Visual indicator for incompatible jobs (available pool only)
        if (pool === "available" && !isJobCompatible) {
            card.style.opacity = "0.5";
            card.style.border = "1px solid var(--text-error)";
            card.style.cursor = "not-allowed";
            card.draggable = false;
        }

        // Worker info
        const nameDiv = card.createDiv();
        nameDiv.style.fontWeight = "600";
        nameDiv.style.marginBottom = "0.25em";
        nameDiv.setText(worker.member.name);

        const infoDiv = card.createDiv();
        infoDiv.style.fontSize = "0.85em";
        infoDiv.style.color = "var(--text-muted)";
        infoDiv.setText(`${worker.faction.name}${worker.member.role ? ` • ${worker.member.role}` : ""}`);

        // Show job type if present
        if (workerJobType) {
            const jobDiv = card.createDiv();
            jobDiv.style.fontSize = "0.75em";
            jobDiv.style.marginTop = "0.25em";
            jobDiv.style.padding = "0.15em 0.35em";
            jobDiv.style.borderRadius = "3px";
            jobDiv.style.display = "inline-block";

            if (pool === "available" && !isJobCompatible) {
                jobDiv.style.background = "var(--background-modifier-error)";
                jobDiv.style.color = "var(--text-error)";
                jobDiv.setText(`⚠️ Job: ${workerJobType} (incompatible)`);
            } else {
                jobDiv.style.background = "var(--background-modifier-success)";
                jobDiv.style.color = "var(--text-success)";
                jobDiv.setText(`Job: ${workerJobType}`);
            }
        }

        // Drag and drop handlers
        card.ondragstart = (e) => {
            e.dataTransfer!.effectAllowed = "move";
            e.dataTransfer!.setData("text/plain", JSON.stringify({
                pool,
                index,
                factionName: worker.faction.name,
                memberName: worker.member.name
            }));
            card.style.opacity = "0.5";
        };

        card.ondragend = () => {
            card.style.opacity = "1";
        };

        // Make assigned worker cards drop targets to swap or unassign
        if (pool === "assigned") {
            card.ondragover = (e) => {
                e.preventDefault();
                card.style.background = "var(--interactive-accent)";
            };

            card.ondragleave = () => {
                card.style.background = "var(--background-primary)";
            };

            card.ondrop = (e) => {
                e.preventDefault();
                card.style.background = "var(--background-primary)";

                const data = JSON.parse(e.dataTransfer!.getData("text/plain"));
                if (data.pool === "available") {
                    // Assign worker
                    this.assignWorker(data.index);
                    this.refresh();
                }
            };
        }

        // Click to unassign (for assigned workers)
        if (pool === "assigned") {
            const unassignBtn = card.createEl("button", { text: "Unassign" });
            unassignBtn.style.marginTop = "0.5em";
            unassignBtn.style.fontSize = "0.8em";
            unassignBtn.onclick = (e) => {
                e.stopPropagation();
                this.unassignWorker(index);
                this.refresh();
            };
        }

        // Click to assign (for available workers)
        if (pool === "available") {
            const assignBtn = card.createEl("button", { text: "Assign" });
            assignBtn.style.marginTop = "0.5em";
            assignBtn.style.fontSize = "0.8em";
            assignBtn.onclick = (e) => {
                e.stopPropagation();
                this.assignWorker(index);
                this.refresh();
            };
        }

        return card;
    }

    /**
     * Assign a worker from available pool to this building
     */
    private assignWorker(availableIndex: number) {
        const template = BUILDING_TEMPLATES[this.production.buildingType];
        if (!template) return;

        // Check capacity
        if (this.assignedWorkers.length >= template.maxWorkers) {
            new Notice(`Building is at max capacity (${template.maxWorkers} workers)`);
            return;
        }

        const worker = this.availableWorkers[availableIndex];
        if (!worker) return;

        // Validate job compatibility
        const workerJobType = worker.member.job?.type;
        if (workerJobType && !template.allowedJobs.includes(workerJobType)) {
            const allowedJobsStr = template.allowedJobs.join(', ');
            new Notice(
                `Cannot assign worker: ${worker.member.name} has job type "${workerJobType}" ` +
                `but this building only allows: ${allowedJobsStr}`,
                5000 // Show for 5 seconds
            );
            logger.warn('Job validation failed', {
                member: worker.member.name,
                memberJob: workerJobType,
                buildingType: this.production.buildingType,
                allowedJobs: template.allowedJobs
            });
            return;
        }

        // Move from available to assigned
        this.availableWorkers.splice(availableIndex, 1);
        this.assignedWorkers.push(worker);

        // Update production worker count
        this.production.currentWorkers = this.assignedWorkers.length;
        this.unsavedChanges = true;

        logger.info('Assigned worker', {
            member: worker.member.name,
            faction: worker.faction.name,
            jobType: workerJobType,
            totalWorkers: this.assignedWorkers.length
        });
    }

    /**
     * Unassign a worker from this building back to available pool
     */
    private unassignWorker(assignedIndex: number) {
        const worker = this.assignedWorkers[assignedIndex];
        if (!worker) return;

        // Move from assigned back to available
        this.assignedWorkers.splice(assignedIndex, 1);
        this.availableWorkers.push(worker);

        // Update production worker count
        this.production.currentWorkers = this.assignedWorkers.length;
        this.unsavedChanges = true;

        logger.info('Unassigned worker', {
            member: worker.member.name,
            faction: worker.faction.name,
            totalWorkers: this.assignedWorkers.length
        });
    }

    private renderProductionTracking(container: HTMLElement, template: typeof BUILDING_TEMPLATES[string]) {
        const section = container.createDiv({ cls: "sm-production-section" });
        section.style.marginBottom = "1.5em";

        // Section header
        const header = section.createEl("h3", { text: "Production Tracking & Analytics" });
        header.style.marginBottom = "0.5em";

        // === Phase 9.2D: Production Visualization Dashboard ===
        const dashboard = createProductionDashboard(this.production);
        section.appendChild(dashboard);

        // Active jobs list (keep existing functionality)
        if (this.production.activeJobs && this.production.activeJobs.length > 0) {
            const jobsSection = section.createDiv({ cls: "sm-active-jobs-section" });
            jobsSection.style.marginTop = "1.5em";
            jobsSection.style.padding = "0.75em";
            jobsSection.style.background = "var(--background-secondary)";
            jobsSection.style.borderRadius = "4px";

            const jobsHeader = jobsSection.createEl("h4", { text: "Active Jobs" });
            jobsHeader.style.fontSize = "0.95em";
            jobsHeader.style.marginTop = "0";
            jobsHeader.style.marginBottom = "0.5em";

            const jobsList = jobsSection.createDiv({ cls: "sm-active-jobs-list" });

            this.production.activeJobs.forEach((job, index) => {
                const jobDiv = jobsList.createDiv({ cls: "sm-job-item" });
                jobDiv.style.padding = "0.5em";
                jobDiv.style.marginBottom = "0.5em";
                jobDiv.style.background = "var(--background-primary)";
                jobDiv.style.borderRadius = "4px";
                jobDiv.style.border = "1px solid var(--background-modifier-border)";

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
                removeBtn.style.fontSize = "0.8em";
                removeBtn.onclick = () => {
                    this.production.activeJobs.splice(index, 1);
                    this.unsavedChanges = true;
                    this.refresh();
                };
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

    /**
     * Create persistence dependencies for extracted functions
     */
    private getPersistenceDeps(): BuildingPersistenceDeps {
        return {
            app: this.app,
            locationFile: this.options.locationFile,
            locationData: this.options.locationData,
            production: this.production,
            assignedWorkers: this.assignedWorkers,
        };
    }

    /**
     * Repair building and deduct resources from owning faction
     */
    private async repairBuilding(goldCost: number, equipmentCost: number, conditionIncrease: number) {
        const result = await repairBuildingWithResources(
            this.getPersistenceDeps(),
            goldCost,
            equipmentCost,
            conditionIncrease
        );

        if (result.success) {
            this.unsavedChanges = true;
            this.refresh();
        }
    }

    private async saveChanges() {
        const success = await saveBuildingChanges(
            this.getPersistenceDeps(),
            this.options.onSave
        );

        if (success) {
            this.unsavedChanges = false;
            this.close();
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
