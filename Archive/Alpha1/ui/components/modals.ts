// src/ui/components/modals.ts
// Overview / central registry for shared modals.
// - NameInputModal: collects a map name (Enter shortcut, focuses the input field).
// - MapSelectModal: fuzzy-searches maps (TFile list) and invokes a callback with the selection.

import type { App, TFile } from "obsidian";
import { FuzzySuggestModal, Notice } from "obsidian";
import { BasePluginModal } from "../patterns/base-modal";

export interface NameInputModalOptions {
    placeholder?: string;
    title?: string;
    cta?: string;
    initialValue?: string;
}

/**
 * Modal used to collect a new map name.
 * Supports Enter key shortcut and auto-focuses input field.
 */
export class NameInputModal extends BasePluginModal<NameInputModalOptions> {
    private value = "";
    private inputEl: HTMLInputElement | null = null;

    constructor(
        app: App,
        private onSubmit: (val: string) => void,
        options?: NameInputModalOptions,
    ) {
        const config = options ?? {};
        const placeholder = config.placeholder ?? "New hex map";
        const title = config.title ?? "Name the new map";

        super(app, config, {
            title,
            className: "sm-name-input-modal",
            width: "400px",
            focusSelector: "input[type='text']"
        });

        this.value = config.initialValue?.trim() ?? "";
    }

    protected renderContent(): HTMLElement {
        const container = document.createElement('div');
        const placeholder = this.options.placeholder ?? "New hex map";
        const ctaLabel = this.options.cta ?? "Create";

        // Input field
        this.inputEl = container.createEl('input', {
            type: 'text',
            placeholder: placeholder,
            cls: 'name-input'
        }) as HTMLInputElement;
        this.inputEl.style.width = '100%';
        this.inputEl.style.marginBottom = '16px';

        if (this.value) {
            this.inputEl.value = this.value;
        }

        // Button row
        const btnRow = container.createDiv({ cls: 'modal-button-row' });

        // Cancel button
        const cancelBtn = btnRow.createEl('button', {
            text: 'Cancel',
            cls: 'mod-plain'
        });
        cancelBtn.addEventListener('click', () => {
            this.close();
        });

        // Submit button
        const submitBtn = btnRow.createEl('button', {
            text: ctaLabel,
            cls: 'mod-cta'
        });
        submitBtn.addEventListener('click', () => {
            this.submit();
        });

        // Track input changes
        this.inputEl.addEventListener('input', (e) => {
            this.value = (e.target as HTMLInputElement).value.trim();
        });

        return container;
    }

    protected onAfterOpen(): void {
        // Register Enter key shortcut
        this.scope.register([], "Enter", () => {
            this.submit();
        });

        // Input will auto-focus via focusSelector in config
    }

    private submit(): void {
        const name = this.value || (this.options.placeholder ?? "New hex map");
        this.close();
        this.onSubmit(name);
    }
}

/** Result from MapCreationModal */
export interface MapCreationResult {
    name: string;
    sizeInDays: number;
    coastEdges: CompassDirection[];
}

export interface MapCreationProgressOptions {
    onProgress?: (percent: number) => void;
    signal?: AbortSignal;
}

export interface MapCreationModalOptions {
    title?: string;
    initialName?: string;
}

type CompassDirection = "N" | "NE" | "SE" | "S" | "SW" | "NW";

/**
 * Modal for creating a new hex map with size and coastline configuration.
 * Provides:
 * - Name input
 * - Size selector (preset buttons + custom slider)
 * - Interactive coastline selector (clickable hex edges)
 */
export class MapCreationModal extends BasePluginModal<MapCreationModalOptions> {
    private name = "";
    private sizeInDays = 5; // Default: Medium
    private coastEdges = new Set<CompassDirection>();
    private inputEl: HTMLInputElement | null = null;
    private previewEl: HTMLElement | null = null;
    private hexSvg: SVGSVGElement | null = null;
    private createBtn: HTMLButtonElement | null = null;
    private progressContainer: HTMLElement | null = null;
    private progressBar: HTMLProgressElement | null = null;
    private progressText: HTMLElement | null = null;
    private cancelBtn: HTMLButtonElement | null = null;
    private abortController: AbortController | null = null;

