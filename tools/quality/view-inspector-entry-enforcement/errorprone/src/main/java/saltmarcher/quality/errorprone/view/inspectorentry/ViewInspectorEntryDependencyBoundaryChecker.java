package saltmarcher.quality.errorprone.view.inspectorentry;

import com.google.errorprone.BugPattern;
import com.google.errorprone.VisitorState;
import com.google.errorprone.bugpatterns.BugChecker;
import com.google.errorprone.matchers.Description;
import com.sun.source.tree.CompilationUnitTree;
import java.util.Set;
import saltmarcher.quality.errorprone.view.ViewArchitectureSupport;

@BugPattern(
        name = "ViewInspectorEntryDependencyBoundary",
        summary = "InspectorEntry adapters may depend only on their local detail slotcontent, InspectorEntrySpec, and published domain carriers.",
        severity = BugPattern.SeverityLevel.ERROR)
public final class ViewInspectorEntryDependencyBoundaryChecker extends BugChecker
        implements BugChecker.CompilationUnitTreeMatcher {

    @Override
    public Description matchCompilationUnit(CompilationUnitTree tree, VisitorState state) {
        if (!ViewInspectorEntrySupport.isInspectorEntrySource(tree)) {
            return Description.NO_MATCH;
        }

        String packageName = ViewArchitectureSupport.packageName(tree);
        Set<String> forbiddenReferences = ViewInspectorEntrySupport.collectForbiddenReferences(tree, state);
        if (forbiddenReferences.isEmpty()) {
            return Description.NO_MATCH;
        }
        return buildDescription(tree)
                .setMessage("InspectorEntry package '" + packageName
                        + "' violates InspectorEntry dependency boundaries via references: "
                        + String.join(", ", forbiddenReferences))
                .build();
    }
}
