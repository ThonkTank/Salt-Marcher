package saltmarcher.quality.pmd.data;

import java.util.Set;
import net.sourceforge.pmd.lang.java.ast.ASTCompilationUnit;
import net.sourceforge.pmd.lang.java.rule.AbstractJavaRule;
import saltmarcher.quality.pmd.support.SaltMarcherSourceFacts;

public final class DataEntrypointRule extends AbstractJavaRule {

    @Override
    public Object visit(ASTCompilationUnit node, Object data) {
        SaltMarcherSourceFacts sourceFacts = SaltMarcherSourceFacts.from(node);
        if (sourceFacts.isDataRoot()) {
            checkServiceRoot(node, data, sourceFacts);
            for (String registeredType : sourceFacts.registeredServiceTypes()) {
                if (isForbiddenDataRootRegistration(registeredType, sourceFacts.featureName())) {
                    asCtx(data).addViolationWithMessage(node,
                            "Root service entrypoint may register only own-feature domain boundary types."
                                    + " Found registration for '" + registeredType + "'.");
                }
            }
        }
        if (sourceFacts.isDataModel() && sourceFacts.fileName().contains("PersistenceSchema")) {
            checkPersistenceSchema(node, data, sourceFacts);
        }
        return data;
    }

    private void checkServiceRoot(ASTCompilationUnit node, Object data, SaltMarcherSourceFacts sourceFacts) {
        if (!sourceFacts.isExpectedServiceRootFileName()) {
            asCtx(data).addViolationWithMessage(node,
                    "Root service entrypoint must be named '" + sourceFacts.expectedServiceRootFileName() + "'.");
        }
        if (!sourceFacts.hasExplicitPublicFinalClass()) {
            asCtx(data).addViolationWithMessage(node, "Root service entrypoint must be declared public final.");
        }
        if (!sourceFacts.hasExplicitPublicNoArgConstructor()) {
            asCtx(data).addViolationWithMessage(node,
                    "Root service entrypoint must declare a public no-arg constructor.");
        }
        if (!sourceFacts.text().contains("ServiceContribution")) {
            asCtx(data).addViolationWithMessage(node,
                    "Root service entrypoint must implement shell.api.ServiceContribution.");
        }
        if (!sourceFacts.hasServiceRegisterMethod()) {
            asCtx(data).addViolationWithMessage(node,
                    "Root service entrypoint must declare register(ServiceRegistry.Builder).");
        }
        if (sourceFacts.hasInstanceFields()) {
            asCtx(data).addViolationWithMessage(node,
                    "Root service entrypoint must stay stateless and must not declare instance fields.");
        }
        validateExposedMembers(node, data, sourceFacts, Set.of(sourceFacts.simpleName(), "register"));
    }

    private void checkPersistenceSchema(ASTCompilationUnit node, Object data, SaltMarcherSourceFacts sourceFacts) {
        if (!sourceFacts.isExpectedPersistenceSchemaFileName()) {
            asCtx(data).addViolationWithMessage(node,
                    "Persistence schema must be named '" + sourceFacts.expectedPersistenceSchemaFileName() + "'.");
        }
    }

    private void validateExposedMembers(
            ASTCompilationUnit node,
            Object data,
            SaltMarcherSourceFacts sourceFacts,
            Set<String> allowedNames) {
        for (String declaration : sourceFacts.exposedExecutableDeclarations()) {
            if (allowedNames.stream().anyMatch(name -> declaration.contains(name + "("))) {
                continue;
            }
            asCtx(data).addViolationWithMessage(node,
                    "Root entrypoint exposes unsupported public/protected member declaration '" + declaration + "'.");
        }
    }

    private static boolean isForbiddenDataRootRegistration(String registeredType, String featureName) {
        String domainFeaturePrefix = "src.domain." + featureName + ".";
        if (!registeredType.startsWith(domainFeaturePrefix)) {
            return true;
        }
        String remainder = registeredType.substring(domainFeaturePrefix.length());
        return remainder.contains(".") || !remainder.endsWith("ApplicationService");
    }
}
