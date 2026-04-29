package saltmarcher.architecture.documentation.domain;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import saltmarcher.architecture.ArchitectureContext;
import saltmarcher.architecture.ArchitectureRule;
import saltmarcher.architecture.ViolationSink;

public final class DomainEnforcementCoverageRules implements ArchitectureRule {

    private static final String COVERAGE_RULE = "domain-enforcement-coverage-complete";
    private static final List<String> MECHANICAL_STATUSES = List.of(
            "Enforced",
            "Enforced Elsewhere",
            "Source-Pattern Enforced");
    private static final Map<String, List<ExpectedRow>> EXPECTED_ROWS_BY_DOCUMENT = Map.ofEntries(
            Map.entry(
                    "docs/project/architecture/enforcement/domain-layer-enforcement.md",
                    List.of(
                            row("domain-layer-context-root-boundary-and-module-topology",
                                    "Enforced Elsewhere",
                                    List.of(
                                            "domain-applicationservice-root-presence",
                                            "domain-usecase-direct-file-placement",
                                            "domain-layer-named-module-name-shape",
                                            "domain-layer-forbidden-top-level-domain-buckets"),
                                    List.of("./gradlew checkArchitecture", "./gradlew checkDocumentationEnforcement")),
                            row("domain-layer-no-outer-layer-or-infrastructure-dependencies",
                                    "Enforced",
                                    List.of("ArchUnit", "Error Prone"),
                                    List.of("./gradlew checkArchitecture", "./gradlew compileJava")),
                            row("domain-layer-public-boundary-families-only",
                                    "Enforced Elsewhere",
                                    List.of(
                                            "domain-applicationservice-root-presence",
                                            "domain-applicationservice-public-input-carriers",
                                            "domain-applicationservice-public-return-carriers",
                                            "domain-published-direct-file-placement",
                                            "domain-published-carrier-shape",
                                            "domain-port-role-shape",
                                            "domain-port-ownership-and-signature-boundary"),
                                    List.of(
                                            "./gradlew compileJava",
                                            "./gradlew checkArchitecture",
                                            "./gradlew checkDocumentationEnforcement")),
                            row("domain-layer-foreign-context-access-only-through-public-boundaries",
                                    "Enforced",
                                    List.of("ArchUnit"),
                                    List.of("./gradlew checkArchitecture")),
                            row("domain-layer-named-module-role-subpackage-required",
                                    "Enforced",
                                    List.of("build-harness"),
                                    List.of("./gradlew checkArchitecture")),
                            row("domain-layer-named-module-name-shape",
                                    "Enforced",
                                    List.of("build-harness"),
                                    List.of("./gradlew checkArchitecture")),
                            row("domain-layer-tactical-role-package-name-allowlist",
                                    "Enforced",
                                    List.of("build-harness"),
                                    List.of("./gradlew checkArchitecture")),
                            row("domain-layer-public-type-shape",
                                    "Enforced",
                                    List.of("Error Prone"),
                                    List.of("./gradlew compileJava")),
                            row("domain-layer-tactical-role-direct-file-placement",
                                    "Enforced",
                                    List.of("build-harness"),
                                    List.of("./gradlew checkArchitecture")),
                            row("domain-layer-forbidden-top-level-domain-buckets",
                                    "Enforced",
                                    List.of("build-harness"),
                                    List.of("./gradlew checkArchitecture")),
                            row("domain-layer-public-type-field-mutation",
                                    "Enforced",
                                    List.of("Error Prone"),
                                    List.of("./gradlew compileJava")),
                            row("domain-layer-no-published-carrier-dependencies-inside-named-modules",
                                    "Enforced",
                                    List.of("Error Prone"),
                                    List.of("./gradlew compileJava")),
                            row("domain-layer-feature-cycle-freedom",
                                    "Enforced",
                                    List.of("ArchUnit"),
                                    List.of("./gradlew checkArchitecture")),
                            row("domain-layer-named-module-cycle-freedom",
                                    "Enforced",
                                    List.of("ArchUnit"),
                                    List.of("./gradlew checkArchitecture")),
                            row("domain-layer-named-module-no-same-context-application-boundary-dependencies",
                                    "Enforced",
                                    List.of("ArchUnit"),
                                    List.of("./gradlew checkArchitecture")),
                            row("domain-layer-named-module-no-foreign-context-dependencies",
                                    "Enforced",
                                    List.of("ArchUnit"),
                                    List.of("./gradlew checkArchitecture")),
                            row("domain-layer-model-role-no-outbound-port-dependencies",
                                    "Enforced",
                                    List.of("ArchUnit"),
                                    List.of("./gradlew checkArchitecture")),
                            row("domain-layer-optional-role-package-necessity",
                                    "Review-Owned"),
                            row("domain-layer-technical-vocabulary-rejection",
                                    "Review-Owned"),
                            row("domain-layer-business-policy-not-in-view-or-data",
                                    "Review-Owned"))),
            Map.entry(
                    "docs/project/architecture/enforcement/domain-context-enforcement.md",
                    List.of(
                            row("domain-context-document-presence",
                                    "Enforced",
                                    List.of("documentation-enforcement"),
                                    List.of("./gradlew checkDocumentationEnforcement")),
                            row("domain-context-name-marker",
                                    "Enforced",
                                    List.of("documentation-enforcement"),
                                    List.of("./gradlew checkDocumentationEnforcement")),
                            row("domain-context-role-marker",
                                    "Enforced",
                                    List.of("documentation-enforcement"),
                                    List.of("./gradlew checkDocumentationEnforcement")),
                            row("domain-context-base-sections",
                                    "Enforced",
                                    List.of("documentation-enforcement"),
                                    List.of("./gradlew checkDocumentationEnforcement")),
                            row("domain-context-authored-truth-required-sections",
                                    "Enforced",
                                    List.of("documentation-enforcement"),
                                    List.of("./gradlew checkDocumentationEnforcement")),
                            row("domain-context-authored-truth-write-model-required",
                                    "Enforced",
                                    List.of("documentation-enforcement"),
                                    List.of("./gradlew checkDocumentationEnforcement")),
                            row("domain-context-aggregate-root-marker-shape",
                                    "Enforced",
                                    List.of("documentation-enforcement"),
                                    List.of("./gradlew checkDocumentationEnforcement")),
                            row("domain-context-generation-policy-required-sections",
                                    "Enforced",
                                    List.of("documentation-enforcement"),
                                    List.of("./gradlew checkDocumentationEnforcement")),
                            row("domain-context-generation-policy-write-model-none",
                                    "Enforced",
                                    List.of("documentation-enforcement"),
                                    List.of("./gradlew checkDocumentationEnforcement")),
                            row("domain-context-generation-policy-ephemeral-rationale",
                                    "Enforced",
                                    List.of("documentation-enforcement"),
                                    List.of("./gradlew checkDocumentationEnforcement")),
                            row("domain-context-standard-role-coverage",
                                    "Enforced",
                                    List.of("documentation-enforcement"),
                                    List.of("./gradlew checkDocumentationEnforcement")),
                            row("domain-context-party-owned-truth",
                                    "Review-Owned"),
                            row("domain-context-creatures-owned-reference-scope",
                                    "Review-Owned"),
                            row("domain-context-encounter-owned-roster-truth",
                                    "Review-Owned"),
                            row("domain-context-encountertable-owned-reference-scope",
                                    "Review-Owned"),
                            row("domain-context-dungeon-owned-world-space-truth",
                                    "Review-Owned"),
                            row("domain-context-sessionplanner-owned-transient-policy",
                                    "Review-Owned"),
                            row("domain-context-creatures-no-encounter-or-lifecycle-truth",
                                    "Review-Owned"),
                            row("domain-context-encounter-no-foreign-truth-ownership",
                                    "Review-Owned"),
                            row("domain-context-encountertable-no-creature-or-generation-policy-truth",
                                    "Review-Owned"),
                            row("domain-context-dungeon-no-cross-context-domain-relationship",
                                    "Review-Owned"),
                            row("domain-context-sessionplanner-no-persistence-truth",
                                    "Review-Owned"),
                            row("domain-context-standard-relationship-coverage",
                                    "Enforced",
                                    List.of("documentation-enforcement"),
                                    List.of("./gradlew checkDocumentationEnforcement")),
                            row("domain-context-party-publishes-downstream-facts",
                                    "Review-Owned"),
                            row("domain-context-creatures-publishes-policy-input-facts",
                                    "Review-Owned"),
                            row("domain-context-encounter-consumes-foreign-public-boundaries",
                                    "Review-Owned"),
                            row("domain-context-encountertable-data-adapter-ingest-and-public-export",
                                    "Review-Owned"),
                            row("domain-context-dungeon-no-domain-relationship-to-other-active-contexts",
                                    "Review-Owned"),
                            row("domain-context-sessionplanner-consumes-party-and-encounter-public-boundaries",
                                    "Review-Owned"))),
            Map.entry(
                    "docs/project/architecture/enforcement/domain-application-service-enforcement.md",
                    List.of(
                            row("domain-applicationservice-root-presence",
                                    "Enforced",
                                    List.of("build-harness", "documentation-enforcement"),
                                    List.of("./gradlew checkArchitecture", "./gradlew checkDocumentationEnforcement")),
                            row("domain-applicationservice-class-shape",
                                    "Enforced",
                                    List.of("Error Prone"),
                                    List.of("./gradlew compileJava")),
                            row("domain-applicationservice-public-input-carriers",
                                    "Enforced",
                                    List.of("Error Prone"),
                                    List.of("./gradlew compileJava")),
                            row("domain-applicationservice-public-return-carriers",
                                    "Enforced",
                                    List.of("Error Prone"),
                                    List.of("./gradlew compileJava")),
                            row("domain-applicationservice-no-nested-contracts",
                                    "Enforced",
                                    List.of("Error Prone"),
                                    List.of("./gradlew compileJava")),
                            row("domain-applicationservice-constructor-composition-boundary",
                                    "Enforced",
                                    List.of("Error Prone"),
                                    List.of("./gradlew compileJava")),
                            row("domain-applicationservice-public-boundary-signature-purity",
                                    "Enforced",
                                    List.of("Error Prone"),
                                    List.of("./gradlew compileJava")),
                            row("domain-applicationservice-no-direct-infrastructure-construction-source-pattern",
                                    "Source-Pattern Enforced",
                                    List.of("PMD"),
                                    List.of("./gradlew pmdArchitectureMain", "./gradlew checkArchitecture")),
                            row("domain-applicationservice-public-carrier-translation-boundary",
                                    "Review-Owned"),
                            row("domain-applicationservice-no-runtime-composition-ownership",
                                    "Review-Owned"),
                            row("domain-applicationservice-no-business-policy-ownership",
                                    "Review-Owned"))),
            Map.entry(
                    "docs/project/architecture/enforcement/domain-use-case-enforcement.md",
                    List.of(
                            row("domain-usecase-direct-file-placement",
                                    "Enforced",
                                    List.of("build-harness"),
                                    List.of("./gradlew checkArchitecture")),
                            row("domain-usecase-no-generic-bucket-names",
                                    "Enforced",
                                    List.of("build-harness"),
                                    List.of("./gradlew checkArchitecture")),
                            row("domain-usecase-no-backend-port-contract-files",
                                    "Enforced",
                                    List.of("build-harness"),
                                    List.of("./gradlew checkArchitecture")),
                            row("domain-usecase-no-same-context-published-dependencies",
                                    "Enforced",
                                    List.of("Error Prone"),
                                    List.of("./gradlew compileJava")),
                            row("domain-usecase-foreign-context-access-only-through-public-boundaries",
                                    "Enforced",
                                    List.of("ArchUnit"),
                                    List.of("./gradlew checkArchitecture")),
                            row("domain-usecase-no-outer-layer-or-infrastructure-dependencies",
                                    "Enforced",
                                    List.of("Error Prone", "ArchUnit"),
                                    List.of("./gradlew compileJava", "./gradlew checkArchitecture")),
                            row("domain-usecase-no-policy-helper-prefix-source-pattern",
                                    "Source-Pattern Enforced",
                                    List.of("PMD"),
                                    List.of("./gradlew pmdArchitectureMain", "./gradlew checkArchitecture")),
                            row("domain-usecase-thin-orchestration-semantics",
                                    "Review-Owned"),
                            row("domain-usecase-collaborator-surface-discipline",
                                    "Review-Owned"),
                            row("domain-usecase-no-hidden-business-policy",
                                    "Review-Owned"),
                            row("domain-usecase-no-hidden-carrier-bypass-into-model",
                                    "Review-Owned"))),
            Map.entry(
                    "docs/project/architecture/enforcement/domain-published-enforcement.md",
                    List.of(
                            row("domain-published-direct-file-placement",
                                    "Enforced",
                                    List.of("build-harness"),
                                    List.of("./gradlew checkArchitecture")),
                            row("domain-published-top-level-public-surface",
                                    "Enforced",
                                    List.of("Error Prone"),
                                    List.of("./gradlew compileJava")),
                            row("domain-published-carrier-shape",
                                    "Enforced",
                                    List.of("Error Prone"),
                                    List.of("./gradlew compileJava")),
                            row("domain-published-observable-state-handle-necessity",
                                    "Review-Owned"),
                            row("domain-published-no-callable-contracts",
                                    "Enforced",
                                    List.of("build-harness"),
                                    List.of("./gradlew checkArchitecture")),
                            row("domain-published-domain-facts-only",
                                    "Review-Owned"),
                            row("domain-published-public-boundary-signature-purity",
                                    "Enforced",
                                    List.of("Error Prone"),
                                    List.of("./gradlew compileJava")),
                            row("domain-published-no-foreign-published-signatures",
                                    "Enforced",
                                    List.of("Error Prone"),
                                    List.of("./gradlew compileJava")),
                            row("domain-published-ubiquitous-language-stability",
                                    "Review-Owned"),
                            row("domain-published-passive-boundary-language",
                                    "Review-Owned"))),
            Map.entry(
                    "docs/project/architecture/enforcement/domain-port-enforcement.md",
                    List.of(
                            row("domain-port-role-shape",
                                    "Enforced",
                                    List.of("Error Prone"),
                                    List.of("./gradlew compileJava")),
                            row("domain-port-repository-placement",
                                    "Enforced",
                                    List.of("Error Prone"),
                                    List.of("./gradlew compileJava")),
                            row("domain-port-ownership-and-signature-boundary",
                                    "Enforced",
                                    List.of("Error Prone"),
                                    List.of("./gradlew compileJava")),
                            row("domain-port-no-implementations-inside-domain",
                                    "Enforced",
                                    List.of("Error Prone"),
                                    List.of("./gradlew compileJava")),
                            row("domain-port-domain-language",
                                    "Review-Owned"),
                            row("domain-port-repository-write-orientation",
                                    "Review-Owned"))),
            Map.entry(
                    "docs/project/architecture/enforcement/domain-aggregate-enforcement.md",
                    List.of(
                            row("domain-aggregate-role-shape", "Enforced",
                                    List.of("Error Prone"), List.of("./gradlew compileJava")),
                            row("domain-aggregate-rich-consistency-boundary",
                                    "Review-Owned"))),
            Map.entry(
                    "docs/project/architecture/enforcement/domain-entity-enforcement.md",
                    List.of(
                            row("domain-entity-role-shape", "Enforced",
                                    List.of("Error Prone"), List.of("./gradlew compileJava")),
                            row("domain-entity-business-identity-and-lifecycle-semantics",
                                    "Review-Owned"))),
            Map.entry(
                    "docs/project/architecture/enforcement/domain-value-enforcement.md",
                    List.of(
                            row("domain-value-top-level-type-shape", "Enforced",
                                    List.of("Error Prone"), List.of("./gradlew compileJava")),
                            row("domain-value-field-purity", "Enforced",
                                    List.of("Error Prone"), List.of("./gradlew compileJava")),
                            row("domain-value-no-non-private-or-non-final-instance-state", "Enforced",
                                    List.of("Error Prone"), List.of("./gradlew compileJava")),
                            row("domain-value-no-published-carriers", "Enforced",
                                    List.of("Error Prone"), List.of("./gradlew compileJava")),
                            row("domain-value-no-same-context-application-boundary", "Enforced",
                                    List.of("ArchUnit"), List.of("./gradlew checkArchitecture")),
                            row("domain-value-no-foreign-context-dependencies", "Enforced",
                                    List.of("ArchUnit"), List.of("./gradlew checkArchitecture")),
                            row("domain-value-no-outbound-port-dependencies", "Enforced",
                                    List.of("ArchUnit"), List.of("./gradlew checkArchitecture")),
                            row("domain-value-semantic-immutability", "Review-Owned"))),
            Map.entry(
                    "docs/project/architecture/enforcement/domain-policy-enforcement.md",
                    List.of(
                            row("domain-policy-role-shape", "Enforced",
                                    List.of("Error Prone"), List.of("./gradlew compileJava")),
                            row("domain-policy-statelessness", "Enforced",
                                    List.of("Error Prone"), List.of("./gradlew compileJava")),
                            row("domain-policy-real-policy-behavior", "Review-Owned"))),
            Map.entry(
                    "docs/project/architecture/enforcement/domain-factory-enforcement.md",
                    List.of(
                            row("domain-factory-role-shape", "Enforced",
                                    List.of("Error Prone"), List.of("./gradlew compileJava")),
                            row("domain-factory-statelessness", "Enforced",
                                    List.of("Error Prone"), List.of("./gradlew compileJava")),
                            row("domain-factory-real-construction-boundary", "Review-Owned"))),
            Map.entry(
                    "docs/project/architecture/enforcement/domain-service-enforcement.md",
                    List.of(
                            row("domain-service-role-shape", "Enforced",
                                    List.of("Error Prone"), List.of("./gradlew compileJava")),
                            row("domain-service-statelessness", "Enforced",
                                    List.of("Error Prone"), List.of("./gradlew compileJava")),
                            row("domain-service-non-ceremonial-role-use", "Review-Owned"))),
            Map.entry(
                    "docs/project/architecture/enforcement/domain-event-enforcement.md",
                    List.of(
                            row("domain-event-role-shape", "Enforced",
                                    List.of("Error Prone"), List.of("./gradlew compileJava")),
                            row("domain-event-domain-meaningfulness", "Review-Owned"))),
            Map.entry(
                    "docs/project/architecture/enforcement/domain-specification-enforcement.md",
                    List.of(
                            row("domain-specification-role-shape", "Enforced",
                                    List.of("Error Prone"), List.of("./gradlew compileJava")),
                            row("domain-specification-non-ceremonial-role-use",
                                    "Review-Owned"))));

