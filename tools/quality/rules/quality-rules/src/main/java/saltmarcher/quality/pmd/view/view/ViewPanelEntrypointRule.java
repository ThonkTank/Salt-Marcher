package saltmarcher.quality.pmd.view.view;

import java.util.Set;
import net.sourceforge.pmd.lang.java.ast.ASTCompilationUnit;
import net.sourceforge.pmd.lang.java.rule.AbstractJavaRule;
import saltmarcher.quality.pmd.support.SaltMarcherSourceFacts;

public final class ViewPanelEntrypointRule extends AbstractJavaRule {

    private static final Set<String> DETAILS_VIEW_PANEL_SUFFIXES = Set.of("DetailsView");

    @Override
    public Object visit(ASTCompilationUnit node, Object data) {
        SaltMarcherSourceFacts sourceFacts = SaltMarcherSourceFacts.from(node);
        if (!sourceFacts.isViewPanelSource()) {
            return data;
        }
        boolean genericView = sourceFacts.simpleName().endsWith("View")
                && !sourceFacts.simpleName().endsWith("ViewModel")
                && !sourceFacts.simpleName().endsWith("PresentationModel")
                && !sourceFacts.simpleName().endsWith("ContributionModel")
                && !sourceFacts.simpleName().endsWith("ContentModel");
        boolean reusableGenericView = sourceFacts.relativePath().startsWith("src/view/slotcontent/")
                && sourceFacts.simpleName().endsWith("View")
                && !sourceFacts.simpleName().endsWith("ViewModel")
                && !sourceFacts.simpleName().endsWith("PresentationModel")
                && !sourceFacts.simpleName().endsWith("ContributionModel")
                && !sourceFacts.simpleName().endsWith("ContentModel");
        boolean activeRootGenericView = !sourceFacts.relativePath().startsWith("src/view/slotcontent/")
                && genericView;
        Set<String> allowedSuffixes = allowedViewPanelSuffixes(sourceFacts);
        if (!activeRootGenericView
                && !reusableGenericView
                && allowedSuffixes.stream().noneMatch(sourceFacts.simpleName()::endsWith)) {
            asCtx(data).addViolationWithMessage(node,
                    "Passive panel views under " + viewAreaName(sourceFacts)
                            + " must end with one of " + allowedSuffixes
                            + "; active-root and slotcontent views must be real *View.java role files.");
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
        return data;
    }

    private static Set<String> allowedViewPanelSuffixes(SaltMarcherSourceFacts sourceFacts) {
        String path = sourceFacts.relativePath();
        if (path.startsWith("src/view/slotcontent/details/")) {
            return DETAILS_VIEW_PANEL_SUFFIXES;
        }
        return Set.of("View");
    }

    private static String viewAreaName(SaltMarcherSourceFacts sourceFacts) {
        String path = sourceFacts.relativePath();
        if (path.startsWith("src/view/leftbartabs/")) {
            return "src/view/leftbartabs";
        }
        if (path.startsWith("src/view/dropdowns/")) {
            return "src/view/dropdowns";
        }
        if (path.startsWith("src/view/statetabs/")) {
            return "src/view/statetabs";
        }
        if (path.startsWith("src/view/slotcontent/details/")) {
            return "src/view/slotcontent/details";
        }
        return "src/view/slotcontent";
    }
}
