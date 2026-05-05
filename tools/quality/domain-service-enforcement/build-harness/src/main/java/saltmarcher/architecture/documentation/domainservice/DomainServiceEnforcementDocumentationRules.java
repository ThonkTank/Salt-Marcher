package saltmarcher.architecture.documentation.domainservice;

import java.util.List;
import saltmarcher.architecture.ArchitectureContext;
import saltmarcher.architecture.ArchitectureRule;
import saltmarcher.architecture.ViolationSink;
import saltmarcher.architecture.documentation.support.MarkdownTableCoverageValidator;

public final class DomainServiceEnforcementDocumentationRules implements ArchitectureRule {

    private static final String DOCUMENT_PATH =
            "docs/project/architecture/enforcement/domain-service-enforcement.md";
    private static final String COVERAGE_RULE = "domain-service-enforcement-coverage-complete";
    private static final List<MarkdownTableCoverageValidator.ExpectedRow> EXPECTED_ROWS = List.of(
            row(
                    "domain-service-role-shape",
                    "Enforced",
                    List.of("domain-service bundle Error Prone", "DomainServiceRoleShape"),
                    List.of("./gradlew compileJava", "./gradlew checkDomainServiceEnforcement")),
            row(
                    "domain-service-statelessness",
                    "Enforced",
                    List.of("domain-service bundle Error Prone", "DomainServiceStatelessness"),
                    List.of("./gradlew compileJava", "./gradlew checkDomainServiceEnforcement")),
            row(
                    "domain-service-no-trivial-relay-wrapper-source-pattern",
                    "Source-Pattern Enforced",
                    List.of("domain-service bundle PMD", "DomainServiceNoCeremonialIndirectionRule"),
                    List.of("./gradlew pmdDomainServiceEnforcement", "./gradlew checkDomainServiceEnforcement")),
            row("domain-service-non-ceremonial-role-use", "Review-Owned"));

    @Override
    public void check(ArchitectureContext context, ViolationSink violations) {
        MarkdownTableCoverageValidator.validateDocument(
                context,
                DOCUMENT_PATH,
                COVERAGE_RULE,
                "Domain service enforcement document must exist.",
                "Could not read domain service enforcement document: ",
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
