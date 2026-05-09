package saltmarcher.architecture.domain.model;

import java.util.List;
import saltmarcher.architecture.ArchitectureContext;
import saltmarcher.architecture.ArchitectureRule;
import saltmarcher.architecture.ViolationSink;
import saltmarcher.architecture.documentation.support.MarkdownTableCoverageValidator;

public final class DomainModelEnforcementCoverageRules implements ArchitectureRule {

    private static final String DOCUMENT_PATH =
            "docs/project/architecture/enforcement/domain-model-enforcement.md";
    private static final String COVERAGE_RULE = "domain-model-enforcement-coverage-complete";
    private static final List<MarkdownTableCoverageValidator.ExpectedRow> EXPECTED_ROWS = List.of(
            row("domain-model-dynamic-state-ownership", "Review-Owned"),
            row(
                    "domain-model-tree-placement",
                    "Enforced",
                    List.of("domain-model bundle build-harness", "DomainModelTopologyRules"),
                    List.of("./gradlew checkDomainModelEnforcement")),
            row(
                    "domain-model-no-outer-layer-dependencies",
                    "Enforced Elsewhere",
                    List.of(
                            "domain-layer bundle ArchUnit", "domainMustStayIndependentFromOuterLayers",
                            "domain-layer bundle Error Prone", "DomainForbiddenInfrastructureDependency"),
                    List.of("./gradlew compileJava", "./gradlew checkDomainLayerEnforcement")),
            row(
                    "domain-model-no-published-carrier-dependencies",
                    "Enforced Elsewhere",
                    List.of("domain-layer bundle ArchUnit", "domainInternalModelsMustNotDependOnPublishedTypes"),
                    List.of("./gradlew checkArchitecture", "./gradlew checkDomainEnforcement", "./gradlew checkDomainModelEnforcement")),
            row("domain-model-published-derivation-ownership", "Review-Owned"));

    @Override
    public void check(ArchitectureContext context, ViolationSink violations) {
        MarkdownTableCoverageValidator.validateDocument(
                context,
                DOCUMENT_PATH,
                COVERAGE_RULE,
                "Domain model enforcement document must exist.",
                "Could not read domain model enforcement document: ",
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
