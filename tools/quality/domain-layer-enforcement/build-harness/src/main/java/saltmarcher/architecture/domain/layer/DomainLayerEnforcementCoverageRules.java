package saltmarcher.architecture.domain.layer;

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

public final class DomainLayerEnforcementCoverageRules implements ArchitectureRule {

    private static final String COVERAGE_RULE = "domain-enforcement-coverage-complete";
    private static final String DOCUMENT_PATH =
            "docs/project/architecture/enforcement/domain-layer-enforcement.md";
    private static final List<String> MECHANICAL_STATUSES = List.of(
            "Enforced",
            "Enforced Elsewhere",
            "Source-Pattern Enforced");
    private static final List<ExpectedRow> EXPECTED_ROWS = List.of(
            row("domain-layer-context-root-boundary-and-module-topology",
                    "Enforced Elsewhere",
                    List.of(
                            "domain-applicationservice-root-presence",
                            "domain-usecase-direct-file-placement",
                            "domain-layer-forbidden-top-level-domain-buckets"),
                    List.of(
                            "./gradlew checkArchitecture",
                            "./gradlew checkDomainApplicationServiceEnforcement",
                            "./gradlew checkDomainLayerEnforcement",
                            "./gradlew checkDocumentationEnforcement")),
            row("domain-layer-named-module-role-subpackage-required",
                    "Enforced",
                    List.of("domain-layer bundle build-harness", "DomainLayerTopologyRules"),
                    List.of("./gradlew checkArchitecture", "./gradlew checkDomainLayerEnforcement")),
            row("domain-layer-tactical-role-package-name-allowlist",
                    "Enforced",
                    List.of("domain-layer bundle build-harness", "DomainLayerTopologyRules"),
                    List.of("./gradlew checkArchitecture", "./gradlew checkDomainLayerEnforcement")),
            row("domain-layer-forbidden-top-level-domain-buckets",
                    "Enforced",
                    List.of("domain-layer bundle build-harness", "DomainLayerTopologyRules"),
                    List.of("./gradlew checkArchitecture", "./gradlew checkDomainLayerEnforcement")),
            row("domain-layer-no-published-carrier-dependencies-inside-named-modules",
                    "Enforced",
                    List.of("domain-layer bundle Error Prone", "DomainModuleNoPublishedCarrierDependency"),
                    List.of("./gradlew compileJava", "./gradlew checkDomainLayerEnforcement")),
            row("domain-layer-public-boundary-families-only",
                    "Enforced Elsewhere",
                    List.of(
                            "domain-applicationservice-root-presence",
                            "domain-applicationservice-public-input-carriers",
                            "domain-applicationservice-query-returns-read-model-handle",
                            "domain-applicationservice-command-no-direct-return",
                            "domain-published-direct-file-placement",
                            "domain-published-carrier-shape",
                            "domain-published-read-model-handle-shape",
                            "domain-port-role-shape",
                            "domain-port-ownership-and-signature-boundary"),
                    List.of(
                            "./gradlew compileJava",
                            "./gradlew checkArchitecture",
                            "./gradlew checkDomainApplicationServiceEnforcement",
                            "./gradlew checkDocumentationEnforcement")),
            row("domain-layer-no-outer-layer-or-infrastructure-dependencies",
                    "Enforced",
                    List.of(
                            "domain-layer bundle ArchUnit", "domainMustStayIndependentFromOuterLayers",
                            "domain-layer bundle Error Prone", "DomainForbiddenInfrastructureDependency"),
                    List.of("./gradlew compileJava", "./gradlew checkArchitecture", "./gradlew checkDomainLayerEnforcement")),
            row("domain-layer-foreign-context-access-only-through-public-boundaries",
                    "Enforced",
                    List.of("domain-layer bundle ArchUnit", "domainFeaturesMustOnlyUseForeignFeatureApis"),
                    List.of("./gradlew checkArchitecture", "./gradlew checkDomainLayerEnforcement")),
            row("domain-layer-named-module-no-same-context-application-boundary-dependencies",
                    "Enforced",
                    List.of("domain-layer bundle ArchUnit", "domainNamedModulesMustNotReachSameContextApplicationBoundary"),
                    List.of("./gradlew checkArchitecture", "./gradlew checkDomainLayerEnforcement")),
            row("domain-layer-named-module-no-foreign-context-dependencies",
                    "Enforced",
                    List.of("domain-layer bundle ArchUnit", "domainNamedModulesMustNotReachForeignDomainContexts"),
                    List.of("./gradlew checkArchitecture", "./gradlew checkDomainLayerEnforcement")),
            row("domain-layer-model-role-no-outbound-port-dependencies",
                    "Enforced",
                    List.of("domain-layer bundle ArchUnit", "domainModelRolesMustNotDependOnOutboundPorts"),
                    List.of("./gradlew checkArchitecture", "./gradlew checkDomainLayerEnforcement")),
            row("domain-layer-core-business-ownership", "Review-Owned"),
            row("domain-layer-no-ui-translation-or-runtime-composition-ownership", "Review-Owned"),
            row("domain-layer-application-orchestration-only-outbound-calls", "Review-Owned"),
            row("domain-layer-optional-role-package-necessity", "Review-Owned"),
            row("domain-layer-technical-vocabulary-rejection", "Review-Owned"));

    @Override
    public void check(ArchitectureContext context, ViolationSink violations) {
        Path document = context.repoRoot().resolve(DOCUMENT_PATH);
        if (!Files.isRegularFile(document)) {
            violations.add(DOCUMENT_PATH, COVERAGE_RULE,
                    "Domain Layer enforcement coverage document is missing.");
            return;
        }

        String content;
        try {
            content = Files.readString(document, StandardCharsets.UTF_8);
        } catch (IOException exception) {
            violations.add(DOCUMENT_PATH, "file-readable",
                    "Could not read Domain Layer enforcement coverage: " + exception.getMessage());
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
