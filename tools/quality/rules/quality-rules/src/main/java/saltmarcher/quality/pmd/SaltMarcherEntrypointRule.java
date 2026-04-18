package saltmarcher.quality.pmd;

import java.util.Set;
import net.sourceforge.pmd.lang.java.ast.ASTCompilationUnit;
import net.sourceforge.pmd.lang.java.rule.AbstractJavaRule;

public final class SaltMarcherEntrypointRule extends AbstractJavaRule {

    @Override
    public Object visit(ASTCompilationUnit node, Object data) {
        SaltMarcherSourceFacts sourceFacts = SaltMarcherSourceFacts.from(node);
        if (sourceFacts.isViewRoot()) {
            checkViewRoot(node, data, sourceFacts);
        }
        if (sourceFacts.isDataRoot()) {
            checkServiceRoot(node, data, sourceFacts);
        }
        if (sourceFacts.isDataModel() && sourceFacts.fileName().contains("PersistenceSchema")) {
            checkPersistenceSchema(node, data, sourceFacts);
        }
        return data;
    }

    private void checkViewRoot(ASTCompilationUnit node, Object data, SaltMarcherSourceFacts sourceFacts) {
        if (!sourceFacts.fileName().equals(sourceFacts.expectedViewRootFileName())) {
            asCtx(data).addViolationWithMessage(node,
                    "Root view entrypoint must be named '" + sourceFacts.expectedViewRootFileName() + "'.");
        }
        if (!sourceFacts.hasExplicitPublicFinalClass()) {
            asCtx(data).addViolationWithMessage(node, "Root view entrypoint must be declared public final.");
        }
        if (!sourceFacts.hasExplicitPublicNoArgConstructor()) {
            asCtx(data).addViolationWithMessage(node, "Root view entrypoint must declare a public no-arg constructor.");
        }
        if (!sourceFacts.text().contains("ShellViewContribution")) {
            asCtx(data).addViolationWithMessage(node,
                    "Root view entrypoint must implement shell.api.ShellViewContribution.");
        }
        if (!sourceFacts.hasRegistrationSpecMethod()) {
            asCtx(data).addViolationWithMessage(node,
                    "Root view entrypoint must declare ShellContributionSpec registrationSpec().");
        }
        if (!sourceFacts.hasCreateScreenMethod()) {
            asCtx(data).addViolationWithMessage(node,
                    "Root view entrypoint must declare ShellScreen createScreen(ShellRuntimeContext).");
        }
        if (sourceFacts.hasInstanceFields()) {
            asCtx(data).addViolationWithMessage(node,
                    "Root view entrypoint must stay stateless and must not declare instance fields.");
        }
        validateExposedMembers(node, data, sourceFacts, Set.of(
                sourceFacts.simpleName(),
                "registrationSpec",
                "createScreen"));

        ContributionSpecKind specKind = detectContributionSpecKind(sourceFacts.text());
        if (specKind == ContributionSpecKind.UNKNOWN) {
            asCtx(data).addViolationWithMessage(node,
                    "Root view entrypoint must construct exactly one allowed contribution spec type.");
        }
        if (sourceFacts.text().contains("defaultLanding") && specKind != ContributionSpecKind.TAB) {
            asCtx(data).addViolationWithMessage(node, "defaultLanding only applies to ShellTabSpec contributions.");
        }
    }

    private void checkServiceRoot(ASTCompilationUnit node, Object data, SaltMarcherSourceFacts sourceFacts) {
        if (!sourceFacts.fileName().equals(sourceFacts.expectedServiceRootFileName())) {
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
        validateExposedMembers(node, data, sourceFacts, Set.of(
                sourceFacts.simpleName(),
                "register"));
    }

    private void checkPersistenceSchema(ASTCompilationUnit node, Object data, SaltMarcherSourceFacts sourceFacts) {
        if (!sourceFacts.fileName().equals(sourceFacts.expectedPersistenceSchemaFileName())) {
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

    private static ContributionSpecKind detectContributionSpecKind(String sourceText) {
        int matches = 0;
        ContributionSpecKind result = ContributionSpecKind.UNKNOWN;
        if (sourceText.contains("new ShellTabSpec(")) {
            matches++;
            result = ContributionSpecKind.TAB;
        }
        if (sourceText.contains("new ShellTopBarSpec(")) {
            matches++;
            result = ContributionSpecKind.TOP_BAR;
        }
        if (sourceText.contains("new ShellRuntimeStateSpec(")) {
            matches++;
            result = ContributionSpecKind.RUNTIME_STATE;
        }
        return matches == 1 ? result : ContributionSpecKind.UNKNOWN;
    }

    private enum ContributionSpecKind {
        TAB,
        TOP_BAR,
        RUNTIME_STATE,
        UNKNOWN
    }
}
