package saltmarcher.quality.errorprone;

import com.google.errorprone.BugPattern;
import com.google.errorprone.VisitorState;
import com.google.errorprone.bugpatterns.BugChecker;
import com.google.errorprone.matchers.Description;
import com.google.errorprone.util.ASTHelpers;
import com.sun.source.tree.ClassTree;
import com.sun.source.tree.CompilationUnitTree;
import com.sun.source.tree.MethodInvocationTree;
import com.sun.source.util.TreeScanner;
import com.sun.source.util.TreePathScanner;
import com.sun.tools.javac.code.Symbol;
import java.util.ArrayList;
import java.util.List;
import java.util.regex.Pattern;

@BugPattern(
        name = "ServiceRegistryRegistrationPlacement",
        summary = "ServiceRegistry registrations must stay in data feature composition adapter roots.",
        severity = BugPattern.SeverityLevel.ERROR)
public final class ServiceRegistryRegistrationPlacementChecker extends BugChecker
        implements BugChecker.CompilationUnitTreeMatcher {

    private static final String SERVICE_REGISTRY_BUILDER = "shell.api.ServiceRegistry.Builder";

    @Override
    public Description matchCompilationUnit(CompilationUnitTree tree, VisitorState state) {
        String packageName = DataArchitectureSupport.packageName(tree);
        var dataRootMatcher = DataArchitectureSupport.DATA_ROOT_PACKAGE.matcher(packageName);
        if (dataRootMatcher.matches()) {
            String featureName = dataRootMatcher.group(1);
            if (isServiceCompositionOwner(tree, featureName)) {
                return Description.NO_MATCH;
            }
        }
        var domainRootMatcher = Pattern.compile("^src\\.domain\\.([^.]+)$").matcher(packageName);
        if (domainRootMatcher.matches()) {
            String featureName = domainRootMatcher.group(1);
            if (isServiceCompositionOwner(tree, featureName)) {
                return Description.NO_MATCH;
            }
        }

        List<String> registrations = new ArrayList<>();
        new TreePathScanner<Void, Void>() {
            @Override
            public Void visitMethodInvocation(MethodInvocationTree methodInvocation, Void unused) {
                Symbol symbol = ASTHelpers.getSymbol(methodInvocation);
                if (symbol != null
                        && isRegistrationMethod(symbol)
                        && SERVICE_REGISTRY_BUILDER.equals(ownerTypeName(symbol))) {
                    registrations.add(methodInvocation.toString());
                }
                return super.visitMethodInvocation(methodInvocation, unused);
            }
        }.scan(tree, null);

        if (registrations.isEmpty()) {
            return Description.NO_MATCH;
        }
        return buildDescription(tree)
                .setMessage("Package '" + packageName
                        + "' registers services directly in shell.api.ServiceRegistry.Builder."
                        + " Runtime service registration belongs only in domain or data feature composition roots."
                        + " Found: " + String.join(", ", registrations))
                .build();
    }

    private static boolean isServiceCompositionOwner(CompilationUnitTree tree, String featureName) {
        String simpleName = topLevelSimpleName(tree);
        return simpleName.endsWith("ServiceContribution")
                || simpleName.endsWith("ServiceAssembly");
    }

    private static String topLevelSimpleName(CompilationUnitTree tree) {
        ClassTree[] result = {null};
        new TreeScanner<Void, Void>() {
            @Override
            public Void visitClass(ClassTree classTree, Void unused) {
                if (result[0] == null) {
                    result[0] = classTree;
                }
                return null;
            }
        }.scan(tree, null);
        return result[0] == null ? "" : result[0].getSimpleName().toString();
    }

    private static boolean isRegistrationMethod(Symbol symbol) {
        return "register".contentEquals(symbol.getSimpleName())
                || "registerFactory".contentEquals(symbol.getSimpleName());
    }

    private static String ownerTypeName(Symbol symbol) {
        if (symbol == null || symbol.owner == null) {
            return null;
        }
        if (symbol.owner instanceof Symbol.ClassSymbol classSymbol) {
            return classSymbol.getQualifiedName().toString();
        }
        return null;
    }
}