    @Override
    public void check(ArchitectureContext context, ViolationSink violations) {
        for (Map.Entry<String, List<ExpectedRow>> entry : EXPECTED_ROWS_BY_DOCUMENT.entrySet()) {
            validateDocument(context, entry.getKey(), entry.getValue(), violations);
        }
    }

    private void validateDocument(
            ArchitectureContext context,
            String documentPath,
            List<ExpectedRow> expectedRows,
            ViolationSink violations) {
        Path document = context.repoRoot().resolve(documentPath);
        if (!Files.isRegularFile(document)) {
            violations.add(documentPath, COVERAGE_RULE,
                    "Domain enforcement coverage document is missing.");
            return;
        }

        String content;
        try {
            content = Files.readString(document, StandardCharsets.UTF_8);
        } catch (IOException exception) {
            violations.add(documentPath, "file-readable",
                    "Could not read domain enforcement coverage: " + exception.getMessage());
            return;
        }

        List<TableRow> rows = tableRows(content);
        Map<String, TableRow> rowsByRuleId = rowsByRuleId(rows);
        for (ExpectedRow expectedRow : expectedRows) {
            TableRow row = rowsByRuleId.get(expectedRow.ruleId());
            if (row == null) {
                violations.add(documentPath, COVERAGE_RULE,
                        "Coverage row for `" + expectedRow.ruleId() + "` is missing.");
                continue;
            }
            validateStatus(documentPath, expectedRow, row, violations);
            validateMechanicalOwner(documentPath, expectedRow, row, violations);
            validateBlockingEntrypoint(documentPath, expectedRow, row, violations);
        }
        validateNoUnexpectedRows(documentPath, expectedRows, rowsByRuleId, violations);
    }