    constructor(
        app: App,
        private onSubmit: (result: MapCreationResult, progressOptions?: MapCreationProgressOptions) => void | Promise<void>,
        options?: MapCreationModalOptions,
    ) {
        super(app, options ?? {}, {
            title: options?.title ?? "Create New Map",
            className: "sm-map-creation-modal",
            width: "500px",
            focusSelector: "input[type='text']"
        });

        this.name = options?.initialName?.trim() ?? "";
    }

    protected renderContent(): HTMLElement {
        const container = document.createElement('div');
        container.style.display = 'flex';
        container.style.flexDirection = 'column';
        container.style.gap = '20px';

        // 1. Name Input
        this.renderNameInput(container);

        // 2. Size Selector
        this.renderSizeSelector(container);

        // 3. Coast Selector
        this.renderCoastSelector(container);

        // 4. Button Row
        this.renderButtons(container);

        // 5. Progress UI (initially hidden)
        this.renderProgressUI(container);

        return container;
    }

    private renderNameInput(container: HTMLElement): void {
        const section = container.createDiv({ cls: 'map-creation-section' });
        section.createEl('label', {
            text: 'Map Name:',
            cls: 'map-creation-label'
        });

        this.inputEl = section.createEl('input', {
            type: 'text',
            placeholder: 'New hex map',
            cls: 'map-creation-input'
        }) as HTMLInputElement;
        this.inputEl.style.width = '100%';
        this.inputEl.style.marginTop = '4px';

        if (this.name) {
            this.inputEl.value = this.name;
        }

        this.inputEl.addEventListener('input', (e) => {
            this.name = (e.target as HTMLInputElement).value.trim();
            // Clear error state when user types
            this.inputEl?.classList.remove('is-error');
            this.updateCreateButtonState();
        });
    }

    private renderSizeSelector(container: HTMLElement): void {
        const section = container.createDiv({ cls: 'map-creation-section' });

        section.createEl('label', {
            text: 'Map Size (Travel Days from Center to Edge)',
            cls: 'map-creation-label'
        });

        // Size input
        const inputRow = section.createDiv({ cls: 'map-creation-input-row' });
        inputRow.style.display = 'flex';
        inputRow.style.alignItems = 'center';
        inputRow.style.gap = '12px';
        inputRow.style.marginTop = '8px';

        const sizeInputEl = inputRow.createEl('input', {
            type: 'number',
            cls: 'map-creation-size-input'
        }) as HTMLInputElement;
        sizeInputEl.min = '1';
        sizeInputEl.max = '20';
        sizeInputEl.value = String(this.sizeInDays);
        sizeInputEl.style.width = '60px';

        inputRow.createEl('span', {
            text: 'days',
            cls: 'map-creation-input-unit'
        });

        sizeInputEl.addEventListener('input', (e) => {
            const value = parseInt((e.target as HTMLInputElement).value, 10);
            if (!isNaN(value)) {
                this.sizeInDays = value;
                this.updateSizePreview();
                this.updateCreateButtonState();
            }
        });

        // Preview text
        this.previewEl = section.createDiv({ cls: 'map-creation-preview' });
        this.previewEl.style.marginTop = '8px';
        this.previewEl.style.fontSize = '0.9em';
        this.previewEl.style.color = 'var(--text-muted)';
        this.updateSizePreview();
    }

    private renderCoastSelector(container: HTMLElement): void {
        const section = container.createDiv({ cls: 'map-creation-section' });

        section.createEl('label', {
            text: 'Coastlines (click edges with water):',
            cls: 'map-creation-label'
        });

        // SVG hexagon with clickable edges
        const svgContainer = section.createDiv({ cls: 'map-creation-coast-svg' });
        svgContainer.style.marginTop = '12px';
        svgContainer.style.display = 'flex';
        svgContainer.style.justifyContent = 'center';

        const svg = svgContainer.createSvg('svg');
        svg.setAttribute('width', '200');
        svg.setAttribute('height', '200');
        svg.setAttribute('viewBox', '0 0 200 200');
        this.hexSvg = svg;

        // Create clickable edge zones
        this.renderHexEdges(svg);

        // Selected edges display
        const selectedRow = section.createDiv({ cls: 'map-creation-selected' });
        selectedRow.style.marginTop = '8px';
        selectedRow.style.fontSize = '0.9em';
        selectedRow.style.color = 'var(--text-muted)';
        this.updateCoastDisplay(selectedRow);
    }

