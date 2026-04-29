package saltmarcher.quality.errorprone.view.binder;

import com.google.errorprone.BugPattern;
import com.google.errorprone.VisitorState;
import com.google.errorprone.bugpatterns.BugChecker;
import com.google.errorprone.matchers.Description;
import com.sun.source.tree.CompilationUnitTree;
import java.util.Set;
import saltmarcher.quality.errorprone.view.ViewArchitectureSupport;
import saltmarcher.quality.errorprone.view.ViewRoleDependencySupport;

@BugPattern(
        name = "ViewBinderDependencyBoundary",
        summary = "Binders may depend only on documented shell, domain, view, and slotcontent seams.",
        severity = BugPattern.SeverityLevel.ERROR)
public final class ViewBinderDependencyBoundaryChecker extends BugChecker
        implements BugChecker.CompilationUnitTreeMatcher {

    @Override
    public Description matchCompilationUnit(CompilationUnitTree tree, VisitorState state) {
        if (!ViewArchitectureSupport.isBinderSource(tree)) {
            return Description.NO_MATCH;
        }

        String packageName = ViewArchitectureSupport.packageName(tree);
        Set<String> forbiddenReferences = ViewRoleDependencySupport.collectForbiddenReferences(
                tree,
                state,
                ViewRoleDependencySupport.SourceRole.BINDER);
        if (forbiddenReferences.isEmpty()) {
            return Description.NO_MATCH;
        }
        return buildDescription(tree)
                .setMessage("Binder package '" + packageName
                        + "' violates Binder dependency boundaries via references: "
                        + String.join(", ", forbiddenReferences))
                .build();
    }
}
