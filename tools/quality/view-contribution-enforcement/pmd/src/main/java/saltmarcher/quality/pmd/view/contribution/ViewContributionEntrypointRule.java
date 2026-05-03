package saltmarcher.quality.pmd.view.contribution;

import java.util.Set;
import net.sourceforge.pmd.lang.java.ast.ASTCompilationUnit;
import net.sourceforge.pmd.lang.java.rule.AbstractJavaRule;
import saltmarcher.quality.pmd.support.SaltMarcherSourceFacts;

public final class ViewContributionEntrypointRule extends AbstractJavaRule {

    private static final Set<String> VIEW_CONTRIBUTION_SUFFIXES = Set.of("Contribution");

    @Override
    public Object visit(ASTCompilationUnit node, Object data) {
        SaltMarcherSourceFacts sourceFacts = SaltMarcherSourceFacts.from(node);
        if (isViewContributionSource(sourceFacts)) {
            checkViewContribution(node, data, sourceFacts);
        }
        return data;
    }

    private static boolean isViewContributionSource(SaltMarcherSourceFacts sourceFacts) {
        String[] pathSegments = sourceFacts.relativePath().split("/");
        return pathSegments.length == 5
                && "src".equals(pathSegments[0])
                && "view".equals(pathSegments[1])
                && Set.of("leftbartabs", "statetabs", "dropdowns").contains(pathSegments[2])
                && sourceFacts.simpleName().endsWith("Contribution");
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
        if (!sourceFacts.implementsType("shell.api.ShellContribution")) {
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

        ContributionSpecKind specKind = detectContributionSpecKind(sourceFacts);
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
        if (sourceFacts.text().contains("defaultLanding") && specKind != ContributionSpecKind.LEFT_BAR_TAB) {
            asCtx(data).addViolationWithMessage(node, "defaultLanding only applies to ShellLeftBarTabSpec contributions.");
        }
    }

    private static ContributionSpecKind detectContributionSpecKind(SaltMarcherSourceFacts sourceFacts) {
        int matches = 0;
        ContributionSpecKind result = ContributionSpecKind.UNKNOWN;
        for (String constructedType : sourceFacts.constructedTypes()) {
            if ("shell.api.ShellLeftBarTabSpec".equals(constructedType)) {
                matches++;
                result = ContributionSpecKind.LEFT_BAR_TAB;
            } else if ("shell.api.ShellTopBarSpec".equals(constructedType)) {
                matches++;
                result = ContributionSpecKind.TOP_BAR;
            } else if ("shell.api.ShellStateTabSpec".equals(constructedType)) {
                matches++;
                result = ContributionSpecKind.STATE_TAB;
            }
        }
        return matches == 1 ? result : ContributionSpecKind.UNKNOWN;
    }

    private static ContributionSpecKind expectedContributionSpecKind(SaltMarcherSourceFacts sourceFacts) {
        String path = sourceFacts.relativePath();
        if (path.startsWith("src/view/leftbartabs/")) {
            return ContributionSpecKind.LEFT_BAR_TAB;
        }
        if (path.startsWith("src/view/dropdowns/")) {
            return ContributionSpecKind.TOP_BAR;
        }
        if (path.startsWith("src/view/statetabs/")) {
            return ContributionSpecKind.STATE_TAB;
        }
        return ContributionSpecKind.UNKNOWN;
    }

    private enum ContributionSpecKind {
        LEFT_BAR_TAB("ShellLeftBarTabSpec"),
        TOP_BAR("ShellTopBarSpec"),
        STATE_TAB("ShellStateTabSpec"),
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
