package saltmarcher.architecture.domain.port;

import saltmarcher.architecture.ArchitectureContext;
import saltmarcher.architecture.ArchitectureRule;
import saltmarcher.architecture.SourceFile;
import saltmarcher.architecture.ViolationSink;
import saltmarcher.architecture.domain.DomainRoleTopologySupport;

public final class DomainPortTopologyRules implements ArchitectureRule {

    @Override
    public void check(ArchitectureContext context, ViolationSink violations) {
        for (SourceFile sourceFile : context.sourceFiles(violations)) {
            if (!DomainRoleTopologySupport.isDomainSource(sourceFile)) {
                continue;
            }
            if (DomainRoleTopologySupport.isModelRoleSource(sourceFile, "port")) {
                validatePortPlacement(sourceFile, violations);
                continue;
            }
            if (DomainRoleTopologySupport.hasRoleSuffix(sourceFile, "Port")) {
                violations.add(sourceFile.relativePath(), "domain-port-role-shape",
                        "Port role files may appear only as direct *Port.java files under src/domain/<context>/model/<family>/port/.");
            }
        }
    }

    private static void validatePortPlacement(SourceFile sourceFile, ViolationSink violations) {
        if (!DomainRoleTopologySupport.isModelRoleDirectFile(sourceFile.relativeSegments(), "port")) {
            violations.add(sourceFile.relativePath(), "domain-port-direct-file-placement",
                    "Ports must stay as direct files under src/domain/<context>/model/<family>/port/.");
        }
        if (!DomainRoleTopologySupport.hasRoleSuffix(sourceFile, "Port")) {
            violations.add(sourceFile.relativePath(), "domain-port-role-shape",
                    "Port role files must use the top-level role form *Port.java.");
        }
    }
}
