package saltmarcher.quality.errorprone.view.view;

import com.google.errorprone.BugPattern;
import com.google.errorprone.VisitorState;
import com.google.errorprone.bugpatterns.BugChecker;
import com.google.errorprone.matchers.Description;
import com.google.errorprone.util.ASTHelpers;
import com.sun.source.tree.CompilationUnitTree;
import com.sun.source.tree.IdentifierTree;
import com.sun.source.tree.MemberSelectTree;
import com.sun.source.util.TreePathScanner;
import com.sun.tools.javac.code.Symbol;
import java.util.ArrayList;
import java.util.List;
import saltmarcher.quality.errorprone.view.ViewArchitectureSupport;

@BugPattern(
        name = "ViewDetailsSlotBoundary",
        summary = "Feature view code must publish cockpit details through the shell-owned Inspector API.",
        severity = BugPattern.SeverityLevel.ERROR)
public final class ViewDetailsSlotBoundaryChecker extends BugChecker
        implements BugChecker.CompilationUnitTreeMatcher {

    @Override
    public Description matchCompilationUnit(CompilationUnitTree tree, VisitorState state) {
        String packageName = ViewArchitectureSupport.packageName(tree);
        if (!packageName.startsWith("src.view.")) {
            return Description.NO_MATCH;
        }

        List<String> violations = new ArrayList<>();
        new TreePathScanner<Void, Void>() {
            @Override
            public Void visitIdentifier(IdentifierTree identifierTree, Void unused) {
                recordViolation(identifierTree, violations);
                return super.visitIdentifier(identifierTree, unused);
            }

            @Override
            public Void visitMemberSelect(MemberSelectTree memberSelectTree, Void unused) {
                recordViolation(memberSelectTree, violations);
                return super.visitMemberSelect(memberSelectTree, unused);
            }
        }.scan(tree, null);

        if (violations.isEmpty()) {
            return Description.NO_MATCH;
        }
        return buildDescription(tree)
                .setMessage("View package '" + packageName
                        + "' must not publish ShellSlot.COCKPIT_DETAILS directly; publish details through ShellRuntimeContext.inspector().")
                .build();
    }

    private static void recordViolation(IdentifierTree tree, List<String> violations) {
        recordViolation(ASTHelpers.getSymbol(tree), violations);
    }

    private static void recordViolation(MemberSelectTree tree, List<String> violations) {
        recordViolation(ASTHelpers.getSymbol(tree), violations);
    }

    private static void recordViolation(Symbol symbol, List<String> violations) {
        if (symbol == null || !symbol.getSimpleName().contentEquals("COCKPIT_DETAILS")) {
            return;
        }
        if ("shell.api.ShellSlot".equals(ViewArchitectureSupport.getQualifiedOwnerTypeName(symbol))) {
            violations.add(symbol.toString());
        }
    }
}
