package saltmarcher.architecture.documentation.domain;

import static saltmarcher.architecture.ArchitectureNaming.expectedDataRootFileName;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.TreeMap;
import java.util.stream.Collectors;
import java.nio.file.Files;
import java.nio.file.Path;
import saltmarcher.architecture.ArchitectureContext;
import saltmarcher.architecture.ArchitectureRule;
import saltmarcher.architecture.SourceFile;
import saltmarcher.architecture.SourceKind;
import saltmarcher.architecture.ViolationSink;

public final class DomainDocumentationRules implements ArchitectureRule {

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
        validateDomainEnforcementDocumentInventory(context, violations);
        var domainFeatures = context.domainFeatures(violations);
        List<SourceFile> sourceFiles = context.sourceFiles(violations);

        validateDomainRootNamesMatchDeclaredContext(context, domainFeatures, sourceFiles, violations);
        validateDataRootNamesMatchDeclaredContext(context, sourceFiles, violations);
    }

    private void validateDomainEnforcementDocumentInventory(
            ArchitectureContext context,
            ViolationSink violations) {
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

    private void validateDomainRootNamesMatchDeclaredContext(
            ArchitectureContext context,
            java.util.Set<String> domainFeatures,
            List<SourceFile> sourceFiles,
            ViolationSink violations) {
        TreeMap<String, List<SourceFile>> rootsByFeature = new TreeMap<>();
        for (SourceFile sourceFile : sourceFiles) {
            if (sourceFile.kind() == SourceKind.DOMAIN_ROOT) {
                rootsByFeature.computeIfAbsent(sourceFile.featureName(), ignored -> new ArrayList<>()).add(sourceFile);
            }
        }

        for (String featureName : domainFeatures) {
            List<String> declaredServices = context.domainApplicationServices(featureName);
            if (declaredServices.isEmpty()) {
                continue;
            }
            List<SourceFile> roots = rootsByFeature.getOrDefault(featureName, List.of()).stream()
                    .sorted(Comparator.comparing(SourceFile::relativePath))
                    .toList();
            for (String declaredService : declaredServices) {
                String expectedFileName = declaredService + ".java";
                if (roots.stream().noneMatch(sourceFile -> expectedFileName.equals(sourceFile.fileName()))) {
                    String actualFiles = roots.isEmpty()
                            ? "none found"
                            : roots.stream().map(SourceFile::relativePath).collect(Collectors.joining(", "));
                    violations.add("src/domain/" + featureName + "/DOMAIN.md", "domain-applicationservice-root-presence",
                            "Context document declares application service '" + declaredService + "', so src/domain/"
                                    + featureName + "/ must expose " + expectedFileName + ". Found: " + actualFiles);
                }
            }
        }
    }

    private void validateDataRootNamesMatchDeclaredContext(
            ArchitectureContext context,
            List<SourceFile> sourceFiles,
            ViolationSink violations) {
        TreeMap<String, List<SourceFile>> rootsByFeature = new TreeMap<>();
        for (SourceFile sourceFile : sourceFiles) {
            if (sourceFile.kind() == SourceKind.DATA_ROOT) {
                rootsByFeature.computeIfAbsent(sourceFile.featureName(), ignored -> new ArrayList<>()).add(sourceFile);
            }
        }

        for (String featureName : context.dataFeatures(violations)) {
            String contextName = context.domainContextName(featureName);
            if (contextName == null || contextName.isBlank()) {
                continue;
            }
            String expectedFileName = expectedDataRootFileName(featureName, contextName);
            List<SourceFile> roots = rootsByFeature.getOrDefault(featureName, List.of()).stream()
                    .sorted(Comparator.comparing(SourceFile::relativePath))
                    .toList();
            if (roots.stream().noneMatch(sourceFile -> expectedFileName.equals(sourceFile.fileName()))) {
                String actualFiles = roots.isEmpty()
                        ? "none found"
                        : roots.stream().map(SourceFile::relativePath).collect(Collectors.joining(", "));
                violations.add("src/domain/" + featureName + "/DOMAIN.md", "data-root-service-contribution-only",
                        "Context document declares '" + contextName + "', so src/data/" + featureName
                                + "/ must expose " + expectedFileName + ". Found: " + actualFiles);
            }
        }
    }
}
