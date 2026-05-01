package saltmarcher.architecture.documentation.datagateway;

import java.util.List;
import saltmarcher.architecture.ArchitectureContext;
import saltmarcher.architecture.ArchitectureRule;
import saltmarcher.architecture.ViolationSink;
import saltmarcher.architecture.documentation.support.MarkdownTableCoverageValidator;

public final class DataGatewayEnforcementDocumentationRules implements ArchitectureRule {

    private static final String DOCUMENT_PATH =
            "docs/project/architecture/enforcement/data-gateway-enforcement.md";
    private static final String COVERAGE_RULE = "data-gateway-enforcement-coverage-complete";
    private static final List<MarkdownTableCoverageValidator.ExpectedRow> EXPECTED_ROWS = List.of(
            row("data-gateway-source-adapter-mechanics-ownership", "Review-Owned"),
            row(
                    "data-gateway-no-generic-infrastructure-business-policy-or-runtime-composition",
                    "Review-Owned"),
            row(
                    "data-gateway-domain-independence",
                    "Enforced",
                    List.of("data-gateway bundle ArchUnit", "DataGatewayArchitectureTest"),
                    List.of("./gradlew checkArchitecture", "./gradlew checkDataGatewayEnforcement")),
            row(
                    "data-gateway-public-signature-boundary",
                    "Enforced",
                    List.of("data-gateway bundle Error Prone", "DataGatewayReturnTypeBoundary"),
                    List.of("./gradlew compileJava", "./gradlew checkDataGatewayEnforcement")),
            row("data-gateway-internal-data-collaborator-boundary", "Review-Owned"));

    @Override
    public void check(ArchitectureContext context, ViolationSink violations) {
        MarkdownTableCoverageValidator.validateDocument(
                context,
                DOCUMENT_PATH,
                COVERAGE_RULE,
                "Data gateway enforcement document must exist.",
                "Could not read data gateway enforcement document: ",
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
