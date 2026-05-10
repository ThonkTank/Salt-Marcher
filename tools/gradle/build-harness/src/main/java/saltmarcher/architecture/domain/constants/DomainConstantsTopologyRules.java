package saltmarcher.architecture.domain.constants;

import saltmarcher.architecture.ArchitectureContext;
import saltmarcher.architecture.ArchitectureRule;
import saltmarcher.architecture.SourceFile;
import saltmarcher.architecture.ViolationSink;
import saltmarcher.architecture.domain.DomainRoleTopologySupport;

public final class DomainConstantsTopologyRules implements ArchitectureRule {

    @Override
    public void check(ArchitectureContext context, ViolationSink violations) {
        for (SourceFile sourceFile : context.sourceFiles(violations)) {
            if (!DomainRoleTopologySupport.isDomainSource(sourceFile)) {
                continue;
            }
            if (DomainRoleTopologySupport.isModelRoleSource(sourceFile, "constants")) {
                validateConstantsPlacement(sourceFile, violations);
                continue;
            }
            if (DomainRoleTopologySupport.hasRoleSuffix(sourceFile, "Constants")) {
                violations.add(sourceFile.relativePath(), "domain-constants-role-shape",
                        "Constants role files may appear only as direct *Constants.java files under src/domain/<context>/model/<family>/constants/.");
            }
        }
    }

    private static void validateConstantsPlacement(SourceFile sourceFile, ViolationSink violations) {
        if (!DomainRoleTopologySupport.isModelRoleDirectFile(sourceFile.relativeSegments(), "constants")) {
            violations.add(sourceFile.relativePath(), "domain-constants-direct-file-placement",
                    "Constants must stay as direct files under src/domain/<context>/model/<family>/constants/.");
        }
        if (!DomainRoleTopologySupport.hasRoleSuffix(sourceFile, "Constants")) {
            violations.add(sourceFile.relativePath(), "domain-constants-role-shape",
                    "Constants role files must use the top-level role form *Constants.java.");
        }
    }
}
