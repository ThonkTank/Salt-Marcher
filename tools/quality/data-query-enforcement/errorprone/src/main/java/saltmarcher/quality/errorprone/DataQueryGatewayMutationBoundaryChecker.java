package saltmarcher.quality.errorprone;

import com.google.errorprone.BugPattern;
import com.google.errorprone.VisitorState;
import com.google.errorprone.bugpatterns.BugChecker;
import com.google.errorprone.matchers.Description;
import com.google.errorprone.util.ASTHelpers;
import com.sun.source.tree.CompilationUnitTree;
import com.sun.source.tree.MethodInvocationTree;
import com.sun.source.util.TreePathScanner;
import com.sun.tools.javac.code.Symbol;
import java.util.ArrayList;
import java.util.List;
import java.util.Set;
import java.util.regex.Matcher;

@BugPattern(
        name = "DataQueryGatewayMutationBoundary",
        summary = "Query adapters must not call mutation-shaped gateway operations.",
        severity = BugPattern.SeverityLevel.ERROR)
public final class DataQueryGatewayMutationBoundaryChecker extends BugChecker
        implements BugChecker.CompilationUnitTreeMatcher {

    private static final Set<String> MUTATION_METHOD_PREFIXES = Set.of(
            "add",
            "create",
            "delete",
            "insert",
            "mutate",
            "persist",
            "remove",
            "save",
            "set",
            "store",
            "update",
            "upsert",
            "write");

    @Override
    public Description matchCompilationUnit(CompilationUnitTree tree, VisitorState state) {
        String packageName = DataArchitectureSupport.packageName(tree);
        Matcher queryMatcher = DataArchitectureSupport.QUERY_PACKAGE.matcher(packageName);
        if (!queryMatcher.matches()) {
            return Description.NO_MATCH;
        }
        String featureName = queryMatcher.group(1);

        List<String> violations = new ArrayList<>();
        new TreePathScanner<Void, Void>() {
            @Override
            public Void visitMethodInvocation(MethodInvocationTree methodInvocation, Void unused) {
                Symbol symbol = ASTHelpers.getSymbol(methodInvocation);
                if (symbol == null) {
                    return super.visitMethodInvocation(methodInvocation, unused);
                }
                String methodName = symbol.getSimpleName().toString();
                String ownerTypeName = ownerTypeName(symbol);
                if (isMutationMethodName(methodName) && isOwnFeatureGatewayType(ownerTypeName, featureName)) {
                    violations.add(methodInvocation + " -> " + ownerTypeName + "." + methodName);
                }
                return super.visitMethodInvocation(methodInvocation, unused);
            }
        }.scan(tree, null);

        if (violations.isEmpty()) {
            return Description.NO_MATCH;
        }
        return buildDescription(tree)
                .setMessage("Data query adapter package '" + packageName
                        + "' must stay read-only and must not call mutation-shaped gateway operations: "
                        + String.join("; ", violations))
                .build();
    }

    private static boolean isMutationMethodName(String methodName) {
        String normalized = methodName.toLowerCase();
        return MUTATION_METHOD_PREFIXES.stream().anyMatch(normalized::startsWith);
    }

    private static boolean isOwnFeatureGatewayType(String ownerTypeName, String featureName) {
        if (ownerTypeName == null) {
            return false;
        }
        Matcher matcher = DataArchitectureSupport.GATEWAY_PACKAGE.matcher(packageName(ownerTypeName));
        return matcher.matches() && matcher.group(1).equals(featureName);
    }

    private static String packageName(String qualifiedName) {
        int separator = qualifiedName.lastIndexOf('.');
        return separator < 0 ? "" : qualifiedName.substring(0, separator);
    }

    private static String ownerTypeName(Symbol symbol) {
        if (symbol.owner instanceof Symbol.ClassSymbol classSymbol) {
            return classSymbol.getQualifiedName().toString();
        }
        return null;
    }
}
