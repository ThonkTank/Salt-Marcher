// src/features/data-manager/modal/modal.ts
// Unified create modal combining BaseCreateModal + DeclarativeCreateModal functionality
import type { App} from "obsidian";
import { Modal, Setting, Notice, type ButtonComponent } from "obsidian";
import { configurableLogger } from '@services/logging/configurable-logger';

const logger = configurableLogger.forModule("data-manager-modal");
import { FieldManager } from "../fields/field-manager";
import { registerAllFieldRenderers } from "../fields/register-renderers";
import { GridLayoutManager } from "../layout/grid-layout-manager";
import { LabelWidthSynchronizer } from "../layout/label-width-sync";
import { DataInitializer, type NamedDraft } from "./data-initializer";
import { ModalNavigation } from "./modal-navigation";
import { ModalPersistence } from "./modal-persistence";
import { orderFields } from "./modal-utils";
import { DefaultFieldTransformer, ModalValidator } from "./modal-validator";
import type { FormCardHandles } from "../layout/layouts";
import type { RepeatingWidthSynchronizer } from "../layout/repeating-width-sync";
import type {
  CreateSpec,
  OpenCreateModalOptions,
  OpenCreateModalResult,
  SectionSpec,
} from "../types";

// Initialize field renderers (called once on module load)
registerAllFieldRenderers();

/**
 * Unified create modal that supports both declarative field specs and direct section mounting.
 * Combines the functionality of BaseCreateModal and DeclarativeCreateModal.
 */
export class CreateModal<
  TDraft extends NamedDraft,
  TSerialized = TDraft,
