package saltmarcher.quality.errorprone.view.view;

import com.google.errorprone.BugPattern;
import com.google.errorprone.VisitorState;
import com.google.errorprone.bugpatterns.BugChecker;
import com.google.errorprone.matchers.Description;
import com.google.errorprone.util.ASTHelpers;
import com.sun.source.tree.CompilationUnitTree;
import com.sun.source.tree.MethodInvocationTree;
import com.sun.source.util.TreePathScanner;
import com.sun.tools.javac.code.Symbol;
import java.util.LinkedHashSet;
import java.util.Set;
import javax.lang.model.element.Modifier;
import saltmarcher.quality.errorprone.view.ViewSourceDescriptor;
@BugPattern(
        name = "PassiveViewModelReadApis",
        summary = "Passive Views may call their models only through observable read-surface APIs.",
        severity = BugPattern.SeverityLevel.ERROR)
public final class PassiveViewModelReadApisChecker extends BugChecker
        implements BugChecker.CompilationUnitTreeMatcher {

    @Override
    public Description matchCompilationUnit(CompilationUnitTree tree, VisitorState state) {
        ViewSourceDescriptor source = ViewSourceDescriptor.describe(tree);
        if (!source.isPassiveViewSource()) {
            return Description.NO_MATCH;
        }

        String sourcePackageName = source.packageName();
        Set<String> violations = new LinkedHashSet<>();
        new TreePathScanner<Void, Void>() {
            @Override
            public Void visitMethodInvocation(MethodInvocationTree methodInvocationTree, Void unused) {
                Symbol.MethodSymbol symbol = ASTHelpers.getSymbol(methodInvocationTree);
                if (symbol == null) {
                    return super.visitMethodInvocation(methodInvocationTree, unused);
                }
                String ownerType = ViewArchitectureSupport.getQualifiedOwnerTypeName(symbol);
                if (!isAllowedViewModelOwner(sourcePackageName, ownerType)) {
                    return super.visitMethodInvocation(methodInvocationTree, unused);
                }
                if (!isAllowedObservableReadSurface(symbol)) {
                    violations.add(ownerType + "." + symbol.getSimpleName() + "()");
                }
                return super.visitMethodInvocation(methodInvocationTree, unused);
            }
        }.scan(tree, null);

        if (violations.isEmpty()) {
            return Description.NO_MATCH;
        }
        return buildDescription(tree)
                .setMessage("Passive View package '" + sourcePackageName
                        + "' reads its model through non-observable APIs: "
                        + String.join(", ", violations)
                        + ". Views may read models only through JavaFX observable/binding surfaces.")
                .build();
    }

    private static boolean isAllowedViewModelOwner(String sourcePackageName, String ownerType) {
        return ViewArchitectureSupport.isTopLevelViewModelReference(ownerType)
                && (ViewArchitectureSupport.isSameViewRootModelReference(sourcePackageName, ownerType)
                || ViewArchitectureSupport.isPrimitiveModelReference(ownerType));
    }

    private static boolean isAllowedObservableReadSurface(Symbol.MethodSymbol methodSymbol) {
        if (methodSymbol.getModifiers().contains(Modifier.STATIC) || !methodSymbol.getParameters().isEmpty()) {
            return false;
        }
        return ViewArchitectureSupport.isObservableReadSurfaceType(methodSymbol.getReturnType());
    }
}
