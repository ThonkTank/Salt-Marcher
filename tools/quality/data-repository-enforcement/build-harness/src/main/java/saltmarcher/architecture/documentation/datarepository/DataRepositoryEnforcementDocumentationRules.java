package saltmarcher.architecture.documentation.datarepository;

import java.util.List;
import saltmarcher.architecture.ArchitectureContext;
import saltmarcher.architecture.ArchitectureRule;
import saltmarcher.architecture.ViolationSink;
import saltmarcher.architecture.documentation.support.MarkdownTableCoverageValidator;

public final class DataRepositoryEnforcementDocumentationRules implements ArchitectureRule {

    private static final String DOCUMENT_PATH =
            "docs/project/architecture/enforcement/data-repository-enforcement.md";
    private static final String COVERAGE_RULE = "data-repository-enforcement-coverage-complete";
    private static final List<MarkdownTableCoverageValidator.ExpectedRow> EXPECTED_ROWS = List.of(
            row(
                    "data-repository-role-contract",
                    "Enforced",
                    List.of("data-repository bundle Error Prone", "DataRepositoryRoleContract"),
                    List.of("./gradlew compileJava", "./gradlew checkDataRepositoryEnforcement")),
            row(
                    "data-repository-no-public-non-adapter-boundary-types",
                    "Enforced",
                    List.of("data-repository bundle Error Prone", "DataRepositoryRoleContract"),
                    List.of("./gradlew compileJava", "./gradlew checkDataRepositoryEnforcement")),
            row(
                    "data-repository-no-source-mechanics",
                    "Source-Pattern Enforced",
                    List.of("data-repository bundle PMD", "DataRepositorySourceMechanicsRule"),
                    List.of("./gradlew checkArchitecture", "./gradlew checkDataRepositoryEnforcement")),
            row("data-repository-write-model-role-semantics", "Review-Owned"),
            row(
                    "data-repository-public-port-surface-only",
                    "Enforced",
                    List.of("data-repository bundle Error Prone", "DataRepositoryRoleContract"),
                    List.of("./gradlew compileJava", "./gradlew checkDataRepositoryEnforcement")),
            row(
                    "data-repository-public-signature-boundary",
                    "Enforced",
                    List.of("data-repository bundle Error Prone", "DataRepositoryPublicSignatureBoundary"),
                    List.of("./gradlew compileJava", "./gradlew checkDataRepositoryEnforcement")),
            row(
                    "data-repository-gateway-collaborator-boundary",
                    "Enforced",
                    List.of("data-repository bundle Error Prone", "DataRepositoryGatewayCollaboratorBoundary"),
                    List.of("./gradlew compileJava", "./gradlew checkDataRepositoryEnforcement")));

    @Override
    public void check(ArchitectureContext context, ViolationSink violations) {
        MarkdownTableCoverageValidator.validateDocument(
                context,
                DOCUMENT_PATH,
                COVERAGE_RULE,
                "Data repository enforcement document must exist.",
                "Could not read data repository enforcement document: ",
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
