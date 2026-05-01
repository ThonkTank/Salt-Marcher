package saltmarcher.architecture.documentation.dataquery;

import java.util.List;
import saltmarcher.architecture.ArchitectureContext;
import saltmarcher.architecture.ArchitectureRule;
import saltmarcher.architecture.ViolationSink;
import saltmarcher.architecture.documentation.support.MarkdownTableCoverageValidator;

public final class DataQueryEnforcementDocumentationRules implements ArchitectureRule {

    private static final String DOCUMENT_PATH =
            "docs/project/architecture/enforcement/data-query-enforcement.md";
    private static final String COVERAGE_RULE = "data-query-enforcement-coverage-complete";
    private static final List<MarkdownTableCoverageValidator.ExpectedRow> EXPECTED_ROWS = List.of(
            row("data-query-separate-read-adapter-necessity", "Review-Owned"),
            row(
                    "data-query-role-contract",
                    "Enforced",
                    List.of("data-query bundle Error Prone", "DataQueryRoleContract"),
                    List.of("./gradlew compileJava", "./gradlew checkDataQueryEnforcement")),
            row(
                    "data-query-no-source-mechanics",
                    "Source-Pattern Enforced",
                    List.of("data-query bundle PMD", "DataQueryNoSourceMechanicsRule"),
                    List.of("./gradlew checkArchitecture", "./gradlew checkDataQueryEnforcement")),
            row(
                    "data-query-no-public-non-adapter-boundary-types",
                    "Enforced",
                    List.of("data-query bundle Error Prone", "DataQueryRoleContract"),
                    List.of("./gradlew compileJava", "./gradlew checkDataQueryEnforcement")),
            row(
                    "data-query-read-only-source-shape",
                    "Enforced",
                    List.of(
                            "data-query bundle PMD",
                            "DataQueryReadOnlySourceShapeRule",
                            "data-query bundle Error Prone",
                            "DataQueryGatewayMutationBoundary"),
                    List.of(
                            "./gradlew compileJava",
                            "./gradlew checkArchitecture",
                            "./gradlew checkDataQueryEnforcement")),
            row("data-query-read-only-role-semantics", "Review-Owned"),
            row(
                    "data-query-public-port-surface-only",
                    "Enforced",
                    List.of("data-query bundle Error Prone", "DataQueryRoleContract"),
                    List.of("./gradlew compileJava", "./gradlew checkDataQueryEnforcement")),
            row(
                    "data-query-public-signature-boundary",
                    "Enforced",
                    List.of("data-query bundle Error Prone", "DataQueryPublicSignatureBoundary"),
                    List.of("./gradlew compileJava", "./gradlew checkDataQueryEnforcement")),
            row(
                    "data-query-gateway-collaborator-boundary",
                    "Enforced",
                    List.of("data-query bundle Error Prone", "DataQueryGatewayCollaboratorBoundary"),
                    List.of("./gradlew compileJava", "./gradlew checkDataQueryEnforcement")));

    @Override
    public void check(ArchitectureContext context, ViolationSink violations) {
        MarkdownTableCoverageValidator.validateDocument(
                context,
                DOCUMENT_PATH,
                COVERAGE_RULE,
                "Data query enforcement document must exist.",
                "Could not read data query enforcement document: ",
                EXPECTED_ROWS,
                true,
                violations);
    }

    private static MarkdownTableCoverageValidator.ExpectedRow row(
            String ruleId,
            String status,
            List<String> ownerFragments,
            List<String> entrypoints) {
        return MarkdownTableCoverageValidator.row(ruleId, status, ownerFragments, entrypoints);
    }

    private static MarkdownTableCoverageValidator.ExpectedRow row(String ruleId, String status) {
        return MarkdownTableCoverageValidator.row(ruleId, status);
    }
}