    private void validateNoUnexpectedRows(
            String documentPath,
            List<ExpectedRow> expectedRows,
            Map<String, TableRow> rowsByRuleId,
            ViolationSink violations) {
        if (!documentPath.equals("docs/project/architecture/enforcement/domain-service-enforcement.md")
                && !documentPath.equals("docs/project/architecture/enforcement/domain-entity-enforcement.md")
                && !documentPath.equals("docs/project/architecture/enforcement/domain-aggregate-enforcement.md")
                && !documentPath.equals("docs/project/architecture/enforcement/domain-context-enforcement.md")) {
            return;
        }

        java.util.Set<String> expectedRuleIds = new java.util.LinkedHashSet<>();
        for (ExpectedRow expectedRow : expectedRows) {
            expectedRuleIds.add(expectedRow.ruleId());
        }
        for (String actualRuleId : rowsByRuleId.keySet()) {
            if (!expectedRuleIds.contains(actualRuleId)) {
                violations.add(documentPath, COVERAGE_RULE,
                        "Coverage row for `" + actualRuleId
                                + "` is not owned by this document and must be removed.");
            }
        }
    }

    private void validateStatus(
            String documentPath,
            ExpectedRow expectedRow,
            TableRow row,
            ViolationSink violations) {
        String actualStatus = row.cell(1);
        if (!expectedRow.status().equals(actualStatus)) {
            violations.add(documentPath, COVERAGE_RULE,
                    "Coverage row for `" + expectedRow.ruleId() + "` must use status `"
                            + expectedRow.status() + "`, not `" + actualStatus + "`.");
            return;
        }
        if (expectedRow.requiresMechanicalOwner() && !MECHANICAL_STATUSES.contains(actualStatus)) {
            violations.add(documentPath, COVERAGE_RULE,
                    "Coverage row for `" + expectedRow.ruleId()
                            + "` must use an enforced status when it names mechanical owners.");
        }
    }

