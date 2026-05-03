package saltmarcher.quality.errorprone.view.binder;

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
import saltmarcher.quality.errorprone.view.ViewArchitectureSupport;

@BugPattern(
        name = "ViewBinderProjectionModelRequestProtocol",
        summary = "Binders must not wire request-token or publish-like protocols off view models; outward work must flow through PublishedEvent sinks.",
        severity = BugPattern.SeverityLevel.ERROR)
public final class ViewBinderProjectionModelRequestProtocolChecker extends BugChecker
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
                if (symbol == null || !isForbiddenProjectionProtocol(symbol)) {
                    return super.visitMethodInvocation(methodInvocationTree, unused);
                }
                String ownerType = ViewArchitectureSupport.getQualifiedOwnerTypeName(symbol);
                if (!ViewArchitectureSupport.isTargetViewModelReference(ownerType)) {
                    return super.visitMethodInvocation(methodInvocationTree, unused);
                }
                violations.add(ownerType + "#" + symbol.getSimpleName());
                return super.visitMethodInvocation(methodInvocationTree, unused);
            }
        }.scan(tree, null);

        if (violations.isEmpty()) {
            return Description.NO_MATCH;
        }
        return buildDescription(tree)
                .setMessage("Binder package '" + sourcePackageName
                        + "' wires request/token protocol APIs from view models: "
                        + String.join(", ", violations)
                        + ". Binder side-effects must be driven through same-root Consumer<...PublishedEvent> seams instead.")
                .build();
    }

    private static boolean isForbiddenProjectionProtocol(Symbol.MethodSymbol symbol) {
        String simpleName = symbol.getSimpleName().toString();
        return simpleName.endsWith("TokenProperty")
                || (simpleName.contains("Request") && simpleName.endsWith("Property"))
                || simpleName.startsWith("request");
    }
}
