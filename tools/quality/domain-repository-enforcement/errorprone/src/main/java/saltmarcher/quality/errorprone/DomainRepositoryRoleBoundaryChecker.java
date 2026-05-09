package saltmarcher.quality.errorprone;

import com.google.errorprone.BugPattern;
import com.google.errorprone.VisitorState;
import com.google.errorprone.bugpatterns.BugChecker;
import com.google.errorprone.matchers.Description;
import com.sun.source.tree.ClassTree;
import com.sun.source.tree.CompilationUnitTree;
import java.util.Set;

@BugPattern(
        name = "DomainRepositoryRoleBoundary",
        summary = "Repository must stay an outbound seam over foreign ApplicationServices and same-context internal model types only.",
        severity = BugPattern.SeverityLevel.ERROR)
public final class DomainRepositoryRoleBoundaryChecker extends BugChecker
        implements BugChecker.CompilationUnitTreeMatcher {

    @Override
    public Description matchCompilationUnit(CompilationUnitTree tree, VisitorState state) {
        DomainRoleConcernSupport.SourceRole sourceRole =
                DomainRoleConcernSupport.describeRole(tree, DomainRoleConcernSupport.Role.REPOSITORY);
        if (sourceRole == null) {
            return Description.NO_MATCH;
        }
        Set<String> violations = DomainRoleConcernSupport.boundaryViolations(sourceRole, tree);
        if (violations.isEmpty()) {
            return Description.NO_MATCH;
        }
        ClassTree topLevelClass = DomainRoleConcernSupport.topLevelClass(tree);
        return buildDescription(topLevelClass == null ? tree : topLevelClass)
                .setMessage("Domain Repository '" + sourceRole.topLevelQualifiedName()
                        + "' violates the closed outbound contract: "
                        + String.join("; ", violations)
                        + ". Repository may speak to foreign root ApplicationServices and same-context internal model/constants only.")
                .build();
    }
}