    private renderHexEdges(svg: SVGSVGElement): void {
        const centerX = 100;
        const centerY = 100;
        const radius = 60;

        // Calculate hex corners (flat-top orientation)
        const corners: Array<{ x: number; y: number }> = [];
        for (let i = 0; i < 6; i++) {
            const angle = (Math.PI / 3) * i - Math.PI / 6;
            corners.push({
                x: centerX + radius * Math.cos(angle),
                y: centerY + radius * Math.sin(angle)
            });
        }

        // Draw hex outline
        const hexPath = corners.map((c, i) =>
            `${i === 0 ? 'M' : 'L'} ${c.x} ${c.y}`
        ).join(' ') + ' Z';

        const hexOutline = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        hexOutline.setAttribute('d', hexPath);
        hexOutline.setAttribute('fill', '#d4a574'); // Tan (land)
        hexOutline.setAttribute('stroke', '#666');
        hexOutline.setAttribute('stroke-width', '2');
        svg.appendChild(hexOutline);

        // Edge definitions (flat-top hex: N, NE, SE, S, SW, NW)
        const edges: Array<{ dir: CompassDirection; i1: number; i2: number }> = [
            { dir: 'N', i1: 0, i2: 1 },   // Top edge
            { dir: 'NE', i1: 1, i2: 2 },  // Top-right edge
            { dir: 'SE', i1: 2, i2: 3 },  // Bottom-right edge
            { dir: 'S', i1: 3, i2: 4 },   // Bottom edge
            { dir: 'SW', i1: 4, i2: 5 },  // Bottom-left edge
            { dir: 'NW', i1: 5, i2: 0 }   // Top-left edge
        ];

        // Create clickable zones for each edge
        for (const edge of edges) {
            const c1 = corners[edge.i1];
            const c2 = corners[edge.i2];
            const mid = {
                x: (c1.x + c2.x) / 2,
                y: (c1.y + c2.y) / 2
            };

            // Offset outward from center
            const dx = mid.x - centerX;
            const dy = mid.y - centerY;
            const dist = Math.sqrt(dx * dx + dy * dy);
            const offset = 15;
            const outerX = mid.x + (dx / dist) * offset;
            const outerY = mid.y + (dy / dist) * offset;

            // Create clickable path (edge segment with thickness)
            const edgePath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
            const pathData = [
                `M ${c1.x} ${c1.y}`,
                `L ${c2.x} ${c2.y}`,
                `L ${outerX} ${outerY}`,
                'Z'
            ].join(' ');
            edgePath.setAttribute('d', pathData);
            edgePath.setAttribute('fill', 'transparent');
            edgePath.setAttribute('stroke', 'transparent');
            edgePath.setAttribute('stroke-width', '8');
            edgePath.setAttribute('cursor', 'pointer');
            edgePath.setAttribute('data-direction', edge.dir);
            svg.appendChild(edgePath);

            // Visual indicator line
            const indicator = document.createElementNS('http://www.w3.org/2000/svg', 'line');
            indicator.setAttribute('x1', String(c1.x));
            indicator.setAttribute('y1', String(c1.y));
            indicator.setAttribute('x2', String(c2.x));
            indicator.setAttribute('y2', String(c2.y));
            indicator.setAttribute('stroke', '#666');
            indicator.setAttribute('stroke-width', '4');
            indicator.setAttribute('data-direction', edge.dir);
            indicator.setAttribute('pointer-events', 'none');
            svg.appendChild(indicator);

            // Label
            const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
            label.setAttribute('x', String(outerX));
            label.setAttribute('y', String(outerY));
            label.setAttribute('text-anchor', 'middle');
            label.setAttribute('dominant-baseline', 'middle');
            label.setAttribute('font-size', '12');
            label.setAttribute('fill', 'var(--text-normal)');
            label.setAttribute('pointer-events', 'none');
            label.textContent = edge.dir;
            svg.appendChild(label);

            // Click handler
            edgePath.addEventListener('click', () => {
                this.toggleCoastEdge(edge.dir);
            });

            // Store reference for updates
            edgePath.setAttribute('data-edge-path', edge.dir);
            indicator.setAttribute('data-edge-indicator', edge.dir);
        }
    }

