package saltmarcher.quality.errorprone.view.projectionmodel;

import com.google.errorprone.BugPattern;
import com.google.errorprone.VisitorState;
import com.google.errorprone.bugpatterns.BugChecker;
import com.google.errorprone.matchers.Description;
import com.sun.source.tree.ClassTree;
import com.sun.source.tree.CompilationUnitTree;
import com.sun.source.tree.Tree;
import com.sun.source.util.TreeScanner;
import java.util.LinkedHashSet;
import java.util.Set;
import saltmarcher.quality.errorprone.view.ViewArchitectureSupport;

@BugPattern(
        name = "ViewContentModelFlatSurface",
        summary = "ContentModels must not declare nested input, request, command, query, operation, or edit carrier types.",
        severity = BugPattern.SeverityLevel.ERROR)
public final class ViewContentModelFlatSurfaceChecker extends BugChecker
        implements BugChecker.CompilationUnitTreeMatcher {

    @Override
    public Description matchCompilationUnit(CompilationUnitTree tree, VisitorState state) {
        if (!ViewArchitectureSupport.isViewModelSource(tree)) {
            return Description.NO_MATCH;
        }
        String topLevelSimpleName = ViewArchitectureSupport.topLevelSimpleName(tree);
        if (!topLevelSimpleName.endsWith("ContentModel")) {
            return Description.NO_MATCH;
        }

        ClassTree topLevelClass = topLevelClass(tree);
        if (topLevelClass == null) {
            return Description.NO_MATCH;
        }

        Set<String> violations = new LinkedHashSet<>();
        for (Tree member : topLevelClass.getMembers()) {
            if (member instanceof ClassTree nestedClass && isForbiddenNestedCarrier(nestedClass)) {
                violations.add(nestedClass.getSimpleName().toString());
            }
        }

        if (violations.isEmpty()) {
            return Description.NO_MATCH;
        }
        return buildDescription(topLevelClass)
                .setMessage(topLevelSimpleName
                        + " must expose a flat published-value surface and must not declare nested carrier types: "
                        + String.join(", ", violations))
                .build();
    }

    private static boolean isForbiddenNestedCarrier(ClassTree nestedClass) {
        if (nestedClass.getSimpleName().isEmpty()) {
            return false;
        }
        String simpleName = nestedClass.getSimpleName().toString();
        return simpleName.endsWith("Intent")
                || simpleName.endsWith("Input")
                || simpleName.endsWith("Request")
                || simpleName.endsWith("Command")
                || simpleName.endsWith("Query")
                || simpleName.endsWith("Operation")
                || simpleName.endsWith("Edit");
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
