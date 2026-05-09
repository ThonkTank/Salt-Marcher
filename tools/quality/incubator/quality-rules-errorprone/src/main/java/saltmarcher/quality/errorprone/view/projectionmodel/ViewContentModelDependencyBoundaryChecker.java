package saltmarcher.quality.errorprone.view.projectionmodel;

import com.google.errorprone.BugPattern;
import com.google.errorprone.VisitorState;
import com.google.errorprone.bugpatterns.BugChecker;
import com.google.errorprone.matchers.Description;
import com.sun.source.tree.CompilationUnitTree;
import java.util.Set;
import saltmarcher.quality.errorprone.view.ViewArchitectureSupport;
import saltmarcher.quality.errorprone.view.ViewRoleDependencySupport;

@BugPattern(
        name = "ViewContentModelDependencyBoundary",
        summary = "ContentModels may depend only on read-side published carriers, bindable JavaFX state types, and allowed local support surfaces.",
        severity = BugPattern.SeverityLevel.ERROR)
public final class ViewContentModelDependencyBoundaryChecker extends BugChecker
        implements BugChecker.CompilationUnitTreeMatcher {

    @Override
    public Description matchCompilationUnit(CompilationUnitTree tree, VisitorState state) {
        if (!ViewArchitectureSupport.isViewModelSource(tree)
                || !ViewArchitectureSupport.topLevelSimpleName(tree).endsWith("ContentModel")) {
            return Description.NO_MATCH;
        }

        String packageName = ViewArchitectureSupport.packageName(tree);
        Set<String> forbiddenReferences = ViewRoleDependencySupport.collectForbiddenReferences(
                tree,
                state,
                ViewRoleDependencySupport.SourceRole.CONTENT_MODEL);
        if (forbiddenReferences.isEmpty()) {
            return Description.NO_MATCH;
        }
        return buildDescription(tree)
                .setMessage("ContentModel package '" + packageName
                        + "' violates ContentModel dependency boundaries via references: "
                        + String.join(", ", forbiddenReferences))
                .build();
    }
}
