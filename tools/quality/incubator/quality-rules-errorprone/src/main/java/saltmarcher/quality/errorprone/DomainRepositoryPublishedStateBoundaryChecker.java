package saltmarcher.quality.errorprone;

import com.google.errorprone.BugPattern;
import com.google.errorprone.VisitorState;
import com.google.errorprone.bugpatterns.BugChecker;
import com.google.errorprone.matchers.Description;
import com.google.errorprone.util.ASTHelpers;
import com.sun.source.tree.ClassTree;
import com.sun.source.tree.CompilationUnitTree;
import com.sun.source.tree.MethodTree;
import com.sun.source.tree.Tree;
import com.sun.tools.javac.code.Symbol;
import java.util.ArrayList;
import java.util.List;
import java.util.regex.Pattern;
import javax.lang.model.element.VariableElement;

@BugPattern(
        name = "DomainRepositoryPublishedStateBoundary",
        summary = "Domain repositories must not replace same-context published read models with generic publish/Object channels.",
        severity = BugPattern.SeverityLevel.ERROR)
public final class DomainRepositoryPublishedStateBoundaryChecker extends BugChecker
        implements BugChecker.CompilationUnitTreeMatcher {

    private static final Pattern REPOSITORY_PACKAGE =
            Pattern.compile("^src\\.domain\\.[^.]+\\.model\\.[^.]+\\.repository$");

    @Override
    public Description matchCompilationUnit(CompilationUnitTree tree, VisitorState state) {
        if (!REPOSITORY_PACKAGE.matcher(DataArchitectureSupport.packageName(tree)).matches()) {
            return Description.NO_MATCH;
        }
        ClassTree topLevelClass = DomainRoleConcernSupport.topLevelClass(tree);
        if (topLevelClass == null || !topLevelClass.getSimpleName().toString().endsWith("Repository")) {
            return Description.NO_MATCH;
        }

        String simpleName = topLevelClass.getSimpleName().toString();
        boolean publishedStateRepository = simpleName.endsWith("PublishedStateRepository");
        List<String> violations = new ArrayList<>();
        for (Tree member : topLevelClass.getMembers()) {
            if (member instanceof MethodTree methodTree) {
                collectMethodViolations(methodTree, publishedStateRepository, violations);
            }
        }
        if (violations.isEmpty()) {
            return Description.NO_MATCH;
        }
        return buildDescription(topLevelClass)
                .setMessage("Domain repository '" + topLevelClass.getSimpleName()
                        + "' violates the outbound repository contract: "
                        + String.join("; ", violations)
                        + ". Same-context publication belongs in typed *PublishedStateRepository sinks and "
                        + "published/*Model handles, not generic repository publish/Object channels.")
                .build();
    }

    private static void collectMethodViolations(
            MethodTree methodTree,
            boolean publishedStateRepository,
            List<String> violations
    ) {
        Symbol.MethodSymbol methodSymbol = ASTHelpers.getSymbol(methodTree);
        if (methodSymbol == null || methodSymbol.isConstructor()) {
            return;
        }
        String methodName = methodSymbol.getSimpleName().toString();
        if (!publishedStateRepository && methodName.startsWith("publish")) {
            violations.add("method " + methodName + "() uses publish naming");
        }
        if ("java.lang.Object".equals(methodSymbol.getReturnType().toString())) {
            violations.add("method " + methodName + "() returns Object");
        }
        for (VariableElement parameter : methodSymbol.getParameters()) {
            if ("java.lang.Object".equals(parameter.asType().toString())) {
                violations.add("method " + methodName + "() accepts Object parameter "
                        + parameter.getSimpleName());
            }
        }
    }
}
