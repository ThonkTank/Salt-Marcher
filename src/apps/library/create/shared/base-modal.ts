// src/apps/library/create/shared/base-modal.ts
// Base class for simple create/edit modals (Spell, Item, Equipment)
import { App, Modal, Setting } from "obsidian";
import { createFormCard } from "./layouts";
import type { FormCardHandles } from "./layouts";

export interface SectionDefinition {
    id: string;
    title: string;
    subtitle?: string;
    navLabel?: string;
    mount: (handles: FormCardHandles) => void;
}

export interface BaseModalConfig<TData> {
    /** Title for the modal */
    title: string;
    /** Subtitle for the modal (optional) */
    subtitle?: string;
    /** Default name for new entries */
    defaultName: string;
    /** Validation function that returns array of error messages */
    validate?: (data: TData) => string[];
    /** Submit button text */
    submitButtonText?: string;
    /** Cancel button text */
    cancelButtonText?: string;
    /** Enable multi-section navigation layout */
    enableNavigation?: boolean;
    /** Sections for navigation layout (requires enableNavigation=true) */
    sections?: SectionDefinition[];
}

/**
 * Base class for simple create/edit modals.
 * Provides common setup, validation UI, and submit/cancel handling.
 *
 * Subclasses override buildFields() to add domain-specific form fields.
 *
 * For complex modals with multi-section navigation:
 * - Set enableNavigation=true and provide sections array
 * - Use registerValidator() to add validators from sections
 */
export abstract class BaseCreateModal<TData extends { name: string }> extends Modal {
    protected data: TData;
    protected onSubmit: (data: TData) => void;
    protected config: BaseModalConfig<TData>;
    protected validationEl: HTMLElement | null = null;
    protected validationIssues: string[] = [];

    // Navigation support
    private sectionObserver: IntersectionObserver | null = null;
    private navButtons: Array<{ id: string; button: HTMLButtonElement }> = [];
    private validators: Array<() => string[]> = [];

    // Background pointer lock
    private bgLock: { el: HTMLElement; pointer: string } | null = null;

    constructor(
        app: App,
        presetOrName: string | TData | undefined,
        onSubmit: (data: TData) => void,
        config: BaseModalConfig<TData>
    ) {
        super(app);
        this.onSubmit = onSubmit;
        this.config = config;
        this.data = this.initializeData(presetOrName);
    }

    /**
     * Initialize data from preset, name string, or default.
     * Subclasses can override to add type-specific defaults.
     */
    protected initializeData(presetOrName: string | TData | undefined): TData {
        if (typeof presetOrName === 'string') {
            return this.createDefault(presetOrName?.trim() || this.config.defaultName);
        } else if (presetOrName && typeof presetOrName === 'object') {
            return this.cloneData(presetOrName);
        } else {
            return this.createDefault(this.config.defaultName);
        }
    }

    /**
     * Create default data object with given name.
     * Subclasses must implement this.
     */
    protected abstract createDefault(name: string): TData;

    /**
     * Clone existing data object.
     * Default implementation does shallow copy, override for deep clone if needed.
     */
    protected cloneData(data: TData): TData {
        return { ...data };
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.empty();
        contentEl.addClass("sm-cc-create-modal");
        this.validationIssues = [];
        this.validators = [];
        this.navButtons = [];

        // Lock background pointer for better modal UX
        this.lockBackgroundPointer();

        // Apply modal layout CSS if navigation is enabled
        if (this.config.enableNavigation) {
            this.applyModalLayout();
        }

        // Build content based on navigation mode
        if (this.config.enableNavigation && this.config.sections?.length) {
            this.buildNavigationLayout(contentEl);
        } else {
            this.buildSimpleLayout(contentEl);
        }
    }

    /**
     * Build simple layout without navigation (default behavior)
     */
    private buildSimpleLayout(contentEl: HTMLElement): void {
        // Title
        contentEl.createEl("h3", { text: this.config.title });

        // Build domain-specific fields
        this.buildFields(contentEl);

        // Validation display area
        this.validationEl = contentEl.createDiv({ cls: "sm-cc-validation" });

        // Submit and Cancel buttons
        this.buildActionButtons(contentEl);

        // Optional: Register Enter key to submit
        this.scope.register([], "Enter", (evt) => {
            // Only submit if not in a textarea
            if (!(evt.target instanceof HTMLTextAreaElement)) {
                this.submit();
            }
        });
    }

