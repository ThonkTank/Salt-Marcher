package saltmarcher.quality.errorprone.view.projectionmodel;

import com.google.errorprone.BugPattern;
import com.google.errorprone.VisitorState;
import com.google.errorprone.bugpatterns.BugChecker;
import com.google.errorprone.matchers.Description;
import com.sun.source.tree.ClassTree;
import com.sun.source.tree.CompilationUnitTree;
import com.sun.source.tree.MethodTree;
import com.sun.source.tree.Tree;
import com.sun.source.util.TreeScanner;
import com.sun.tools.javac.code.Symbol;
import java.util.LinkedHashSet;
import java.util.Set;
import javax.lang.model.element.Modifier;
import saltmarcher.quality.errorprone.view.ViewArchitectureSupport;

@BugPattern(
        name = "ViewContributionModelRequestProtocol",
        summary = "ContributionModels must not expose outward request-token or publish-like protocols.",
        severity = BugPattern.SeverityLevel.ERROR)
public final class ViewContributionModelRequestProtocolChecker extends BugChecker
        implements BugChecker.CompilationUnitTreeMatcher {

    @Override
    public Description matchCompilationUnit(CompilationUnitTree tree, VisitorState state) {
        if (!ViewArchitectureSupport.isViewModelSource(tree)) {
            return Description.NO_MATCH;
        }
        String topLevelSimpleName = ViewArchitectureSupport.topLevelSimpleName(tree);
        if (!topLevelSimpleName.endsWith("ContributionModel")) {
            return Description.NO_MATCH;
        }

        ClassTree topLevelClass = topLevelClass(tree);
        if (topLevelClass == null) {
            return Description.NO_MATCH;
        }

        Set<String> violations = new LinkedHashSet<>();
        for (Tree member : topLevelClass.getMembers()) {
            if (!(member instanceof MethodTree methodTree)) {
                continue;
            }
            Symbol.MethodSymbol symbol = (Symbol.MethodSymbol) com.google.errorprone.util.ASTHelpers.getSymbol(methodTree);
            if (symbol == null || symbol.isConstructor() || symbol.getModifiers().contains(Modifier.PRIVATE)) {
                continue;
            }
            if (isForbiddenOutwardProtocol(symbol)) {
                violations.add(symbol.getSimpleName().toString());
            }
        }

        if (violations.isEmpty()) {
            return Description.NO_MATCH;
        }
        return buildDescription(topLevelClass)
                .setMessage(topLevelSimpleName
                        + " exposes outward request/publish protocol members: "
                        + String.join(", ", violations)
                        + ". Binder-facing outward work must leave the view layer through Binder-installed Consumer<...PublishedEvent> seams, not through ContributionModel request channels.")
                .build();
    }

    private static boolean isForbiddenOutwardProtocol(Symbol.MethodSymbol symbol) {
        String simpleName = symbol.getSimpleName().toString();
        return simpleName.endsWith("TokenProperty")
                || (simpleName.contains("Request") && simpleName.endsWith("Property"))
                || simpleName.startsWith("publish");
    }

    private static ClassTree topLevelClass(CompilationUnitTree tree) {
        ClassTree[] result = {null};
        new TreeScanner<Void, Void>() {
            @Override
            public Void visitClass(ClassTree classTree, Void unused) {
                if (result[0] == null) {
                    result[0] = classTree;
                }
                return null;
            }
        }.scan(tree, null);
        return result[0];
    }
}
