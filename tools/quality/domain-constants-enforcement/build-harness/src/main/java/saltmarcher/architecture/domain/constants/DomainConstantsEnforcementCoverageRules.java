package saltmarcher.architecture.domain.constants;

import java.util.List;
import saltmarcher.architecture.ArchitectureContext;
import saltmarcher.architecture.ArchitectureRule;
import saltmarcher.architecture.ViolationSink;
import saltmarcher.architecture.documentation.support.MarkdownTableCoverageValidator;

public final class DomainConstantsEnforcementCoverageRules implements ArchitectureRule {

    private static final String DOCUMENT_PATH =
            "docs/project/architecture/enforcement/domain-constants-enforcement.md";
    private static final String COVERAGE_RULE = "domain-constants-enforcement-coverage-complete";
    private static final List<MarkdownTableCoverageValidator.ExpectedRow> EXPECTED_ROWS = List.of(
            row(
                    "domain-constants-direct-file-placement",
                    "Enforced",
                    List.of("domain-constants bundle build-harness", "DomainConstantsTopologyRules"),
                    List.of("./gradlew checkDomainConstantsEnforcement")),
            row(
                    "domain-constants-role-shape",
                    "Enforced",
                    List.of("domain-constants bundle build-harness", "DomainConstantsTopologyRules"),
                    List.of("./gradlew checkDomainConstantsEnforcement")),
            row("domain-constants-immutable-only", "Review-Owned"),
            row("domain-constants-no-runtime-or-state-ownership", "Review-Owned"));

    @Override
    public void check(ArchitectureContext context, ViolationSink violations) {
        MarkdownTableCoverageValidator.validateDocument(
                context,
                DOCUMENT_PATH,
                COVERAGE_RULE,
                "Domain constants enforcement document must exist.",
                "Could not read domain constants enforcement document: ",
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