    /**
     * Build navigation layout with sections
     */
    private buildNavigationLayout(contentEl: HTMLElement): void {
        // Header
        const header = contentEl.createDiv({ cls: "sm-cc-modal-header" });
        header.createEl("h2", { text: this.config.title });
        if (this.config.subtitle) {
            header.createEl("p", {
                cls: "sm-cc-modal-subtitle",
                text: this.config.subtitle,
            });
        }

        // Shell layout
        const shell = contentEl.createDiv({ cls: "sm-cc-shell" });
        const nav = shell.createEl("nav", { cls: "sm-cc-shell__nav", attr: { "aria-label": "Abschnitte" } });
        nav.createEl("p", { cls: "sm-cc-shell__nav-label", text: "Abschnitte" });
        const navList = nav.createDiv({ cls: "sm-cc-shell__nav-list" });
        const content = shell.createDiv({ cls: "sm-cc-shell__content" });

        // Active section tracking
        const setActive = (sectionId: string | null) => {
            for (const entry of this.navButtons) {
                const isActive = entry.id === sectionId;
                entry.button.classList.toggle("is-active", isActive);
                if (isActive) {
                    entry.button.setAttribute("aria-current", "true");
                } else {
                    entry.button.removeAttribute("aria-current");
                }
            }
        };

        // IntersectionObserver for auto-highlighting visible section
        const observer = new IntersectionObserver(entries => {
            const visible = entries.filter(entry => entry.isIntersecting);
            if (!visible.length) return;
            visible.sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
            const next = (visible[0].target as HTMLElement).id;
            if (next) setActive(next);
        }, { root: contentEl, rootMargin: "-45% 0px -45% 0px", threshold: 0 });
        this.sectionObserver = observer;

        // Create sections
        for (const section of this.config.sections!) {
            this.createSection(section, content, navList, observer, setActive);
        }

        // Set first section as active
        if (this.config.sections!.length) {
            setActive(this.config.sections![0].id);
        }

        // Footer with buttons
        const footer = contentEl.createDiv({ cls: "sm-cc-modal-footer" });
        this.buildActionButtons(footer);
    }

    /**
     * Create a single section in navigation layout
     */
    private createSection(
        section: SectionDefinition,
        content: HTMLElement,
        navList: HTMLElement,
        observer: IntersectionObserver,
        setActive: (id: string | null) => void
    ): void {
        const handles = createFormCard(content, {
            title: section.title,
            subtitle: section.subtitle,
            registerValidator: (runner) => this.addValidator(runner),
            id: section.id,
        });

        const navButton = navList.createEl("button", {
            cls: "sm-cc-shell__nav-button",
            text: section.navLabel ?? section.title,
        }) as HTMLButtonElement;
        navButton.type = "button";
        navButton.setAttribute("aria-controls", handles.card.id);
        this.navButtons.push({ id: handles.card.id, button: navButton });

        navButton.addEventListener("click", () => {
            setActive(handles.card.id);
            handles.card.scrollIntoView({ behavior: "smooth", block: "start" });
        });

        observer.observe(handles.card);
        section.mount(handles);
    }

    /**
     * Build the form fields for this modal.
     * Subclasses implement this to add their specific fields.
     */
    protected abstract buildFields(container: HTMLElement): void;

    /**
     * Build submit and cancel buttons.
     * Can be overridden for custom button layout.
     */
    protected buildActionButtons(container: HTMLElement): void {
        const buttons = new Setting(container);

        buttons.addButton(btn => {
            btn.setButtonText(this.config.cancelButtonText || "Abbrechen")
                .onClick(() => this.close());
        });

        buttons.addButton(btn => {
            btn.setButtonText(this.config.submitButtonText || "Erstellen")
                .setCta()
                .onClick(() => this.submit());
        });
    }

