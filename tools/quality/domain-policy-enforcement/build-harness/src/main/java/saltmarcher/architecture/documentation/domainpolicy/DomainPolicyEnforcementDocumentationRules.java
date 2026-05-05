package saltmarcher.architecture.documentation.domainpolicy;

import java.util.List;
import saltmarcher.architecture.ArchitectureContext;
import saltmarcher.architecture.ArchitectureRule;
import saltmarcher.architecture.ViolationSink;
import saltmarcher.architecture.documentation.support.MarkdownTableCoverageValidator;

public final class DomainPolicyEnforcementDocumentationRules implements ArchitectureRule {

    private static final String DOCUMENT_PATH =
            "docs/project/architecture/enforcement/domain-policy-enforcement.md";
    private static final String COVERAGE_RULE = "domain-policy-enforcement-coverage-complete";
    private static final List<MarkdownTableCoverageValidator.ExpectedRow> EXPECTED_ROWS = List.of(
            row(
                    "domain-policy-role-shape",
                    "Enforced",
                    List.of("domain-policy bundle Error Prone", "DomainPolicyRoleShape"),
                    List.of("./gradlew compileJava", "./gradlew checkDomainPolicyEnforcement")),
            row(
                    "domain-policy-statelessness",
                    "Enforced",
                    List.of("domain-policy bundle Error Prone", "DomainPolicyStatelessness"),
                    List.of("./gradlew compileJava", "./gradlew checkDomainPolicyEnforcement")),
            row(
                    "domain-policy-no-trivial-relay-wrapper-source-pattern",
                    "Source-Pattern Enforced",
                    List.of("domain-policy bundle PMD", "DomainPolicyNoCeremonialIndirectionRule"),
                    List.of("./gradlew pmdDomainPolicyEnforcement", "./gradlew checkDomainPolicyEnforcement")),
            row("domain-policy-real-policy-behavior", "Review-Owned"));

    @Override
    public void check(ArchitectureContext context, ViolationSink violations) {
        MarkdownTableCoverageValidator.validateDocument(
                context,
                DOCUMENT_PATH,
                COVERAGE_RULE,
                "Domain policy enforcement document must exist.",
                "Could not read domain policy enforcement document: ",
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
