package saltmarcher.quality.errorprone;

import com.google.errorprone.BugPattern;
import com.google.errorprone.VisitorState;
import com.google.errorprone.bugpatterns.BugChecker;
import com.google.errorprone.matchers.Description;
import com.sun.source.tree.ClassTree;
import com.sun.source.tree.CompilationUnitTree;
import java.util.Set;

@BugPattern(
        name = "DomainConstantsRoleBoundary",
        summary = "Constants must stay immutable constant holders free of runtime, state, and foreign role concerns.",
        severity = BugPattern.SeverityLevel.ERROR)
public final class DomainConstantsRoleBoundaryChecker extends BugChecker
        implements BugChecker.CompilationUnitTreeMatcher {

    @Override
    public Description matchCompilationUnit(CompilationUnitTree tree, VisitorState state) {
        DomainRoleConcernSupport.SourceRole sourceRole =
                DomainRoleConcernSupport.describeRole(tree, DomainRoleConcernSupport.Role.CONSTANTS);
        if (sourceRole == null) {
            return Description.NO_MATCH;
        }
        Set<String> violations = DomainRoleConcernSupport.boundaryViolations(sourceRole, tree);
        if (violations.isEmpty()) {
            return Description.NO_MATCH;
        }
        ClassTree topLevelClass = DomainRoleConcernSupport.topLevelClass(tree);
        return buildDescription(topLevelClass == null ? tree : topLevelClass)
                .setMessage("Domain Constants '" + sourceRole.topLevelQualifiedName()
                        + "' violates the closed constants contract: "
                        + String.join("; ", violations)
                        + ". Constants may remain only immutable holders over constant data and must not absorb runtime or state concerns.")
                .build();
    }
}
