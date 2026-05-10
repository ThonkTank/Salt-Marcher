package saltmarcher.architecture.domain.applicationservice;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Set;
import java.util.TreeMap;
import java.util.stream.Collectors;
import saltmarcher.architecture.ArchitectureContext;
import saltmarcher.architecture.ArchitectureRule;
import saltmarcher.architecture.SourceFile;
import saltmarcher.architecture.SourceKind;
import saltmarcher.architecture.ViolationSink;

public final class DomainApplicationServiceDocumentationRules implements ArchitectureRule {

    @Override
    public void check(ArchitectureContext context, ViolationSink violations) {
        Set<String> domainFeatures = context.domainFeatures(violations);
        List<SourceFile> sourceFiles = context.sourceFiles(violations);
        validateDomainRootNamesMatchDeclaredContext(context, domainFeatures, sourceFiles, violations);
    }

    private void validateDomainRootNamesMatchDeclaredContext(
            ArchitectureContext context,
            Set<String> domainFeatures,
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
}
