package saltmarcher.architecture.documentation.domaincontext;

import java.util.List;
import saltmarcher.architecture.ArchitectureContext;
import saltmarcher.architecture.ArchitectureRule;
import saltmarcher.architecture.ViolationSink;
import saltmarcher.architecture.documentation.support.MarkdownTableCoverageValidator;

public final class DomainContextEnforcementCoverageRules implements ArchitectureRule {

    private static final String DOCUMENT_PATH =
            "docs/project/architecture/enforcement/domain-context-enforcement.md";
    private static final String COVERAGE_RULE = "domain-context-enforcement-coverage-complete";
    private static final List<MarkdownTableCoverageValidator.ExpectedRow> EXPECTED_ROWS = List.of(
            row(
                    "domain-context-document-presence",
                    "Enforced",
                    List.of("domain-context-enforcement", "DomainContextDocumentationRules"),
                    List.of("./gradlew checkDomainContextEnforcement")),
            row(
                    "domain-context-name-marker",
                    "Enforced",
                    List.of("domain-context-enforcement", "DomainContextDocumentationRules"),
                    List.of("./gradlew checkDomainContextEnforcement")),
            row(
                    "domain-context-role-marker",
                    "Enforced",
                    List.of("domain-context-enforcement", "DomainContextDocumentationRules"),
                    List.of("./gradlew checkDomainContextEnforcement")),
            row(
                    "domain-context-standard-role-coverage",
                    "Enforced",
                    List.of("domain-context-enforcement", "DomainContextDocumentationRules"),
                    List.of("./gradlew checkDomainContextEnforcement")),
            row(
                    "domain-context-base-sections",
                    "Enforced",
                    List.of("domain-context-enforcement", "DomainContextDocumentationRules"),
                    List.of("./gradlew checkDomainContextEnforcement")),
            row(
                    "domain-context-authored-truth-required-sections",
                    "Enforced",
                    List.of("domain-context-enforcement", "DomainContextDocumentationRules"),
                    List.of("./gradlew checkDomainContextEnforcement")),
            row(
                    "domain-context-aggregate-root-marker-shape",
                    "Enforced",
                    List.of("domain-context-enforcement", "DomainContextDocumentationRules"),
                    List.of("./gradlew checkDomainContextEnforcement")),
            row(
                    "domain-context-generation-policy-required-sections",
                    "Enforced",
                    List.of("domain-context-enforcement", "DomainContextDocumentationRules"),
                    List.of("./gradlew checkDomainContextEnforcement")),
            row(
                    "domain-context-generation-policy-write-model-none",
                    "Enforced",
                    List.of("domain-context-enforcement", "DomainContextDocumentationRules"),
                    List.of("./gradlew checkDomainContextEnforcement")),
            row(
                    "domain-context-generation-policy-ephemeral-rationale",
                    "Enforced",
                    List.of("domain-context-enforcement", "DomainContextDocumentationRules"),
                    List.of("./gradlew checkDomainContextEnforcement")),
            row("domain-context-party-owned-truth", "Review-Owned"),
            row("domain-context-creatures-owned-reference-scope", "Review-Owned"),
            row("domain-context-encounter-owned-roster-truth", "Review-Owned"),
            row("domain-context-encountertable-owned-reference-scope", "Review-Owned"),
            row("domain-context-dungeon-owned-world-space-truth", "Review-Owned"),
            row("domain-context-sessionplanner-owned-session-record-truth", "Review-Owned"),
            row(
                    "domain-context-authored-truth-write-model-required",
                    "Enforced",
                    List.of("domain-context-enforcement", "DomainContextDocumentationRules"),
                    List.of("./gradlew checkDomainContextEnforcement")),
            row("domain-context-creatures-no-encounter-or-lifecycle-truth", "Review-Owned"),
            row("domain-context-encounter-no-foreign-truth-ownership", "Review-Owned"),
            row("domain-context-encountertable-no-creature-or-generation-policy-truth", "Review-Owned"),
            row("domain-context-sessionplanner-no-foreign-truth-ownership", "Review-Owned"),
            row(
                    "domain-context-standard-relationship-coverage",
                    "Enforced",
                    List.of("domain-context-enforcement", "DomainContextDocumentationRules"),
                    List.of("./gradlew checkDomainContextEnforcement")),
            row("domain-context-party-publishes-downstream-facts", "Review-Owned"),
            row("domain-context-creatures-publishes-policy-input-facts", "Review-Owned"),
            row("domain-context-encounter-consumes-foreign-public-boundaries", "Review-Owned"),
            row("domain-context-encountertable-data-adapter-ingest-and-public-export", "Review-Owned"),
            row("domain-context-dungeon-no-domain-relationship-to-other-active-contexts", "Review-Owned"),
            row("domain-context-sessionplanner-consumes-party-and-encounter-public-boundaries", "Review-Owned"));

    @Override
    public void check(ArchitectureContext context, ViolationSink violations) {
        MarkdownTableCoverageValidator.validateDocument(
                context,
                DOCUMENT_PATH,
                COVERAGE_RULE,
                "Domain context enforcement document must exist.",
                "Could not read domain context enforcement document: ",
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
