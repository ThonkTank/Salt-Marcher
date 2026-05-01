package saltmarcher.architecture.domain.applicationservice;

import static saltmarcher.architecture.ArchitectureNaming.isFeatureFileName;

import java.util.List;
import saltmarcher.architecture.ArchitectureContext;
import saltmarcher.architecture.ArchitectureRule;
import saltmarcher.architecture.SourceFile;
import saltmarcher.architecture.ViolationSink;

public final class DomainApplicationServiceTopologyRules implements ArchitectureRule {

    @Override
    public void check(ArchitectureContext context, ViolationSink violations) {
        for (SourceFile sourceFile : context.sourceFiles(violations)) {
            if (!isDomainSource(sourceFile.relativeSegments())) {
                continue;
            }
            validateDomainRootPlacement(sourceFile, violations);
        }
    }

    private static boolean isDomainSource(List<String> segments) {
        return segments.size() >= 3
                && "src".equals(segments.get(0))
                && "domain".equals(segments.get(1));
    }

    private static void validateDomainRootPlacement(SourceFile sourceFile, ViolationSink violations) {
        List<String> segments = sourceFile.relativeSegments();
        if (segments.size() < 4) {
            violations.add(sourceFile.relativePath(), "domain-applicationservice-root-presence",
                    "Domain sources must live under src/domain/<context>/...");
            return;
        }

        if (segments.size() == 4) {
            String feature = segments.get(2);
            if (!isFeatureFileName(feature, sourceFile.fileName(), "ApplicationService")) {
                violations.add(sourceFile.relativePath(), "domain-applicationservice-root-presence",
                        "Only <PascalContext>ApplicationService.java may live directly under src/domain/<context>/.");
            }
            return;
        }
    }
}
