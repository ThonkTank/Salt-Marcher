package saltmarcher.quality.errorprone.view.view;

import com.google.errorprone.BugPattern;
import com.google.errorprone.VisitorState;
import com.google.errorprone.bugpatterns.BugChecker;
import com.google.errorprone.matchers.Description;
import com.google.errorprone.util.ASTHelpers;
import com.sun.source.tree.CompilationUnitTree;
import com.sun.source.tree.IfTree;
import com.sun.source.tree.MethodInvocationTree;
import com.sun.source.tree.SwitchExpressionTree;
import com.sun.source.tree.SwitchTree;
import com.sun.source.tree.Tree;
import com.sun.source.util.TreeScanner;
import com.sun.tools.javac.code.Symbol;
import java.util.LinkedHashSet;
import java.util.Set;
@BugPattern(
        name = "ViewPresentationDecisionLeak",
        summary = "Presentation decisions derived from model carriers belong in the model, not View widgets.",
        severity = BugPattern.SeverityLevel.ERROR)
public final class ViewPresentationDecisionLeakChecker extends BugChecker
        implements BugChecker.CompilationUnitTreeMatcher {

    private static final Set<String> PRESENTATION_MUTATION_METHODS = Set.of(
            "setDisable",
            "setManaged",
            "setText",
            "setVisible");

    @Override
    public Description matchCompilationUnit(CompilationUnitTree tree, VisitorState state) {
        if (!ViewArchitectureSupport.isPanelViewSource(tree)) {
            return Description.NO_MATCH;
        }

        String packageName = ViewArchitectureSupport.packageName(tree);
        Tree[] violatingTree = {null};
        new TreeScanner<Void, Void>() {
            @Override
            public Void visitIf(IfTree ifTree, Void unused) {
                if (violatingTree[0] == null
                        && referencesModelDerivedState(ifTree.getCondition(), packageName)
                        && (containsPresentationMutation(ifTree.getThenStatement())
                        || containsPresentationMutation(ifTree.getElseStatement()))) {
                    violatingTree[0] = ifTree;
                }
                return super.visitIf(ifTree, unused);
            }

            @Override
            public Void visitSwitch(SwitchTree switchTree, Void unused) {
                if (violatingTree[0] == null
                        && referencesModelDerivedState(switchTree.getExpression(), packageName)
                        && containsPresentationMutation(switchTree)) {
                    violatingTree[0] = switchTree;
                }
                return super.visitSwitch(switchTree, unused);
            }

            @Override
            public Void visitSwitchExpression(SwitchExpressionTree switchExpressionTree, Void unused) {
                if (violatingTree[0] == null
                        && referencesModelDerivedState(switchExpressionTree.getExpression(), packageName)
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
                        + "' branches on same-root model-derived state while mutating shared widget presentation."
                        + " Move shared labels, enablement, visibility, and style decisions into the owning model state.")
                .build();
    }

    private static boolean referencesModelDerivedState(Tree tree, String sourcePackageName) {
        if (tree == null) {
            return false;
        }
        Set<String> referencedTypes = new LinkedHashSet<>();
        new TreeScanner<Void, Void>() {
            @Override
            public Void scan(Tree currentTree, Void unused) {
                if (currentTree != null) {
                    ViewArchitectureSupport.collectReferencedTypes(currentTree, referencedTypes);
                }
                return super.scan(currentTree, unused);
            }
        }.scan(tree, null);
        return referencedTypes.stream().anyMatch(referencedType ->
                ViewArchitectureSupport.isSameViewRootModelReference(sourcePackageName, referencedType)
                        || (ViewArchitectureSupport.isSupportValueReference(referencedType)
                        && ViewArchitectureSupport.isSameViewRootReference(sourcePackageName, referencedType)));
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

}
