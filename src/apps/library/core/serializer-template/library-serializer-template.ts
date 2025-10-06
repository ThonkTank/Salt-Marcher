// src/apps/library/core/serializer-template/library-serializer-template.ts
// Beschreibt das Serializer-Template, mit dem Library-Domänen deklarative Policies, Storage-Verknüpfung und Telemetrie planen.
import {
    type LibraryStorageDomainDescriptor,
    type LibraryStorageDomainId,
    type LibraryStorageAdapterKind,
    type LibraryStorageBackupPlan,
    type LibraryStorageDryRunReport,
    describeLibraryStorageDomain,
} from "../library-storage-port";

const SEMVER_PATTERN = /^\d+\.\d+\.\d+$/u;

export type LibrarySerializerTemplateVersion = `${number}.${number}.${number}`;

export interface LibrarySerializerPolicyRequirementPlan {
    readonly reason: string;
    readonly when?: string;
}

export type LibrarySerializerPolicyRequirement = boolean | LibrarySerializerPolicyRequirementPlan;

export type LibrarySerializerDefaultValueStrategy = "literal" | "factory" | "policy";

export interface LibrarySerializerDefaultValuePlan {
    readonly strategy: LibrarySerializerDefaultValueStrategy;
    readonly value?: unknown;
    readonly reason: string;
}

export type LibrarySerializerMigrationKind = "rename" | "coerce" | "split" | "merge" | "custom";

export interface LibrarySerializerMigrationStep {
    readonly fromVersion: LibrarySerializerTemplateVersion | "legacy";
    readonly kind: LibrarySerializerMigrationKind;
    readonly description: string;
}

export type LibrarySerializerValidationRuleKind =
    | "required"
    | "enum"
    | "range"
    | "pattern"
    | "length"
    | "custom";

export interface LibrarySerializerValidationRule {
    readonly kind: LibrarySerializerValidationRuleKind;
    readonly code: string;
    readonly message: string;
    readonly severity: "error" | "warning";
    readonly config?: Record<string, unknown>;
}

export type LibrarySerializerTransformerKind = "json" | "markdown" | "custom";

export interface LibrarySerializerTransformerPlan {
    readonly kind: LibrarySerializerTransformerKind;
    readonly identifier: string;
    readonly description: string;
}

export interface LibrarySerializerPolicyDescriptor {
    readonly field: string;
    readonly required?: LibrarySerializerPolicyRequirement;
    readonly defaultValue?: LibrarySerializerDefaultValuePlan;
    readonly migrate?: readonly LibrarySerializerMigrationStep[];
    readonly validate?: readonly LibrarySerializerValidationRule[];
    readonly transform?: LibrarySerializerTransformerPlan;
}

export type LibrarySerializerVersioningStrategy = "frontmatter" | "content" | "none";

export type LibrarySerializerDryRunExpectation = "required" | "supported" | "disabled";

export interface LibrarySerializerStorageBinding {
    readonly domain: LibraryStorageDomainId;
    readonly adapter: LibraryStorageAdapterKind;
    readonly versioning: LibrarySerializerVersioningStrategy;
    readonly dryRun: LibrarySerializerDryRunExpectation;
    readonly backupPlan?: LibraryStorageBackupPlan;
}

export interface LibrarySerializerTelemetryEvents {
    readonly migrationApplied: string;
    readonly validationFailed: string;
    readonly dryRunExecuted: string;
    readonly transformFallback: string;
}

export interface LibrarySerializerTelemetryPlan {
    readonly events: LibrarySerializerTelemetryEvents;
    readonly attributes: readonly string[];
}

export interface LibrarySerializerTemplateDraft {
    readonly id: string;
    readonly description: string;
    readonly version: LibrarySerializerTemplateVersion;
    readonly storage: LibrarySerializerStorageBinding;
    readonly policies: readonly LibrarySerializerPolicyDescriptor[];
    readonly telemetry?: LibrarySerializerTelemetryPlan;
}

export interface LibrarySerializerPolicy extends LibrarySerializerPolicyDescriptor {
    readonly required?: LibrarySerializerPolicyRequirement;
    readonly migrate?: readonly LibrarySerializerMigrationStep[];
    readonly validate?: readonly LibrarySerializerValidationRule[];
}

export interface LibrarySerializerTemplate {
    readonly id: string;
    readonly description: string;
    readonly version: LibrarySerializerTemplateVersion;
    readonly storage: LibrarySerializerStorageBinding & {
        readonly descriptor: LibraryStorageDomainDescriptor;
    };
    readonly policies: readonly LibrarySerializerPolicy[];
    readonly telemetry: LibrarySerializerTelemetryPlan;
}

export type LibrarySerializerTemplateIssueCode =
    | "invalid-version"
    | "unknown-domain"
    | "policy-missing-field"
    | "policy-duplicate-field"
    | "policy-migrate-missing-description"
    | "policy-migrate-invalid-from"
    | "policy-validate-missing-code"
    | "policy-validate-missing-message"
    | "policy-transform-missing-identifier"
    | "telemetry-missing-event"
    | "storage-invalid-versioning"
    | "storage-invalid-dry-run";

