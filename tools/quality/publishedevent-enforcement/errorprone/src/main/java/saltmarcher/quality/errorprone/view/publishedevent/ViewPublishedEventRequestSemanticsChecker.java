package saltmarcher.quality.errorprone.view.publishedevent;

import com.google.errorprone.BugPattern;
import com.google.errorprone.VisitorState;
import com.google.errorprone.bugpatterns.BugChecker;
import com.google.errorprone.matchers.Description;
import com.sun.source.tree.ClassTree;
import com.sun.source.tree.CompilationUnitTree;
import com.sun.source.tree.MethodTree;
import com.sun.source.tree.Tree;
import com.sun.source.tree.VariableTree;
import java.util.LinkedHashSet;
import java.util.Set;
import java.util.regex.Pattern;
import saltmarcher.quality.errorprone.view.ViewArchitectureSupport;

@BugPattern(
        name = "ViewPublishedEventRequestSemantics",
        summary = "PublishedEvent carriers must not encode request-, query-, search-, refresh-, detail-open-, preview-, load-, or reset-style read semantics.",
        severity = BugPattern.SeverityLevel.ERROR)
public final class ViewPublishedEventRequestSemanticsChecker extends BugChecker
        implements BugChecker.CompilationUnitTreeMatcher {

    private static final Pattern FORBIDDEN_SEMANTICS = Pattern.compile(
            "(?i)(refresh|search|open|detail|preview|load|query|lookup|fetch|reset|request)");

    @Override
    public Description matchCompilationUnit(CompilationUnitTree tree, VisitorState state) {
        if (!ViewArchitectureSupport.isPublishedEventSource(tree)) {
            return Description.NO_MATCH;
        }

        ClassTree topLevelClass = topLevelClass(tree);
        if (topLevelClass == null) {
            return Description.NO_MATCH;
        }

        Set<String> violations = new LinkedHashSet<>();
        collectViolations(topLevelClass, violations);
        if (violations.isEmpty()) {
            return Description.NO_MATCH;
        }
        return buildDescription(topLevelClass)
                .setMessage("PublishedEvent carriers must stay write-side domain sink payloads, not read/request protocols. Violations: "
                        + String.join(", ", violations))
                .build();
    }

    private static void collectViolations(ClassTree classTree, Set<String> violations) {
        boolean insideEnum = classTree.getKind() == Tree.Kind.ENUM;
        boolean insideRecord = classTree.getKind() == Tree.Kind.RECORD;
        for (Tree member : classTree.getMembers()) {
            if (member instanceof MethodTree methodTree) {
                String simpleName = methodTree.getName().toString();
                if (!"<init>".equals(simpleName) && hasForbiddenSemantics(simpleName)) {
                    violations.add("method " + simpleName);
                }
                continue;
            }
            if (member instanceof VariableTree variableTree) {
                String simpleName = variableTree.getName().toString();
                if (insideEnum && hasForbiddenSemantics(simpleName)) {
                    violations.add("enum constant " + simpleName);
                }
                if (insideRecord && hasForbiddenSemantics(simpleName)) {
                    violations.add("record component " + simpleName);
                }
                continue;
            }
            if (member instanceof ClassTree nestedClassTree) {
                collectViolations(nestedClassTree, violations);
            }
        }
    }

    private static boolean hasForbiddenSemantics(String simpleName) {
        return simpleName != null
                && !simpleName.isBlank()
                && FORBIDDEN_SEMANTICS.matcher(simpleName).find();
    }

    private static ClassTree topLevelClass(CompilationUnitTree tree) {
        for (Tree typeDecl : tree.getTypeDecls()) {
            if (typeDecl instanceof ClassTree classTree) {
                return classTree;
            }
        }
        return null;
    }
}
