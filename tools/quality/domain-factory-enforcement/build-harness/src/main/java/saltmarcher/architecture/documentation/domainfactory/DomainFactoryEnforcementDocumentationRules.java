package saltmarcher.architecture.documentation.domainfactory;

import java.util.List;
import saltmarcher.architecture.ArchitectureContext;
import saltmarcher.architecture.ArchitectureRule;
import saltmarcher.architecture.ViolationSink;
import saltmarcher.architecture.documentation.support.MarkdownTableCoverageValidator;

public final class DomainFactoryEnforcementDocumentationRules implements ArchitectureRule {

    private static final String DOCUMENT_PATH =
            "docs/project/architecture/enforcement/domain-factory-enforcement.md";
    private static final String COVERAGE_RULE = "domain-factory-enforcement-coverage-complete";
    private static final List<MarkdownTableCoverageValidator.ExpectedRow> EXPECTED_ROWS = List.of(
            row(
                    "domain-factory-role-shape",
                    "Enforced",
                    List.of("domain-factory bundle Error Prone", "DomainFactoryRoleShape"),
                    List.of("./gradlew compileJava", "./gradlew checkDomainFactoryEnforcement")),
            row(
                    "domain-factory-statelessness",
                    "Enforced",
                    List.of("domain-factory bundle Error Prone", "DomainFactoryStatelessness"),
                    List.of("./gradlew compileJava", "./gradlew checkDomainFactoryEnforcement")),
            row(
                    "domain-factory-no-trivial-construction-wrapper-source-pattern",
                    "Source-Pattern Enforced",
                    List.of("domain-factory bundle PMD", "DomainFactoryNoCeremonialIndirectionRule"),
                    List.of("./gradlew pmdDomainFactoryEnforcement", "./gradlew checkDomainFactoryEnforcement")),
            row("domain-factory-real-construction-boundary", "Review-Owned"));

    @Override
    public void check(ArchitectureContext context, ViolationSink violations) {
        MarkdownTableCoverageValidator.validateDocument(
                context,
                DOCUMENT_PATH,
                COVERAGE_RULE,
                "Domain factory enforcement document must exist.",
                "Could not read domain factory enforcement document: ",
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
