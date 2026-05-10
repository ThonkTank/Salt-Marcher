package saltmarcher.architecture.domain.helper;

import saltmarcher.architecture.ArchitectureContext;
import saltmarcher.architecture.ArchitectureRule;
import saltmarcher.architecture.SourceFile;
import saltmarcher.architecture.ViolationSink;
import saltmarcher.architecture.domain.DomainRoleTopologySupport;

public final class DomainHelperTopologyRules implements ArchitectureRule {

    @Override
    public void check(ArchitectureContext context, ViolationSink violations) {
        for (SourceFile sourceFile : context.sourceFiles(violations)) {
            if (!DomainRoleTopologySupport.isDomainSource(sourceFile)) {
                continue;
            }
            if (DomainRoleTopologySupport.isModelRoleSource(sourceFile, "helper")) {
                validateHelperPlacement(sourceFile, violations);
                continue;
            }
            if (DomainRoleTopologySupport.hasRoleSuffix(sourceFile, "Helper")) {
                violations.add(sourceFile.relativePath(), "domain-helper-role-shape",
                        "Helper role files may appear only as direct *Helper.java files under src/domain/<context>/model/<family>/helper/.");
            }
        }
    }

    private static void validateHelperPlacement(SourceFile sourceFile, ViolationSink violations) {
        if (!DomainRoleTopologySupport.isModelRoleDirectFile(sourceFile.relativeSegments(), "helper")) {
            violations.add(sourceFile.relativePath(), "domain-helper-direct-file-placement",
                    "Helpers must stay as direct files under src/domain/<context>/model/<family>/helper/.");
        }
        if (!DomainRoleTopologySupport.hasRoleSuffix(sourceFile, "Helper")) {
            violations.add(sourceFile.relativePath(), "domain-helper-role-shape",
                    "Helper role files must use the top-level role form *Helper.java.");
        }
    }
}
