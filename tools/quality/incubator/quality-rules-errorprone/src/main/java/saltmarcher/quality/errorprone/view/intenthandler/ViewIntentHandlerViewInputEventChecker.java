package saltmarcher.quality.errorprone.view.intenthandler;

import com.google.errorprone.BugPattern;
import com.google.errorprone.VisitorState;
import com.google.errorprone.bugpatterns.BugChecker;
import com.google.errorprone.matchers.Description;
import com.google.errorprone.util.ASTHelpers;
import com.sun.source.tree.ClassTree;
import com.sun.source.tree.CompilationUnitTree;
import com.sun.source.tree.ExpressionTree;
import com.sun.source.tree.MethodInvocationTree;
import com.sun.source.tree.MethodTree;
import com.sun.source.tree.VariableTree;
import com.sun.source.util.TreeScanner;
import com.sun.tools.javac.code.Symbol;
import java.util.LinkedHashSet;
import java.util.Set;
import saltmarcher.quality.errorprone.view.ViewArchitectureSupport;

@BugPattern(
        name = "ViewIntentHandlerViewInputEvent",
        summary = "IntentHandlers must expose consume(...) entrypoints for same-root and reused slotcontent ViewInputEvent input.",
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
        Set<String> violations = new LinkedHashSet<>();
        boolean hasAllowedConsumeMethod = false;
        for (var member : topLevelClass.getMembers()) {
            if (!(member instanceof MethodTree methodTree)) {
                continue;
            }
            if (isAllowedConsumeMethod(methodTree, sourcePackageName)) {
                hasAllowedConsumeMethod = true;
                collectDiscriminatorDispatchViolations(methodTree, sourcePackageName, violations);
            }
        }

        if (!hasAllowedConsumeMethod) {
            return buildDescription(tree)
                    .setMessage("IntentHandlers must expose a fire-and-forget consume(...) entrypoint for their same-root or reused slotcontent ViewInputEvent surfaces.")
                    .build();
        }
        if (violations.isEmpty()) {
            return Description.NO_MATCH;
        }
        return buildDescription(tree)
                .setMessage("IntentHandlers must derive meaning from concrete ViewInputEvent snapshot fields instead of dispatching via source/action discriminators. Violations: "
                        + String.join(", ", violations))
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
        return referencesAllowedViewInputEvent(parameter, sourcePackageName);
    }

    private static boolean referencesAllowedViewInputEvent(
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
                                && ViewArchitectureSupport.isSameViewRootOrReusableSlotcontentViewInputEventReference(
                                        sourcePackageName,
                                        referencedType));
    }

    private static void collectDiscriminatorDispatchViolations(
            MethodTree methodTree,
            String sourcePackageName,
            Set<String> violations
    ) {
        VariableTree parameter = methodTree.getParameters().get(0);
        Symbol parameterSymbol = ASTHelpers.getSymbol(parameter);
        if (parameterSymbol == null || methodTree.getBody() == null) {
            return;
        }
        new TreeScanner<Void, Void>() {
            @Override
            public Void visitMethodInvocation(MethodInvocationTree methodInvocationTree, Void unused) {
                Symbol.MethodSymbol methodSymbol = ASTHelpers.getSymbol(methodInvocationTree);
                if (methodSymbol == null) {
                    return super.visitMethodInvocation(methodInvocationTree, unused);
                }
                String methodName = methodSymbol.getSimpleName().toString();
                if (!"source".equals(methodName) && !"action".equals(methodName)) {
                    return super.visitMethodInvocation(methodInvocationTree, unused);
                }
                ExpressionTree receiver = ASTHelpers.getReceiver(methodInvocationTree);
                Symbol receiverSymbol = receiver == null ? null : ASTHelpers.getSymbol(receiver);
                if (receiverSymbol == null || !receiverSymbol.equals(parameterSymbol)) {
                    return super.visitMethodInvocation(methodInvocationTree, unused);
                }
                if (referencesAllowedViewInputEvent(parameter, sourcePackageName)) {
                    violations.add(methodTree.getName() + "(" + parameter.getType() + ")." + methodName + "()");
                }
                return super.visitMethodInvocation(methodInvocationTree, unused);
            }
        }.scan(methodTree.getBody(), null);
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
