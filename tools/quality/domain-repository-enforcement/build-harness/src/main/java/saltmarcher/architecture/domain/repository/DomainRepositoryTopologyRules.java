package saltmarcher.architecture.domain.repository;

import saltmarcher.architecture.ArchitectureContext;
import saltmarcher.architecture.ArchitectureRule;
import saltmarcher.architecture.SourceFile;
import saltmarcher.architecture.ViolationSink;
import saltmarcher.architecture.domain.DomainRoleTopologySupport;

public final class DomainRepositoryTopologyRules implements ArchitectureRule {

    @Override
    public void check(ArchitectureContext context, ViolationSink violations) {
        for (SourceFile sourceFile : context.sourceFiles(violations)) {
            if (!DomainRoleTopologySupport.isDomainSource(sourceFile)) {
                continue;
            }
            if (DomainRoleTopologySupport.isModelRoleSource(sourceFile, "repository")) {
                validateRepositoryPlacement(sourceFile, violations);
                continue;
            }
            if (DomainRoleTopologySupport.hasRoleSuffix(sourceFile, "Repository")) {
                violations.add(sourceFile.relativePath(), "domain-repository-role-shape",
                        "Repository role files may appear only as direct *Repository.java files under src/domain/<context>/model/<family>/repository/.");
            }
        }
    }

    private static void validateRepositoryPlacement(SourceFile sourceFile, ViolationSink violations) {
        if (!DomainRoleTopologySupport.isModelRoleDirectFile(sourceFile.relativeSegments(), "repository")) {
            violations.add(sourceFile.relativePath(), "domain-repository-direct-file-placement",
                    "Repositories must stay as direct files under src/domain/<context>/model/<family>/repository/.");
        }
        if (!DomainRoleTopologySupport.hasRoleSuffix(sourceFile, "Repository")) {
            violations.add(sourceFile.relativePath(), "domain-repository-role-shape",
                    "Repository role files must use the top-level role form *Repository.java.");
        }
    }
}
