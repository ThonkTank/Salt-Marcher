package saltmarcher.quality.errorprone;

import com.google.errorprone.BugPattern;
import com.google.errorprone.VisitorState;
import com.google.errorprone.bugpatterns.BugChecker;
import com.google.errorprone.matchers.Description;
import com.google.errorprone.util.ASTHelpers;
import com.sun.source.tree.CompilationUnitTree;
import com.sun.source.tree.ClassTree;
import com.sun.source.tree.IfTree;
import com.sun.source.tree.MethodInvocationTree;
import com.sun.source.tree.SwitchExpressionTree;
import com.sun.source.tree.SwitchTree;
import com.sun.source.tree.Tree;
import com.sun.source.util.TreeScanner;
import com.sun.tools.javac.code.Symbol;
import java.util.Set;

@BugPattern(
        name = "ViewPresentationDecisionLeak",
        summary = "Presentation decisions derived from ViewModel carriers belong in ViewModel, not View widgets.",
        severity = BugPattern.SeverityLevel.ERROR)
public final class ViewPresentationDecisionLeakChecker extends BugChecker
        implements BugChecker.CompilationUnitTreeMatcher {

    private static final Set<String> PRESENTATION_MUTATION_METHODS = Set.of(
            "add",
            "addAll",
            "remove",
            "removeAll",
            "setAll",
            "setCellValueFactory",
            "setDisable",
            "setManaged",
            "setOnAction",
            "setOnMouseClicked",
            "setPlaceholder",
            "setText",
            "setVisible");

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

        Tree[] violatingTree = {null};
        new TreeScanner<Void, Void>() {
            @Override
            public Void visitIf(IfTree ifTree, Void unused) {
                if (violatingTree[0] == null
                        && referencesPresentationCarrier(ifTree.getCondition(), component)
                        && (containsPresentationMutation(ifTree.getThenStatement())
                        || containsPresentationMutation(ifTree.getElseStatement()))) {
                    violatingTree[0] = ifTree;
                }
                return super.visitIf(ifTree, unused);
            }

            @Override
            public Void visitSwitch(SwitchTree switchTree, Void unused) {
                if (violatingTree[0] == null
                        && referencesPresentationCarrier(switchTree.getExpression(), component)
                        && containsPresentationMutation(switchTree)) {
                    violatingTree[0] = switchTree;
                }
                return super.visitSwitch(switchTree, unused);
            }

            @Override
            public Void visitSwitchExpression(SwitchExpressionTree switchExpressionTree, Void unused) {
                if (violatingTree[0] == null
                        && referencesPresentationCarrier(switchExpressionTree.getExpression(), component)
                        && containsPresentationMutation(switchExpressionTree)) {
                    violatingTree[0] = switchExpressionTree;
                }
                return super.visitSwitchExpression(switchExpressionTree, unused);
            }
        }.scan(tree, null);

        if (violatingTree[0] == null) {
            return Description.NO_MATCH;
        }
        return buildDescription(violatingTree[0])
                .setMessage("View package '" + packageName
                        + "' branches on a ViewModel presentation carrier while mutating widget presentation."
                        + " Move shared labels, enablement, visibility, and style decisions into ViewModel state.")
                .build();
    }

    private static boolean referencesPresentationCarrier(Tree tree, String component) {
        if (tree == null) {
            return false;
        }
        boolean[] found = {false};
        new TreeScanner<Void, Void>() {
            @Override
            public Void scan(Tree currentTree, Void unused) {
                if (currentTree != null && isPresentationCarrier(currentTree, component)) {
                    found[0] = true;
                    return null;
                }
                return found[0] ? null : super.scan(currentTree, unused);
            }
        }.scan(tree, null);
        return found[0];
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

    private static boolean containsPresentationMutation(Tree tree) {
        if (tree == null) {
            return false;
        }
        boolean[] found = {false};
        new TreeScanner<Void, Void>() {
            @Override
            public Void visitMethodInvocation(MethodInvocationTree methodInvocationTree, Void unused) {
                Symbol.MethodSymbol symbol = ASTHelpers.getSymbol(methodInvocationTree);
                if (symbol != null && PRESENTATION_MUTATION_METHODS.contains(symbol.getSimpleName().toString())) {
                    found[0] = true;
                    return null;
                }
                return found[0] ? null : super.visitMethodInvocation(methodInvocationTree, unused);
            }
        }.scan(tree, null);
        return found[0];
    }

    private static boolean isPresentationCarrier(Tree tree, String component) {
        var type = ASTHelpers.getType(tree);
        if (type == null || type.tsym == null) {
            return false;
        }
        String qualifiedName = type.tsym.getQualifiedName().toString();
        if (!ViewArchitectureSupport.isOwnViewModelReference(qualifiedName, component)) {
            return false;
        }
        String simpleName = qualifiedName.substring(qualifiedName.lastIndexOf('.') + 1);
        return simpleName.endsWith("Snapshot")
                || simpleName.endsWith("State")
                || simpleName.endsWith("Status")
                || simpleName.endsWith("ViewData")
                || simpleName.endsWith("ViewModel")
                || simpleName.endsWith("Selection")
                || simpleName.endsWith("Settings");
    }
}
