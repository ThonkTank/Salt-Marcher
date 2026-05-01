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
import com.sun.tools.javac.code.Type;
import java.util.LinkedHashSet;
import java.util.Set;

@BugPattern(
        name = "ShellLifecycleHookOwnership",
        summary = "ShellBinding lifecycle hooks must be invoked only by shell.host.AppShell.",
        severity = BugPattern.SeverityLevel.ERROR)
public final class ShellLifecycleHookOwnershipChecker extends BugChecker
        implements BugChecker.CompilationUnitTreeMatcher {

    private static final Set<String> LIFECYCLE_HOOKS = Set.of("onActivate", "onDeactivate");

    @Override
    public Description matchCompilationUnit(CompilationUnitTree tree, VisitorState state) {
        if (isAppShellSource(tree)) {
            return Description.NO_MATCH;
        }

        Set<String> violations = new LinkedHashSet<>();
        new TreePathScanner<Void, Void>() {
            @Override
            public Void visitMethodInvocation(MethodInvocationTree methodInvocation, Void unused) {
                Symbol symbol = ASTHelpers.getSymbol(methodInvocation);
                if (symbol instanceof Symbol.MethodSymbol methodSymbol
                        && isShellBindingLifecycleHook(methodSymbol, state)) {
                    violations.add(methodInvocation.toString());
                }
                return super.visitMethodInvocation(methodInvocation, unused);
            }
        }.scan(tree, null);

        if (violations.isEmpty()) {
            return Description.NO_MATCH;
        }
        return buildDescription(tree)
                .setMessage("ShellBinding lifecycle hooks are shell-owned activation callbacks."
                        + " Only shell.host.AppShell may invoke onActivate() or onDeactivate(). Found: "
                        + String.join(", ", violations))
                .build();
    }

    private static boolean isAppShellSource(CompilationUnitTree tree) {
        return tree.getSourceFile()
                .getName()
                .replace('\\', '/')
                .endsWith("shell/host/AppShell.java");
    }

    private static boolean isShellBindingLifecycleHook(Symbol.MethodSymbol methodSymbol, VisitorState state) {
        if (!LIFECYCLE_HOOKS.contains(methodSymbol.getSimpleName().toString())) {
            return false;
        }
        Type shellBindingType = state.getTypeFromString("shell.api.ShellBinding");
        return shellBindingType != null
                && methodSymbol.owner instanceof Symbol.ClassSymbol owner
                && ASTHelpers.isSubtype(owner.type, shellBindingType, state);
    }
}
