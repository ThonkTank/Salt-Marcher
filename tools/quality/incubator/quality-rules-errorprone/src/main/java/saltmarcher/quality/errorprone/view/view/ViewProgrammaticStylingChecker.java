package saltmarcher.quality.errorprone.view.view;

import com.google.errorprone.BugPattern;
import com.google.errorprone.VisitorState;
import com.google.errorprone.bugpatterns.BugChecker;
import com.google.errorprone.matchers.Description;
import com.sun.source.tree.CompilationUnitTree;
import java.util.Set;

@BugPattern(
        name = "ViewProgrammaticStyling",
        summary = "Visual style values must come from centralized stylesheets outside the documented passive-View direct-render exception.",
        severity = BugPattern.SeverityLevel.ERROR)
public final class ViewProgrammaticStylingChecker extends BugChecker
        implements BugChecker.CompilationUnitTreeMatcher {

    @Override
    public Description matchCompilationUnit(CompilationUnitTree tree, VisitorState state) {
        if (!StylingLayerProgrammaticStylingSupport.isTrackedLayerSource(tree)) {
            return Description.NO_MATCH;
        }

        Set<String> violations = StylingLayerProgrammaticStylingSupport.collectViolations(tree);
        if (violations.isEmpty()) {
            return Description.NO_MATCH;
        }
        String packageName = tree.getPackageName() == null ? "" : tree.getPackageName().toString();
        return buildDescription(tree)
                .setMessage("Package '" + packageName
                        + "' defines visual style values outside centralized resources/salt-marcher.css and outside the dedicated passive-View direct-render exception. Violations: "
                        + String.join(", ", violations))
                .build();
    }
}
