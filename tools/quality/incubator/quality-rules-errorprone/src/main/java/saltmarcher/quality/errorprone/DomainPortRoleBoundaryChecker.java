package saltmarcher.quality.errorprone;

import com.google.errorprone.BugPattern;
import com.google.errorprone.VisitorState;
import com.google.errorprone.bugpatterns.BugChecker;
import com.google.errorprone.matchers.Description;
import com.sun.source.tree.ClassTree;
import com.sun.source.tree.CompilationUnitTree;
import java.util.Set;

@BugPattern(
        name = "DomainPortRoleBoundary",
        summary = "Port must stay an inbound listener seam over foreign published state and same-context use-case follow-up work.",
        severity = BugPattern.SeverityLevel.ERROR)
public final class DomainPortRoleBoundaryChecker extends BugChecker
        implements BugChecker.CompilationUnitTreeMatcher {

    @Override
    public Description matchCompilationUnit(CompilationUnitTree tree, VisitorState state) {
        DomainRoleConcernSupport.SourceRole sourceRole =
                DomainRoleConcernSupport.describeRole(tree, DomainRoleConcernSupport.Role.PORT);
        if (sourceRole == null) {
            return Description.NO_MATCH;
        }
        Set<String> violations = DomainRoleConcernSupport.boundaryViolations(sourceRole, tree);
        if (violations.isEmpty()) {
            return Description.NO_MATCH;
        }
        ClassTree topLevelClass = DomainRoleConcernSupport.topLevelClass(tree);
        return buildDescription(topLevelClass == null ? tree : topLevelClass)
                .setMessage("Domain Port '" + sourceRole.topLevelQualifiedName()
                        + "' violates the closed inbound-listener contract: "
                        + String.join("; ", violations)
                        + ". Port may consume foreign published state and trigger same-context use-case/model follow-up only.")
                .build();
    }
}
