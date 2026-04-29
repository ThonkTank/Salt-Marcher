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
import saltmarcher.quality.errorprone.view.ViewArchitectureSupport;

@BugPattern(
        name = "ViewReflectionBypass",
        summary = "View-layer architecture checks must not be bypassed via reflective type lookups.",
        severity = BugPattern.SeverityLevel.ERROR)
public final class ViewReflectionBypassChecker extends BugChecker
        implements BugChecker.CompilationUnitTreeMatcher {

    @Override
    public Description matchCompilationUnit(CompilationUnitTree tree, VisitorState state) {
        String packageName = ViewArchitectureSupport.packageName(tree);
        if (!packageName.startsWith("src.view.")) {
            return Description.NO_MATCH;
        }

        Set<String> violations = new LinkedHashSet<>();
        for (String referencedType : ViewArchitectureSupport.collectReferencedTypes(tree)) {
            if (referencedType.startsWith("java.lang.reflect.")) {
                violations.add("reflective type -> " + referencedType);
            }
        }

        new TreePathScanner<Void, Void>() {
            @Override
            public Void visitMethodInvocation(MethodInvocationTree methodInvocationTree, Void unused) {
                Symbol.MethodSymbol symbol = ASTHelpers.getSymbol(methodInvocationTree);
                if (symbol != null) {
                    String owner = ViewArchitectureSupport.getQualifiedOwnerTypeName(symbol);
                    String methodName = symbol.getSimpleName().toString();
                    if (("java.lang.Class".equals(owner) && "forName".equals(methodName))
                            || ("java.lang.ClassLoader".equals(owner) && "loadClass".equals(methodName))
                            || ("java.lang.invoke.MethodHandles.Lookup".equals(owner) && "findClass".equals(methodName))) {
                        violations.add("reflective lookup -> " + owner + "." + methodName + "()");
                    }
                }
                return super.visitMethodInvocation(methodInvocationTree, unused);
            }
        }.scan(tree, null);

        if (violations.isEmpty()) {
            return Description.NO_MATCH;
        }
        return buildDescription(tree)
                .setMessage("View package '" + packageName
                        + "' must not bypass architecture boundaries via reflection: "
                        + String.join(", ", violations))
                .build();
    }
}
