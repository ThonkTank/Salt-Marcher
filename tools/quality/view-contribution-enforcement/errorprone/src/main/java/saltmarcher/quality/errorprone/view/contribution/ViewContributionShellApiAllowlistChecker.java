package saltmarcher.quality.errorprone.view.contribution;

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
        name = "ViewContributionShellApiAllowlist",
        summary = "View contributions may use only their documented shell registration subset and may not perform runtime service lookup.",
        severity = BugPattern.SeverityLevel.ERROR)
public final class ViewContributionShellApiAllowlistChecker extends BugChecker
        implements BugChecker.CompilationUnitTreeMatcher {

    @Override
    public Description matchCompilationUnit(CompilationUnitTree tree, VisitorState state) {
        if (!ViewArchitectureSupport.isContributionSource(tree)) {
            return Description.NO_MATCH;
        }

        String packageName = ViewArchitectureSupport.packageName(tree);
        Set<String> forbiddenReferences = new LinkedHashSet<>();
        for (String referencedType : ViewArchitectureSupport.collectReferencedTypes(tree)) {
            if (referencedType.startsWith("shell.host.")) {
                forbiddenReferences.add(referencedType);
                continue;
            }
            if (referencedType.startsWith("shell.api.")
                    && !ViewArchitectureSupport.isAllowedContributionShellType(referencedType)) {
                forbiddenReferences.add(referencedType);
            }
        }
        collectContributionServiceLookupViolations(tree, forbiddenReferences);

        if (forbiddenReferences.isEmpty()) {
            return Description.NO_MATCH;
        }
        return buildDescription(tree)
                .setMessage("Contribution package '" + packageName
                        + "' references shell types outside its allowed shell contract subset: "
                        + String.join(", ", forbiddenReferences))
                .build();
    }

    private static void collectContributionServiceLookupViolations(
            CompilationUnitTree tree,
            Set<String> forbiddenReferences) {
        new TreePathScanner<Void, Void>() {
            @Override
            public Void visitMethodInvocation(MethodInvocationTree methodInvocationTree, Void unused) {
                Symbol.MethodSymbol symbol = ASTHelpers.getSymbol(methodInvocationTree);
                if (symbol != null
                        && "services".equals(symbol.getSimpleName().toString())
                        && "shell.api.ShellRuntimeContext".equals(ViewArchitectureSupport.getQualifiedOwnerTypeName(symbol))) {
                    forbiddenReferences.add("shell.api.ShellRuntimeContext.services()");
                }
                return super.visitMethodInvocation(methodInvocationTree, unused);
            }
        }.scan(tree, null);
    }
}
