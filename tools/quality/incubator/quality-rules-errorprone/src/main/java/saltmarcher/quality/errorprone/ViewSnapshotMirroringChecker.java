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
        var matcher = ViewArchitectureSupport.VIEW_PACKAGE.matcher(packageName);
        if (!matcher.matches()) {
            return Description.NO_MATCH;
        }
        if (!containsTargetController(tree)) {
            return Description.NO_MATCH;
        }
        String component = matcher.group(1);

        Set<String> violations = new LinkedHashSet<>();
        new TreePathScanner<Void, Void>() {
            @Override
            public Void visitMethodInvocation(MethodInvocationTree methodInvocationTree, Void unused) {
                Symbol.MethodSymbol symbol = ASTHelpers.getSymbol(methodInvocationTree);
                if (symbol != null) {
                    String owner = ViewArchitectureSupport.getQualifiedOwnerTypeName(symbol);
                    String methodName = symbol.getSimpleName().toString();
                    if (isOwnViewModel(owner, component)
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
                        + "' mirrors ViewModel snapshots through manual refresh APIs: "
                        + String.join(", ", violations)
                        + ". Expose bindable properties/collections from ViewModel instead.")
                .build();
    }

    private static boolean isOwnViewModel(String qualifiedType, String component) {
        return qualifiedType != null
                && ViewArchitectureSupport.isOwnViewModelReference(qualifiedType, component);
    }

    private static boolean containsTargetController(CompilationUnitTree tree) {
        boolean[] found = {false};
        new TreeScanner<Void, Void>() {
            @Override
            public Void visitClass(ClassTree classTree, Void unused) {
                if (classTree.getSimpleName().toString().endsWith("Controller")) {
                    found[0] = true;
                    return null;
                }
                return found[0] ? null : super.visitClass(classTree, unused);
            }
        }.scan(tree, null);
        return found[0];
    }
}
