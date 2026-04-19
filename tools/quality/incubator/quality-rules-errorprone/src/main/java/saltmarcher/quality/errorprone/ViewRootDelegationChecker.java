package saltmarcher.quality.errorprone;

import com.google.errorprone.BugPattern;
import com.google.errorprone.VisitorState;
import com.google.errorprone.bugpatterns.BugChecker;
import com.google.errorprone.matchers.Description;
import com.google.errorprone.util.ASTHelpers;
import com.sun.source.tree.CompilationUnitTree;
import com.sun.source.tree.ConditionalExpressionTree;
import com.sun.source.tree.ExpressionTree;
import com.sun.source.tree.IdentifierTree;
import com.sun.source.tree.MethodInvocationTree;
import com.sun.source.tree.MethodTree;
import com.sun.source.tree.NewClassTree;
import com.sun.source.tree.ParenthesizedTree;
import com.sun.source.tree.ReturnTree;
import com.sun.source.tree.TypeCastTree;
import com.sun.source.tree.VariableTree;
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
        boolean[] hasAssemblyBackedReturn = {false};
        for (String referencedType : ViewArchitectureSupport.collectReferencedTypes(tree)) {
            if (isForbiddenReference(referencedType, component)) {
                violations.add("reference -> " + referencedType);
            }
        }

        new TreePathScanner<Void, Void>() {
            private boolean insideCreateScreen;
            private final Set<String> assemblyBackedLocals = new LinkedHashSet<>();

            @Override
            public Void visitMethod(MethodTree methodTree, Void unused) {
                boolean previousInsideCreateScreen = insideCreateScreen;
                Set<String> previousAssemblyBackedLocals = new LinkedHashSet<>(assemblyBackedLocals);
                if (isCreateScreenMethod(methodTree)) {
                    hasCreateScreen[0] = true;
                    insideCreateScreen = true;
                    assemblyBackedLocals.clear();
                }
                try {
                    return super.visitMethod(methodTree, unused);
                } finally {
                    insideCreateScreen = previousInsideCreateScreen;
                    assemblyBackedLocals.clear();
                    assemblyBackedLocals.addAll(previousAssemblyBackedLocals);
                }
            }

            @Override
            public Void visitVariable(VariableTree variableTree, Void unused) {
                if (insideCreateScreen
                        && isAssemblyBackedExpression(variableTree.getInitializer(), component, assemblyBackedLocals)) {
                    assemblyBackedLocals.add(variableTree.getName().toString());
                }
                return super.visitVariable(variableTree, unused);
            }

            @Override
            public Void visitReturn(ReturnTree returnTree, Void unused) {
                if (!insideCreateScreen) {
                    return super.visitReturn(returnTree, unused);
                }
                if (isAssemblyBackedExpression(returnTree.getExpression(), component, assemblyBackedLocals)) {
                    hasAssemblyBackedReturn[0] = true;
                } else {
                    violations.add("createScreen return -> return expression is not backed by src.view."
                            + component
                            + ".assembly.*");
                }
                return super.visitReturn(returnTree, unused);
            }

            @Override
            public Void visitMethodInvocation(MethodInvocationTree methodInvocationTree, Void unused) {
                Symbol.MethodSymbol symbol = ASTHelpers.getSymbol(methodInvocationTree);
                if (symbol != null) {
                    String owner = ViewArchitectureSupport.getQualifiedOwnerTypeName(symbol);
                    String methodName = symbol.getSimpleName().toString();
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
                if (newClassTree.getClassBody() != null) {
                    if ("shell.api.ShellScreen".equals(constructedType)) {
                        violations.add("direct shell screen construction -> " + constructedType);
                    }
                }
                return super.visitNewClass(newClassTree, unused);
            }
        }.scan(tree, null);

        if (hasCreateScreen[0] && !hasAssemblyBackedReturn[0]) {
            violations.add("createScreen return -> no ShellScreen returned from src.view."
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

    private static boolean isAssemblyBackedExpression(
            ExpressionTree expression,
            String component,
            Set<String> assemblyBackedLocals) {
        if (expression == null) {
            return false;
        }
        return switch (expression) {
            case MethodInvocationTree methodInvocationTree ->
                    isOwnAssemblyReference(
                            ViewArchitectureSupport.getQualifiedOwnerTypeName(ASTHelpers.getSymbol(methodInvocationTree)),
                            component);
            case NewClassTree newClassTree ->
                    ASTHelpers.getType(newClassTree) != null
                            && ASTHelpers.getType(newClassTree).tsym instanceof Symbol.ClassSymbol classSymbol
                            && isOwnAssemblyReference(classSymbol.getQualifiedName().toString(), component);
            case IdentifierTree identifierTree ->
                    assemblyBackedLocals.contains(identifierTree.getName().toString());
            case ParenthesizedTree parenthesizedTree ->
                    isAssemblyBackedExpression(parenthesizedTree.getExpression(), component, assemblyBackedLocals);
            case TypeCastTree typeCastTree ->
                    isAssemblyBackedExpression(typeCastTree.getExpression(), component, assemblyBackedLocals);
            case ConditionalExpressionTree conditionalExpressionTree ->
                    isAssemblyBackedExpression(conditionalExpressionTree.getTrueExpression(), component, assemblyBackedLocals)
                            && isAssemblyBackedExpression(conditionalExpressionTree.getFalseExpression(), component, assemblyBackedLocals);
            default -> false;
        };
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