export interface LibrarySerializerTemplateIssue {
    readonly severity: "error" | "warning";
    readonly code: LibrarySerializerTemplateIssueCode;
    readonly message: string;
    readonly path?: string;
}

export class LibrarySerializerTemplateError extends Error {
    public readonly issues: readonly LibrarySerializerTemplateIssue[];

    public constructor(message: string, issues: readonly LibrarySerializerTemplateIssue[]) {
        super(message);
        this.name = "LibrarySerializerTemplateError";
        this.issues = Object.freeze([...issues]);
    }
}

const REQUIRED_TELEMETRY_EVENTS: ReadonlyArray<keyof LibrarySerializerTelemetryEvents> = Object.freeze([
    "migrationApplied",
    "validationFailed",
    "dryRunExecuted",
    "transformFallback",
]);

const DEFAULT_TELEMETRY_PLAN: LibrarySerializerTelemetryPlan = Object.freeze({
    events: Object.freeze({
        migrationApplied: "library.serializer.migration.applied",
        validationFailed: "library.serializer.validation.failed",
        dryRunExecuted: "library.serializer.dry-run.executed",
        transformFallback: "library.serializer.transform.fallback",
    }),
    attributes: Object.freeze(["templateId", "domain", "version"]),
});

const ALLOWED_VERSIONING: ReadonlySet<LibrarySerializerVersioningStrategy> = new Set([
    "frontmatter",
    "content",
    "none",
]);

const ALLOWED_DRY_RUN: ReadonlySet<LibrarySerializerDryRunExpectation> = new Set([
    "required",
    "supported",
    "disabled",
]);

export function validateLibrarySerializerTemplate(
    draft: LibrarySerializerTemplateDraft,
): LibrarySerializerTemplateIssue[] {
    const issues: LibrarySerializerTemplateIssue[] = [];

    if (!SEMVER_PATTERN.test(draft.version)) {
        issues.push({
            severity: "error",
            code: "invalid-version",
            message: `Template ${draft.id} besitzt keine SemVer-Version (${draft.version}).`,
            path: "version",
        });
    }

    if (!ALLOWED_VERSIONING.has(draft.storage.versioning)) {
        issues.push({
            severity: "error",
            code: "storage-invalid-versioning",
            message: `Unbekannte Versionierungsstrategie: ${draft.storage.versioning}.`,
            path: "storage.versioning",
        });
    }

    if (!ALLOWED_DRY_RUN.has(draft.storage.dryRun)) {
        issues.push({
            severity: "error",
            code: "storage-invalid-dry-run",
            message: `Unbekannte Dry-Run-Anforderung: ${draft.storage.dryRun}.`,
            path: "storage.dryRun",
        });
    }

    try {
        describeLibraryStorageDomain(draft.storage.domain);
    } catch (error) {
        issues.push({
            severity: "error",
            code: "unknown-domain",
            message: `Template ${draft.id} referenziert unbekannte Domain ${draft.storage.domain}.`,
            path: "storage.domain",
        });
    }

    const seenFields = new Set<string>();
    draft.policies.forEach((policy, index) => {
        const fieldPath = `policies[${index}]`;
        const trimmedField = policy.field?.trim();
        if (!trimmedField) {
            issues.push({
                severity: "error",
                code: "policy-missing-field",
                message: `Policy an Position ${index} besitzt kein Feld.`,
                path: `${fieldPath}.field`,
            });
        } else {
            if (seenFields.has(trimmedField)) {
                issues.push({
                    severity: "error",
                    code: "policy-duplicate-field",
                    message: `Policy-Feld ${trimmedField} ist mehrfach definiert.`,
                    path: `${fieldPath}.field`,
                });
            }
            seenFields.add(trimmedField);
        }

        policy.migrate?.forEach((step, migrateIndex) => {
            const migratePath = `${fieldPath}.migrate[${migrateIndex}]`;
            if (!step.description.trim()) {
                issues.push({
                    severity: "error",
                    code: "policy-migrate-missing-description",
                    message: `Migration für Feld ${policy.field} benötigt eine Beschreibung.`,
                    path: `${migratePath}.description`,
                });
            }
            if (step.fromVersion !== "legacy" && !SEMVER_PATTERN.test(step.fromVersion)) {
                issues.push({
                    severity: "error",
                    code: "policy-migrate-invalid-from",
                    message: `Migration für Feld ${policy.field} nutzt ungültige Version ${step.fromVersion}.`,
                    path: `${migratePath}.fromVersion`,
                });
            }
        });

        policy.validate?.forEach((rule, ruleIndex) => {
            const validatePath = `${fieldPath}.validate[${ruleIndex}]`;
            if (!rule.code.trim()) {
                issues.push({
                    severity: "error",
                    code: "policy-validate-missing-code",
                    message: `Validierungsregel für Feld ${policy.field} benötigt einen Fehlercode.`,
                    path: `${validatePath}.code`,
                });
            }
            if (!rule.message.trim()) {
                issues.push({
                    severity: "error",
                    code: "policy-validate-missing-message",
                    message: `Validierungsregel für Feld ${policy.field} benötigt eine Fehlermeldung.`,
                    path: `${validatePath}.message`,
                });
            }
        });

        if (policy.transform && !policy.transform.identifier.trim()) {
            issues.push({
                severity: "error",
                code: "policy-transform-missing-identifier",
                message: `Transformer für Feld ${policy.field} benötigt eine Kennung.`,
                path: `${fieldPath}.transform.identifier`,
            });
        }
    });

    const telemetryPlan = draft.telemetry ?? DEFAULT_TELEMETRY_PLAN;
    REQUIRED_TELEMETRY_EVENTS.forEach(key => {
        if (!telemetryPlan.events[key].trim()) {
            issues.push({
                severity: "error",
                code: "telemetry-missing-event",
                message: `Telemetry-Event ${key} ist nicht belegt.`,
                path: `telemetry.events.${key}`,
            });
        }
    });

    return issues;
}

