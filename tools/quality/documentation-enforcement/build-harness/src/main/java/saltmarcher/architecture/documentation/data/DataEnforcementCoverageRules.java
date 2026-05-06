package saltmarcher.architecture.documentation.data;

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

public final class DataEnforcementCoverageRules implements ArchitectureRule {

    private static final String COVERAGE_RULE = "data-enforcement-coverage-complete";
    private static final List<String> MECHANICAL_STATUSES = List.of(
            "Enforced",
            "Enforced Elsewhere",
            "Source-Pattern Enforced");
    private static final Map<String, List<ExpectedRow>> EXPECTED_ROWS_BY_DOCUMENT = Map.ofEntries(
            Map.entry(
                    "docs/project/architecture/enforcement/data-layer-enforcement.md",
                    List.of(
                            row("data-root-service-contribution-only", "Enforced",
                                    List.of("build-harness", "PMD"),
                                    List.of("./gradlew checkArchitecture")),
                            row("data-feature-bucket-layout", "Enforced",
                                    List.of("build-harness"),
                                    List.of("./gradlew checkArchitecture")),
                            row("data-feature-composition-root-presence", "Enforced",
                                    List.of("build-harness"),
                                    List.of("./gradlew checkArchitecture")),
                            row("data-layer-adapter-zone-ownership", "Review-Owned"),
                            row("data-outer-layer-independence", "Enforced",
                                    List.of("ArchUnit"),
                                    List.of("./gradlew checkArchitecture")),
                            row("data-non-root-shell-independence", "Enforced",
                                    List.of("ArchUnit"),
                                    List.of("./gradlew checkArchitecture")),
                            row("data-foreign-feature-public-boundary", "Enforced",
                                    List.of("ArchUnit"),
                                    List.of("./gradlew checkArchitecture")),
                            row("data-foreign-private-data-bucket-isolation", "Enforced",
                                    List.of("ArchUnit"),
                                    List.of("./gradlew checkArchitecture")),
                            row("data-feature-cycles", "Enforced",
                                    List.of("ArchUnit"),
                                    List.of("./gradlew checkArchitecture")),
                            row("data-layer-no-business-policy-or-second-model", "Review-Owned"),
                            row("data-layer-no-public-backend-boundary", "Review-Owned"),
                            row("data-service-registry-root-only", "Enforced",
                                    List.of("Error Prone", "build-harness", "PMD"),
                                    List.of("./gradlew compileJava", "./gradlew checkArchitecture")),
                            row("data-layer-shell-runtime-seam-only-through-root-service-registration",
                                    "Enforced Elsewhere",
                                    List.of(
                                            "data-service-registry-root-only",
                                            "data-service-contribution-shell-runtime-seam-subset",
                                            "data-non-root-shell-independence"),
                                    List.of("./gradlew compileJava", "./gradlew checkArchitecture")),
                            row("data-layer-domain-source-dependencies-only-through-own-feature-ports-and-foreign-public-boundaries",
                                    "Enforced Elsewhere",
                                    List.of(
                                            "data-service-contribution-register-export-shape",
                                            "data-repository-role-contract",
                                            "data-query-role-contract",
                                            "data-gateway-domain-independence",
                                            "data-foreign-feature-public-boundary"),
                                    List.of(
                                            "./gradlew compileJava",
                                            "./gradlew checkArchitecture",
                                            "./gradlew checkDataGatewayEnforcement")),
                            row("data-layer-root-runtime-export-surface-only", "Review-Owned"))),
            Map.entry(
                    "docs/project/architecture/enforcement/data-service-contribution-enforcement.md",
                    List.of(
                            row("data-service-contribution-discovery-entrypoint-shape", "Enforced",
                                    List.of("PMD"),
                                    List.of("./gradlew checkArchitecture")),
                            row("data-service-contribution-stateless-public-surface", "Enforced",
                                    List.of("PMD"),
                                    List.of("./gradlew checkArchitecture")),
                            row("data-service-contribution-no-source-mechanics", "Source-Pattern Enforced",
                                    List.of("PMD"),
                                    List.of("./gradlew checkArchitecture")),
                            row("data-service-contribution-construction-purity", "Enforced",
                                    List.of("Error Prone"),
                                    List.of("./gradlew compileJava")),
                            row("data-service-contribution-no-hidden-business-or-runtime-workflow",
                                    "Review-Owned"),
                            row("data-service-contribution-shell-runtime-seam-subset", "Enforced",
                                    List.of("Error Prone"),
                                    List.of("./gradlew compileJava")),
                            row("data-service-contribution-register-export-shape", "Enforced",
                                    List.of("Error Prone", "PMD"),
                                    List.of("./gradlew compileJava", "./gradlew checkArchitecture")),
                            row("data-service-contribution-factory-export-shape",
                                    "Enforced",
                                    List.of("Error Prone"),
                                    List.of("./gradlew compileJava")),
                            row("data-service-contribution-composition-collaborator-assembly-only",
                                    "Review-Owned"))),
            Map.entry(
                    "docs/project/architecture/enforcement/data-repository-enforcement.md",
                    List.of(
                            row("data-repository-role-contract", "Enforced",
                                    List.of("Error Prone"),
                                    List.of("./gradlew compileJava")),
                            row("data-repository-no-public-non-adapter-boundary-types", "Enforced",
                                    List.of("Error Prone"),
                                    List.of("./gradlew compileJava")),
                            row("data-repository-no-source-mechanics", "Source-Pattern Enforced",
                                    List.of("PMD"),
                                    List.of("./gradlew checkArchitecture")),
                            row("data-repository-write-model-role-semantics", "Review-Owned"),
                            row("data-repository-public-port-surface-only", "Enforced",
                                    List.of("Error Prone"),
                                    List.of("./gradlew compileJava")),
                            row("data-repository-public-signature-boundary", "Enforced",
                                    List.of("Error Prone"),
                                    List.of("./gradlew compileJava")),
                            row("data-repository-gateway-collaborator-boundary", "Enforced",
                                    List.of("Error Prone"),
                                    List.of("./gradlew compileJava")))),
            Map.entry(
                    "docs/project/architecture/enforcement/data-query-enforcement.md",
                    List.of(
                            row("data-query-separate-read-adapter-necessity", "Review-Owned"),
                            row("data-query-role-contract", "Enforced",
                                    List.of("Error Prone"),
                                    List.of("./gradlew compileJava")),
                            row("data-query-no-source-mechanics", "Source-Pattern Enforced",
                                    List.of("PMD"),
                                    List.of("./gradlew checkArchitecture")),
                            row("data-query-no-public-non-adapter-boundary-types", "Enforced",
                                    List.of("Error Prone"),
                                    List.of("./gradlew compileJava")),
                            row("data-query-read-only-source-shape", "Enforced",
                                    List.of("PMD", "Error Prone"),
                                    List.of("./gradlew checkArchitecture", "./gradlew compileJava")),
                            row("data-query-read-only-role-semantics", "Review-Owned"),
                            row("data-query-public-port-surface-only", "Enforced",
                                    List.of("Error Prone"),
                                    List.of("./gradlew compileJava")),
                            row("data-query-public-signature-boundary", "Enforced",
                                    List.of("Error Prone"),
                                    List.of("./gradlew compileJava")),
                            row("data-query-gateway-collaborator-boundary", "Enforced",
                                    List.of("Error Prone"),
                                    List.of("./gradlew compileJava")))),
            Map.entry(
                    "docs/project/architecture/enforcement/data-mapper-enforcement.md",
                    List.of(
                            row("data-mapper-non-trivial-translation-ownership",
                                    "Review-Owned"),
                            row("data-mapper-translation-surface-ownership",
                                    "Review-Owned"),
                            row("data-mapper-no-source-mechanics", "Source-Pattern Enforced",
                                    List.of("PMD"),
                                    List.of("./gradlew checkArchitecture")),
                            row("data-mapper-no-business-rules-or-policy",
                                    "Review-Owned"),
                            row("data-mapper-shape-translation-boundary",
                                    "Review-Owned"))),
            Map.entry(
                    "docs/project/architecture/enforcement/data-persistencecore-enforcement.md",
                    List.of(
                            row("data-persistencecore-model-generic-schema-helper-semantics",
                                    "Review-Owned"),
                            row("data-persistencecore-sqlite-generic-infrastructure-semantics",
                                    "Review-Owned"),
                            row("data-persistencecore-no-feature-specific-data-dependencies", "Enforced",
                                    List.of("ArchUnit"),
                                    List.of("./gradlew checkArchitecture")),
                            row("data-persistencecore-no-domain-dependencies", "Enforced",
                                    List.of("ArchUnit"),
                                    List.of("./gradlew checkArchitecture")),
                            row("data-persistencecore-model-data-internal-consumer-boundary",
                                    "Review-Owned"),
                            row("data-persistencecore-sqlite-data-internal-consumer-boundary",
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
                    "Data enforcement coverage document is missing.");
            return;
        }

        String content;
        try {
            content = Files.readString(document, StandardCharsets.UTF_8);
        } catch (IOException exception) {
            violations.add(documentPath, "file-readable",
                    "Could not read data enforcement coverage: " + exception.getMessage());
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
