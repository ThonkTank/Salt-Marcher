package saltmarcher.quality.errorprone.view.intenthandler;

import com.google.errorprone.BugPattern;
import com.google.errorprone.VisitorState;
import com.google.errorprone.bugpatterns.BugChecker;
import com.google.errorprone.matchers.Description;
import com.google.errorprone.util.ASTHelpers;
import com.sun.source.tree.ClassTree;
import com.sun.source.tree.CompilationUnitTree;
import com.sun.source.tree.MethodTree;
import com.sun.source.tree.VariableTree;
import com.sun.source.util.TreeScanner;
import java.util.LinkedHashSet;
import java.util.Set;
import saltmarcher.quality.errorprone.view.ViewArchitectureSupport;

@BugPattern(
        name = "ViewIntentHandlerViewInputEvent",
        summary = "IntentHandlers must expose a same-root consume(SameRootViewInputEvent) entrypoint for interactive View input.",
        severity = BugPattern.SeverityLevel.ERROR)
public final class ViewIntentHandlerViewInputEventChecker extends BugChecker
        implements BugChecker.CompilationUnitTreeMatcher {

    @Override
    public Description matchCompilationUnit(CompilationUnitTree tree, VisitorState state) {
        if (!ViewArchitectureSupport.isIntentHandlerSource(tree)) {
            return Description.NO_MATCH;
        }

        ClassTree topLevelClass = topLevelClass(tree);
        if (topLevelClass == null) {
            return Description.NO_MATCH;
        }

        String sourcePackageName = ViewArchitectureSupport.packageName(tree);
        for (var member : topLevelClass.getMembers()) {
            if (!(member instanceof MethodTree methodTree)) {
                continue;
            }
            if (isAllowedConsumeMethod(methodTree, sourcePackageName)) {
                return Description.NO_MATCH;
            }
        }

        return buildDescription(tree)
                .setMessage("IntentHandlers must expose a fire-and-forget consume(SameRootViewInputEvent) entrypoint for their interactive View surface.")
                .build();
    }

    private static boolean isAllowedConsumeMethod(MethodTree methodTree, String sourcePackageName) {
        if (!"consume".contentEquals(methodTree.getName())
                || methodTree.getParameters().size() != 1
                || methodTree.getReturnType() == null
                || !"void".contentEquals(methodTree.getReturnType().toString())) {
            return false;
        }
        VariableTree parameter = methodTree.getParameters().get(0);
        return referencesSameRootViewInputEvent(parameter, sourcePackageName);
    }

    private static boolean referencesSameRootViewInputEvent(
            VariableTree parameter,
            String sourcePackageName
    ) {
        Set<String> referencedTypes = new LinkedHashSet<>();
        ViewArchitectureSupport.collectReferencedTypes(parameter.getType(), referencedTypes);
        if (referencedTypes.isEmpty()) {
            String renderedType = ASTHelpers.getType(parameter.getType()) == null
                    ? ""
                    : ASTHelpers.getType(parameter.getType()).toString();
            if (!renderedType.isBlank()) {
                referencedTypes.add(renderedType);
            }
        }
        return referencedTypes.stream()
                .anyMatch(referencedType ->
                        ViewArchitectureSupport.isTargetViewInputEventReference(referencedType)
                                && ViewArchitectureSupport.isSameViewRootReference(sourcePackageName, referencedType));
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