    private void validateMechanicalOwner(
            String documentPath,
            ExpectedRow expectedRow,
            TableRow row,
            ViolationSink violations) {
        if (!expectedRow.requiresMechanicalOwner()) {
            return;
        }
        String actualOwner = row.cell(3);
        for (String requiredFragment : expectedRow.requiredOwnerFragments()) {
            if (!actualOwner.contains(requiredFragment)) {
                violations.add(documentPath, COVERAGE_RULE,
                        "Coverage row for `" + expectedRow.ruleId()
                                + "` must name mechanical owner fragment `" + requiredFragment + "`.");
            }
        }
    }

    private void validateBlockingEntrypoint(
            String documentPath,
            ExpectedRow expectedRow,
            TableRow row,
            ViolationSink violations) {
        if (!expectedRow.requiresMechanicalOwner()) {
            return;
        }
        String actualEntrypoint = row.cell(4);
        for (String requiredEntrypoint : expectedRow.requiredEntrypoints()) {
            if (!actualEntrypoint.contains(requiredEntrypoint)) {
                violations.add(documentPath, COVERAGE_RULE,
                        "Coverage row for `" + expectedRow.ruleId()
                                + "` must name blocking entrypoint `" + requiredEntrypoint + "`.");
            }
        }
    }

    private static List<TableRow> tableRows(String content) {
        List<String> lines = List.of(content.split("\\R"));
        List<TableRow> rows = new java.util.ArrayList<>();
        for (String line : lines) {
            if (!line.startsWith("|") || line.contains("---")) {
                continue;
            }
            TableRow row = TableRow.from(line);
            if (row.cells().size() >= 5
                    && !row.cell(0).equals("Invariant ID")
                    && !row.cell(0).equals("Rule ID")) {
                rows.add(row);
            }
        }
        return rows;
    }

