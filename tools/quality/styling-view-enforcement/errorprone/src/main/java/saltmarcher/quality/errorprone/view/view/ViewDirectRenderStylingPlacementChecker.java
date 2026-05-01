package saltmarcher.quality.errorprone.view.view;

import com.google.errorprone.BugPattern;
import com.google.errorprone.VisitorState;
import com.google.errorprone.bugpatterns.BugChecker;
import com.google.errorprone.matchers.Description;
import com.sun.source.tree.CompilationUnitTree;
import java.util.Set;

@BugPattern(
        name = "ViewDirectRenderStylingPlacement",
        summary = "Passive views may host local JavaFX style values only inside the documented direct-render exception.",
        severity = BugPattern.SeverityLevel.ERROR)
public final class ViewDirectRenderStylingPlacementChecker extends BugChecker
        implements BugChecker.CompilationUnitTreeMatcher {

    private static final Set<String> DIRECT_RENDER_EXCEPTION_TYPES = Set.of(
            "src.view.slotcontent.primitives.mapcanvas.MapCanvasView",
            "src.view.slotcontent.main.dungeonmap.DungeonMapView"
    );

    @Override
    public Description matchCompilationUnit(CompilationUnitTree tree, VisitorState state) {
        if (!ViewProgrammaticStylingSupport.isPassiveViewSource(tree)) {
            return Description.NO_MATCH;
        }

        Set<String> violations = ViewProgrammaticStylingSupport.collectViolations(tree);
        if (violations.isEmpty()) {
            return Description.NO_MATCH;
        }

        String qualifiedTypeName = ViewProgrammaticStylingSupport.qualifiedTopLevelTypeName(tree);
        if (DIRECT_RENDER_EXCEPTION_TYPES.contains(qualifiedTypeName)) {
            return Description.NO_MATCH;
        }

        return buildDescription(tree)
                .setMessage("Passive View '" + qualifiedTypeName
                        + "' defines local JavaFX style values outside the documented direct-render exception. "
                        + "Only " + String.join(", ", DIRECT_RENDER_EXCEPTION_TYPES)
                        + " may currently host direct-render styling code. Violations: "
                        + String.join(", ", violations))
                .build();
    }
}
