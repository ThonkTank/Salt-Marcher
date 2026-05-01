package saltmarcher.architecture.documentation.domain;

import static saltmarcher.architecture.ArchitectureNaming.expectedDataRootFileName;
import static saltmarcher.architecture.ArchitectureNaming.expectedDomainRootFileName;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.TreeMap;
import java.util.stream.Collectors;
import saltmarcher.architecture.ArchitectureContext;
import saltmarcher.architecture.ArchitectureRule;
import saltmarcher.architecture.SourceFile;
import saltmarcher.architecture.SourceKind;
import saltmarcher.architecture.ViolationSink;

public final class DomainDocumentationRules implements ArchitectureRule {

    @Override
    public void check(ArchitectureContext context, ViolationSink violations) {
        var domainFeatures = context.domainFeatures(violations);
        List<SourceFile> sourceFiles = context.sourceFiles(violations);

        validateDomainRootNamesMatchDeclaredContext(context, domainFeatures, sourceFiles, violations);
        validateDataRootNamesMatchDeclaredContext(context, sourceFiles, violations);
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
            String contextName = context.domainContextName(featureName);
            if (contextName == null || contextName.isBlank()) {
                continue;
            }
            String expectedFileName = expectedDomainRootFileName(featureName, contextName);
            List<SourceFile> roots = rootsByFeature.getOrDefault(featureName, List.of()).stream()
                    .sorted(Comparator.comparing(SourceFile::relativePath))
                    .toList();
            if (roots.stream().noneMatch(sourceFile -> expectedFileName.equals(sourceFile.fileName()))) {
                String actualFiles = roots.isEmpty()
                        ? "none found"
                        : roots.stream().map(SourceFile::relativePath).collect(Collectors.joining(", "));
                violations.add("src/domain/" + featureName + "/DOMAIN.md", "domain-applicationservice-root-presence",
                        "Context document declares '" + contextName + "', so src/domain/" + featureName
                                + "/ must expose " + expectedFileName + ". Found: " + actualFiles);
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
