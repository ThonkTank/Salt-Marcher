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
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import javax.lang.model.type.TypeKind;
import saltmarcher.quality.errorprone.view.ViewArchitectureSupport;

@BugPattern(
        name = "ViewBinderApplicationServiceReadback",
        summary = "Binders may only value-consume same-context published/*Model handles from ApplicationServices.",
        severity = BugPattern.SeverityLevel.ERROR)
public final class ViewBinderApplicationServiceReadbackChecker extends BugChecker
        implements BugChecker.CompilationUnitTreeMatcher {

    private static final Pattern APPLICATION_SERVICE_CONTEXT =
            Pattern.compile("^src\\.domain\\.([^.]+)\\.[^.]+ApplicationService(?:\\$.*)?$");
    private static final Pattern PUBLISHED_MODEL_CONTEXT =
            Pattern.compile("^src\\.domain\\.([^.]+)\\.published\\.[^.]+Model(?:<.*>)?$");

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
                if (isSameContextPublishedModel(ownerType, returnType)) {
                    return super.visitMethodInvocation(methodInvocationTree, unused);
                }
                violations.add(ownerType + "#" + symbol.getSimpleName() + " -> " + returnType);
                return super.visitMethodInvocation(methodInvocationTree, unused);
            }
        }.scan(tree, null);

        if (violations.isEmpty()) {
            return Description.NO_MATCH;
        }
        return buildDescription(tree)
                .setMessage("Binder package '" + sourcePackageName
                        + "' value-consumes non-model ApplicationService results: "
                        + String.join(", ", violations)
                        + ". Binders may only read same-context src.domain.<context>.published.*Model handles and then use current()/subscribe(); all other ApplicationService results must be ignored.")
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

    private static boolean isSameContextPublishedModel(String ownerType, String returnType) {
        Matcher serviceMatcher = APPLICATION_SERVICE_CONTEXT.matcher(ownerType == null ? "" : ownerType);
        Matcher modelMatcher = PUBLISHED_MODEL_CONTEXT.matcher(returnType == null ? "" : returnType);
        return serviceMatcher.matches()
                && modelMatcher.matches()
                && serviceMatcher.group(1).equals(modelMatcher.group(1));
    }
}
