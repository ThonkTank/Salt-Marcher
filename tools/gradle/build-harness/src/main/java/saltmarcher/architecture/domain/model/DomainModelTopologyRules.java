package saltmarcher.architecture.domain.model;

import java.util.List;
import saltmarcher.architecture.ArchitectureContext;
import saltmarcher.architecture.ArchitectureRule;
import saltmarcher.architecture.SourceFile;
import saltmarcher.architecture.ViolationSink;
import saltmarcher.architecture.domain.DomainRoleTopologySupport;

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
        return DomainRoleTopologySupport.isInternalModelSource(segments);
    }

    private static void validateTreePlacement(SourceFile sourceFile, ViolationSink violations) {
        String family = DomainRoleTopologySupport.modelFamily(sourceFile.relativeSegments()).orElse("");
        if (!DomainRoleTopologySupport.isValidModelFamilyName(family)) {
            violations.add(sourceFile.relativePath(), "domain-model-tree-placement",
                    "Internal model types must live under src/domain/<context>/model/<family>/ with a lower-case family name.");
        }
    }
}
