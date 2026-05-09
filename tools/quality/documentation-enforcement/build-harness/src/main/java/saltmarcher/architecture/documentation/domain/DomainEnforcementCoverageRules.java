package saltmarcher.architecture.documentation.domain;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import saltmarcher.architecture.ArchitectureContext;
import saltmarcher.architecture.ArchitectureRule;
import saltmarcher.architecture.ViolationSink;

public final class DomainEnforcementCoverageRules implements ArchitectureRule {

    private static final String COVERAGE_RULE = "domain-enforcement-coverage-complete";
    private static final List<String> ACTIVE_DOMAIN_ENFORCEMENT_DOCS = List.of(
            "docs/project/architecture/enforcement/domain-layer-enforcement.md",
            "docs/project/architecture/enforcement/domain-context-enforcement.md",
            "docs/project/architecture/enforcement/domain-application-service-enforcement.md",
            "docs/project/architecture/enforcement/domain-use-case-enforcement.md",
            "docs/project/architecture/enforcement/domain-published-enforcement.md",
            "docs/project/architecture/enforcement/domain-port-enforcement.md",
            "docs/project/architecture/enforcement/domain-repository-enforcement.md",
            "docs/project/architecture/enforcement/domain-model-enforcement.md",
            "docs/project/architecture/enforcement/domain-helper-enforcement.md",
            "docs/project/architecture/enforcement/domain-constants-enforcement.md");
    private static final List<String> RETIRED_DOMAIN_ENFORCEMENT_DOCS = List.of(
            "docs/project/architecture/enforcement/domain-aggregate-enforcement.md",
            "docs/project/architecture/enforcement/domain-entity-enforcement.md",
            "docs/project/architecture/enforcement/domain-value-enforcement.md",
            "docs/project/architecture/enforcement/domain-policy-enforcement.md",
            "docs/project/architecture/enforcement/domain-factory-enforcement.md",
            "docs/project/architecture/enforcement/domain-service-enforcement.md",
            "docs/project/architecture/enforcement/domain-event-enforcement.md",
            "docs/project/architecture/enforcement/domain-specification-enforcement.md");

    @Override
    public void check(ArchitectureContext context, ViolationSink violations) {
        for (String documentPath : ACTIVE_DOMAIN_ENFORCEMENT_DOCS) {
            Path document = context.repoRoot().resolve(documentPath);
            if (!Files.isRegularFile(document)) {
                violations.add(documentPath, COVERAGE_RULE,
                        "Active domain enforcement owner document is missing.");
            }
        }
        for (String documentPath : RETIRED_DOMAIN_ENFORCEMENT_DOCS) {
            Path document = context.repoRoot().resolve(documentPath);
            if (Files.isRegularFile(document)) {
                violations.add(documentPath, COVERAGE_RULE,
                        "Retired tactical domain enforcement document must be removed.");
            }
        }
    }
}
