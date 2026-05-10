package saltmarcher.quality.errorprone.view.binder;

import com.google.errorprone.BugPattern;
import com.google.errorprone.VisitorState;
import com.google.errorprone.bugpatterns.BugChecker;
import com.google.errorprone.matchers.Description;
import com.google.errorprone.util.ASTHelpers;
import com.sun.source.tree.CompilationUnitTree;
import com.sun.source.tree.ExpressionTree;
import com.sun.source.tree.MemberReferenceTree;
import com.sun.source.tree.MethodInvocationTree;
import com.sun.source.util.TreePathScanner;
import com.sun.source.util.TreeScanner;
import com.sun.tools.javac.code.Symbol;
import java.util.LinkedHashSet;
import java.util.Set;
import saltmarcher.quality.errorprone.view.ViewArchitectureSupport;

@BugPattern(
        name = "ViewBinderViewInputEventWiring",
        summary = "Binders may wire passive Views to same-root IntentHandlers only through onViewInputEvent(intentHandler::consume).",
        severity = BugPattern.SeverityLevel.ERROR)
public final class ViewBinderViewInputEventWiringChecker extends BugChecker
        implements BugChecker.CompilationUnitTreeMatcher {

    @Override
    public Description matchCompilationUnit(CompilationUnitTree tree, VisitorState state) {
        if (!ViewArchitectureSupport.isBinderSource(tree)) {
            return Description.NO_MATCH;
        }

        String sourcePackageName = ViewArchitectureSupport.packageName(tree);
        Set<String> violations = new LinkedHashSet<>();
        new TreePathScanner<Void, Void>() {
            @Override
            public Void visitMethodInvocation(MethodInvocationTree methodInvocationTree, Void unused) {
                Symbol.MethodSymbol symbol = ASTHelpers.getSymbol(methodInvocationTree);
                if (symbol == null) {
                    return super.visitMethodInvocation(methodInvocationTree, unused);
                }
                String ownerType = ViewArchitectureSupport.getQualifiedOwnerTypeName(symbol);
                if (!ViewArchitectureSupport.isTargetPanelViewReference(ownerType)) {
                    return super.visitMethodInvocation(methodInvocationTree, unused);
                }

                String methodName = symbol.getSimpleName().toString();
                if ("onViewInputEvent".equals(methodName)) {
                    if (!isAllowedViewInputEventWiring(methodInvocationTree, sourcePackageName, ownerType)) {
                        violations.add(methodName + " -> " + ownerType);
                    }
                    return super.visitMethodInvocation(methodInvocationTree, unused);
                }

                if (containsTargetViewIntentHandlerReference(methodInvocationTree, ownerType)) {
                    violations.add(methodName + " -> " + ownerType);
                }
                return super.visitMethodInvocation(methodInvocationTree, unused);
            }
        }.scan(tree, null);

        if (violations.isEmpty()) {
            return Description.NO_MATCH;
        }
        return buildDescription(tree)
                .setMessage("Binder package '" + sourcePackageName
                        + "' wires passive Views directly to IntentHandler methods: "
                        + String.join(", ", violations)
                        + ". Bind the View only through onViewInputEvent(intentHandler::consume).")
                .build();
    }

    private static boolean containsTargetViewIntentHandlerReference(
            MethodInvocationTree methodInvocationTree,
            String ownerType
    ) {
        for (ExpressionTree argument : methodInvocationTree.getArguments()) {
            if (referencesTargetViewIntentHandler(argument, ownerType)) {
                return true;
            }
        }
        return false;
    }

    private static boolean referencesTargetViewIntentHandler(ExpressionTree tree, String ownerType) {
        boolean[] found = {false};
        new TreeScanner<Void, Void>() {
            @Override
            public Void scan(com.sun.source.tree.Tree currentTree, Void unused) {
                if (currentTree == null || found[0]) {
                    return null;
                }
                Set<String> referencedTypes = new LinkedHashSet<>();
                ViewArchitectureSupport.collectReferencedTypes(currentTree, referencedTypes);
                if (referencedTypes.stream().anyMatch(referencedType ->
                        ViewArchitectureSupport.isSameViewUnitReference(ownerType, referencedType)
                                && ViewArchitectureSupport.isIntentHandlerReference(referencedType))) {
                    found[0] = true;
                    return null;
                }
                return super.scan(currentTree, unused);
            }
        }.scan(tree, null);
        return found[0];
    }

    private static boolean isAllowedViewInputEventWiring(
            MethodInvocationTree methodInvocationTree,
            String binderPackageName,
            String ownerType
    ) {
        if (methodInvocationTree.getArguments().size() != 1) {
            return false;
        }
        ExpressionTree argument = methodInvocationTree.getArguments().get(0);
        if (!(argument instanceof MemberReferenceTree memberReferenceTree)) {
            return false;
        }
        Symbol symbol = ASTHelpers.getSymbol(memberReferenceTree);
        if (!(symbol instanceof Symbol.MethodSymbol methodSymbol)) {
            return false;
        }
        String handlerOwnerType = ViewArchitectureSupport.getQualifiedOwnerTypeName(methodSymbol);
        return "consume".contentEquals(methodSymbol.getSimpleName())
                && ViewArchitectureSupport.isSameViewRootIntentHandlerReference(binderPackageName, handlerOwnerType);
    }
}
