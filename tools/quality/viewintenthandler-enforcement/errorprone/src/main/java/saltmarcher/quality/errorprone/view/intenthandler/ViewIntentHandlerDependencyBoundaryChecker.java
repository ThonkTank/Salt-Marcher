package saltmarcher.quality.errorprone.view.intenthandler;

import com.google.errorprone.BugPattern;
import com.google.errorprone.VisitorState;
import com.google.errorprone.bugpatterns.BugChecker;
import com.google.errorprone.matchers.Description;
import com.sun.source.tree.CompilationUnitTree;
import java.util.Set;
import saltmarcher.quality.errorprone.view.ViewRole;
import saltmarcher.quality.errorprone.view.ViewSourceDescriptor;

@BugPattern(
        name = "ViewIntentHandlerDependencyBoundary",
        summary = "IntentHandlers may depend only on their co-located model and local carrier seams.",
        severity = BugPattern.SeverityLevel.ERROR)
public final class ViewIntentHandlerDependencyBoundaryChecker extends BugChecker
        implements BugChecker.CompilationUnitTreeMatcher {

    @Override
    public Description matchCompilationUnit(CompilationUnitTree tree, VisitorState state) {
        ViewSourceDescriptor source = ViewSourceDescriptor.describe(tree);
        if (source.role() != ViewRole.INTENT_HANDLER || !source.isActiveRootSource()) {
            return Description.NO_MATCH;
        }

        String packageName = source.packageName();
        Set<String> forbiddenReferences = ViewIntentHandlerDependencySupport.collectForbiddenReferences(tree, state);
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
