package saltmarcher.architecture.data.layer;

import static saltmarcher.architecture.ArchitectureNaming.isFeatureFileName;

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

public final class DataLayerTopologyRules implements ArchitectureRule {

    @Override
    public void check(ArchitectureContext context, ViolationSink violations) {
        List<SourceFile> sourceFiles = context.sourceFiles(violations);
        TreeMap<String, List<SourceFile>> rootsByFeature = new TreeMap<>();
        for (SourceFile sourceFile : sourceFiles) {
            validateDataLayout(sourceFile, violations);
            if (sourceFile.kind() == SourceKind.DATA_ROOT) {
                rootsByFeature.computeIfAbsent(sourceFile.featureName(), ignored -> new ArrayList<>()).add(sourceFile);
            }
        }
        validateCompositionRootPresence(context, rootsByFeature, violations);
    }

    private void validateDataLayout(SourceFile sourceFile, ViolationSink violations) {
        List<String> segments = sourceFile.relativeSegments();
        if (segments.size() < 3
                || !"src".equals(segments.get(0))
                || !"data".equals(segments.get(1))) {
            return;
        }

        if ("persistencecore".equals(segments.get(2))) {
            if (segments.size() < 5 || !Set.of("sqlite", "model").contains(segments.get(3))) {
                violations.add(sourceFile.relativePath(), "data-feature-bucket-layout",
                        "Persistencecore sources must live under src/data/persistencecore/sqlite or src/data/persistencecore/model.");
            }
            return;
        }

        if (segments.size() == 4) {
            String feature = segments.get(2);
            if (!isFeatureFileName(feature, sourceFile.fileName(), "ServiceContribution")) {
                violations.add(sourceFile.relativePath(), "data-root-service-contribution-only",
                        "Only <PascalFeatureName>ServiceContribution.java may live directly under src/data/<feature>/.");
            }
            return;
        }

        if (segments.size() < 5) {
            violations.add(sourceFile.relativePath(), "data-feature-bucket-layout",
                    "Data sources must live under src/data/<feature>/<Feature>ServiceContribution.java,"
                            + " repository, query, gateway, model, or mapper according to the current adapter layout.");
            return;
        }

        String bucket = segments.get(3);
        switch (bucket) {
            case "repository", "query", "model", "mapper" -> {
            }
            case "gateway" -> {
                if (segments.size() < 6 || !Set.of("local", "remote").contains(segments.get(4))) {
                    violations.add(sourceFile.relativePath(), "data-feature-bucket-layout",
                            "Source adapters in the physical gateway/ package must live under gateway/local or gateway/remote.");
                }
            }
            default -> violations.add(sourceFile.relativePath(), "data-feature-bucket-layout",
                    "Only a composition adapter root, repository/ and query/ port adapters, gateway/local/ and gateway/remote/ source adapters, model/ source models, and mapper/ translators are allowed in data features.");
        }
    }

    private void validateCompositionRootPresence(
            ArchitectureContext context,
            TreeMap<String, List<SourceFile>> rootsByFeature,
            ViolationSink violations) {
        for (String featureName : context.dataFeatures(violations)) {
            List<SourceFile> roots = rootsByFeature.getOrDefault(featureName, List.of()).stream()
                    .sorted(Comparator.comparing(SourceFile::relativePath))
                    .toList();
            if (roots.size() == 1) {
                continue;
            }
            String files = roots.isEmpty()
                    ? "none found"
                    : roots.stream().map(SourceFile::relativePath).collect(Collectors.joining(", "));
            violations.add("src/data/" + featureName, "data-feature-composition-root-presence",
                    "Persistence-exporting data feature '" + featureName + "' must expose exactly one composition adapter root."
                            + " Found: " + files);
        }
    }
}
