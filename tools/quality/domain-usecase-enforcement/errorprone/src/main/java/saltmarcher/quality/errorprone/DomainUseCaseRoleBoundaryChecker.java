package saltmarcher.quality.errorprone;

import com.google.errorprone.BugPattern;
import com.google.errorprone.VisitorState;
import com.google.errorprone.bugpatterns.BugChecker;
import com.google.errorprone.matchers.Description;
import com.sun.source.tree.ClassTree;
import com.sun.source.tree.CompilationUnitTree;
import java.util.Set;

@BugPattern(
        name = "DomainUseCaseRoleBoundary",
        summary = "UseCase must stay on internal model work, helper steps, repositories, ports, and allowed foreign root boundaries.",
        severity = BugPattern.SeverityLevel.ERROR)
public final class DomainUseCaseRoleBoundaryChecker extends BugChecker
        implements BugChecker.CompilationUnitTreeMatcher {

    @Override
    public Description matchCompilationUnit(CompilationUnitTree tree, VisitorState state) {
        DomainRoleConcernSupport.SourceRole sourceRole =
                DomainRoleConcernSupport.describeRole(tree, DomainRoleConcernSupport.Role.USECASE);
        if (sourceRole == null) {
            return Description.NO_MATCH;
        }
        Set<String> violations = DomainRoleConcernSupport.boundaryViolations(sourceRole, tree);
        if (violations.isEmpty()) {
            return Description.NO_MATCH;
        }
        ClassTree topLevelClass = DomainRoleConcernSupport.topLevelClass(tree);
        return buildDescription(topLevelClass == null ? tree : topLevelClass)
                .setMessage("Domain UseCase '" + sourceRole.topLevelQualifiedName()
                        + "' violates the closed orchestration contract: "
                        + String.join("; ", violations)
                        + ". UseCase may orchestrate same-context model work plus allowed repository/port seams, but it must not absorb foreign role concerns.")
                .build();
    }
}
