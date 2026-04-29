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
import java.util.LinkedHashSet;
import java.util.Set;
import saltmarcher.quality.errorprone.view.ViewArchitectureSupport;

@BugPattern(
        name = "FeatureShellApiAllowlist",
        summary = "View contributions, binders, and data service roots may use only their documented shell API subset.",
        severity = BugPattern.SeverityLevel.ERROR)
public final class FeatureShellApiAllowlistChecker extends BugChecker
        implements BugChecker.CompilationUnitTreeMatcher {

    @Override
    public Description matchCompilationUnit(CompilationUnitTree tree, VisitorState state) {
        String packageName = ViewArchitectureSupport.packageName(tree);
        ShellPolicy shellPolicy = shellPolicy(tree, packageName);
        if (shellPolicy == null) {
            return Description.NO_MATCH;
        }

        Set<String> forbiddenReferences = new LinkedHashSet<>();
        for (String referencedType : ViewArchitectureSupport.collectReferencedTypes(tree)) {
            if (referencedType.startsWith("shell.host.")) {
                forbiddenReferences.add(referencedType);
                continue;
            }
            if (referencedType.startsWith("shell.api.")
                    && !shellPolicy.isAllowed(referencedType)) {
                forbiddenReferences.add(referencedType);
            }
        }
        if (ViewArchitectureSupport.isContributionSource(tree)) {
            collectContributionServiceLookupViolations(tree, forbiddenReferences);
        }

        if (forbiddenReferences.isEmpty()) {
            return Description.NO_MATCH;
        }
        return buildDescription(tree)
                .setMessage("Package '" + packageName
                        + "' references shell types outside its allowed shell contract subset: "
                        + String.join(", ", forbiddenReferences))
                .build();
    }

    private static ShellPolicy shellPolicy(CompilationUnitTree tree, String packageName) {
        if (ViewArchitectureSupport.isContributionSource(tree)) {
            return ShellPolicy.CONTRIBUTION;
        }
        if (ViewArchitectureSupport.isBinderSource(tree)) {
            return ShellPolicy.BINDER;
        }
        if (ViewArchitectureSupport.DATA_ROOT_PACKAGE.matcher(packageName).matches()) {
            return ShellPolicy.DATA_ROOT;
        }
        return null;
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

    private enum ShellPolicy {
        CONTRIBUTION {
            @Override
            boolean isAllowed(String referencedType) {
                return ViewArchitectureSupport.isAllowedContributionShellType(referencedType);
            }
        },
        BINDER {
            @Override
            boolean isAllowed(String referencedType) {
                return ViewArchitectureSupport.isAllowedBinderShellType(referencedType);
            }
        },
        DATA_ROOT {
            @Override
            boolean isAllowed(String referencedType) {
                return ViewArchitectureSupport.isAllowedDataRootShellType(referencedType);
            }
        };

        abstract boolean isAllowed(String referencedType);
    }
}
