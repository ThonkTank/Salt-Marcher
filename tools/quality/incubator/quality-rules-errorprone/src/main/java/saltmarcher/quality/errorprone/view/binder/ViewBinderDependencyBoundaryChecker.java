package saltmarcher.quality.errorprone.view.binder;

import com.google.errorprone.BugPattern;
import com.google.errorprone.VisitorState;
import com.google.errorprone.bugpatterns.BugChecker;
import com.google.errorprone.matchers.Description;
import com.sun.source.tree.ClassTree;
import com.sun.source.tree.CompilationUnitTree;
import java.util.Set;
import saltmarcher.quality.errorprone.view.ViewArchitectureSupport;
import saltmarcher.quality.errorprone.view.ViewRole;
import saltmarcher.quality.errorprone.view.ViewRoleDependencySupport;
import saltmarcher.quality.errorprone.view.ViewSourceDescriptor;

@BugPattern(
        name = "ViewBinderDependencyBoundary",
        summary = "Binders may depend only on documented shell, domain, view, and slotcontent seams.",
        severity = BugPattern.SeverityLevel.ERROR)
public final class ViewBinderDependencyBoundaryChecker extends BugChecker
        implements BugChecker.CompilationUnitTreeMatcher {

    @Override
    public Description matchCompilationUnit(CompilationUnitTree tree, VisitorState state) {
        ViewSourceDescriptor source = ViewSourceDescriptor.describe(tree);
        if (!source.isActiveRootSource() || source.role() != ViewRole.BINDER) {
            return Description.NO_MATCH;
        }

        Set<String> forbiddenReferences = ViewRoleDependencySupport.collectForbiddenReferences(tree, state, source);
        if (forbiddenReferences.isEmpty()) {
            return Description.NO_MATCH;
        }
        ClassTree topLevelClass = ViewArchitectureSupport.topLevelClass(tree);
        return buildDescription(topLevelClass == null ? tree : topLevelClass)
                .setMessage("Binder package '" + source.packageName()
                        + "' violates Binder dependency boundaries via references: "
                        + String.join(", ", forbiddenReferences))
                .build();
    }
}
