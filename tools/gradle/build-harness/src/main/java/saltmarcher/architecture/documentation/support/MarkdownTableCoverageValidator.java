package saltmarcher.architecture.documentation.support;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import saltmarcher.architecture.ArchitectureContext;
import saltmarcher.architecture.ViolationSink;

public final class MarkdownTableCoverageValidator {

    private static final List<String> MECHANICAL_STATUSES = List.of(
            "Enforced",
            "Enforced Elsewhere",
            "Source-Pattern Enforced");

    private MarkdownTableCoverageValidator() {
    }

    public static void validateDocument(
            ArchitectureContext context,
            String documentPath,
            String coverageRule,
            String missingDocumentMessage,
            String unreadableMessagePrefix,
            List<ExpectedRow> expectedRows,
            boolean exactOwner,
            ViolationSink violations) {
        Path document = context.repoRoot().resolve(documentPath);
        if (!Files.isRegularFile(document)) {
            violations.add(documentPath, coverageRule, missingDocumentMessage);
            return;
        }

        String content;
        try {
            content = Files.readString(document, StandardCharsets.UTF_8);
        } catch (IOException exception) {
            violations.add(documentPath, "file-readable", unreadableMessagePrefix + exception.getMessage());
            return;
        }

        Map<String, TableRow> rowsByRuleId = rowsByRuleId(tableRows(content));
        for (ExpectedRow expectedRow : expectedRows) {
            TableRow row = rowsByRuleId.get(expectedRow.ruleId());
            if (row == null) {
                violations.add(documentPath, coverageRule,
                        "Coverage row for `" + expectedRow.ruleId() + "` is missing.");
                continue;
            }
            validateStatus(documentPath, coverageRule, expectedRow, row, violations);
            validateMechanicalOwner(documentPath, coverageRule, expectedRow, row, violations);
            validateBlockingEntrypoint(documentPath, coverageRule, expectedRow, row, violations);
        }
        if (exactOwner) {
            validateNoUnexpectedRows(documentPath, coverageRule, expectedRows, rowsByRuleId, violations);
        }
    }

    public static ExpectedRow row(
            String ruleId,
            String status,
            List<String> ownerFragments,
            List<String> entrypoints) {
        return new ExpectedRow(ruleId, status, ownerFragments, entrypoints);
    }

    public static ExpectedRow row(String ruleId, String status) {
        return new ExpectedRow(ruleId, status, List.of(), List.of());
    }

    private static void validateNoUnexpectedRows(
            String documentPath,
            String coverageRule,
            List<ExpectedRow> expectedRows,
            Map<String, TableRow> rowsByRuleId,
            ViolationSink violations) {
        java.util.Set<String> expectedRuleIds = new java.util.LinkedHashSet<>();
        for (ExpectedRow expectedRow : expectedRows) {
            expectedRuleIds.add(expectedRow.ruleId());
        }
        for (String actualRuleId : rowsByRuleId.keySet()) {
            if (!expectedRuleIds.contains(actualRuleId)) {
                violations.add(documentPath, coverageRule,
                        "Coverage row for `" + actualRuleId
                                + "` is not owned by this document and must be removed.");
            }
        }
    }

    private static void validateStatus(
            String documentPath,
            String coverageRule,
            ExpectedRow expectedRow,
            TableRow row,
            ViolationSink violations) {
        String actualStatus = row.cell(1);
        if (!expectedRow.status().equals(actualStatus)) {
            violations.add(documentPath, coverageRule,
                    "Coverage row for `" + expectedRow.ruleId() + "` must use status `"
                            + expectedRow.status() + "`, not `" + actualStatus + "`.");
            return;
        }
        if (expectedRow.requiresMechanicalOwner() && !MECHANICAL_STATUSES.contains(actualStatus)) {
            violations.add(documentPath, coverageRule,
                    "Coverage row for `" + expectedRow.ruleId()
                            + "` must use an enforced status when it names mechanical owners.");
        }
    }

    private static void validateMechanicalOwner(
            String documentPath,
            String coverageRule,
            ExpectedRow expectedRow,
            TableRow row,
            ViolationSink violations) {
        if (!expectedRow.requiresMechanicalOwner()) {
            return;
        }
        String actualOwner = row.cell(3);
        for (String requiredFragment : expectedRow.requiredOwnerFragments()) {
            if (!actualOwner.contains(requiredFragment)) {
                violations.add(documentPath, coverageRule,
                        "Coverage row for `" + expectedRow.ruleId()
                                + "` must name mechanical owner fragment `" + requiredFragment + "`.");
            }
        }
    }

    private static void validateBlockingEntrypoint(
            String documentPath,
            String coverageRule,
            ExpectedRow expectedRow,
            TableRow row,
            ViolationSink violations) {
        if (!expectedRow.requiresMechanicalOwner()) {
            return;
        }
        String actualEntrypoint = row.cell(4);
        for (String requiredEntrypoint : expectedRow.requiredEntrypoints()) {
            if (!actualEntrypoint.contains(requiredEntrypoint)) {
                violations.add(documentPath, coverageRule,
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

    public record ExpectedRow(
            String ruleId,
            String status,
            List<String> requiredOwnerFragments,
            List<String> requiredEntrypoints
    ) {
        public boolean requiresMechanicalOwner() {
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