    private toggleCoastEdge(dir: CompassDirection): void {
        if (this.coastEdges.has(dir)) {
            this.coastEdges.delete(dir);
        } else {
            this.coastEdges.add(dir);
        }
        this.updateCoastVisuals();
    }

    private updateCoastVisuals(): void {
        if (!this.hexSvg) return;

        // Update edge colors
        const allEdges: CompassDirection[] = ['N', 'NE', 'SE', 'S', 'SW', 'NW'];
        for (const dir of allEdges) {
            const indicator = this.hexSvg.querySelector(`[data-edge-indicator="${dir}"]`);
            if (indicator) {
                const isWater = this.coastEdges.has(dir);
                indicator.setAttribute('stroke', isWater ? '#4a90e2' : '#666'); // Blue for water
                indicator.setAttribute('stroke-width', isWater ? '6' : '4');
            }
        }

        // Update text display
        const selectedRow = this.contentEl.querySelector('.map-creation-selected');
        if (selectedRow) {
            this.updateCoastDisplay(selectedRow as HTMLElement);
        }
    }

    private updateCoastDisplay(container: HTMLElement): void {
        const edges = Array.from(this.coastEdges).sort();
        container.textContent = edges.length > 0
            ? `Selected: ${edges.join(', ')}`
            : 'No coastlines selected';
    }

    private updateSizePreview(): void {
        if (!this.previewEl) return;

        const radius = this.sizeInDays * 3;
        const tileCount = this.calculateTileCount(this.sizeInDays);

        this.previewEl.textContent = `Estimated tiles: ${tileCount} (radius: ${radius} hexes)`;
    }

    private calculateTileCount(sizeInDays: number): number {
        // Formula for hexes in a filled hexagon: 3 * r^2 + 3 * r + 1
        const radius = sizeInDays * 3;
        return 3 * radius * radius + 3 * radius + 1;
    }

    private renderButtons(container: HTMLElement): void {
        const btnRow = container.createDiv({ cls: 'modal-button-row' });
        btnRow.style.display = 'flex';
        btnRow.style.justifyContent = 'flex-end';
        btnRow.style.gap = '8px';
        btnRow.style.marginTop = '8px';

        // Cancel button
        const cancelBtn = btnRow.createEl('button', {
            text: 'Cancel',
            cls: 'mod-plain'
        });
        cancelBtn.addEventListener('click', () => {
            this.close();
        });

        // Create button
        this.createBtn = btnRow.createEl('button', {
            text: 'Create Map →',
            cls: 'mod-cta'
        }) as HTMLButtonElement;
        this.createBtn.addEventListener('click', () => {
            this.submit();
        });

        // Set initial button state
        this.updateCreateButtonState();
    }

    private renderProgressUI(container: HTMLElement): void {
        this.progressContainer = container.createDiv({ cls: 'sm-map-progress-container' });
        this.progressContainer.style.display = 'none'; // Hidden initially
        this.progressContainer.style.marginTop = '16px';
        this.progressContainer.style.padding = '12px';
        this.progressContainer.style.background = 'var(--background-secondary)';
        this.progressContainer.style.borderRadius = '4px';

        this.progressBar = this.progressContainer.createEl('progress', {
            cls: 'sm-map-progress-bar',
            attr: { max: '100', value: '0' }
        }) as HTMLProgressElement;
        this.progressBar.style.width = '100%';
        this.progressBar.style.height = '8px';

        this.progressText = this.progressContainer.createDiv({ cls: 'sm-map-progress-text' });
        this.progressText.style.marginTop = '8px';
        this.progressText.style.fontSize = '12px';
        this.progressText.style.color = 'var(--text-muted)';
        this.progressText.setText('Creating map...');

        this.cancelBtn = this.progressContainer.createEl('button', {
            text: 'Cancel',
            cls: 'mod-plain sm-map-cancel-btn'
        }) as HTMLButtonElement;
        this.cancelBtn.style.marginTop = '8px';
    }

