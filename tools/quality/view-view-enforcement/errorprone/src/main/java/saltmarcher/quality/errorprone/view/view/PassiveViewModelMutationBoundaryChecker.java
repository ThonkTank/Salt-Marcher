package saltmarcher.quality.errorprone.view.view;

import com.google.errorprone.BugPattern;
import com.google.errorprone.VisitorState;
import com.google.errorprone.bugpatterns.BugChecker;
import com.google.errorprone.matchers.Description;
import com.google.errorprone.util.ASTHelpers;
import com.sun.source.tree.CompilationUnitTree;
import com.sun.source.tree.ExpressionTree;
import com.sun.source.tree.MemberSelectTree;
import com.sun.source.tree.MethodInvocationTree;
import com.sun.source.tree.VariableTree;
import com.sun.source.util.TreePathScanner;
import com.sun.tools.javac.code.Symbol;
import java.util.LinkedHashSet;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import saltmarcher.quality.errorprone.view.ViewArchitectureSupport;

@BugPattern(
        name = "PassiveViewModelMutationBoundary",
        summary = "Passive Views must not mutate their co-located model, including through writable observable surfaces.",
        severity = BugPattern.SeverityLevel.ERROR)
public final class PassiveViewModelMutationBoundaryChecker extends BugChecker
        implements BugChecker.CompilationUnitTreeMatcher {

    private static final Set<String> MUTATOR_METHODS = Set.of(
            "set",
            "setValue",
            "bind",
            "unbind",
            "bindBidirectional",
            "unbindBidirectional",
            "add",
            "addAll",
            "remove",
            "removeAll",
            "retainAll",
            "clear",
            "setAll",
            "replaceAll",
            "put",
            "putAll");

    @Override
    public Description matchCompilationUnit(CompilationUnitTree tree, VisitorState state) {
        if (!ViewArchitectureSupport.isPanelViewSource(tree)) {
            return Description.NO_MATCH;
        }

        String sourcePackageName = ViewArchitectureSupport.packageName(tree);
        Set<String> violations = new LinkedHashSet<>();
        TreePathScanner<Void, Void> scanner = new TreePathScanner<>() {
            private final Map<Symbol, String> mutableAliases = new ConcurrentHashMap<>();

            @Override
            public Void visitVariable(VariableTree variableTree, Void unused) {
                Symbol symbol = ASTHelpers.getSymbol(variableTree);
                if (symbol != null && isModelOwnedMutableSurfaceAccess(variableTree.getInitializer(), sourcePackageName)) {
                    mutableAliases.put(symbol, variableTree.getName().toString());
                }
                return super.visitVariable(variableTree, unused);
            }

            @Override
            public Void visitMethodInvocation(MethodInvocationTree methodInvocationTree, Void unused) {
                Symbol.MethodSymbol symbol = ASTHelpers.getSymbol(methodInvocationTree);
                if (symbol != null
                        && MUTATOR_METHODS.contains(symbol.getSimpleName().toString())
                        && isMutableModelSurfaceReceiver(methodInvocationTree, sourcePackageName, mutableAliases)) {
                    violations.add(describeMutation(methodInvocationTree, symbol, mutableAliases));
                }
                return super.visitMethodInvocation(methodInvocationTree, unused);
            }
        };
        scanner.scan(tree, null);

        if (violations.isEmpty()) {
            return Description.NO_MATCH;
        }
        return buildDescription(tree)
                .setMessage("Passive View package '" + sourcePackageName
                        + "' mutates its co-located model through writable observable surfaces: "
                        + String.join(", ", violations)
                        + ". Passive Views may observe model state but must not write it.")
                .build();
    }

    private static boolean isMutableModelSurfaceReceiver(
            MethodInvocationTree methodInvocationTree,
            String sourcePackageName,
            Map<Symbol, String> mutableAliases
    ) {
        if (!(methodInvocationTree.getMethodSelect() instanceof MemberSelectTree memberSelectTree)) {
            return false;
        }
        ExpressionTree receiver = memberSelectTree.getExpression();
        if (isModelOwnedMutableSurfaceAccess(receiver, sourcePackageName)) {
            return true;
        }
        Symbol receiverSymbol = ASTHelpers.getSymbol(receiver);
        return receiverSymbol != null && mutableAliases.containsKey(receiverSymbol);
    }

    private static boolean isModelOwnedMutableSurfaceAccess(ExpressionTree expressionTree, String sourcePackageName) {
        if (!(expressionTree instanceof MethodInvocationTree methodInvocationTree)) {
            return false;
        }
        Symbol.MethodSymbol symbol = ASTHelpers.getSymbol(methodInvocationTree);
        if (symbol == null) {
            return false;
        }
        String ownerType = ViewArchitectureSupport.getQualifiedOwnerTypeName(symbol);
        if (!isAllowedViewModelOwner(sourcePackageName, ownerType)) {
            return false;
        }
        return ViewArchitectureSupport.isObservableMutableSurfaceType(symbol.getReturnType());
    }

    private static boolean isAllowedViewModelOwner(String sourcePackageName, String ownerType) {
        if (ViewArchitectureSupport.isSameViewRootModelReference(sourcePackageName, ownerType)
                && ViewArchitectureSupport.isTopLevelViewModelReference(ownerType)) {
            return true;
        }
        return ViewArchitectureSupport.isPrimitiveViewPackage(sourcePackageName)
                && ViewArchitectureSupport.isPrimitiveModelReferenceAllowedFromPrimitiveView(sourcePackageName, ownerType)
                && ViewArchitectureSupport.isTopLevelViewModelReference(ownerType);
    }

    private static String describeMutation(
            MethodInvocationTree methodInvocationTree,
            Symbol.MethodSymbol symbol,
            Map<Symbol, String> mutableAliases
    ) {
        if (!(methodInvocationTree.getMethodSelect() instanceof MemberSelectTree memberSelectTree)) {
            return symbol.getSimpleName().toString();
        }
        ExpressionTree receiver = memberSelectTree.getExpression();
        Symbol receiverSymbol = ASTHelpers.getSymbol(receiver);
        if (receiverSymbol != null && mutableAliases.containsKey(receiverSymbol)) {
            return mutableAliases.get(receiverSymbol) + "." + symbol.getSimpleName() + "(...)";
        }
        if (receiver instanceof MethodInvocationTree receiverInvocation) {
            Symbol.MethodSymbol receiverMethod = ASTHelpers.getSymbol(receiverInvocation);
            if (receiverMethod != null) {
                String ownerType = ViewArchitectureSupport.getQualifiedOwnerTypeName(receiverMethod);
                return ownerType + "." + receiverMethod.getSimpleName() + "()." + symbol.getSimpleName() + "(...)";
            }
        }
        return memberSelectTree + "";
    }
}
