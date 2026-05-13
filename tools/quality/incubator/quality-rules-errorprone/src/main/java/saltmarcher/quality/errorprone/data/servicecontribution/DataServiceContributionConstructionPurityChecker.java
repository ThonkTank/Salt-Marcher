package saltmarcher.quality.errorprone.data.servicecontribution;

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
import java.util.regex.Matcher;

@BugPattern(
        name = "DataServiceContributionConstructionPurity",
        summary = "Data ServiceContribution roots must stay limited to constructor wiring and service registration.",
        severity = BugPattern.SeverityLevel.ERROR)
public final class DataServiceContributionConstructionPurityChecker extends BugChecker
        implements BugChecker.CompilationUnitTreeMatcher {

    private static final String SERVICE_REGISTRY_BUILDER = "shell.api.ServiceRegistry.Builder";

    @Override
    public Description matchCompilationUnit(CompilationUnitTree tree, VisitorState state) {
        String packageName = DataServiceContributionArchitectureSupport.packageName(tree);
        Matcher rootMatcher = DataServiceContributionArchitectureSupport.DATA_ROOT_PACKAGE.matcher(packageName);
        if (!rootMatcher.matches()) {
            return Description.NO_MATCH;
        }
        String featureName = rootMatcher.group(1);
        if (!DataServiceContributionArchitectureSupport.isServiceCompositionOwner(tree, featureName)) {
            return Description.NO_MATCH;
        }
        String compositionOwner = packageName + "."
                + DataServiceContributionArchitectureSupport.topLevelSimpleName(tree);

        List<String> violations = new ArrayList<>();
        new TreePathScanner<Void, Void>() {
            @Override
            public Void visitMethodInvocation(MethodInvocationTree methodInvocation, Void unused) {
                Symbol symbol = ASTHelpers.getSymbol(methodInvocation);
                if (symbol == null) {
                    return super.visitMethodInvocation(methodInvocation, unused);
                }
                if (isServiceRegistryRegistration(symbol)
                        && SERVICE_REGISTRY_BUILDER.equals(ownerTypeName(symbol))) {
                    return super.visitMethodInvocation(methodInvocation, unused);
                }
                String ownerTypeName = ownerTypeName(symbol);
                if (isAllowedCompositionOwnerCall(ownerTypeName, packageName, compositionOwner)
                        || !isForbiddenRootCall(ownerTypeName, featureName)) {
                    return super.visitMethodInvocation(methodInvocation, unused);
                }
                if (isForbiddenRootCall(ownerTypeName, featureName)) {
                    violations.add(methodInvocation + " -> " + ownerTypeName);
                }
                return super.visitMethodInvocation(methodInvocation, unused);
            }
        }.scan(tree, null);

        if (violations.isEmpty()) {
            return Description.NO_MATCH;
        }
        return buildDescription(tree)
                .setMessage("Data ServiceContribution root '" + packageName
                        + "' must perform constructor wiring and ServiceRegistry registration only."
                        + " Move source mechanics, schema, mapper, repository/query, or gateway method calls behind adapters. Found: "
                        + String.join("; ", violations))
                .build();
    }

    private static boolean isForbiddenRootCall(String ownerTypeName, String featureName) {
        if (ownerTypeName == null) {
            return false;
        }
        if (ownerTypeName.startsWith("src.data." + featureName + ".")) {
            return true;
        }
        return ownerTypeName.startsWith("java.sql.")
                || ownerTypeName.startsWith("javax.sql.")
                || ownerTypeName.startsWith("java.io.")
                || ownerTypeName.startsWith("java.net.")
                || ownerTypeName.startsWith("java.nio.file.")
                || ownerTypeName.startsWith("java.net.http.")
                || ownerTypeName.startsWith("okhttp3.")
                || ownerTypeName.startsWith("retrofit2.");
    }

    private static boolean isServiceRegistryRegistration(Symbol symbol) {
        return "register".contentEquals(symbol.getSimpleName())
                || "registerFactory".contentEquals(symbol.getSimpleName());
    }

    private static boolean isAllowedCompositionOwnerCall(
            String ownerTypeName,
            String packageName,
            String compositionOwner) {
        if (ownerTypeName == null) {
            return false;
        }
        String samePackagePrefix = packageName + ".";
        String simpleOwnerName = ownerTypeName.startsWith(samePackagePrefix)
                ? ownerTypeName.substring(samePackagePrefix.length())
                : ownerTypeName;
        return ownerTypeName.equals(compositionOwner)
                || ownerTypeName.startsWith(compositionOwner + "$")
                || ownerTypeName.startsWith(compositionOwner + ".")
                || simpleOwnerName.endsWith("ServiceAssembly")
                || simpleOwnerName.contains("ServiceAssembly$");
    }

    private static String ownerTypeName(Symbol symbol) {
        if (symbol.owner instanceof Symbol.ClassSymbol classSymbol) {
            return classSymbol.getQualifiedName().toString();
        }
        return null;
    }
}
