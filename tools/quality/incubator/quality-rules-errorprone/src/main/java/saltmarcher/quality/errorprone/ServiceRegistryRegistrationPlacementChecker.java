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

@BugPattern(
        name = "ServiceRegistryRegistrationPlacement",
        summary = "ServiceRegistry registrations must stay in data feature composition adapter roots.",
        severity = BugPattern.SeverityLevel.ERROR)
public final class ServiceRegistryRegistrationPlacementChecker extends BugChecker
        implements BugChecker.CompilationUnitTreeMatcher {

    private static final String SERVICE_REGISTRY_BUILDER = "shell.api.ServiceRegistry.Builder";

    @Override
    public Description matchCompilationUnit(CompilationUnitTree tree, VisitorState state) {
        String packageName = ViewArchitectureSupport.packageName(tree);
        if (ViewArchitectureSupport.DATA_ROOT_PACKAGE.matcher(packageName).matches()) {
            return Description.NO_MATCH;
        }

        List<String> registrations = new ArrayList<>();
        new TreePathScanner<Void, Void>() {
            @Override
            public Void visitMethodInvocation(MethodInvocationTree methodInvocation, Void unused) {
                Symbol symbol = ASTHelpers.getSymbol(methodInvocation);
                if (symbol != null
                        && "register".contentEquals(symbol.getSimpleName())
                        && SERVICE_REGISTRY_BUILDER.equals(ViewArchitectureSupport.getQualifiedOwnerTypeName(symbol))) {
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
                        + " Runtime service registration belongs only in the data feature composition adapter at src/data/<feature>/<Feature>ServiceContribution.java."
                        + " Found: " + String.join(", ", registrations))
                .build();
    }
}
