package saltmarcher.architecture.documentation.domainport;

import java.util.List;
import saltmarcher.architecture.ArchitectureContext;
import saltmarcher.architecture.ArchitectureRule;
import saltmarcher.architecture.ViolationSink;
import saltmarcher.architecture.documentation.support.MarkdownTableCoverageValidator;

public final class DomainPortEnforcementDocumentationRules implements ArchitectureRule {

    private static final String DOCUMENT_PATH =
            "docs/project/architecture/enforcement/domain-port-enforcement.md";
    private static final String COVERAGE_RULE = "domain-port-enforcement-coverage-complete";
    private static final List<MarkdownTableCoverageValidator.ExpectedRow> EXPECTED_ROWS = List.of(
            row(
                    "domain-port-direct-file-placement",
                    "Enforced",
                    List.of("domain-port bundle build-harness", "DomainPortTopologyRules"),
                    List.of("./gradlew checkDomainPortEnforcement")),
            row(
                    "domain-port-role-shape",
                    "Enforced",
                    List.of("domain-port bundle build-harness", "DomainPortTopologyRules"),
                    List.of("./gradlew checkDomainPortEnforcement")),
            row("domain-port-no-foreign-mutation-or-data-seam", "Review-Owned"),
            row("domain-port-published-listener-boundary", "Review-Owned"),
            row("domain-port-domain-language", "Review-Owned"));

    @Override
    public void check(ArchitectureContext context, ViolationSink violations) {
        MarkdownTableCoverageValidator.validateDocument(
                context,
                DOCUMENT_PATH,
                COVERAGE_RULE,
                "Domain port enforcement document must exist.",
                "Could not read domain port enforcement document: ",
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
