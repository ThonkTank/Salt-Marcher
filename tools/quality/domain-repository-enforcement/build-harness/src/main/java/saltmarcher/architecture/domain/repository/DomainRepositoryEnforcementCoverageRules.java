package saltmarcher.architecture.domain.repository;

import java.util.List;
import saltmarcher.architecture.ArchitectureContext;
import saltmarcher.architecture.ArchitectureRule;
import saltmarcher.architecture.ViolationSink;
import saltmarcher.architecture.documentation.support.MarkdownTableCoverageValidator;

public final class DomainRepositoryEnforcementCoverageRules implements ArchitectureRule {

    private static final String DOCUMENT_PATH =
            "docs/project/architecture/enforcement/domain-repository-enforcement.md";
    private static final String COVERAGE_RULE = "domain-repository-enforcement-coverage-complete";
    private static final List<MarkdownTableCoverageValidator.ExpectedRow> EXPECTED_ROWS = List.of(
            row(
                    "domain-repository-direct-file-placement",
                    "Enforced",
                    List.of("domain-repository bundle build-harness", "DomainRepositoryTopologyRules"),
                    List.of("./gradlew checkDomainRepositoryEnforcement")),
            row(
                    "domain-repository-role-shape",
                    "Enforced",
                    List.of("domain-repository bundle build-harness", "DomainRepositoryTopologyRules"),
                    List.of("./gradlew checkDomainRepositoryEnforcement")),
            row("domain-repository-outbound-trigger-ownership", "Review-Owned"),
            row("domain-repository-no-src-data-type-leaks", "Review-Owned"),
            row("domain-repository-foreign-applicationservice-routing-only", "Review-Owned"));

    @Override
    public void check(ArchitectureContext context, ViolationSink violations) {
        MarkdownTableCoverageValidator.validateDocument(
                context,
                DOCUMENT_PATH,
                COVERAGE_RULE,
                "Domain repository enforcement document must exist.",
                "Could not read domain repository enforcement document: ",
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
