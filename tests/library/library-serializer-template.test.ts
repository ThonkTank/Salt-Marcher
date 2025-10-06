// tests/library/library-serializer-template.test.ts
// Prüft das Serializer-Template auf korrekte Policy-Validierung, Default-Telemetrie und Freeze-Verhalten.
import { describe, expect, it } from "vitest";

import {
    createLibrarySerializerTemplate,
    validateLibrarySerializerTemplate,
    LibrarySerializerTemplateError,
    type LibrarySerializerTemplateDraft,
} from "../../src/apps/library/core/serializer-template/library-serializer-template";

describe("library serializer template", () => {
    it("creates an immutable template with explicit telemetry configuration", () => {
        const draft: LibrarySerializerTemplateDraft = {
            id: "creatures.template",
            description: "Creatures serializer policies",
            version: "1.0.0",
            storage: {
                domain: "creatures",
                adapter: "vault",
                versioning: "frontmatter",
                dryRun: "supported",
                backupPlan: {
                    directory: "backups/creatures",
                    strategy: "append",
                    note: "Keep legacy revisions for audits",
                },
            },
            policies: [
                {
                    field: "name",
                    required: true,
                    validate: [
                        {
                            kind: "required",
                            code: "creature.name.required",
                            message: "Name is required",
                            severity: "error",
                        },
                    ],
                },
                {
                    field: "smType",
                    required: {
                        reason: "Legacy files rely on smType",
                    },
                    defaultValue: {
                        strategy: "literal",
                        value: "creature",
                        reason: "Legacy default",
                    },
                    migrate: [
                        {
                            fromVersion: "legacy",
                            kind: "rename",
                            description: "Map legacy frontmatter property",
                        },
                    ],
                },
                {
                    field: "entries_structured_json",
                    transform: {
                        kind: "json",
                        identifier: "structuredEntries",
                        description: "Parse structured action blocks",
                    },
                },
            ],
            telemetry: {
                events: {
                    migrationApplied: "library.creatures.serializer.migration",
                    validationFailed: "library.creatures.serializer.validation_failed",
                    dryRunExecuted: "library.creatures.serializer.dry_run",
                    transformFallback: "library.creatures.serializer.transform_fallback",
                },
                attributes: ["templateId", "domain", "version", "policy"],
            },
        };

        const template = createLibrarySerializerTemplate(draft);

        expect(template.storage.descriptor.id).toBe("creatures");
        expect(Object.isFrozen(template)).toBe(true);
        expect(Object.isFrozen(template.policies)).toBe(true);
        expect(Object.isFrozen(template.policies[0])).toBe(true);
        expect(template.telemetry.events.migrationApplied).toBe(
            "library.creatures.serializer.migration",
        );
        expect(template.storage.backupPlan?.directory).toBe("backups/creatures");
    });

    it("reports validation issues for duplicate fields, invalid versions and telemetry gaps", () => {
        const invalidDraft: LibrarySerializerTemplateDraft = {
            id: "items.template",
            description: "Invalid template to check validation",
            version: "1",
            storage: {
                domain: "items",
                adapter: "legacy",
                versioning: "invalid" as unknown as "frontmatter",
                dryRun: "invalid" as unknown as "supported",
            },
            policies: [
                {
                    field: "name",
                    migrate: [
                        {
                            fromVersion: "0.0",
                            kind: "rename",
                            description: "",
                        },
                    ],
                },
                {
                    field: "name",
                },
                {
                    field: "effect",
                    validate: [
                        {
                            kind: "custom",
                            code: "",
                            message: "",
                            severity: "error",
                        },
                    ],
                    transform: {
                        kind: "custom",
                        identifier: "",
                        description: "",
                    },
                },
            ],
        };

        const issues = validateLibrarySerializerTemplate(invalidDraft);

        expect(issues).toEqual(
            expect.arrayContaining([
                expect.objectContaining({ code: "invalid-version" }),
                expect.objectContaining({ code: "policy-duplicate-field" }),
                expect.objectContaining({ code: "policy-migrate-missing-description" }),
                expect.objectContaining({ code: "policy-migrate-invalid-from" }),
                expect.objectContaining({ code: "policy-validate-missing-code" }),
                expect.objectContaining({ code: "policy-validate-missing-message" }),
                expect.objectContaining({ code: "policy-transform-missing-identifier" }),
                expect.objectContaining({ code: "storage-invalid-versioning" }),
                expect.objectContaining({ code: "storage-invalid-dry-run" }),
            ]),
        );
    });

    it("throws a structured error when create is invoked with validation failures", () => {
        const invalidDraft: LibrarySerializerTemplateDraft = {
            id: "equipment.template",
            description: "Equipment serializer",
            version: "2.0.0",
            storage: {
                domain: "equipment",
                adapter: "legacy",
                versioning: "frontmatter",
                dryRun: "supported",
            },
            policies: [
                {
                    field: "name",
                },
                {
                    field: "name",
                },
            ],
            telemetry: {
                events: {
                    migrationApplied: "",
                    validationFailed: "",
                    dryRunExecuted: "",
                    transformFallback: "",
                },
                attributes: [],
            },
        };

        expect(() => createLibrarySerializerTemplate(invalidDraft)).toThrowError(
            LibrarySerializerTemplateError,
        );

        try {
            createLibrarySerializerTemplate(invalidDraft);
        } catch (error) {
            const templateError = error as LibrarySerializerTemplateError;
            expect(templateError.issues.length).toBeGreaterThan(0);
            expect(
                templateError.issues.filter(issue => issue.code === "policy-duplicate-field"),
            ).toHaveLength(1);
        }
    });

    it("fills telemetry defaults when omitted", () => {
        const draft: LibrarySerializerTemplateDraft = {
            id: "spells.template",
            description: "Spell serializer",
            version: "1.1.0",
            storage: {
                domain: "spells",
                adapter: "vault",
                versioning: "content",
                dryRun: "required",
            },
            policies: [
                {
                    field: "name",
                    validate: [
                        {
                            kind: "required",
                            code: "spell.name.required",
                            message: "Spell name required",
                            severity: "error",
                        },
                    ],
                },
            ],
        };

        const template = createLibrarySerializerTemplate(draft);

        expect(template.telemetry.events.migrationApplied).toBe(
            "library.serializer.migration.applied",
        );
        expect(template.telemetry.attributes).toContain("templateId");
    });
});
