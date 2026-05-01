package saltmarcher.architecture.domain;

import static saltmarcher.architecture.ArchitectureNaming.expectedDomainRootFileName;

import java.nio.file.Path;
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

public final class DomainFeatureRules implements ArchitectureRule {

    @Override
    public void check(ArchitectureContext context, ViolationSink violations) {
        List<SourceFile> sourceFiles = context.sourceFiles(violations);
        Set<String> domainFeatures = context.domainFeatures(violations);

        validateDomainFeatureBoundaries(context, domainFeatures, sourceFiles, violations);
        validateMapcoreRemoved(context, violations);
    }

    private void validateDomainFeatureBoundaries(
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
            List<SourceFile> roots = rootsByFeature.getOrDefault(featureName, List.of()).stream()
                    .sorted(Comparator.comparing(SourceFile::relativePath))
                    .toList();
            if (roots.size() == 1) {
                continue;
            }
            String files = roots.isEmpty()
                    ? "none found"
                    : roots.stream().map(SourceFile::relativePath).collect(Collectors.joining(", "));
            violations.add("src/domain/" + featureName, "domain-root-presence",
                    "Domain feature '" + featureName + "' must expose exactly one root application service."
                            + " Expected " + expectedDomainRootFileName(featureName) + ". Found: " + files);
        }
    }

    private void validateMapcoreRemoved(ArchitectureContext context, ViolationSink violations) {
        Path mapcoreRoot = context.repoRoot().resolve("src/domain/mapcore");
        if (context.hasRepositoryContent(mapcoreRoot)) {
            violations.add("src/domain/mapcore", "domain-mapcore-removed",
                    "src/domain/mapcore is forbidden. Map/world facts belong to dungeon published language and render display models belong to the view layer.");
        }
    }
}
