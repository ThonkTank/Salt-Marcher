package saltmarcher.architecture.documentation.dataservicecontribution;

import java.util.List;
import saltmarcher.architecture.ArchitectureContext;
import saltmarcher.architecture.ArchitectureRule;
import saltmarcher.architecture.ViolationSink;
import saltmarcher.architecture.documentation.support.MarkdownTableCoverageValidator;

public final class DataServiceContributionEnforcementCoverageRules implements ArchitectureRule {

    private static final String DOCUMENT_PATH =
            "docs/project/architecture/enforcement/data-service-contribution-enforcement.md";
    private static final String COVERAGE_RULE = "data-enforcement-coverage-complete";
    private static final List<MarkdownTableCoverageValidator.ExpectedRow> EXPECTED_ROWS = List.of(
            row(
                    "data-service-contribution-discovery-entrypoint-shape",
                    "Enforced",
                    List.of("data-service-contribution bundle PMD", "DataServiceContributionEntrypointRule"),
                    List.of(
                            "./gradlew pmdDataServiceContributionEnforcement",
                            "./gradlew checkDataServiceContributionEnforcement")),
            row(
                    "data-service-contribution-stateless-public-surface",
                    "Enforced",
                    List.of("data-service-contribution bundle PMD", "DataServiceContributionEntrypointRule"),
                    List.of(
                            "./gradlew pmdDataServiceContributionEnforcement",
                            "./gradlew checkDataServiceContributionEnforcement")),
            row(
                    "data-service-contribution-no-source-mechanics",
                    "Source-Pattern Enforced",
                    List.of("data-service-contribution bundle PMD", "DataServiceContributionSourceMechanicsRule"),
                    List.of(
                            "./gradlew pmdDataServiceContributionEnforcement",
                            "./gradlew checkDataServiceContributionEnforcement")),
            row(
                    "data-service-contribution-construction-purity",
                    "Enforced",
                    List.of(
                            "data-service-contribution bundle Error Prone",
                            "DataServiceContributionConstructionPurity"),
                    List.of(
                            "./gradlew compileJava",
                            "./gradlew checkDataServiceContributionEnforcement")),
            row("data-service-contribution-no-hidden-business-or-runtime-workflow", "Review-Owned"),
            row(
                    "data-service-contribution-shell-runtime-seam-subset",
                    "Enforced",
                    List.of(
                            "data-service-contribution bundle Error Prone",
                            "DataServiceContributionShellApiAllowlist"),
                    List.of(
                            "./gradlew compileJava",
                            "./gradlew checkDataServiceContributionEnforcement")),
            row(
                    "data-service-contribution-register-export-shape",
                    "Enforced",
                    List.of(
                            "data-service-contribution bundle Error Prone",
                            "DataServiceContributionRegisterExportShape",
                            "data-service-contribution bundle PMD",
                            "DataServiceContributionEntrypointRule"),
                    List.of(
                            "./gradlew compileJava",
                            "./gradlew pmdDataServiceContributionEnforcement",
                            "./gradlew checkDataServiceContributionEnforcement")),
            row("data-service-contribution-factory-export-shape", "Review-Owned"),
            row("data-service-contribution-composition-collaborator-assembly-only", "Review-Owned"));

    @Override
    public void check(ArchitectureContext context, ViolationSink violations) {
        MarkdownTableCoverageValidator.validateDocument(
                context,
                DOCUMENT_PATH,
                COVERAGE_RULE,
                "Data ServiceContribution enforcement document must exist.",
                "Could not read data ServiceContribution enforcement coverage: ",
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
