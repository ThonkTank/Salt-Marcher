package saltmarcher.quality.pmd;

import java.util.Set;
import java.util.regex.Pattern;
import net.sourceforge.pmd.lang.java.ast.ASTCompilationUnit;
import net.sourceforge.pmd.lang.java.rule.AbstractJavaRule;

public final class SaltMarcherEntrypointRule extends AbstractJavaRule {

    private static final Set<String> VIEW_CONTRIBUTION_SUFFIXES = Set.of("Contribution");
    private static final Set<String> TAB_VIEW_PANEL_SUFFIXES = Set.of("ControlsView", "MainView", "StateView");
    private static final Set<String> TOP_BAR_VIEW_PANEL_SUFFIXES = Set.of("TopBarView");
    private static final Set<String> RUNTIME_STATE_VIEW_PANEL_SUFFIXES = Set.of("StateView");
    private static final Set<String> DETAILS_VIEW_PANEL_SUFFIXES = Set.of("DetailsView");
    private static final Pattern SHELL_TAB_SPEC_CONSTRUCTOR_PATTERN =
            Pattern.compile("\\bnew\\s+(?:shell\\.api\\.)?ShellTabSpec\\s*\\(");
    private static final Pattern SHELL_TOP_BAR_SPEC_CONSTRUCTOR_PATTERN =
            Pattern.compile("\\bnew\\s+(?:shell\\.api\\.)?ShellTopBarSpec\\s*\\(");
    private static final Pattern SHELL_RUNTIME_STATE_SPEC_CONSTRUCTOR_PATTERN =
            Pattern.compile("\\bnew\\s+(?:shell\\.api\\.)?ShellRuntimeStateSpec\\s*\\(");

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
        ContributionSpecKind expectedSpecKind = expectedContributionSpecKind(sourceFacts);
        if (specKind != ContributionSpecKind.UNKNOWN
                && expectedSpecKind != ContributionSpecKind.UNKNOWN
                && specKind != expectedSpecKind) {
            asCtx(data).addViolationWithMessage(node,
                    "View shell contribution under " + sourceFacts.relativePath()
                            + " must construct " + expectedSpecKind.specTypeName() + ".");
        }
        if (sourceFacts.text().contains("defaultLanding") && specKind != ContributionSpecKind.TAB) {
            asCtx(data).addViolationWithMessage(node, "defaultLanding only applies to ShellTabSpec contributions.");
        }
    }

    private void checkViewPanel(ASTCompilationUnit node, Object data, SaltMarcherSourceFacts sourceFacts) {
        boolean reusableGenericView = sourceFacts.relativePath().startsWith("src/view/views/")
                && sourceFacts.simpleName().endsWith("View")
                && !sourceFacts.simpleName().endsWith("ViewModel");
        Set<String> allowedSuffixes = allowedViewPanelSuffixes(sourceFacts);
        if (!reusableGenericView && allowedSuffixes.stream().noneMatch(sourceFacts.simpleName()::endsWith)) {
            asCtx(data).addViolationWithMessage(node,
                    "Passive panel views under " + viewAreaName(sourceFacts)
                            + " must end with one of " + allowedSuffixes
                            + "; reusable generic views under src/view/views must end with View.");
        }
        if (!reusableGenericView && !sourceFacts.hasExplicitPublicFinalClass()) {
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
        if (SHELL_TAB_SPEC_CONSTRUCTOR_PATTERN.matcher(sourceText).find()) {
            matches++;
            result = ContributionSpecKind.TAB;
        }
        if (SHELL_TOP_BAR_SPEC_CONSTRUCTOR_PATTERN.matcher(sourceText).find()) {
            matches++;
            result = ContributionSpecKind.TOP_BAR;
        }
        if (SHELL_RUNTIME_STATE_SPEC_CONSTRUCTOR_PATTERN.matcher(sourceText).find()) {
            matches++;
            result = ContributionSpecKind.RUNTIME_STATE;
        }
        return matches == 1 ? result : ContributionSpecKind.UNKNOWN;
    }

    private static ContributionSpecKind expectedContributionSpecKind(SaltMarcherSourceFacts sourceFacts) {
        String path = sourceFacts.relativePath();
        if (path.startsWith("src/view/tabs/")) {
            return ContributionSpecKind.TAB;
        }
        if (path.startsWith("src/view/topbar/")) {
            return ContributionSpecKind.TOP_BAR;
        }
        if (path.startsWith("src/view/state/")) {
            return ContributionSpecKind.RUNTIME_STATE;
        }
        return ContributionSpecKind.UNKNOWN;
    }

    private static Set<String> allowedViewPanelSuffixes(SaltMarcherSourceFacts sourceFacts) {
        String path = sourceFacts.relativePath();
        if (path.startsWith("src/view/tabs/")) {
            return TAB_VIEW_PANEL_SUFFIXES;
        }
        if (path.startsWith("src/view/topbar/")) {
            return TOP_BAR_VIEW_PANEL_SUFFIXES;
        }
        if (path.startsWith("src/view/state/")) {
            return RUNTIME_STATE_VIEW_PANEL_SUFFIXES;
        }
        if (path.startsWith("src/view/details/")) {
            return DETAILS_VIEW_PANEL_SUFFIXES;
        }
        return Set.of("View");
    }

    private static String viewAreaName(SaltMarcherSourceFacts sourceFacts) {
        String path = sourceFacts.relativePath();
        if (path.startsWith("src/view/tabs/")) {
            return "src/view/tabs";
        }
        if (path.startsWith("src/view/topbar/")) {
            return "src/view/topbar";
        }
        if (path.startsWith("src/view/state/")) {
            return "src/view/state";
        }
        if (path.startsWith("src/view/details/")) {
            return "src/view/details";
        }
        return "src/view/views";
    }

    private enum ContributionSpecKind {
        TAB("ShellTabSpec"),
        TOP_BAR("ShellTopBarSpec"),
        RUNTIME_STATE("ShellRuntimeStateSpec"),
        UNKNOWN("one allowed shell contribution spec");

        private final String specTypeName;

        ContributionSpecKind(String specTypeName) {
            this.specTypeName = specTypeName;
        }

        private String specTypeName() {
            return specTypeName;
        }
    }
}