    private static Map<String, TableRow> rowsByRuleId(List<TableRow> rows) {
        Map<String, TableRow> result = new LinkedHashMap<>();
        for (TableRow row : rows) {
            result.put(unquoteCodeCell(row.cell(0)), row);
        }
        return result;
    }

    private static String unquoteCodeCell(String cell) {
        String stripped = cell.strip();
        if (stripped.startsWith("`") && stripped.endsWith("`") && stripped.length() >= 2) {
            return stripped.substring(1, stripped.length() - 1);
        }
        return stripped;
    }

    private static ExpectedRow row(
            String ruleId,
            String status,
            List<String> ownerFragments,
            List<String> entrypoints) {
        return new ExpectedRow(ruleId, status, ownerFragments, entrypoints);
    }

    private static ExpectedRow row(String ruleId, String status) {
        return new ExpectedRow(ruleId, status, List.of(), List.of());
    }

    private record ExpectedRow(
            String ruleId,
            String status,
            List<String> requiredOwnerFragments,
            List<String> requiredEntrypoints
    ) {
        private boolean requiresMechanicalOwner() {
            return !requiredOwnerFragments.isEmpty() || !requiredEntrypoints.isEmpty();
        }
    }

    private record TableRow(List<String> cells) {

        private String cell(int index) {
            return index < cells.size() ? cells.get(index).strip() : "";
        }

        private static TableRow from(String line) {
            String trimmed = line.strip();
            String body = trimmed.substring(1, trimmed.length() - 1);
            return new TableRow(List.of(body.split("\\|", -1)).stream()
                    .map(String::strip)
                    .toList());
        }
    }
}
