// src/features/data-manager/modal-validator.ts
// Service for validating draft data and transforming fields

import { configurableLogger } from '@services/logging/configurable-logger';

const logger = configurableLogger.forModule("data-manager-modal-validator");
import { extractSchemaIssues } from "./modal-utils";
import type { AnyFieldSpec, CreateSpec } from "../types";
import type { FieldTransformer } from "./modal-persistence";

/**
 * Validation result with errors, summary, and transformed data
 */
export interface ValidationResult<TSerialized> {
  isValid: boolean;
  errors: Map<string, string[]>;
  summary: string[];
  transformed?: TSerialized;
}

/**
 * Field instance with handle for setting errors and container reference
 */
export interface FieldInstance {
  spec: AnyFieldSpec;
  handle: {
    setErrors?: (errors: string[]) => void;
  };
  container?: HTMLElement;  // DOM container for visibility toggling
  isVisible: boolean;
}

/**
 * Service responsible for applying field transforms.
 * Executes transform functions defined in field specs.
 */
export class DefaultFieldTransformer<TDraft> implements FieldTransformer<TDraft> {
  constructor(private fields: AnyFieldSpec[]) {}

  /**
   * Apply all field transforms to data.
   * Returns a new object with transformed values.
   */
  apply(data: TDraft): Record<string, unknown> {
    const result: Record<string, unknown> = { ...data };

    for (const field of this.fields) {
      if (!field.transform) continue;

      try {
        const transformed = field.transform(result[field.id] as never, result);
        result[field.id] = transformed;
      } catch (error) {
        logger.error(`Transform failed for field ${field.id}`, error);
      }
    }

    return result;
  }
}

/**
 * Service responsible for comprehensive validation of draft data.
 * Consolidates field validation, schema validation, and custom validators.
 */
export class ModalValidator<TDraft, TSerialized> {
  constructor(
    private spec: CreateSpec<TDraft, TSerialized>,
    private fieldInstances: Map<string, FieldInstance>,
    private data: () => TDraft,  // Getter function for current data
    private customValidators: Array<() => string[]>,
    private transformer: FieldTransformer<TDraft>
  ) {}

  /**
   * Run comprehensive validation:
   * 1. Field validation (required, custom validate functions)
   * 2. Field transforms
   * 3. Schema validation
   * 4. Custom validators
   */
  validate(): ValidationResult<TSerialized> {
    const summary: string[] = [];

    // Step 1: Field validation
    const fieldErrors = this.validateFields();

    // Add field errors to summary
    for (const [id, errors] of fieldErrors) {
      if (errors.length > 0) {
        const instance = this.fieldInstances.get(id);
        if (instance) {
          summary.push(`${instance.spec.label}: ${errors[0]}`);
        }
      }
    }

    // Step 2: Transform and validate schema
    const transformed = this.transformer.apply(this.data());
    const schemaErrors = this.validateSchema(transformed, fieldErrors);
    summary.push(...schemaErrors);

    // Step 3: Custom validators
    const customErrors = this.runCustomValidators();
    summary.push(...customErrors);

    // Step 4: Apply field errors to UI
    this.applyFieldErrors(fieldErrors);

    const isValid = summary.length === 0;

    // Log validation results for UI testing
    if (!isValid) {
      const errorObj: Record<string, string[]> = {};
      for (const [id, errors] of fieldErrors) {
        if (errors.length > 0) {
          errorObj[id] = errors;
        }
      }
      logger.debug('[UI-TEST] Validation errors:', JSON.stringify({ errors: errorObj, summary }));
    } else {
      logger.debug('[UI-TEST] Validation passed');
    }

    return {
      isValid,
      errors: fieldErrors,
      summary,
      transformed: isValid ? (transformed as TSerialized) : undefined
    };
  }

  /**
   * Validate all fields: required and custom validate functions.
   */
  private validateFields(): Map<string, string[]> {
    const fieldErrors = new Map<string, string[]>();
    const currentData = this.data();

    for (const [id, instance] of this.fieldInstances) {
      // Clear errors for invisible fields
      if (!instance.isVisible) {
        instance.handle.setErrors?.([]);
        fieldErrors.set(id, []);
        continue;
      }

      const value = (currentData as Record<string, unknown>)[id];
      const errors: string[] = [];

      // Required validation
      if (instance.spec.required) {
        if (value === undefined || value === null || value === "") {
          errors.push("Pflichtfeld");
        } else if (Array.isArray(value) && value.length === 0) {
          errors.push("Mindestens ein Wert erforderlich");
        }
      }

      // Custom validation
      if (instance.spec.validate) {
        try {
          const result = instance.spec.validate(value as never, currentData);
          if (typeof result === "string" && result.trim()) {
            errors.push(result.trim());
          }
        } catch (error) {
          errors.push(String(error));
        }
      }

      fieldErrors.set(id, errors);
    }

    return fieldErrors;
  }

  /**
   * Validate transformed data with schema.
   * Adds schema errors to existing field errors.
   */
  private validateSchema(
    transformed: Record<string, unknown>,
    fieldErrors: Map<string, string[]>
  ): string[] {
    const summary: string[] = [];
    const schema = this.spec.schema.safeParse(transformed);

    if (!schema.success) {
      const issues = extractSchemaIssues(schema.error);

      // If no structured issues, add raw error
      if (issues.length === 0) {
        summary.push(String(schema.error));
      }

      // Add issues to field errors and summary
      for (const issue of issues) {
        const target = issue.path?.[0];

        if (typeof target === "string" && fieldErrors.has(target)) {
          const list = fieldErrors.get(target)!;
          if (issue.message) {
            list.push(issue.message);
          }
          summary.push(`${target}: ${issue.message ?? "Ungültiger Wert"}`);
        } else if (issue.message) {
          summary.push(issue.message);
        }
      }
    }

    return summary;
  }

  /**
   * Run custom validator functions (used in navigation mode).
   */
  private runCustomValidators(): string[] {
    const collected: string[] = [];
    for (const validator of this.customValidators) {
      collected.push(...validator());
    }
    return collected;
  }

  /**
   * Apply field errors to UI (set errors on field handles).
   */
  private applyFieldErrors(errors: Map<string, string[]>): void {
    for (const [id, instance] of this.fieldInstances) {
      const fieldErrors = errors.get(id) ?? [];
      instance.handle.setErrors?.(fieldErrors);
    }
  }
}

// Export FieldTransformer type for modal-persistence.ts
export type { FieldTransformer };