function freezePolicy(policy: LibrarySerializerPolicyDescriptor): LibrarySerializerPolicy {
    const frozenMigrate = policy.migrate?.map(step =>
        Object.freeze({
            fromVersion: step.fromVersion,
            kind: step.kind,
            description: step.description,
        }),
    );
    const frozenValidate = policy.validate?.map(rule =>
        Object.freeze({
            kind: rule.kind,
            code: rule.code,
            message: rule.message,
            severity: rule.severity,
            config: rule.config ? Object.freeze({ ...rule.config }) : undefined,
        }),
    );

    return Object.freeze({
        field: policy.field,
        required: policy.required,
        defaultValue: policy.defaultValue
            ? Object.freeze({
                  strategy: policy.defaultValue.strategy,
                  value: policy.defaultValue.value,
                  reason: policy.defaultValue.reason,
              })
            : undefined,
        migrate: frozenMigrate ? Object.freeze(frozenMigrate) : undefined,
        validate: frozenValidate ? Object.freeze(frozenValidate) : undefined,
        transform: policy.transform
            ? Object.freeze({
                  kind: policy.transform.kind,
                  identifier: policy.transform.identifier,
                  description: policy.transform.description,
              })
            : undefined,
    });
}

function freezeTelemetry(plan: LibrarySerializerTelemetryPlan): LibrarySerializerTelemetryPlan {
    return Object.freeze({
        events: Object.freeze({
            migrationApplied: plan.events.migrationApplied,
            validationFailed: plan.events.validationFailed,
            dryRunExecuted: plan.events.dryRunExecuted,
            transformFallback: plan.events.transformFallback,
        }),
        attributes: Object.freeze([...new Set(plan.attributes)]),
    });
}

export function createLibrarySerializerTemplate(
    draft: LibrarySerializerTemplateDraft,
): LibrarySerializerTemplate {
    const issues = validateLibrarySerializerTemplate(draft);
    const blockingIssues = issues.filter(issue => issue.severity === "error");
    if (blockingIssues.length > 0) {
        throw new LibrarySerializerTemplateError(
            `Template ${draft.id} ist ungültig (${blockingIssues.length} Fehler).`,
            issues,
        );
    }

    const descriptor = describeLibraryStorageDomain(draft.storage.domain);
    const telemetryPlan = freezeTelemetry(draft.telemetry ?? DEFAULT_TELEMETRY_PLAN);
    const policies = draft.policies.map(policy => freezePolicy(policy));

    return Object.freeze({
        id: draft.id,
        description: draft.description,
        version: draft.version,
        storage: Object.freeze({
            domain: draft.storage.domain,
            adapter: draft.storage.adapter,
            versioning: draft.storage.versioning,
            dryRun: draft.storage.dryRun,
            descriptor,
            backupPlan: draft.storage.backupPlan
                ? Object.freeze({
                      directory: draft.storage.backupPlan.directory,
                      strategy: draft.storage.backupPlan.strategy,
                      note: draft.storage.backupPlan.note,
                  })
                : undefined,
        }),
        policies: Object.freeze(policies),
        telemetry: telemetryPlan,
    });
}

export interface LibrarySerializerDryRunExecution {
    readonly templateId: string;
    readonly domain: LibraryStorageDomainId;
    readonly report: LibraryStorageDryRunReport;
}

export interface LibrarySerializerTelemetryEventContext {
    readonly templateId: string;
    readonly domain: LibraryStorageDomainId;
    readonly version: LibrarySerializerTemplateVersion;
    readonly event: keyof LibrarySerializerTelemetryEvents;
    readonly attributes?: Record<string, unknown>;
}

export interface LibrarySerializerTemplateRuntimeHooks {
    readonly onDryRunExecuted?: (execution: LibrarySerializerDryRunExecution) => void;
    readonly emitTelemetry?: (context: LibrarySerializerTelemetryEventContext) => void;
}
