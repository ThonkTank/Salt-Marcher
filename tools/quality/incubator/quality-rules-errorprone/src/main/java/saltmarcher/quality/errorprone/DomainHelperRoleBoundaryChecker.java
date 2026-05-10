package saltmarcher.quality.errorprone;

import com.google.errorprone.BugPattern;
import com.google.errorprone.VisitorState;
import com.google.errorprone.bugpatterns.BugChecker;
import com.google.errorprone.matchers.Description;
import com.sun.source.tree.ClassTree;
import com.sun.source.tree.CompilationUnitTree;
import java.util.Set;

@BugPattern(
        name = "DomainHelperRoleBoundary",
        summary = "Helper must stay a pure explicit work step over model inputs and constants only.",
        severity = BugPattern.SeverityLevel.ERROR)
public final class DomainHelperRoleBoundaryChecker extends BugChecker
        implements BugChecker.CompilationUnitTreeMatcher {

    @Override
    public Description matchCompilationUnit(CompilationUnitTree tree, VisitorState state) {
        DomainRoleConcernSupport.SourceRole sourceRole =
                DomainRoleConcernSupport.describeRole(tree, DomainRoleConcernSupport.Role.HELPER);
        if (sourceRole == null) {
            return Description.NO_MATCH;
        }
        Set<String> violations = DomainRoleConcernSupport.boundaryViolations(sourceRole, tree);
        if (violations.isEmpty()) {
            return Description.NO_MATCH;
        }
        ClassTree topLevelClass = DomainRoleConcernSupport.topLevelClass(tree);
        return buildDescription(topLevelClass == null ? tree : topLevelClass)
                .setMessage("Domain Helper '" + sourceRole.topLevelQualifiedName()
                        + "' violates the closed helper contract: "
                        + String.join("; ", violations)
                        + ". Helper may consume model inputs and constants only, and it must not absorb context, repository, port, or published concerns.")
                .build();
    }
}