    /**
     * Validate and submit the form.
     */
    protected submit(): void {
        // Run all validators (for navigation mode)
        const validatorIssues = this.runValidators();

        // Run config validation
        const configIssues = this.config.validate?.(this.data) ?? [];

        // Combine all issues
        this.validationIssues = [...validatorIssues, ...configIssues];

        // Display validation errors if any
        if (this.validationIssues.length > 0) {
            if (this.config.enableNavigation) {
                // In navigation mode, scroll to first invalid card
                const firstInvalid = this.contentEl.querySelector(".sm-cc-card.is-invalid") as HTMLElement | null;
                if (firstInvalid) firstInvalid.scrollIntoView({ behavior: "smooth", block: "center" });
            } else {
                // In simple mode, show errors
                this.showValidationErrors(this.validationIssues);
            }
            return;
        }

        // Basic name validation
        if (!this.data.name || !this.data.name.trim()) {
            if (!this.config.enableNavigation) {
                this.showValidationErrors(["Name ist erforderlich"]);
            }
            return;
        }

        // Clear validation display
        this.clearValidationErrors();

        // Submit and close
        this.onSubmit(this.data);
        this.close();
    }

    /**
     * Display validation errors in the validation area.
     */
    protected showValidationErrors(errors: string[]): void {
        if (!this.validationEl) return;

        this.validationEl.empty();
        this.validationEl.createEl("p", {
            text: "Validation errors:",
            cls: "sm-cc-validation__title"
        });

        const ul = this.validationEl.createEl("ul");
        for (const error of errors) {
            ul.createEl("li", { text: error });
        }
    }

    /**
     * Clear validation error display.
     */
    protected clearValidationErrors(): void {
        this.validationEl?.empty();
    }

    /**
     * Helper to create a textarea field (common pattern across modals).
     */
    protected addTextArea(
        parent: HTMLElement,
        label: string,
        placeholder: string,
        onChange: (value: string) => void,
        initialValue?: string,
        rows: number = 4
    ): { wrapper: HTMLElement; controlEl: HTMLElement; textarea: HTMLTextAreaElement } {
        const wrap = parent.createDiv({ cls: "setting-item" });
        wrap.createDiv({ cls: "setting-item-info", text: label });
        const ctl = wrap.createDiv({ cls: "setting-item-control" });
        const ta = ctl.createEl("textarea", { attr: { placeholder } });
        ta.rows = rows;
        ta.style.width = '100%';
        if (initialValue != null) ta.value = initialValue;
        ta.addEventListener("input", () => onChange(ta.value));
        return { wrapper: wrap, controlEl: ctl, textarea: ta };
    }

    onClose() {
        // Cleanup navigation
        this.sectionObserver?.disconnect();
        this.sectionObserver = null;
        this.navButtons = [];
        this.validators = [];

        // Cleanup modal layout
        if (this.config.enableNavigation) {
            this.resetModalLayout();
        }

        // Restore background pointer
        this.restoreBackgroundPointer();

        this.contentEl.empty();
    }

    /**
     * Add a validator (used by sections in navigation mode)
     */
    protected addValidator(run: () => string[]): () => string[] {
        this.validators.push(run);
        return run;
    }

    /**
     * Run all validators
     */
    private runValidators(): string[] {
        const collected: string[] = [];
        for (const validator of this.validators) {
            collected.push(...validator());
        }
        return collected;
    }

    /**
     * Lock background pointer to prevent clicks
     */
    private lockBackgroundPointer(): void {
        const bg = document.querySelector('.modal-bg') as HTMLElement | null;
        if (!bg) return;
        this.bgLock = { el: bg, pointer: bg.style.pointerEvents };
        bg.style.pointerEvents = 'none';
    }

    /**
     * Restore background pointer
     */
    private restoreBackgroundPointer(): void {
        if (!this.bgLock) return;
        this.bgLock.el.style.pointerEvents = this.bgLock.pointer || '';
        this.bgLock = null;
    }

    /**
     * Apply modal layout CSS
     */
    private applyModalLayout(): void {
        this.modalEl.addClass("sm-cc-create-modal-host");
    }

    /**
     * Reset modal layout CSS
     */
    private resetModalLayout(): void {
        this.modalEl.removeClass("sm-cc-create-modal-host");
    }
}
