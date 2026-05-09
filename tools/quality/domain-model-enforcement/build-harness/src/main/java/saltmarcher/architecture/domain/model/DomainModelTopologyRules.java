package saltmarcher.architecture.domain.model;

import java.util.List;
import saltmarcher.architecture.ArchitectureContext;
import saltmarcher.architecture.ArchitectureRule;
import saltmarcher.architecture.SourceFile;
import saltmarcher.architecture.ViolationSink;

public final class DomainModelTopologyRules implements ArchitectureRule {

    @Override
    public void check(ArchitectureContext context, ViolationSink violations) {
        for (SourceFile sourceFile : context.sourceFiles(violations)) {
            List<String> segments = sourceFile.relativeSegments();
            if (!isDomainModelSource(segments)) {
                continue;
            }
            validateTreePlacement(sourceFile, violations);
        }
    }

    private static boolean isDomainModelSource(List<String> segments) {
        return segments.size() >= 7
                && "src".equals(segments.get(0))
                && "domain".equals(segments.get(1))
                && "model".equals(segments.get(3))
                && "model".equals(segments.get(5));
    }

    private static void validateTreePlacement(SourceFile sourceFile, ViolationSink violations) {
        List<String> segments = sourceFile.relativeSegments();
        if (segments.size() < 7) {
            return;
        }
        String family = segments.get(4);
        if (!family.matches("[a-z][a-z0-9_]*")) {
            violations.add(sourceFile.relativePath(), "domain-model-tree-placement",
                    "Internal model types must live under src/domain/<context>/model/<family>/model/ with a lower-case family name.");
        }
    }
}
