// src/ui/workmode/create/declarative-modal.ts
// Declarative wrapper around BaseCreateModal that renders fields from CreateSpec.
import type { App } from "obsidian";
import { BaseCreateModal, type CreateModalPipeline } from "./base-modal";
import type { FormCardHandles } from "./layouts";
import { createDefaultFieldRegistry, findRenderer } from "./field-registry";
import { buildSerializedPayload, persistSerializedPayload } from "./storage";
import type {
  AnyFieldSpec,
  CreateSpec,
  FieldRegistryEntry,
  FieldRenderHandle,
  OpenCreateModalOptions,
  OpenCreateModalResult,
  SectionSpec,
  SerializedPayload,
} from "./types";

interface NamedDraft extends Record<string, unknown> {
  name: string;
}

interface FieldInstance {
  spec: AnyFieldSpec;
  handle: FieldRenderHandle & { setErrors?: (errors: string[]) => void; container?: HTMLElement };
  container?: HTMLElement;
  isVisible: boolean;
}

interface SchemaErrorIssue {
  path?: Array<string | number>;
  message?: string;
}

interface ModalSerializationResult<TSerialized> {
  values: TSerialized;
  payload: SerializedPayload;
}

function deepClone<T>(value: T): T {
  if (typeof structuredClone === "function") {
    return structuredClone(value);
  }
  return JSON.parse(JSON.stringify(value)) as T;
}

function resolveDefaults<TDraft extends NamedDraft>(
  spec: CreateSpec<TDraft, unknown>,
  name: string,
): Partial<TDraft> {
  const fromSpec = typeof spec.defaults === "function"
    ? spec.defaults({ presetName: name })
    : spec.defaults;
  return fromSpec ? { ...fromSpec } : {};
}

function orderFields(fields: AnyFieldSpec[], ids: string[] | undefined): AnyFieldSpec[] {
  if (!ids || ids.length === 0) return fields;
  const lookup = new Map(fields.map((field) => [field.id, field] as const));
  const ordered: AnyFieldSpec[] = [];
  const used = new Set<string>();
  for (const id of ids) {
    const entry = lookup.get(id);
    if (!entry) continue;
    ordered.push(entry);
    used.add(id);
  }
  for (const field of fields) {
    if (!used.has(field.id)) ordered.push(field);
  }
  return ordered;
}

function extractSchemaIssues(error: unknown): SchemaErrorIssue[] {
  if (!error || typeof error !== "object") return [];
  const maybeIssues = (error as { issues?: unknown }).issues;
  if (!Array.isArray(maybeIssues)) return [];
  return maybeIssues.filter((issue): issue is SchemaErrorIssue => typeof issue === "object" && issue !== null);
}

export class DeclarativeCreateModal<
  TDraft extends NamedDraft,
  TSerialized,
> extends BaseCreateModal<
  TDraft,
  ModalSerializationResult<TSerialized>,
  OpenCreateModalResult
