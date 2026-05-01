package saltmarcher.architecture.documentation.domainaggregate;

import java.util.List;
import saltmarcher.architecture.ArchitectureContext;
import saltmarcher.architecture.ArchitectureRule;
import saltmarcher.architecture.ViolationSink;
import saltmarcher.architecture.documentation.support.MarkdownTableCoverageValidator;

public final class DomainAggregateEnforcementDocumentationRules implements ArchitectureRule {

    private static final String DOCUMENT_PATH =
            "docs/project/architecture/enforcement/domain-aggregate-enforcement.md";
    private static final String COVERAGE_RULE = "domain-aggregate-enforcement-coverage-complete";
    private static final List<MarkdownTableCoverageValidator.ExpectedRow> EXPECTED_ROWS = List.of(
            row(
                    "domain-aggregate-role-shape",
                    "Enforced",
                    List.of("domain-aggregate bundle Error Prone", "DomainAggregateRoleShape"),
                    List.of("./gradlew compileJava", "./gradlew checkDomainAggregateEnforcement")),
            row("domain-aggregate-rich-consistency-boundary", "Review-Owned"));

    @Override
    public void check(ArchitectureContext context, ViolationSink violations) {
        MarkdownTableCoverageValidator.validateDocument(
                context,
                DOCUMENT_PATH,
                COVERAGE_RULE,
                "Domain aggregate enforcement document must exist.",
                "Could not read domain aggregate enforcement document: ",
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