    private showProgress(): void {
        if (this.progressContainer) {
            this.progressContainer.style.display = 'block';
        }
        if (this.createBtn) {
            this.createBtn.disabled = true;
        }
        if (this.progressBar) {
            this.progressBar.value = 0;
        }
        if (this.progressText) {
            this.progressText.setText('Creating map... 0%');
        }
    }

    private hideProgress(): void {
        if (this.progressContainer) {
            this.progressContainer.style.display = 'none';
        }
        if (this.createBtn) {
            this.createBtn.disabled = false;
            this.updateCreateButtonState();
        }
    }

    private updateProgress(percent: number): void {
        if (this.progressBar) {
            this.progressBar.value = percent;
        }
        if (this.progressText) {
            this.progressText.setText(`Creating map... ${Math.round(percent)}%`);
        }
    }

    protected onAfterOpen(): void {
        // Register Enter key shortcut
        this.scope.register([], "Enter", () => {
            this.submit();
        });

        // Register Escape key shortcut
        this.scope.register([], "Escape", () => {
            this.close();
        });
    }

    private isValid(): boolean {
        // Validate name
        if (!this.name || this.name.trim().length === 0) {
            return false;
        }
        if (this.name.length > 100) {
            return false;
        }

        // Validate size
        if (this.sizeInDays < 1 || this.sizeInDays > 20) {
            return false;
        }

        return true;
    }

    private updateCreateButtonState(): void {
        if (this.createBtn) {
            this.createBtn.disabled = !this.isValid();
        }
    }

    private async submit(): Promise<void> {
        const name = this.name.trim();

        // Validate name
        if (!name) {
            new Notice("Please enter a map name");
            this.inputEl?.classList.add('is-error');
            this.inputEl?.focus();
            return;
        }
        if (name.length > 100) {
            new Notice("Map name too long (max 100 characters)");
            this.inputEl?.classList.add('is-error');
            this.inputEl?.focus();
            return;
        }

        // Validate size
        if (this.sizeInDays < 1 || this.sizeInDays > 20) {
            new Notice("Size must be between 1 and 20 travel days");
            return;
        }

        // Show progress UI
        this.showProgress();
        this.abortController = new AbortController();

        // Setup cancel handler
        if (this.cancelBtn) {
            this.cancelBtn.onclick = () => {
                this.abortController?.abort();
                this.hideProgress();
                new Notice('Map creation cancelled');
            };
        }

        try {
            // Call onSubmit with progress callback
            await this.onSubmit(
                {
                    name,
                    sizeInDays: this.sizeInDays,
                    coastEdges: Array.from(this.coastEdges)
                },
                {
                    onProgress: (percent) => this.updateProgress(percent),
                    signal: this.abortController.signal
                }
            );
            this.close();
        } catch (e) {
            // Check if it's an abort error
            if (e instanceof Error && e.name === 'AbortError') {
                // Already handled by cancel button
                return;
            }
            if (e instanceof Error && e.message === 'Map creation cancelled') {
                // Already handled
                return;
            }
            // Other errors
            new Notice(`Map creation failed: ${e instanceof Error ? e.message : String(e)}`);
            this.hideProgress();
        }
    }
}

/** Fuzzy list of available map files (TFiles). */
export class MapSelectModal extends FuzzySuggestModal<TFile> {
    constructor(app: App, private files: TFile[], private onChoose: (f: TFile) => void) {
        super(app);
        this.setPlaceholder("Search maps…");
    }
    getItems() {
        return this.files;
    }
    getItemText(f: TFile) {
        return f.basename;
    }
    onChooseItem(f: TFile) {
        this.onChoose(f);
    }
}
