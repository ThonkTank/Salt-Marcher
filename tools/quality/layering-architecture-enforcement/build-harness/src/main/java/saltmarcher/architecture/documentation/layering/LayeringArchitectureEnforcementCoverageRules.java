package saltmarcher.architecture.documentation.layering;

import java.util.List;
import saltmarcher.architecture.ArchitectureContext;
import saltmarcher.architecture.ArchitectureRule;
import saltmarcher.architecture.ViolationSink;
import saltmarcher.architecture.documentation.support.MarkdownTableCoverageValidator;

public final class LayeringArchitectureEnforcementCoverageRules implements ArchitectureRule {

    private static final String DOCUMENT_PATH =
            "docs/project/architecture/enforcement/layering-architecture-enforcement.md";
    private static final String COVERAGE_RULE = "layering-architecture-enforcement-coverage-complete";
    private static final List<MarkdownTableCoverageValidator.ExpectedRow> EXPECTED_ROWS = List.of(
            row(
                    "layering-repository-active-java-root-allowlist",
                    "Enforced",
                    List.of("`layering-architecture-enforcement` bundle build-harness", "LayeringArchitectureTopologyRules"),
                    List.of("./gradlew checkLayeringArchitectureEnforcement", "./gradlew checkArchitecture")),
            row(
                    "layering-repository-src-direct-child-allowlist",
                    "Enforced",
                    List.of("`layering-architecture-enforcement` bundle build-harness", "LayeringArchitectureTopologyRules"),
                    List.of("./gradlew checkLayeringArchitectureEnforcement", "./gradlew checkArchitecture")),
            row(
                    "layering-repository-included-build-taxonomy",
                    "Enforced",
                    List.of("`layering-architecture-enforcement` bundle build-harness", "LayeringArchitectureTopologyRules"),
                    List.of("./gradlew checkLayeringArchitectureEnforcement", "./gradlew checkArchitecture")),
            row(
                    "layering-intentional-cross-layer-public-boundary-set",
                    "Enforced Elsewhere",
                    List.of("view-layer-contribution-count", "domain-applicationservice-root-presence", "data-root-service-contribution-only"),
                    List.of("see neighboring owner docs and their listed entrypoints")),
            row(
                    "layering-no-extra-active-layer-roots",
                    "Enforced",
                    List.of("`layering-architecture-enforcement` bundle build-harness", "LayeringArchitectureTopologyRules"),
                    List.of("./gradlew checkLayeringArchitectureEnforcement", "./gradlew checkArchitecture")),
            row("layering-no-undocumented-cross-layer-public-extension-points", "Review-Owned"),
            row(
                    "layering-no-passive-carrier-shape-mirror-inside-feature-root",
                    "Enforced",
                    List.of("`layering-architecture-enforcement` bundle build-harness", "LayeringPassiveCarrierMirrorRules"),
                    List.of("./gradlew checkLayeringArchitectureEnforcement", "./gradlew checkArchitecture")),
            row(
                    "layering-no-direct-view-data-dependency",
                    "Enforced Elsewhere",
                    List.of("PassiveViewDependencyBoundaries", "ViewBinderDependencyBoundary"),
                    List.of("./gradlew compileJava", "./gradlew checkViewArchitecture")),
            row(
                    "layering-no-direct-view-domain-connection-outside-documented-seams",
                    "Enforced Elsewhere",
                    List.of(
                            "view-binder-no-legacy-intenthandler-write-sink-injection",
                            "view-intenthandler-root-applicationservice-boundary-surface"),
                    List.of("see neighboring owner docs and their listed entrypoints")),
            row("layering-no-non-applicationservice-public-backend-boundary-below-view", "Review-Owned"),
            row("layering-no-outer-format-object-leak-inward", "Review-Owned"),
            row("layering-no-substantive-domain-role-pass-through-wrapper", "Review-Owned"),
            row("layering-no-adjacent-layer-pass-through-wrapper-outside-explicit-thin-roles", "Review-Owned"),
            row(
                    "layering-source-code-dependencies-point-inward",
                    "Enforced Elsewhere",
                    List.of("domainMustStayIndependentFromOuterLayers", "dataMustNotReachBootstrapOrPresentation"),
                    List.of("./gradlew compileJava", "./gradlew checkArchitecture")),
            row("layering-runtime-controlflow-reversal-only-through-documented-seams", "Review-Owned"),
            row("layering-bootstrap-registration-order-and-generic-discovery-path", "Review-Owned"),
            row(
                    "layering-view-domain-write-and-readback-seams-only",
                    "Enforced Elsewhere",
                    List.of("view-binder-no-legacy-intenthandler-write-sink-injection", "view-contentmodel-read-side-only-direct-boundary"),
                    List.of("./gradlew compileJava", "./gradlew checkViewArchitecture")),
            row("layering-no-third-presentation-state-mutation-route", "Review-Owned"),
            row(
                    "layering-data-reaches-domain-only-through-public-boundaries-and-repositories",
                    "Enforced Elsewhere",
                    List.of("data-service-contribution-register-export-shape", "domain-repository-role-shape"),
                    List.of("./gradlew compileJava", "./gradlew checkDomainRepositoryEnforcement")),
            row("layering-explicit-cross-layer-public-boundary-diagnostic", "Candidate"),
            row("layering-thin-role-relay-stack-diagnostic", "Candidate"),
            row("layering-thin-role-indirection-candidate-scan", "Candidate"),
            row("layering-role-hub-sprawl-candidate", "Candidate"),
            row("layering-cross-feature-sprawl-candidate", "Candidate"),
            row("layering-public-boundary-breadth-candidate", "Candidate"));

    @Override
    public void check(ArchitectureContext context, ViolationSink violations) {
        MarkdownTableCoverageValidator.validateDocument(
                context,
                DOCUMENT_PATH,
                COVERAGE_RULE,
                "Layering Architecture enforcement document must exist.",
                "Could not read layering architecture enforcement document: ",
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
