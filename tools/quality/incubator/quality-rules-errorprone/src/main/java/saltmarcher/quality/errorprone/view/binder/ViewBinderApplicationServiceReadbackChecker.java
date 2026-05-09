package saltmarcher.quality.errorprone.view.binder;

import com.google.errorprone.BugPattern;
import com.google.errorprone.VisitorState;
import com.google.errorprone.bugpatterns.BugChecker;
import com.google.errorprone.matchers.Description;
import com.google.errorprone.util.ASTHelpers;
import com.sun.source.tree.CompilationUnitTree;
import com.sun.source.tree.ExpressionStatementTree;
import com.sun.source.tree.LambdaExpressionTree;
import com.sun.source.tree.MethodInvocationTree;
import com.sun.source.tree.ParenthesizedTree;
import com.sun.source.util.TreePath;
import com.sun.source.util.TreePathScanner;
import com.sun.tools.javac.code.Symbol;
import java.util.LinkedHashSet;
import java.util.Set;
import javax.lang.model.type.TypeKind;
import saltmarcher.quality.errorprone.view.ViewArchitectureSupport;

@BugPattern(
        name = "ViewBinderApplicationServiceReadback",
        summary = "Binders must not consume ApplicationService return values for readback.",
        severity = BugPattern.SeverityLevel.ERROR)
public final class ViewBinderApplicationServiceReadbackChecker extends BugChecker
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
                if (!ViewArchitectureSupport.isApplicationServiceReference(ownerType)) {
                    return super.visitMethodInvocation(methodInvocationTree, unused);
                }
                if (symbol.getReturnType() == null || symbol.getReturnType().getKind() == TypeKind.VOID) {
                    return super.visitMethodInvocation(methodInvocationTree, unused);
                }
                if (isIgnoredReturnValue(getCurrentPath())) {
                    return super.visitMethodInvocation(methodInvocationTree, unused);
                }
                String returnType = symbol.getReturnType().toString();
                violations.add(ownerType + "#" + symbol.getSimpleName() + " -> " + returnType);
                return super.visitMethodInvocation(methodInvocationTree, unused);
            }
        }.scan(tree, null);

        if (violations.isEmpty()) {
            return Description.NO_MATCH;
        }
        return buildDescription(tree)
                .setMessage("Binder package '" + sourcePackageName
                        + "' value-consumes ApplicationService results: "
                        + String.join(", ", violations)
                        + ". Binders may send commands to ApplicationServices only; same-context readback and feedback must come from direct published/*Model runtime services, never from ApplicationService return values.")
                .build();
    }

    private static boolean isIgnoredReturnValue(TreePath currentPath) {
        TreePath parentPath = currentPath == null ? null : currentPath.getParentPath();
        if (parentPath == null) {
            return false;
        }
        if (parentPath.getLeaf() instanceof ExpressionStatementTree) {
            return true;
        }
        if (parentPath.getLeaf() instanceof ParenthesizedTree) {
            return isIgnoredReturnValue(parentPath);
        }
        if (!(parentPath.getLeaf() instanceof LambdaExpressionTree lambdaExpressionTree)) {
            return false;
        }
        return lambdaExpressionTree.getBody() == currentPath.getLeaf();
    }
}
