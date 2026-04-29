package saltmarcher.architecture.data;

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

    private static final String COVERAGE_PATH = "docs/project/architecture/enforcement/data-layer-enforcement.md";
    private static final List<String> REQUIRED_ENFORCED_DATA_RULES = List.of(
            "data-root-service-contribution-only",
            "data-feature-bucket-layout",
            "data-feature-composition-root-presence",
            "data-feature-schema-contract",
            "data-service-contribution-shape",
            "data-service-registry-root-only",
            "data-composition-no-source-mechanics",
            "data-port-adapter-no-source-mechanics",
            "data-mapper-no-source-mechanics",
            "data-query-read-only-source-shape",
            "data-schema-ddl-placement",
            "data-schema-table-name-owned-by-schema",
            "data-port-adapter-role-contract",
            "data-port-adapter-public-signature-boundary",
            "data-port-adapter-gateway-collaborator-boundary",
            "data-gateway-public-signature-boundary",
            "data-gateway-domain-independence",
            "data-model-source-shape",
            "data-outer-layer-independence",
            "data-non-root-shell-independence",
            "data-model-domain-independence",
            "data-service-contribution-construction-purity",
            "data-persistencecore-generic-only",
            "data-foreign-feature-public-boundary",
            "data-foreign-private-data-bucket-isolation",
            "data-feature-cycles",
            "data-enforcement-coverage-complete");
    private static final List<String> REQUIRED_DATA_RULE_GROUPS = List.of(
            "data-adapter-zone-purpose",
            "data-ports-domain-owned",
            "data-role-bucket-placement",
            "data-active-record-rejected",
            "data-source-mechanics-owned-by-gateway",
            "data-source-local-shapes-owned-by-model",
            "data-source-field-name-centralization",
            "data-single-write-model",
            "data-runtime-composition-root",
            "data-bootstrap-shell-no-source-wiring",
            "data-cross-feature-boundary",
            "data-service-contribution-thinness",
            "data-repository-write-model-role",
            "data-query-read-only-role",
            "data-gateway-internal-source-adapter",
            "data-model-schema-source-local",
            "data-mapper-translation-only",
            "data-persistencecore-generic-only-rule",
            "data-pattern-vocabulary-optional",
            "data-gateway-helper-co-location",
            "data-persistencecore-semantic-genericity",
            "data-forbidden-business-policy",
            "data-view-shell-private-data-access",
            "data-domain-no-source-mechanics",
            "data-source-adapter-no-public-capabilities",
            "data-duplicate-schema-truth");

    @Override
    public void check(ArchitectureContext context, ViolationSink violations) {
        Path coverageDocument = context.repoRoot().resolve(COVERAGE_PATH);
        if (!Files.isRegularFile(coverageDocument)) {
            violations.add(COVERAGE_PATH, "data-enforcement-coverage-complete",
                    "Data enforcement coverage must document every required enforced data-layer rule and rule group.");
            return;
        }

        String content;
        try {
            content = Files.readString(coverageDocument, StandardCharsets.UTF_8);
        } catch (IOException exception) {
            violations.add(COVERAGE_PATH, "file-readable",
                    "Could not read data enforcement coverage: " + exception.getMessage());
            return;
        }

        List<TableRow> enforcedRuleRows = tableRowsUnderHeading(content, "## Enforced Rule Matrix");
        List<TableRow> ruleGroupRows = tableRowsUnderHeading(content, "## Documented Data Rule Coverage Inventory");
        validateRequiredEnforcedRules(enforcedRuleRows, violations);
        validateRequiredRuleGroups(ruleGroupRows, violations);
    }

    private static void validateRequiredEnforcedRules(List<TableRow> rows, ViolationSink violations) {
        Map<String, TableRow> rowsByRuleId = rowsByFirstCell(rows);
        for (String ruleId : REQUIRED_ENFORCED_DATA_RULES) {
            TableRow row = rowsByRuleId.get(ruleId);
            if (row == null) {
                violations.add(COVERAGE_PATH, "data-enforcement-coverage-complete",
                        "Data enforcement coverage row for `" + ruleId
                                + "` must name a mechanical owner and blocking Gradle entrypoint.");
                continue;
            }
            if (!lineContainsMechanicalOwner(row.cell(1)) || !row.cell(2).contains("./gradlew")) {
                violations.add(COVERAGE_PATH, "data-enforcement-coverage-complete",
                        "Data enforcement coverage row for `" + ruleId
                                + "` must name a mechanical owner and blocking Gradle entrypoint in the enforced matrix.");
            }
        }
    }

    private static void validateRequiredRuleGroups(List<TableRow> rows, ViolationSink violations) {
        Map<String, TableRow> rowsByRuleGroup = rowsByFirstCell(rows);
        for (String ruleGroupId : REQUIRED_DATA_RULE_GROUPS) {
            TableRow row = rowsByRuleGroup.get(ruleGroupId);
            if (row == null) {
                violations.add(COVERAGE_PATH, "data-enforcement-coverage-complete",
                        "Data enforcement coverage must classify data-layer rule group `"
                                + ruleGroupId + "` as Enforced, Enforced Elsewhere, or Review-Owned.");
                continue;
            }
            if (!isAllowedRuleGroupStatus(row.cell(1))) {
                violations.add(COVERAGE_PATH, "data-enforcement-coverage-complete",
                        "Coverage row for data-layer rule group `" + ruleGroupId
                                + "` must use status Enforced, Enforced Elsewhere, or Review-Owned.");
            }
        }
    }

    private static List<TableRow> tableRowsUnderHeading(String content, String heading) {
        List<String> lines = List.of(content.split("\\R"));
        int headingIndex = -1;
        for (int index = 0; index < lines.size(); index++) {
            if (lines.get(index).strip().equals(heading)) {
                headingIndex = index;
                break;
            }
        }
        if (headingIndex < 0) {
            return List.of();
        }

        java.util.ArrayList<TableRow> rows = new java.util.ArrayList<>();
        for (int index = headingIndex + 1; index < lines.size(); index++) {
            String line = lines.get(index);
            if (line.startsWith("## ")) {
                break;
            }
            if (!line.startsWith("|")) {
                continue;
            }
            if (line.contains("---")) {
                continue;
            }
            TableRow row = TableRow.from(line);
            if (row.cells().size() >= 3 && !row.cell(0).equals("Rule ID") && !row.cell(0).equals("Data Rule Group")) {
                rows.add(row);
            }
        }
        return rows;
    }

    private static Map<String, TableRow> rowsByFirstCell(List<TableRow> rows) {
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

    private static boolean lineContainsMechanicalOwner(String line) {
        return line.contains("build-harness")
                || line.contains("PMD")
                || line.contains("Error Prone")
                || line.contains("ArchUnit")
                || line.contains("Gradle");
    }

    private static boolean isAllowedRuleGroupStatus(String cell) {
        String status = cell.strip();
        return status.equals("Enforced")
                || status.equals("Enforced Elsewhere")
                || status.equals("Review-Owned");
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
