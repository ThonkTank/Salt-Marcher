package saltmarcher.quality.pmd;

import java.util.Set;
import net.sourceforge.pmd.lang.java.ast.ASTCompilationUnit;
import net.sourceforge.pmd.lang.java.rule.AbstractJavaRule;

public final class SaltMarcherEntrypointRule extends AbstractJavaRule {

    private static final Set<String> VIEW_CONTRIBUTION_SUFFIXES = Set.of("Contribution");
    private static final Set<String> VIEW_PANEL_SUFFIXES = Set.of(
            "ControlsView",
            "MainView",
            "DetailsView",
            "StateView",
            "TopBarView");

    @Override
    public Object visit(ASTCompilationUnit node, Object data) {
        SaltMarcherSourceFacts sourceFacts = SaltMarcherSourceFacts.from(node);
        if (sourceFacts.isViewContributionSource()) {
            checkViewContribution(node, data, sourceFacts);
        }
        if (sourceFacts.isViewPanelSource()) {
            checkViewPanel(node, data, sourceFacts);
        }
        if (sourceFacts.isDataRoot()) {
            checkServiceRoot(node, data, sourceFacts);
        }
        if (sourceFacts.isDataModel() && sourceFacts.fileName().contains("PersistenceSchema")) {
            checkPersistenceSchema(node, data, sourceFacts);
        }
        return data;
    }

    private void checkViewContribution(ASTCompilationUnit node, Object data, SaltMarcherSourceFacts sourceFacts) {
        if (VIEW_CONTRIBUTION_SUFFIXES.stream().noneMatch(sourceFacts.simpleName()::endsWith)) {
            asCtx(data).addViolationWithMessage(node,
                    "View shell contributions must be named *Contribution.");
        }
        if (!sourceFacts.hasExplicitPublicFinalClass()) {
            asCtx(data).addViolationWithMessage(node, "View shell contribution must be declared public final.");
        }
        if (!sourceFacts.hasExplicitPublicNoArgConstructor()) {
            asCtx(data).addViolationWithMessage(node,
                    "View shell contribution must declare a public no-arg constructor for shell discovery.");
        }
        if (!sourceFacts.text().contains("implements ShellContribution")
                && !sourceFacts.text().contains("implements shell.api.ShellContribution")) {
            asCtx(data).addViolationWithMessage(node,
                    "View shell contribution must implement shell.api.ShellContribution.");
        }
        if (!sourceFacts.hasRegistrationSpecMethod()) {
            asCtx(data).addViolationWithMessage(node,
                    "View shell contribution must declare ShellContributionSpec registrationSpec().");
        }
        if (!sourceFacts.hasBindMethod()) {
            asCtx(data).addViolationWithMessage(node,
                    "View shell contribution must declare ShellBinding bind(ShellRuntimeContext).");
        }

        ContributionSpecKind specKind = detectContributionSpecKind(sourceFacts.text());
        if (specKind == ContributionSpecKind.UNKNOWN) {
            asCtx(data).addViolationWithMessage(node,
                    "View shell contribution must construct exactly one allowed shell contribution spec type.");
        }
        if (sourceFacts.text().contains("defaultLanding") && specKind != ContributionSpecKind.TAB) {
            asCtx(data).addViolationWithMessage(node, "defaultLanding only applies to ShellTabSpec contributions.");
        }
    }

    private void checkViewPanel(ASTCompilationUnit node, Object data, SaltMarcherSourceFacts sourceFacts) {
        boolean reusableGenericView = sourceFacts.relativePath().startsWith("src/view/views/")
                && sourceFacts.simpleName().endsWith("View");
        if (!reusableGenericView && VIEW_PANEL_SUFFIXES.stream().noneMatch(sourceFacts.simpleName()::endsWith)) {
            asCtx(data).addViolationWithMessage(node,
                    "Passive panel views must end with ControlsView, MainView, DetailsView, StateView, or TopBarView; reusable generic views under src/view/views must end with View.");
        }
        if (!sourceFacts.hasExplicitPublicFinalClass()) {
            asCtx(data).addViolationWithMessage(node, "Passive panel view must be declared public final.");
        }
        if (sourceFacts.text().contains("ShellContribution")
                || sourceFacts.hasRegistrationSpecMethod()
                || sourceFacts.hasBindMethod()) {
            asCtx(data).addViolationWithMessage(node,
                    "Passive panel views must not own shell registration or bind shell content.");
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
