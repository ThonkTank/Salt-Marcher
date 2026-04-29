package saltmarcher.architecture.domain;

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
                            row("domain-layer-no-outer-layer-or-infrastructure-dependencies",
                                    "Enforced",
                                    List.of("ArchUnit", "Error Prone"),
                                    List.of("./gradlew checkArchitecture", "./gradlew compileJava")),
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
                            row("domain-layer-tactical-role-direct-file-placement",
                                    "Enforced",
                                    List.of("build-harness"),
                                    List.of("./gradlew checkArchitecture")),
                            row("domain-layer-forbidden-top-level-domain-buckets",
                                    "Enforced",
                                    List.of("build-harness"),
                                    List.of("./gradlew checkArchitecture")),
                            row("domain-layer-mapcore-removed",
                                    "Enforced",
                                    List.of("build-harness"),
                                    List.of("./gradlew checkArchitecture")),
                            row("domain-layer-feature-cycle-freedom",
                                    "Enforced",
                                    List.of("ArchUnit"),
                                    List.of("./gradlew checkArchitecture")),
                            row("domain-layer-named-module-cycle-freedom",
                                    "Enforced",
                                    List.of("ArchUnit"),
                                    List.of("./gradlew checkArchitecture")),
                            row("domain-layer-technical-vocabulary-rejection",
                                    "Review-Owned"),
                            row("domain-layer-business-policy-not-in-view-or-data",
                                    "Review-Owned"))),
            Map.entry(
                    "docs/project/architecture/enforcement/domain-context-enforcement.md",
                    List.of(
                            row("domain-context-document-presence",
                                    "Enforced",
                                    List.of("build-harness"),
                                    List.of("./gradlew checkArchitecture")),
                            row("domain-context-name-marker",
                                    "Enforced",
                                    List.of("build-harness"),
                                    List.of("./gradlew checkArchitecture")),
                            row("domain-context-role-marker",
                                    "Enforced",
                                    List.of("build-harness"),
                                    List.of("./gradlew checkArchitecture")),
                            row("domain-context-base-sections",
                                    "Enforced",
                                    List.of("build-harness"),
                                    List.of("./gradlew checkArchitecture")),
                            row("domain-context-authored-truth-required-sections",
                                    "Enforced",
                                    List.of("build-harness"),
                                    List.of("./gradlew checkArchitecture")),
                            row("domain-context-authored-truth-write-model-required",
                                    "Enforced",
                                    List.of("build-harness"),
                                    List.of("./gradlew checkArchitecture")),
                            row("domain-context-aggregate-root-marker-shape",
                                    "Enforced",
                                    List.of("build-harness"),
                                    List.of("./gradlew checkArchitecture")),
                            row("domain-context-generation-policy-required-sections",
                                    "Enforced",
                                    List.of("build-harness"),
                                    List.of("./gradlew checkArchitecture")),
                            row("domain-context-generation-policy-write-model-none",
                                    "Enforced",
                                    List.of("build-harness"),
                                    List.of("./gradlew checkArchitecture")),
                            row("domain-context-generation-policy-ephemeral-rationale",
                                    "Enforced",
                                    List.of("build-harness"),
                                    List.of("./gradlew checkArchitecture")),
                            row("domain-context-standard-role-coverage",
                                    "Enforced",
                                    List.of("build-harness"),
                                    List.of("./gradlew checkArchitecture")),
                            row("domain-context-standard-relationship-coverage",
                                    "Enforced",
                                    List.of("build-harness", "ArchUnit"),
                                    List.of("./gradlew checkArchitecture")),
                            row("domain-context-relationship-prose-accuracy",
                                    "Review-Owned"),
                            row("domain-context-foreign-service-documentation",
                                    "Review-Owned"))),
            Map.entry(
                    "docs/project/architecture/enforcement/domain-application-service-enforcement.md",
                    List.of(
                            row("domain-applicationservice-root-presence",
                                    "Enforced",
                                    List.of("build-harness"),
                                    List.of("./gradlew checkArchitecture")),
                            row("domain-applicationservice-class-shape",
                                    "Enforced",
                                    List.of("Error Prone"),
                                    List.of("./gradlew compileJava")),
                            row("domain-applicationservice-public-api-carriers",
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
                            row("domain-applicationservice-service-registry-export-shape",
                                    "Enforced",
                                    List.of("Error Prone"),
                                    List.of("./gradlew compileJava")),
                            row("domain-applicationservice-public-boundary-signature-purity",
                                    "Enforced",
                                    List.of("Error Prone"),
                                    List.of("./gradlew compileJava")),
                            row("domain-applicationservice-no-outer-layer-or-infrastructure-signatures",
                                    "Enforced",
                                    List.of("Error Prone", "ArchUnit"),
                                    List.of("./gradlew compileJava", "./gradlew checkArchitecture")),
                            row("domain-applicationservice-no-direct-infrastructure-construction-source-pattern",
                                    "Source-Pattern Enforced",
                                    List.of("PMD"),
                                    List.of("./gradlew pmdArchitectureMain", "./gradlew checkArchitecture")),
                            row("domain-applicationservice-thin-boundary-coordination",
                                    "Review-Owned"),
                            row("domain-applicationservice-public-carrier-translation-quality",
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
                            row("domain-published-carrier-shape",
                                    "Enforced",
                                    List.of("Error Prone"),
                                    List.of("./gradlew compileJava")),
                            row("domain-published-no-callable-contracts",
                                    "Enforced",
                                    List.of("build-harness"),
                                    List.of("./gradlew checkArchitecture")),
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
                    tacticalRoleRows(
                            "domain-aggregate-role-shape",
                            "domain-aggregate-public-concrete-type-shape",
                            "domain-aggregate-field-purity",
                            "domain-aggregate-no-published-carriers",
                            "domain-aggregate-no-same-context-application-boundary",
                            "domain-aggregate-no-foreign-context-dependencies",
                            "domain-aggregate-no-outbound-port-dependencies",
                            "domain-aggregate-rich-consistency-boundary")),
            Map.entry(
                    "docs/project/architecture/enforcement/domain-entity-enforcement.md",
                    tacticalRoleRows(
                            "domain-entity-role-shape",
                            "domain-entity-public-concrete-type-shape",
                            "domain-entity-field-purity",
                            "domain-entity-no-published-carriers",
                            "domain-entity-no-same-context-application-boundary",
                            "domain-entity-no-foreign-context-dependencies",
                            "domain-entity-no-outbound-port-dependencies",
                            "domain-entity-business-identity-and-lifecycle-semantics")),
            Map.entry(
                    "docs/project/architecture/enforcement/domain-value-enforcement.md",
                    tacticalRoleRows(
                            "domain-value-role-shape",
                            "domain-value-public-concrete-type-shape",
                            "domain-value-field-purity",
                            "domain-value-no-published-carriers",
                            "domain-value-no-same-context-application-boundary",
                            "domain-value-no-foreign-context-dependencies",
                            "domain-value-no-outbound-port-dependencies",
                            "domain-value-semantic-immutability")),
            Map.entry(
                    "docs/project/architecture/enforcement/domain-policy-enforcement.md",
                    tacticalRoleRowsWithStatelessness(
                            "domain-policy-role-shape",
                            "domain-policy-public-concrete-type-shape",
                            "domain-policy-field-purity",
                            "domain-policy-no-published-carriers",
                            "domain-policy-no-same-context-application-boundary",
                            "domain-policy-no-foreign-context-dependencies",
                            "domain-policy-no-outbound-port-dependencies",
                            "domain-policy-real-policy-behavior")),
            Map.entry(
                    "docs/project/architecture/enforcement/domain-factory-enforcement.md",
                    tacticalRoleRowsWithStatelessness(
                            "domain-factory-role-shape",
                            "domain-factory-public-concrete-type-shape",
                            "domain-factory-field-purity",
                            "domain-factory-no-published-carriers",
                            "domain-factory-no-same-context-application-boundary",
                            "domain-factory-no-foreign-context-dependencies",
                            "domain-factory-no-outbound-port-dependencies",
                            "domain-factory-real-construction-boundary")),
            Map.entry(
                    "docs/project/architecture/enforcement/domain-service-enforcement.md",
                    tacticalRoleRowsWithStatelessness(
                            "domain-service-role-shape",
                            "domain-service-public-concrete-type-shape",
                            "domain-service-field-purity",
                            "domain-service-no-published-carriers",
                            "domain-service-no-same-context-application-boundary",
                            "domain-service-no-foreign-context-dependencies",
                            "domain-service-no-outbound-port-dependencies",
                            "domain-service-real-cross-concept-behavior")),
            Map.entry(
                    "docs/project/architecture/enforcement/domain-event-enforcement.md",
                    tacticalRoleRows(
                            "domain-event-role-shape",
                            "domain-event-public-concrete-type-shape",
                            "domain-event-field-purity",
                            "domain-event-no-published-carriers",
                            "domain-event-no-same-context-application-boundary",
                            "domain-event-no-foreign-context-dependencies",
                            "domain-event-no-outbound-port-dependencies",
                            "domain-event-domain-meaningfulness")),
            Map.entry(
                    "docs/project/architecture/enforcement/domain-specification-enforcement.md",
                    tacticalRoleRows(
                            "domain-specification-role-shape",
                            "domain-specification-public-concrete-type-shape",
                            "domain-specification-field-purity",
                            "domain-specification-no-published-carriers",
                            "domain-specification-no-same-context-application-boundary",
                            "domain-specification-no-foreign-context-dependencies",
                            "domain-specification-no-outbound-port-dependencies",
                            "domain-specification-real-domain-predicate-semantics")));

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
                    "Domain enforcement owner document is missing.");
            return;
        }

        String content;
        try {
            content = Files.readString(document, StandardCharsets.UTF_8);
        } catch (IOException exception) {
            violations.add(documentPath, "file-readable",
                    "Could not read domain enforcement owner document: " + exception.getMessage());
            return;
        }

        Map<String, TableRow> rowsById = rowsByInvariantId(content);
        for (ExpectedRow expectedRow : expectedRows) {
            TableRow actualRow = rowsById.get(expectedRow.invariantId());
            if (actualRow == null) {
                violations.add(documentPath, COVERAGE_RULE,
                        "Domain enforcement owner document must contain invariant row `"
                                + expectedRow.invariantId() + "` with status `" + expectedRow.status() + "`.");
                continue;
            }
            if (!expectedRow.status().equals(actualRow.status())) {
                violations.add(documentPath, COVERAGE_RULE,
                        "Invariant row `" + expectedRow.invariantId() + "` must use status `"
                                + expectedRow.status() + "`, not `" + actualRow.status() + "`.");
            }
            if (!MECHANICAL_STATUSES.contains(expectedRow.status())) {
                continue;
            }
            for (String ownerToken : expectedRow.ownerTokens()) {
                if (!actualRow.mechanicalOwner().contains(ownerToken)) {
                    violations.add(documentPath, COVERAGE_RULE,
                            "Invariant row `" + expectedRow.invariantId()
                                    + "` must name mechanical owner `" + ownerToken + "`.");
                }
            }
            for (String entrypointToken : expectedRow.entrypointTokens()) {
                if (!actualRow.blockingEntrypoint().contains(entrypointToken)) {
                    violations.add(documentPath, COVERAGE_RULE,
                            "Invariant row `" + expectedRow.invariantId()
                                    + "` must name blocking entrypoint `" + entrypointToken + "`.");
                }
            }
        }
    }

    private static List<ExpectedRow> tacticalRoleRows(
            String shapeId,
            String concreteShapeId,
            String fieldPurityId,
            String publishedId,
            String sameContextApplicationId,
            String foreignContextId,
            String outboundPortId,
            String reviewOwnedId) {
        return List.of(
                row(shapeId, "Enforced", List.of("Error Prone"), List.of("./gradlew compileJava")),
                row(concreteShapeId, "Enforced", List.of("Error Prone"), List.of("./gradlew compileJava")),
                row(fieldPurityId, "Enforced", List.of("Error Prone"), List.of("./gradlew compileJava")),
                row(publishedId, "Enforced", List.of("Error Prone"), List.of("./gradlew compileJava")),
                row(sameContextApplicationId, "Enforced", List.of("ArchUnit"), List.of("./gradlew checkArchitecture")),
                row(foreignContextId, "Enforced", List.of("ArchUnit"), List.of("./gradlew checkArchitecture")),
                row(outboundPortId, "Enforced", List.of("ArchUnit"), List.of("./gradlew checkArchitecture")),
                row(reviewOwnedId, "Review-Owned"));
    }

    private static List<ExpectedRow> tacticalRoleRowsWithStatelessness(
            String shapeId,
            String concreteShapeId,
            String fieldPurityId,
            String publishedId,
            String sameContextApplicationId,
            String foreignContextId,
            String outboundPortId,
            String reviewOwnedId) {
        return List.of(
                row(shapeId, "Enforced", List.of("Error Prone"), List.of("./gradlew compileJava")),
                row(concreteShapeId, "Enforced", List.of("Error Prone"), List.of("./gradlew compileJava")),
                row(fieldPurityId, "Enforced", List.of("Error Prone"), List.of("./gradlew compileJava")),
                row(shapeId.replace("-role-shape", "-statelessness"),
                        "Enforced",
                        List.of("Error Prone"),
                        List.of("./gradlew compileJava")),
                row(publishedId, "Enforced", List.of("Error Prone"), List.of("./gradlew compileJava")),
                row(sameContextApplicationId, "Enforced", List.of("ArchUnit"), List.of("./gradlew checkArchitecture")),
                row(foreignContextId, "Enforced", List.of("ArchUnit"), List.of("./gradlew checkArchitecture")),
                row(outboundPortId, "Enforced", List.of("ArchUnit"), List.of("./gradlew checkArchitecture")),
                row(reviewOwnedId, "Review-Owned"));
    }

    private static ExpectedRow row(
            String invariantId,
            String status) {
        return new ExpectedRow(invariantId, status, List.of(), List.of());
    }

    private static ExpectedRow row(
            String invariantId,
            String status,
            List<String> ownerTokens,
            List<String> entrypointTokens) {
        return new ExpectedRow(invariantId, status, ownerTokens, entrypointTokens);
    }

    private static Map<String, TableRow> rowsByInvariantId(String content) {
        Map<String, TableRow> result = new LinkedHashMap<>();
        for (String line : content.split("\\R")) {
            if (!line.startsWith("|") || line.contains("---")) {
                continue;
            }
            TableRow row = TableRow.from(line);
            if (row == null) {
                continue;
            }
            String invariantId = row.invariantId();
            if (invariantId.equals("Invariant ID") || invariantId.equals("Rule ID")) {
                continue;
            }
            result.put(invariantId, row);
        }
        return result;
    }

    private record ExpectedRow(
            String invariantId,
            String status,
            List<String> ownerTokens,
            List<String> entrypointTokens) {
    }

    private record TableRow(
            String invariantId,
            String status,
            String mechanicalOwner,
            String blockingEntrypoint) {

        private static TableRow from(String line) {
            String trimmed = line.strip();
            if (!trimmed.endsWith("|") || trimmed.length() < 2) {
                return null;
            }
            String body = trimmed.substring(1, trimmed.length() - 1);
            List<String> cells = List.of(body.split("\\|", -1)).stream()
                    .map(String::strip)
                    .toList();
            if (cells.size() < 5) {
                return null;
            }
            return new TableRow(unquoteCodeCell(cells.get(0)), cells.get(1), cells.get(3), cells.get(4));
        }

        private static String unquoteCodeCell(String cell) {
            if (cell.startsWith("`") && cell.endsWith("`") && cell.length() >= 2) {
                return cell.substring(1, cell.length() - 1);
            }
            return cell;
        }
    }
}
