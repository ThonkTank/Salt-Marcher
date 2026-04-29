package saltmarcher.quality.errorprone.view.contribution;

import com.google.errorprone.BugPattern;
import com.google.errorprone.VisitorState;
import com.google.errorprone.bugpatterns.BugChecker;
import com.google.errorprone.matchers.Description;
import com.sun.source.tree.CompilationUnitTree;
import java.util.Set;
import saltmarcher.quality.errorprone.view.ViewArchitectureSupport;
import saltmarcher.quality.errorprone.view.ViewRoleDependencySupport;

@BugPattern(
        name = "ViewContributionDependencyBoundary",
        summary = "View contributions stay thin shell entrypoints and may depend only on their co-located Binder and allowed shell APIs.",
        severity = BugPattern.SeverityLevel.ERROR)
public final class ViewContributionDependencyBoundaryChecker extends BugChecker
        implements BugChecker.CompilationUnitTreeMatcher {

    @Override
    public Description matchCompilationUnit(CompilationUnitTree tree, VisitorState state) {
        if (!ViewArchitectureSupport.isContributionSource(tree)) {
            return Description.NO_MATCH;
        }

        String packageName = ViewArchitectureSupport.packageName(tree);
        Set<String> forbiddenReferences = ViewRoleDependencySupport.collectForbiddenReferences(
                tree,
                state,
                ViewRoleDependencySupport.SourceRole.CONTRIBUTION);
        if (forbiddenReferences.isEmpty()) {
            return Description.NO_MATCH;
        }
        return buildDescription(tree)
                .setMessage("Contribution package '" + packageName
                        + "' violates thin shell entrypoint dependency boundaries via references: "
                        + String.join(", ", forbiddenReferences))
                .build();
    }
}