> extends Modal {
  private readonly spec: CreateSpec<TDraft, TSerialized>;
  private readonly resolveResult: (result: OpenCreateModalResult | null) => void;
  private readonly data: TDraft;
  private readonly sectionOrder: SectionSpec[];
  private completion: OpenCreateModalResult | null = null;
  private resolved = false;

  // Navigation support
  private navigation: ModalNavigation | null = null;
  private validators: Array<() => string[]> = [];

  // Layout managers for dynamic grid
  private layoutManagers: GridLayoutManager[] = [];

  // Width synchronizers for repeating fields
  private widthSynchronizers: RepeatingWidthSynchronizer[] = [];

  // Label width synchronizers for sections
  private labelSynchronizers: LabelWidthSynchronizer[] = [];

  // Background pointer lock
  private bgLock: { el: HTMLElement; pointer: string } | null = null;

  // Submission state
  private submitButton: ButtonComponent | null = null;
  private cancelButton: ButtonComponent | null = null;
  private isSubmitting = false;

  // Services
  private transformer!: DefaultFieldTransformer<TDraft>;
  private persistence!: ModalPersistence<TDraft, TSerialized>;
  private validator!: ModalValidator<TDraft, TSerialized>;
  private fieldManager!: FieldManager;

  constructor(
    app: App,
    spec: CreateSpec<TDraft, TSerialized>,
    options: OpenCreateModalOptions | undefined,
    resolve: (result: OpenCreateModalResult | null) => void,
  ) {
    super(app);
    this.spec = spec;
    this.resolveResult = resolve;
    this.sectionOrder = spec.ui?.sections ?? [];

    // Delegate data initialization to DataInitializer service
    const initializer = new DataInitializer({
      spec,
      preset: options?.preset as string | TDraft | undefined,
      customInitializer: options?.initialize
    });
    this.data = initializer.initialize();
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass("sm-cc-create-modal");
    this.validators = [];

    // Log modal opened for UI testing
    logger.debug('[UI-TEST] Modal opened:', JSON.stringify({
      kind: this.spec.kind,
      title: this.spec.title,
      entity: this.data.name || 'new',
      timestamp: Date.now()
    }));

    // Initialize services
    this.transformer = new DefaultFieldTransformer(this.spec.fields);
    this.persistence = new ModalPersistence(
      this.app,
      this.spec,
      this.transformer
    );
    this.fieldManager = new FieldManager(
      this.spec.fields,
      () => this.data,  // Getter for current data
      (id, value) => this.handleFieldChange(id, value),
      this.widthSynchronizers
    );
    this.validator = new ModalValidator(
      this.spec,
      this.fieldManager.getFieldInstances(),
      () => this.data,  // Getter for current data
      this.validators,
      this.transformer
    );

    // Lock background pointer
    this.lockBackgroundPointer();

    const navigationEnabled = this.spec.ui?.enableNavigation ?? Boolean(this.sectionOrder.length);

    // Apply modal layout CSS if navigation is enabled
    if (navigationEnabled) {
      this.modalEl.addClass("sm-cc-create-modal-host");
    }

    // Build content based on navigation mode
    if (navigationEnabled && this.sectionOrder.length) {
      this.buildNavigationLayout(contentEl);
    } else {
      this.buildSimpleLayout(contentEl);
    }
  }

  private buildSimpleLayout(contentEl: HTMLElement): void {
    // Title
    contentEl.createEl("h3", { text: this.spec.title });

    // Build fields
    this.fieldManager.renderFields(contentEl, undefined);

    // Submit and Cancel buttons
    this.buildActionButtons(contentEl);

    // Optional: Register Enter key to submit
    this.scope.register([], "Enter", (evt) => {
      // Only submit if not in a textarea
      if (!(evt.target instanceof HTMLTextAreaElement)) {
        void this.submit();
      }
    });
  }

  private buildNavigationLayout(contentEl: HTMLElement): void {
    // Create navigation service
    this.navigation = new ModalNavigation({
      container: contentEl,
      sections: this.sectionOrder,
      title: this.spec.title,
      subtitle: this.spec.subtitle,
      onMountSection: (handles, section) => this.mountSection(handles, section),
      addValidator: (runner) => this.addValidator(runner),
    });

    // Mount navigation and get footer
    const footer = this.navigation.mount();

    // Add action buttons to footer
    this.buildActionButtons(footer);
  }

  private mountSection(handles: FormCardHandles, section: SectionSpec): void {
    const ordered = orderFields(this.spec.fields, section.fieldIds);

    // Render fields using FieldManager
    this.fieldManager.renderFields(handles.body, section.fieldIds);

    // Create layout manager for dynamic grid
    const layoutManager = new GridLayoutManager(handles.body, ordered);
    this.layoutManagers.push(layoutManager);

    // Synchronize label widths
    // - Multi-column: only tags/structured-tags labels (synced with first column)
    // - Single-column: all labels
    const labelSync = new LabelWidthSynchronizer(handles.body, layoutManager.isMultiColumn);
    this.labelSynchronizers.push(labelSync);
    logger.debug('[Modal] Label sync enabled for section:', section.id, 'Multi-column:', layoutManager.isMultiColumn);

    // Register validation (called by card to show validation summary)
    handles.registerValidation(() => {
      // Run validation to get current errors
      const result = this.validator.validate();

      const issues: string[] = [];
      for (const field of ordered) {
        const fieldErrors = result.errors.get(field.id) ?? [];
        if (fieldErrors.length) {
          issues.push(`${field.label}: ${fieldErrors[0]}`);
        }
      }
      const summary = issues.length > 0 ? `${issues.length} Feld${issues.length > 1 ? "er" : ""} benötigt Aufmerksamkeit` : undefined;
      return { issues, summary };
    });
  }

  private handleFieldChange(id: string, value: unknown): void {
    if (id === "name" && typeof value === "string") {
      (this.data as NamedDraft).name = value.trim();
    }
    (this.data as Record<string, unknown>)[id] = value;
    this.fieldManager.updateVisibility();
  }

  private buildActionButtons(container: HTMLElement): void {
    const buttons = new Setting(container);

    buttons.addButton(btn => {
      this.cancelButton = btn;
      btn.setButtonText(this.spec.ui?.cancelLabel || "Abbrechen")
        .onClick(() => {
          if (this.isSubmitting) return;
          this.close();
        });
    });

    buttons.addButton(btn => {
      this.submitButton = btn;
      btn.setButtonText(this.spec.ui?.submitLabel || "Erstellen")
        .setCta()
        .onClick(() => void this.submit());
    });
  }

  private async submit(): Promise<void> {
    if (this.isSubmitting) return;

    // Run comprehensive validation
    const validationResult = this.validator.validate();

    // Display validation errors if any
    if (!validationResult.isValid) {
      if (this.spec.ui?.enableNavigation) {
        // In navigation mode, scroll to first invalid card
        const firstInvalid = this.contentEl.querySelector(".sm-cc-card.is-invalid") as HTMLElement | null;
        if (firstInvalid) firstInvalid.scrollIntoView({ behavior: "smooth", block: "center" });
      }
      return;
    }

    // Basic name validation
    if (!this.data.name || !this.data.name.trim()) {
      return;
    }

    this.setButtonsDisabled(true);
    this.isSubmitting = true;

    try {
      const result = await this.persistence.save(this.data);
      await this.spec.transformers?.postSave?.(result.filePath, result.values);
      this.completion = {
        filePath: result.filePath,
        values: result.values as Record<string, any>
      };
      this.close();
    } catch (error) {
      logger.error("Failed to submit create modal", error);
      this.handleSubmissionError(error);
    } finally {
      this.isSubmitting = false;
      this.setButtonsDisabled(false);
    }
  }

  onClose(): void {
    // Cleanup field manager
    this.fieldManager?.dispose();

    // Cleanup navigation
    this.navigation?.dispose();
    this.navigation = null;
    this.validators = [];

    // Cleanup layout managers
    for (const manager of this.layoutManagers) {
      manager.destroy();
    }
    this.layoutManagers = [];

    // Cleanup width synchronizers
    for (const synchronizer of this.widthSynchronizers) {
      synchronizer.destroy();
    }
    this.widthSynchronizers = [];

    // Cleanup label synchronizers
    for (const synchronizer of this.labelSynchronizers) {
      synchronizer.destroy();
    }
    this.labelSynchronizers = [];

    // Cleanup modal layout
    this.modalEl.removeClass("sm-cc-create-modal-host");

    // Restore background pointer
    this.restoreBackgroundPointer();

    // Resolve promise
    if (!this.resolved) {
      this.resolved = true;
      this.resolveResult(this.completion);
    }

    this.contentEl.empty();
    this.submitButton = null;
    this.cancelButton = null;
    this.isSubmitting = false;
  }

  private addValidator(run: () => string[]): () => string[] {
    this.validators.push(run);
    return run;
  }

  private setButtonsDisabled(disabled: boolean): void {
    this.submitButton?.setDisabled(disabled);
    this.cancelButton?.setDisabled(disabled);
  }

  private handleSubmissionError(error: unknown): void {
    const message = error instanceof Error ? error.message : String(error ?? "Unbekannter Fehler");
    new Notice(`Fehler beim Speichern: ${message}`);
  }

  private lockBackgroundPointer(): void {
    const bg = document.querySelector('.modal-bg') as HTMLElement | null;
    if (!bg) return;
    this.bgLock = { el: bg, pointer: bg.style.pointerEvents };
    bg.style.pointerEvents = 'none';
  }

  private restoreBackgroundPointer(): void {
    if (!this.bgLock) return;
    this.bgLock.el.style.pointerEvents = this.bgLock.pointer || '';
    this.bgLock = null;
  }
}
