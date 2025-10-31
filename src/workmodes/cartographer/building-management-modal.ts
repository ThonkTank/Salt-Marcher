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
import type { FactionMember, FactionData } from "../../workmodes/library/factions/types";
import {
    BUILDING_TEMPLATES,
    calculateProductionRate,
    calculateMaintenanceCost,
    getBuildingBonuses,
    calculateRepairCosts,
    repairBuilding
} from "../../features/locations/building-production";
import { createProductionDashboard } from "../../features/locations/production-visualization";
import { readFrontmatter } from "../../features/data-manager/browse/frontmatter-utils";
import { logger } from "../../app/plugin-logger";
import * as yaml from "js-yaml";

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
            // Load all factions from the vault
            const factions = await this.loadAllFactions();

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

            logger.debug('[building-management] Loaded workers', {
                available: this.availableWorkers.length,
                assigned: this.assignedWorkers.length,
            });
        } catch (error) {
            logger.error('[building-management] Failed to load workers', { error });
            new Notice("Failed to load faction members");
        }
    }

    /**
     * Load all factions from vault
     */
    private async loadAllFactions(): Promise<FactionData[]> {
        const factions: FactionData[] = [];

        try {
            const files = this.app.vault.getMarkdownFiles();
            const factionFiles = files.filter(f =>
                f.path.startsWith("SaltMarcher/Factions/") &&
                !f.path.includes("Presets")
            );

            for (const file of factionFiles) {
                try {
                    const content = await this.app.vault.read(file);
                    const fmMatch = content.match(/^---\n([\s\S]*?)\n---/);
                    if (!fmMatch) continue;

                    const fm = fmMatch[1];
                    if (!fm.includes("smType: faction")) continue;

                    const parsed = yaml.load(fm) as any;
                    if (!parsed || typeof parsed !== "object") continue;

                    if (!parsed.name || typeof parsed.name !== "string") continue;

                    factions.push(parsed as FactionData);
                } catch (error) {
                    logger.warn('[building-management] Error loading faction file', {
                        file: file.path,
                        error
                    });
                }
            }
        } catch (error) {
            logger.error('[building-management] Failed to load factions', { error });
        }

        return factions;
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
            logger.warn('[building-management] Job validation failed', {
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

        logger.debug('[building-management] Assigned worker', {
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

        logger.debug('[building-management] Unassigned worker', {
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
     * Repair building and deduct resources from owning faction
     */
    private async repairBuilding(goldCost: number, equipmentCost: number, conditionIncrease: number) {
        try {
            // 1. Check if location has an owning faction
            if (this.options.locationData.owner_type !== "faction" || !this.options.locationData.owner_name) {
                new Notice("Building has no owning faction. Cannot deduct repair costs.");
                return;
            }

            const factionName = this.options.locationData.owner_name;

            // 2. Find and load faction file
            const factionFile = await this.findFactionFile(factionName);
            if (!factionFile) {
                new Notice(`Faction "${factionName}" not found.`);
                return;
            }

            const content = await this.app.vault.read(factionFile);
            const fmMatch = content.match(/^---\n([\s\S]*?)\n---/);
            if (!fmMatch) {
                new Notice(`Invalid faction file format for "${factionName}".`);
                return;
            }

            const faction = yaml.load(fmMatch[1]) as FactionData;

            // 3. Ensure faction has resources
            if (!faction.resources) {
                faction.resources = {};
            }

            // 4. Check if faction has enough resources
            const currentGold = faction.resources.gold || 0;
            const currentEquipment = faction.resources.equipment || 0;

            if (currentGold < goldCost || currentEquipment < equipmentCost) {
                new Notice(
                    `Insufficient resources. Faction has ${currentGold} gold (need ${goldCost}) and ${currentEquipment} equipment (need ${equipmentCost}).`
                );
                return;
            }

            // 5. Deduct resources from faction
            faction.resources.gold = currentGold - goldCost;
            faction.resources.equipment = currentEquipment - equipmentCost;

            // 6. Save updated faction file
            const updatedFrontmatter = yaml.dump(faction);
            const updatedContent = `---\n${updatedFrontmatter}---${content.substring(fmMatch[0].length)}`;
            await this.app.vault.modify(factionFile, updatedContent);

            // 7. Apply repair to building
            const actualRepair = repairBuilding(this.production, goldCost, equipmentCost);

            logger.info('[building-management] Building repaired', {
                location: this.options.locationData.name,
                faction: factionName,
                goldSpent: goldCost,
                equipmentSpent: equipmentCost,
                conditionIncrease: actualRepair,
                newCondition: this.production.condition
            });

            new Notice(
                `Repaired building: +${actualRepair.toFixed(0)} condition (now ${this.production.condition}%). Spent ${goldCost} gold and ${equipmentCost} equipment.`
            );

            this.unsavedChanges = true;
            this.refresh();
        } catch (error) {
            logger.error('[building-management] Failed to repair building', { error });
            new Notice("Failed to repair building. Check console for details.");
        }
    }

    private async saveChanges() {
        try {
            // 1. Update building production in location file
            await this.app.fileManager.processFrontMatter(
                this.options.locationFile,
                (frontmatter) => {
                    frontmatter.building_production = this.production;
                }
            );

            // 2. Update faction files to reflect worker assignments
            await this.saveFactionWorkerAssignments();

            logger.info('[building-management] Saved building changes', {
                location: this.options.locationData.name,
                buildingType: this.production.buildingType,
                condition: this.production.condition,
                workers: this.production.currentWorkers
            });

            new Notice("Building changes saved");

            // Callback for parent components
            if (this.options.onSave) {
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

    /**
     * Update faction files to reflect worker position and job assignments
     */
    private async saveFactionWorkerAssignments() {
        const locationName = this.options.locationData.name;

        // Group assigned workers by faction
        const workersByFaction = new Map<string, FactionMember[]>();
        for (const { faction, member } of this.assignedWorkers) {
            if (!workersByFaction.has(faction.name)) {
                workersByFaction.set(faction.name, []);
            }
            workersByFaction.get(faction.name)!.push(member);
        }

        // Update each faction file
        for (const [factionName, members] of workersByFaction.entries()) {
            try {
                const factionFile = await this.findFactionFile(factionName);
                if (!factionFile) {
                    logger.warn('[building-management] Faction file not found', { factionName });
                    continue;
                }

                const content = await this.app.vault.read(factionFile);
                const fmMatch = content.match(/^---\n([\s\S]*?)\n---/);
                if (!fmMatch) continue;

                const parsed = yaml.load(fmMatch[1]) as FactionData;
                if (!parsed.members) parsed.members = [];

                // Update members that are assigned to this building
                for (const assignedMember of members) {
                    const member = parsed.members.find(m => m.name === assignedMember.name);
                    if (member) {
                        // Update position to POI
                        member.position = {
                            type: "poi",
                            location_name: locationName
                        };
                        // Set building reference for job
                        if (!member.job) {
                            member.job = {
                                type: "guard", // Default job type
                                building: locationName,
                                progress: 0
                            };
                        } else {
                            member.job.building = locationName;
                        }
                    }
                }

                // Serialize and save
                const yamlStr = yaml.dump(parsed, { lineWidth: -1, noRefs: true });
                const body = content.split(/\n---\n/)[1] || "";
                const newContent = `---\n${yamlStr}---\n${body}`;
                await this.app.vault.modify(factionFile, newContent);

                logger.debug('[building-management] Updated faction file', {
                    faction: factionName,
                    workers: members.length
                });
            } catch (error) {
                logger.error('[building-management] Failed to update faction', {
                    faction: factionName,
                    error
                });
            }
        }
    }

    /**
     * Find faction file by name
     */
    private async findFactionFile(factionName: string): Promise<TFile | null> {
        const files = this.app.vault.getMarkdownFiles();
        const factionFiles = files.filter(f =>
            f.path.startsWith("SaltMarcher/Factions/") &&
            !f.path.includes("Presets")
        );

        for (const file of factionFiles) {
            const content = await this.app.vault.read(file);
            const fmMatch = content.match(/^---\n([\s\S]*?)\n---/);
            if (!fmMatch) continue;

            const parsed = yaml.load(fmMatch[1]) as any;
            if (parsed && parsed.name === factionName) {
                return file;
            }
        }

        return null;
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
