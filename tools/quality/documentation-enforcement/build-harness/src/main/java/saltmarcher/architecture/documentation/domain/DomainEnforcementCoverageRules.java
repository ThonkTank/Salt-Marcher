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
                    "docs/project/architecture/enforcement/domain-specification-enforcement.md",
                    List.of(
                            row("domain-specification-role-shape", "Enforced",
                                    List.of("Error Prone"),
                                    List.of("./gradlew compileJava",
                                            "./gradlew checkDomainSpecificationEnforcement")),
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
        if (!documentPath.equals("docs/project/architecture/enforcement/domain-specification-enforcement.md")) {
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
