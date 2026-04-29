package saltmarcher.quality.errorprone.view.intenthandler;

import com.google.errorprone.BugPattern;
import com.google.errorprone.VisitorState;
import com.google.errorprone.bugpatterns.BugChecker;
import com.google.errorprone.matchers.Description;
import com.sun.source.tree.CompilationUnitTree;
import java.util.Set;
import saltmarcher.quality.errorprone.view.ViewArchitectureSupport;
import saltmarcher.quality.errorprone.view.ViewRoleDependencySupport;

@BugPattern(
        name = "ViewIntentHandlerDependencyBoundary",
        summary = "IntentHandlers may depend only on their co-located model and local carrier seams.",
        severity = BugPattern.SeverityLevel.ERROR)
public final class ViewIntentHandlerDependencyBoundaryChecker extends BugChecker
        implements BugChecker.CompilationUnitTreeMatcher {

    @Override
    public Description matchCompilationUnit(CompilationUnitTree tree, VisitorState state) {
        if (!ViewArchitectureSupport.isIntentHandlerSource(tree)) {
            return Description.NO_MATCH;
        }

        String packageName = ViewArchitectureSupport.packageName(tree);
        Set<String> forbiddenReferences = ViewRoleDependencySupport.collectForbiddenReferences(
                tree,
                state,
                ViewRoleDependencySupport.SourceRole.INTENT_HANDLER);
        if (forbiddenReferences.isEmpty()) {
            return Description.NO_MATCH;
        }
        return buildDescription(tree)
                .setMessage("IntentHandler package '" + packageName
                        + "' violates IntentHandler dependency boundaries via references: "
                        + String.join(", ", forbiddenReferences))
                .build();
    }
}