> {
  private static pendingSpec: CreateSpec<NamedDraft, unknown> | null = null;
  private readonly spec: CreateSpec<TDraft, TSerialized>;
  private readonly registry: FieldRegistryEntry[];
  private readonly resolveResult: (result: OpenCreateModalResult | null) => void;
  private readonly fieldInstances = new Map<string, FieldInstance>();
  private readonly sectionOrder: SectionSpec[];
  private fieldIssues = new Map<string, string[]>();
  private completion: OpenCreateModalResult | null = null;
  private resolved = false;

  constructor(
    app: App,
    spec: CreateSpec<TDraft, TSerialized>,
    options: OpenCreateModalOptions | undefined,
    resolve: (result: OpenCreateModalResult | null) => void,
    registry: FieldRegistryEntry[] = createDefaultFieldRegistry(),
  ) {
    const preset = options?.preset as string | TDraft | undefined;
    const defaultName = DeclarativeCreateModal.resolveDefaultName(spec);
    const navigationEnabled = spec.ui?.enableNavigation ?? Boolean(spec.ui?.sections?.length);
    const initialSections = spec.ui?.sections ?? [];
    const pipeline: CreateModalPipeline<
      TDraft,
      ModalSerializationResult<TSerialized>,
      OpenCreateModalResult
    > = {
      serialize: async (draft) => {
        const modal = modalRef.instance;
        if (!modal) throw new Error("Modal not initialized");
        return modal.serializeDraft(draft);
      },
      persist: async (payload, context) => {
        const modal = modalRef.instance;
        if (!modal) throw new Error("Modal not initialized");
        return modal.persistDraft(payload, context.app);
      },
    };
    const modalRef: { instance: DeclarativeCreateModal<TDraft, TSerialized> | null } = { instance: null };
    DeclarativeCreateModal.pendingSpec = spec as CreateSpec<NamedDraft, unknown>;
    super(app, preset, {
      title: spec.title,
      subtitle: spec.subtitle,
      defaultName,
      submitButtonText: spec.ui?.submitLabel,
      cancelButtonText: spec.ui?.cancelLabel,
      enableNavigation: navigationEnabled,
      sections: [],
      initialize: (input, helpers) => {
        const providedName = typeof input === "string"
          ? input
          : typeof input === "object" && input && "name" in input
            ? String((input as Record<string, unknown>).name ?? defaultName)
            : defaultName;
        const base = helpers.createDefault(providedName);
        let merged: TDraft = { ...base };
        if (input && typeof input === "object") {
          merged = { ...merged, ...(input as TDraft) };
        }
        const defaults = resolveDefaults(spec, providedName);
        merged = { ...helpers.createDefault(providedName), ...defaults, ...merged };
        if (options?.initialize) {
          const adjusted = options.initialize(deepClone(merged));
          if (adjusted && typeof adjusted === "object") {
            merged = { ...merged, ...(adjusted as TDraft) };
          }
        }
        return merged;
      },
      pipeline,
    });
    DeclarativeCreateModal.pendingSpec = null;
    modalRef.instance = this;
    this.spec = spec;
    this.registry = registry;
    this.resolveResult = resolve;
    this.sectionOrder = initialSections;
    this.config.validate = (data) => this.collectValidationIssues(data as TDraft);
    if (this.config.enableNavigation) {
      this.config.sections = this.sectionOrder.map((section) => ({
        id: section.id,
        title: section.label,
        subtitle: section.description,
        mount: (handles: FormCardHandles) => this.mountSection(handles, section),
      }));
    }
  }

  protected createDefault(name: string): TDraft {
    const activeSpec = this.spec ?? (DeclarativeCreateModal.pendingSpec as CreateSpec<TDraft, TSerialized> | null);
    if (!activeSpec) {
      throw new Error("Create spec unavailable during initialization");
    }
    const defaults = resolveDefaults(activeSpec, name);
    const draft: Record<string, unknown> = { name };
    for (const field of activeSpec.fields) {
      if (defaults[field.id] !== undefined) {
        draft[field.id] = defaults[field.id];
        continue;
      }
      if (field.default !== undefined) {
        draft[field.id] = field.default;
      }
    }
    if (draft[activeSpec.storage.filenameFrom] === undefined) {
      draft[activeSpec.storage.filenameFrom] = draft.name;
    }
    return draft as TDraft;
  }

  protected buildFields(contentEl: HTMLElement): void {
    this.renderFields(contentEl, undefined);
  }

  onClose(): void {
    super.onClose();
    if (!this.resolved) {
      this.resolved = true;
      this.resolveResult(this.completion);
    }
  }

  private mountSection(handles: FormCardHandles, section: SectionSpec): void {
    const ordered = orderFields(this.spec.fields, section.fieldIds);
    for (const field of ordered) {
      this.renderField(handles.body, field);
    }
    handles.registerValidation(() => {
      const issues: string[] = [];
      for (const field of ordered) {
        const fieldErrors = this.fieldIssues.get(field.id) ?? [];
        if (fieldErrors.length) {
          issues.push(`${field.label}: ${fieldErrors[0]}`);
        }
      }
      const summary = issues.length > 0 ? `${issues.length} Feld${issues.length > 1 ? "er" : ""} benötigt Aufmerksamkeit` : undefined;
      return { issues, summary };
    });
  }

  private renderFields(container: HTMLElement, fieldIds: string[] | undefined): void {
    const ordered = orderFields(this.spec.fields, fieldIds);
    for (const field of ordered) {
      this.renderField(container, field);
    }
    this.updateFieldVisibility();
  }

  private renderField(container: HTMLElement, field: AnyFieldSpec): void {
    const renderer = findRenderer(this.registry, field);
    if (!renderer) {
      const fallback = container.createDiv({ cls: "sm-cc-field--unsupported" });
      fallback.createEl("label", { text: field.label });
      fallback.createEl("p", { text: `Unsupported field type: ${field.type}` });
      return;
    }
    const handle = renderer.render({
      app: this.app,
      container,
      spec: field,
      values: this.data,
      onChange: (id, value) => this.handleFieldChange(id, value),
      registerValidator: (runner) => runner(),
    });
    this.fieldInstances.set(field.id, {
      spec: field,
      handle,
      container: handle.container,
      isVisible: true,
    });
  }

  private handleFieldChange(id: string, value: unknown): void {
    if (id === "name" && typeof value === "string") {
      (this.data as NamedDraft).name = value.trim();
    }
    (this.data as Record<string, unknown>)[id] = value;
    this.updateFieldVisibility();
  }

  private updateFieldVisibility(): void {
    for (const [id, instance] of this.fieldInstances) {
      const visible = this.evaluateVisibility(instance.spec);
      instance.isVisible = visible;
      const target = instance.container;
      if (target) {
        target.toggleClass("is-hidden", !visible);
        if (!visible) {
          instance.handle.setErrors?.([]);
        }
      }
    }
  }

  private evaluateVisibility(field: AnyFieldSpec): boolean {
    if (!field.visibleIf) return true;
    try {
      return field.visibleIf(this.data);
    } catch (error) {
      console.error("Failed to evaluate field visibility", error);
      return true;
    }
  }

  private collectValidationIssues(data: TDraft): string[] {
    const fieldIssues = new Map<string, string[]>();
    const summary: string[] = [];
    for (const [id, instance] of this.fieldInstances) {
      if (!instance.isVisible) {
        instance.handle.setErrors?.([]);
        fieldIssues.set(id, []);
        continue;
      }
      const value = (data as Record<string, unknown>)[id];
      const issues: string[] = [];
      if (instance.spec.required) {
        if (value === undefined || value === null || value === "") {
          issues.push("Pflichtfeld");
        } else if (Array.isArray(value) && value.length === 0) {
          issues.push("Mindestens ein Wert erforderlich");
        }
      }
      if (instance.spec.validate) {
        try {
          const result = instance.spec.validate(value as never, data);
          if (typeof result === "string" && result.trim()) {
            issues.push(result.trim());
          }
        } catch (error) {
          issues.push(String(error));
        }
      }
      instance.handle.setErrors?.(issues);
      fieldIssues.set(id, issues);
      if (issues.length) {
        summary.push(`${instance.spec.label}: ${issues[0]}`);
      }
    }
    const transformed = this.applyFieldTransforms(data);
    const schema = this.spec.schema.safeParse(transformed);
    if (!schema.success) {
      const issues = extractSchemaIssues(schema.error);
      if (issues.length === 0) {
        summary.push(String(schema.error));
      }
      for (const issue of issues) {
        const target = issue.path?.[0];
        if (typeof target === "string" && fieldIssues.has(target)) {
          const list = fieldIssues.get(target)!;
          if (issue.message) {
            list.push(issue.message);
          }
          summary.push(`${target}: ${issue.message ?? "Ungültiger Wert"}`);
        } else if (issue.message) {
          summary.push(issue.message);
        }
      }
    }
    for (const [id, instance] of this.fieldInstances) {
      const issues = fieldIssues.get(id) ?? [];
      instance.handle.setErrors?.(issues);
    }
    this.fieldIssues = fieldIssues;
    return summary;
  }

  private applyFieldTransforms(data: TDraft): Record<string, unknown> {
    const result: Record<string, unknown> = { ...data };
    for (const field of this.spec.fields) {
      if (!field.transform) continue;
      try {
        const transformed = field.transform(result[field.id] as never, result);
        result[field.id] = transformed;
      } catch (error) {
        console.error(`Transform failed for field ${field.id}`, error);
      }
    }
    return result;
  }

  private async serializeDraft(draft: TDraft): Promise<ModalSerializationResult<TSerialized>> {
    const transformed = this.applyFieldTransforms(draft);
    const parsed = this.spec.schema.parse(transformed) as TSerialized;
    const prepared = this.spec.transformers?.preSave ? this.spec.transformers.preSave(parsed) : parsed;
    const payload = buildSerializedPayload(this.spec.storage, prepared as unknown as Record<string, unknown>);
    return { values: prepared, payload };
  }

  private async persistDraft(
    serialized: ModalSerializationResult<TSerialized>,
    app: App,
  ): Promise<OpenCreateModalResult> {
    const result = await persistSerializedPayload(app, this.spec.storage, serialized.payload);
    await this.spec.transformers?.postSave?.(result.filePath, serialized.values);
    this.completion = { filePath: result.filePath, values: serialized.values as Record<string, any> };
    return this.completion;
  }

  private static resolveDefaultName(spec: CreateSpec<NamedDraft>): string {
    const nameField = spec.fields.find((field) => field.id === "name");
    if (nameField && typeof nameField.default === "string" && nameField.default.trim()) {
      return nameField.default;
    }
    const kind = spec.kind || "Eintrag";
    const normalized = kind.charAt(0).toUpperCase() + kind.slice(1);
    return `Neue/r ${normalized}`;
  }
}
