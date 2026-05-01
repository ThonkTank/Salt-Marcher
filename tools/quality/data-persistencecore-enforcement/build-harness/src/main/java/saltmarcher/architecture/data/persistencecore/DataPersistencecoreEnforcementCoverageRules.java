package saltmarcher.architecture.data.persistencecore;

import java.util.List;
import saltmarcher.architecture.ArchitectureContext;
import saltmarcher.architecture.ArchitectureRule;
import saltmarcher.architecture.ViolationSink;
import saltmarcher.architecture.documentation.support.MarkdownTableCoverageValidator;

public final class DataPersistencecoreEnforcementCoverageRules implements ArchitectureRule {

    private static final String DOCUMENT_PATH =
            "docs/project/architecture/enforcement/data-persistencecore-enforcement.md";
    private static final String COVERAGE_RULE = "data-persistencecore-enforcement-coverage-complete";
    private static final List<MarkdownTableCoverageValidator.ExpectedRow> EXPECTED_ROWS = List.of(
            row("data-persistencecore-model-generic-schema-helper-semantics", "Review-Owned"),
            row("data-persistencecore-sqlite-generic-infrastructure-semantics", "Review-Owned"),
            row(
                    "data-persistencecore-no-feature-specific-data-dependencies",
                    "Enforced",
                    List.of(
                            "data-persistencecore bundle ArchUnit",
                            "persistencecoreMustStayIndependentFromFeatureSpecificDataPackages"),
                    List.of(
                            "./gradlew checkArchitecture",
                            "./gradlew checkDataPersistencecoreEnforcement")),
            row(
                    "data-persistencecore-no-domain-dependencies",
                    "Enforced",
                    List.of(
                            "data-persistencecore bundle ArchUnit",
                            "persistencecoreMustNotDependOnDomainTypes"),
                    List.of(
                            "./gradlew checkArchitecture",
                            "./gradlew checkDataPersistencecoreEnforcement")),
            row("data-persistencecore-model-data-internal-consumer-boundary", "Review-Owned"),
            row("data-persistencecore-sqlite-data-internal-consumer-boundary", "Review-Owned"));

    @Override
    public void check(ArchitectureContext context, ViolationSink violations) {
        MarkdownTableCoverageValidator.validateDocument(
                context,
                DOCUMENT_PATH,
                COVERAGE_RULE,
                "Data Persistencecore enforcement document is missing.",
                "Could not read data persistencecore enforcement document: ",
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
