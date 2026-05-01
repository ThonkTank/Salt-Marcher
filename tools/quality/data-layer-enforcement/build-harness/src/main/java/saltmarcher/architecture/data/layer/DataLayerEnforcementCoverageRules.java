package saltmarcher.architecture.data.layer;

import java.util.List;
import saltmarcher.architecture.ArchitectureContext;
import saltmarcher.architecture.ArchitectureRule;
import saltmarcher.architecture.ViolationSink;
import saltmarcher.architecture.documentation.support.MarkdownTableCoverageValidator;

public final class DataLayerEnforcementCoverageRules implements ArchitectureRule {

    private static final String DOCUMENT_PATH =
            "docs/project/architecture/enforcement/data-layer-enforcement.md";
    private static final String COVERAGE_RULE = "data-layer-enforcement-coverage-complete";
    private static final List<MarkdownTableCoverageValidator.ExpectedRow> EXPECTED_ROWS = List.of(
            row("data-root-service-contribution-only",
                    "Enforced",
                    List.of("data-layer bundle build-harness", "DataLayerTopologyRules"),
                    List.of("./gradlew checkArchitecture", "./gradlew checkDataLayerEnforcement")),
            row("data-feature-bucket-layout",
                    "Enforced",
                    List.of("data-layer bundle build-harness", "DataLayerTopologyRules"),
                    List.of("./gradlew checkArchitecture", "./gradlew checkDataLayerEnforcement")),
            row("data-feature-composition-root-presence",
                    "Enforced",
                    List.of("data-layer bundle build-harness", "DataLayerTopologyRules"),
                    List.of("./gradlew checkArchitecture", "./gradlew checkDataLayerEnforcement")),
            row("data-layer-adapter-zone-ownership", "Review-Owned"),
            row("data-outer-layer-independence",
                    "Enforced",
                    List.of(
                            "data-layer bundle ArchUnit",
                            "dataMustNotReachBootstrapOrPresentation",
                            "dataMustNotReachPresentationShellOrBootstrap"),
                    List.of("./gradlew checkArchitecture", "./gradlew checkDataLayerEnforcement")),
            row("data-non-root-shell-independence",
                    "Enforced",
                    List.of("data-layer bundle ArchUnit", "dataMustNotReachPresentationShellOrBootstrap"),
                    List.of("./gradlew checkArchitecture", "./gradlew checkDataLayerEnforcement")),
            row("data-foreign-feature-public-boundary",
                    "Enforced",
                    List.of("data-layer bundle ArchUnit", "dataFeaturesMustOnlyUseForeignFeatureApis"),
                    List.of("./gradlew checkArchitecture", "./gradlew checkDataLayerEnforcement")),
            row("data-foreign-private-data-bucket-isolation",
                    "Enforced",
                    List.of("data-layer bundle ArchUnit", "dataFeaturesMustNotReachForeignPrivateDataBuckets"),
                    List.of("./gradlew checkArchitecture", "./gradlew checkDataLayerEnforcement")),
            row("data-feature-cycles",
                    "Enforced",
                    List.of("data-layer bundle ArchUnit", "dataFeaturesMustStayCycleFree"),
                    List.of("./gradlew checkArchitecture", "./gradlew checkDataLayerEnforcement")),
            row("data-layer-no-business-policy-or-second-model", "Review-Owned"),
            row("data-layer-no-public-backend-boundary", "Review-Owned"),
            row("data-service-registry-root-only",
                    "Enforced",
                    List.of(
                            "data-layer bundle Error Prone",
                            "ServiceRegistryRegistrationPlacement",
                            "data-layer bundle build-harness",
                            "DataLayerTopologyRules"),
                    List.of(
                            "./gradlew compileJava",
                            "./gradlew checkArchitecture",
                            "./gradlew checkDataLayerEnforcement")),
            row("data-layer-shell-runtime-seam-only-through-root-service-registration",
                    "Enforced Elsewhere",
                    List.of(
                            "data-service-registry-root-only",
                            "data-service-contribution-shell-runtime-seam-subset",
                            "data-non-root-shell-independence"),
                    List.of("./gradlew compileJava", "./gradlew checkArchitecture")),
            row("data-layer-domain-source-dependencies-only-through-own-feature-ports-and-foreign-public-boundaries",
                    "Enforced Elsewhere",
                    List.of(
                            "data-service-contribution-register-export-shape",
                            "data-repository-role-contract",
                            "data-query-role-contract",
                            "data-gateway-domain-independence",
                            "data-foreign-feature-public-boundary"),
                    List.of("./gradlew compileJava", "./gradlew checkArchitecture")),
            row("data-layer-root-runtime-export-surface-only", "Review-Owned"));

    @Override
    public void check(ArchitectureContext context, ViolationSink violations) {
        MarkdownTableCoverageValidator.validateDocument(
                context,
                DOCUMENT_PATH,
                COVERAGE_RULE,
                "Data Layer enforcement coverage document is missing.",
                "Could not read Data Layer enforcement coverage: ",
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
