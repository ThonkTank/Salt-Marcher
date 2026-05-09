package saltmarcher.architecture.domain.helper;

import java.util.List;
import saltmarcher.architecture.ArchitectureContext;
import saltmarcher.architecture.ArchitectureRule;
import saltmarcher.architecture.ViolationSink;
import saltmarcher.architecture.documentation.support.MarkdownTableCoverageValidator;

public final class DomainHelperEnforcementCoverageRules implements ArchitectureRule {

    private static final String DOCUMENT_PATH =
            "docs/project/architecture/enforcement/domain-helper-enforcement.md";
    private static final String COVERAGE_RULE = "domain-helper-enforcement-coverage-complete";
    private static final List<MarkdownTableCoverageValidator.ExpectedRow> EXPECTED_ROWS = List.of(
            row(
                    "domain-helper-direct-file-placement",
                    "Enforced",
                    List.of("domain-helper bundle build-harness", "DomainHelperTopologyRules"),
                    List.of("./gradlew checkDomainHelperEnforcement")),
            row(
                    "domain-helper-role-shape",
                    "Enforced",
                    List.of("domain-helper bundle build-harness", "DomainHelperTopologyRules"),
                    List.of("./gradlew checkDomainHelperEnforcement")),
            row("domain-helper-explicit-work-step", "Review-Owned"),
            row("domain-helper-no-current-context-access", "Review-Owned"),
            row("domain-helper-constants-only-downward-dependency", "Review-Owned"));

    @Override
    public void check(ArchitectureContext context, ViolationSink violations) {
        MarkdownTableCoverageValidator.validateDocument(
                context,
                DOCUMENT_PATH,
                COVERAGE_RULE,
                "Domain helper enforcement document must exist.",
                "Could not read domain helper enforcement document: ",
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
