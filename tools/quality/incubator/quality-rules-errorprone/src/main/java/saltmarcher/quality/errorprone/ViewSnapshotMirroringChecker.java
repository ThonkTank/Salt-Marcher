package saltmarcher.quality.errorprone;

import com.google.errorprone.BugPattern;
import com.google.errorprone.VisitorState;
import com.google.errorprone.bugpatterns.BugChecker;
import com.google.errorprone.matchers.Description;
import com.google.errorprone.util.ASTHelpers;
import com.sun.source.tree.ClassTree;
import com.sun.source.tree.CompilationUnitTree;
import com.sun.source.tree.MethodInvocationTree;
import com.sun.source.util.TreePathScanner;
import com.sun.source.util.TreeScanner;
import com.sun.tools.javac.code.Symbol;
import java.util.LinkedHashSet;
import java.util.Set;

@BugPattern(
        name = "ViewSnapshotMirroring",
        summary = "View code must bind to ViewModel state instead of mirroring whole snapshots through manual refresh loops.",
        severity = BugPattern.SeverityLevel.ERROR)
public final class ViewSnapshotMirroringChecker extends BugChecker
        implements BugChecker.CompilationUnitTreeMatcher {

    @Override
    public Description matchCompilationUnit(CompilationUnitTree tree, VisitorState state) {
        String packageName = ViewArchitectureSupport.packageName(tree);
        if (!ViewArchitectureSupport.isPanelViewSource(tree)) {
            return Description.NO_MATCH;
        }
        if (!containsTargetPanelView(tree)) {
            return Description.NO_MATCH;
        }

        Set<String> violations = new LinkedHashSet<>();
        new TreePathScanner<Void, Void>() {
            @Override
            public Void visitMethodInvocation(MethodInvocationTree methodInvocationTree, Void unused) {
                Symbol.MethodSymbol symbol = ASTHelpers.getSymbol(methodInvocationTree);
                if (symbol != null) {
                    String owner = ViewArchitectureSupport.getQualifiedOwnerTypeName(symbol);
                    String methodName = symbol.getSimpleName().toString();
                    if (ViewArchitectureSupport.isTargetViewModelReference(owner)
                            && ("snapshot".equals(methodName) || "addChangeListener".equals(methodName))) {
                        violations.add(owner + "." + methodName + "()");
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
                        + "' mirrors model snapshots through manual refresh APIs: "
                        + String.join(", ", violations)
                        + ". Expose bindable properties/collections from the owning ViewModel instead.")
                .build();
    }

    private static boolean containsTargetPanelView(CompilationUnitTree tree) {
        boolean[] found = {false};
        new TreeScanner<Void, Void>() {
            @Override
            public Void visitClass(ClassTree classTree, Void unused) {
                String simpleName = classTree.getSimpleName().toString();
                if (simpleName.endsWith("ControlsView")
                        || simpleName.endsWith("MainView")
                        || simpleName.endsWith("DetailsView")
                        || simpleName.endsWith("StateView")
                        || simpleName.endsWith("TopBarView")) {
                    found[0] = true;
                    return null;
                }
                return found[0] ? null : super.visitClass(classTree, unused);
            }
        }.scan(tree, null);
        return found[0];
    }
}
