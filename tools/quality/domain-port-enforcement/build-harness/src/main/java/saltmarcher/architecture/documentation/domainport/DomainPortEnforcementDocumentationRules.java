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
            row("domain-port-repository-write-orientation", "Review-Owned"),
            row("domain-port-read-port-placement", "Review-Owned"),
            row("domain-port-read-port-read-only-orientation", "Review-Owned"),
            row(
                    "domain-port-role-shape",
                    "Enforced",
                    List.of("domain-port bundle Error Prone", "DomainPortRoleShape"),
                    List.of("./gradlew compileJava", "./gradlew checkDomainPortEnforcement")),
            row(
                    "domain-port-repository-placement",
                    "Enforced",
                    List.of("domain-port bundle Error Prone", "DomainPortBoundary"),
                    List.of("./gradlew compileJava", "./gradlew checkDomainPortEnforcement")),
            row(
                    "domain-port-no-implementations-inside-domain",
                    "Enforced",
                    List.of("domain-port bundle Error Prone", "DomainPortBoundary"),
                    List.of("./gradlew compileJava", "./gradlew checkDomainPortEnforcement")),
            row(
                    "domain-port-ownership-and-signature-boundary",
                    "Enforced",
                    List.of("domain-port bundle Error Prone", "DomainPortBoundary"),
                    List.of("./gradlew compileJava", "./gradlew checkDomainPortEnforcement")),
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
