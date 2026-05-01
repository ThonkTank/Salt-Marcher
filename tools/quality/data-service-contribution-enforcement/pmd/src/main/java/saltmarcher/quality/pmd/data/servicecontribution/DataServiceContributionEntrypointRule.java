package saltmarcher.quality.pmd.data.servicecontribution;

import java.util.Set;
import net.sourceforge.pmd.lang.java.ast.ASTCompilationUnit;
import net.sourceforge.pmd.lang.java.rule.AbstractJavaRule;
import saltmarcher.quality.pmd.support.SaltMarcherSourceFacts;

public final class DataServiceContributionEntrypointRule extends AbstractJavaRule {

    @Override
    public Object visit(ASTCompilationUnit node, Object data) {
        SaltMarcherSourceFacts sourceFacts = SaltMarcherSourceFacts.from(node);
        if (!sourceFacts.isDataRoot()) {
            return data;
        }

        checkServiceRoot(node, data, sourceFacts);
        for (String registeredType : sourceFacts.registeredServiceTypes()) {
            if (isForbiddenDataRootRegistration(registeredType, sourceFacts.featureName())) {
                asCtx(data).addViolationWithMessage(node,
                        "Data ServiceContribution root may register only own-feature root domain ApplicationService types."
                                + " Found registration for '" + registeredType + "'.");
            }
        }
        return data;
    }

    private void checkServiceRoot(ASTCompilationUnit node, Object data, SaltMarcherSourceFacts sourceFacts) {
        if (!sourceFacts.isExpectedServiceRootFileName()) {
            asCtx(data).addViolationWithMessage(node,
                    "Data ServiceContribution root must be named '" + sourceFacts.expectedServiceRootFileName() + "'.");
        }
        if (!sourceFacts.hasExplicitPublicFinalClass()) {
            asCtx(data).addViolationWithMessage(node,
                    "Data ServiceContribution root must be declared public final.");
        }
        if (!sourceFacts.hasExplicitPublicNoArgConstructor()) {
            asCtx(data).addViolationWithMessage(node,
                    "Data ServiceContribution root must declare a public no-arg constructor.");
        }
        if (!sourceFacts.implementsType("shell.api.ServiceContribution")) {
            asCtx(data).addViolationWithMessage(node,
                    "Data ServiceContribution root must implement shell.api.ServiceContribution.");
        }
        if (!sourceFacts.hasServiceRegisterMethod()) {
            asCtx(data).addViolationWithMessage(node,
                    "Data ServiceContribution root must declare register(ServiceRegistry.Builder).");
        }
        if (sourceFacts.hasInstanceFields()) {
            asCtx(data).addViolationWithMessage(node,
                    "Data ServiceContribution root must stay stateless and must not declare instance fields.");
        }
        validateExposedMembers(node, data, sourceFacts, Set.of(sourceFacts.simpleName(), "register"));
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
                    "Data ServiceContribution root exposes unsupported public/protected member declaration '"
                            + declaration + "'.");
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
