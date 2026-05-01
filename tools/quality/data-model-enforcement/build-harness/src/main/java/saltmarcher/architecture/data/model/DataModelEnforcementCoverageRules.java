package saltmarcher.architecture.data.model;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import saltmarcher.architecture.ArchitectureContext;
import saltmarcher.architecture.ArchitectureRule;
import saltmarcher.architecture.ViolationSink;

public final class DataModelEnforcementCoverageRules implements ArchitectureRule {

    private static final String COVERAGE_RULE = "data-model-enforcement-coverage-complete";
    private static final String DOCUMENT_PATH =
            "docs/project/architecture/enforcement/data-model-enforcement.md";
    private static final List<String> MECHANICAL_STATUSES = List.of(
            "Enforced",
            "Enforced Elsewhere",
            "Source-Pattern Enforced");
    private static final List<ExpectedRow> EXPECTED_ROWS = List.of(
            row("data-feature-schema-contract",
                    "Enforced",
                    List.of("data-model bundle build-harness", "DataModelTopologyRules"),
                    List.of("./gradlew checkArchitecture", "./gradlew checkDataModelEnforcement")),
            row("data-schema-ddl-placement",
                    "Source-Pattern Enforced",
                    List.of("data-model bundle PMD", "DataModelSchemaDdlPlacementRule"),
                    List.of("./gradlew checkArchitecture", "./gradlew checkDataModelEnforcement")),
            row("data-model-source-shape",
                    "Enforced",
                    List.of("data-model bundle Error Prone", "DataModelSourceShape"),
                    List.of("./gradlew compileJava", "./gradlew checkDataModelEnforcement")),
            row("data-model-domain-independence",
                    "Enforced",
                    List.of("data-model bundle ArchUnit", "DataModelArchitectureTest"),
                    List.of("./gradlew checkArchitecture", "./gradlew checkDataModelEnforcement")),
            row("data-model-source-local-not-renamed-domain-entities", "Review-Owned"),
            row("data-model-public-signature-boundary",
                    "Enforced",
                    List.of("data-model bundle Error Prone", "DataModelSourceShape"),
                    List.of("./gradlew compileJava", "./gradlew checkDataModelEnforcement")),
            row("data-schema-table-name-owned-by-schema",
                    "Enforced",
                    List.of("data-model bundle build-harness", "DataModelTopologyRules"),
                    List.of("./gradlew checkArchitecture", "./gradlew checkDataModelEnforcement")),
            row("data-model-field-name-centralization", "Review-Owned"));

    @Override
    public void check(ArchitectureContext context, ViolationSink violations) {
        Path document = context.repoRoot().resolve(DOCUMENT_PATH);
        if (!Files.isRegularFile(document)) {
            violations.add(DOCUMENT_PATH, COVERAGE_RULE,
                    "Data Model enforcement coverage document is missing.");
            return;
        }

        String content;
        try {
            content = Files.readString(document, StandardCharsets.UTF_8);
        } catch (IOException exception) {
            violations.add(DOCUMENT_PATH, "file-readable",
                    "Could not read Data Model enforcement coverage: " + exception.getMessage());
            return;
        }

        List<TableRow> rows = tableRows(content);
        Map<String, TableRow> rowsByRuleId = rowsByRuleId(rows);
        for (ExpectedRow expectedRow : EXPECTED_ROWS) {
            TableRow row = rowsByRuleId.get(expectedRow.ruleId());
            if (row == null) {
                violations.add(DOCUMENT_PATH, COVERAGE_RULE,
                        "Coverage row for `" + expectedRow.ruleId() + "` is missing.");
                continue;
            }
            validateStatus(expectedRow, row, violations);
            validateMechanicalOwner(expectedRow, row, violations);
            validateBlockingEntrypoint(expectedRow, row, violations);
        }
        validateNoUnexpectedRows(rowsByRuleId, violations);
    }

    private void validateStatus(ExpectedRow expectedRow, TableRow row, ViolationSink violations) {
        String actualStatus = row.cell(1);
        if (!expectedRow.status().equals(actualStatus)) {
            violations.add(DOCUMENT_PATH, COVERAGE_RULE,
                    "Coverage row for `" + expectedRow.ruleId() + "` must use status `"
                            + expectedRow.status() + "`, not `" + actualStatus + "`.");
            return;
        }
        if (expectedRow.requiresMechanicalOwner() && !MECHANICAL_STATUSES.contains(actualStatus)) {
            violations.add(DOCUMENT_PATH, COVERAGE_RULE,
                    "Coverage row for `" + expectedRow.ruleId()
                            + "` must use an enforced status when it names mechanical owners.");
        }
    }

    private void validateMechanicalOwner(ExpectedRow expectedRow, TableRow row, ViolationSink violations) {
        if (!expectedRow.requiresMechanicalOwner()) {
            return;
        }
        String actualOwner = row.cell(3);
        for (String requiredFragment : expectedRow.requiredOwnerFragments()) {
            if (!actualOwner.contains(requiredFragment)) {
                violations.add(DOCUMENT_PATH, COVERAGE_RULE,
                        "Coverage row for `" + expectedRow.ruleId()
                                + "` must name mechanical owner fragment `" + requiredFragment + "`.");
            }
        }
    }

    private void validateBlockingEntrypoint(ExpectedRow expectedRow, TableRow row, ViolationSink violations) {
        if (!expectedRow.requiresMechanicalOwner()) {
            return;
        }
        String actualEntrypoint = row.cell(4);
        for (String requiredEntrypoint : expectedRow.requiredEntrypoints()) {
            if (!actualEntrypoint.contains(requiredEntrypoint)) {
                violations.add(DOCUMENT_PATH, COVERAGE_RULE,
                        "Coverage row for `" + expectedRow.ruleId()
                                + "` must name blocking entrypoint `" + requiredEntrypoint + "`.");
            }
        }
    }

    private void validateNoUnexpectedRows(Map<String, TableRow> rowsByRuleId, ViolationSink violations) {
        Set<String> expectedRuleIds = new LinkedHashSet<>();
        for (ExpectedRow expectedRow : EXPECTED_ROWS) {
            expectedRuleIds.add(expectedRow.ruleId());
        }
        for (String actualRuleId : rowsByRuleId.keySet()) {
            if (!expectedRuleIds.contains(actualRuleId)) {
                violations.add(DOCUMENT_PATH, COVERAGE_RULE,
                        "Coverage row for `" + actualRuleId
                                + "` is not owned by this document and must be removed.");
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
            if (row.cells().size() >= 5 && !row.cell(0).equals("Invariant ID")) {
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
