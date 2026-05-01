package saltmarcher.architecture.documentation.datamapper;

import java.util.List;
import saltmarcher.architecture.ArchitectureContext;
import saltmarcher.architecture.ArchitectureRule;
import saltmarcher.architecture.ViolationSink;
import saltmarcher.architecture.documentation.support.MarkdownTableCoverageValidator;

public final class DataMapperEnforcementDocumentationRules implements ArchitectureRule {

    private static final String DOCUMENT_PATH =
            "docs/project/architecture/enforcement/data-mapper-enforcement.md";
    private static final String COVERAGE_RULE = "data-mapper-enforcement-coverage-complete";
    private static final List<MarkdownTableCoverageValidator.ExpectedRow> EXPECTED_ROWS = List.of(
            row("data-mapper-non-trivial-translation-ownership", "Review-Owned"),
            row("data-mapper-translation-surface-ownership", "Review-Owned"),
            row(
                    "data-mapper-no-source-mechanics",
                    "Source-Pattern Enforced",
                    List.of("data-mapper bundle PMD", "DataMapperSourceMechanicsRule"),
                    List.of("./gradlew checkDataMapperEnforcement")),
            row("data-mapper-no-business-rules-or-policy", "Review-Owned"),
            row("data-mapper-shape-translation-boundary", "Review-Owned"));

    @Override
    public void check(ArchitectureContext context, ViolationSink violations) {
        MarkdownTableCoverageValidator.validateDocument(
                context,
                DOCUMENT_PATH,
                COVERAGE_RULE,
                "Data mapper enforcement document must exist.",
                "Could not read data mapper enforcement document: ",
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
