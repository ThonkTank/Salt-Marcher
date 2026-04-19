package saltmarcher.quality.errorprone;

import com.google.errorprone.BugPattern;
import com.google.errorprone.VisitorState;
import com.google.errorprone.bugpatterns.BugChecker;
import com.google.errorprone.matchers.Description;
import com.google.errorprone.util.ASTHelpers;
import com.sun.source.tree.CompilationUnitTree;
import com.sun.source.tree.MethodInvocationTree;
import com.sun.source.tree.MethodTree;
import com.sun.source.tree.NewClassTree;
import com.sun.source.util.TreePathScanner;
import com.sun.tools.javac.code.Symbol;
import java.util.LinkedHashSet;
import java.util.Set;

@BugPattern(
        name = "ViewRootDelegation",
        summary = "Root view entrypoints must delegate all slice wiring into their own assembly.",
        severity = BugPattern.SeverityLevel.ERROR)
public final class ViewRootDelegationChecker extends BugChecker
        implements BugChecker.CompilationUnitTreeMatcher {

    private static final Set<String> FORBIDDEN_RUNTIME_CONTEXT_METHODS = Set.of("persistence", "inspector", "services", "session");

    @Override
    public Description matchCompilationUnit(CompilationUnitTree tree, VisitorState state) {
        String packageName = ViewArchitectureSupport.packageName(tree);
        var matcher = ViewArchitectureSupport.ROOT_PACKAGE.matcher(packageName);
        if (!matcher.matches()) {
            return Description.NO_MATCH;
        }
        String component = matcher.group(1);

        Set<String> violations = new LinkedHashSet<>();
        boolean[] hasCreateScreen = {false};
        boolean[] delegatesCreateScreenToAssembly = {false};
        for (String referencedType : ViewArchitectureSupport.collectReferencedTypes(tree)) {
            if (isForbiddenReference(referencedType, component)) {
                violations.add("reference -> " + referencedType);
            }
        }

        new TreePathScanner<Void, Void>() {
            private boolean insideCreateScreen;

            @Override
            public Void visitMethod(MethodTree methodTree, Void unused) {
                boolean previousInsideCreateScreen = insideCreateScreen;
                if (isCreateScreenMethod(methodTree)) {
                    hasCreateScreen[0] = true;
                    insideCreateScreen = true;
                }
                try {
                    return super.visitMethod(methodTree, unused);
                } finally {
                    insideCreateScreen = previousInsideCreateScreen;
                }
            }

            @Override
            public Void visitMethodInvocation(MethodInvocationTree methodInvocationTree, Void unused) {
                Symbol.MethodSymbol symbol = ASTHelpers.getSymbol(methodInvocationTree);
                if (symbol != null) {
                    String owner = ViewArchitectureSupport.getQualifiedOwnerTypeName(symbol);
                    String methodName = symbol.getSimpleName().toString();
                    if (insideCreateScreen && isOwnAssemblyReference(owner, component)) {
                        delegatesCreateScreenToAssembly[0] = true;
                    }
                    if ("shell.api.ShellRuntimeContext".equals(owner)
                            && FORBIDDEN_RUNTIME_CONTEXT_METHODS.contains(methodName)) {
                        violations.add("runtime access -> ShellRuntimeContext." + methodName + "()");
                    }
                }
                return super.visitMethodInvocation(methodInvocationTree, unused);
            }

            @Override
            public Void visitNewClass(NewClassTree newClassTree, Void unused) {
                String constructedType = null;
                if (ASTHelpers.getType(newClassTree) != null && ASTHelpers.getType(newClassTree).tsym instanceof Symbol.ClassSymbol classSymbol) {
                    constructedType = classSymbol.getQualifiedName().toString();
                }
                if (insideCreateScreen && isOwnAssemblyReference(constructedType, component)) {
                    delegatesCreateScreenToAssembly[0] = true;
                }
                if (newClassTree.getClassBody() != null) {
                    if ("shell.api.ShellScreen".equals(constructedType)) {
                        violations.add("direct shell screen construction -> " + constructedType);
                    }
                }
                return super.visitNewClass(newClassTree, unused);
            }
        }.scan(tree, null);

        if (hasCreateScreen[0] && !delegatesCreateScreenToAssembly[0]) {
            violations.add("createScreen delegation -> no call to src.view."
                    + component
                    + ".assembly.*");
        }

        if (violations.isEmpty()) {
            return Description.NO_MATCH;
        }
        return buildDescription(tree)
                .setMessage("Root package '" + packageName
                        + "' must delegate slice wiring into own assembly. Violations: "
                        + String.join(", ", violations))
                .build();
    }

    private static boolean isForbiddenReference(String referencedType, String component) {
        if (referencedType.startsWith("javafx.")
                || referencedType.startsWith("src.domain.")
                || referencedType.startsWith("src.data.")) {
            return true;
        }
        ViewArchitectureSupport.ViewTypeInfo viewType = ViewArchitectureSupport.parseViewType(referencedType);
        if (viewType == null) {
            return false;
        }
        if (viewType.component().equals(component)) {
            return !"assembly".equals(viewType.bucket()) && !"ROOT".equals(viewType.bucket());
        }
        return true;
    }

    private static boolean isCreateScreenMethod(MethodTree methodTree) {
        return methodTree.getName().contentEquals("createScreen")
                && methodTree.getParameters().size() == 1;
    }

    private static boolean isOwnAssemblyReference(String referencedType, String component) {
        return referencedType != null
                && referencedType.startsWith("src.view." + component + ".assembly.");
    }
}
