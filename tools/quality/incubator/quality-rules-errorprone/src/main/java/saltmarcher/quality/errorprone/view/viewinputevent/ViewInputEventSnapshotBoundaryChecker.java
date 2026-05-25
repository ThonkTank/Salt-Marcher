package saltmarcher.quality.errorprone.view.viewinputevent;

import com.google.errorprone.BugPattern;
import com.google.errorprone.VisitorState;
import com.google.errorprone.bugpatterns.BugChecker;
import com.google.errorprone.matchers.Description;
import com.google.errorprone.util.ASTHelpers;
import com.sun.source.tree.CompilationUnitTree;
import com.sun.source.tree.MethodTree;
import com.sun.source.tree.NewClassTree;
import com.sun.source.tree.Tree;
import com.sun.source.util.TreePathScanner;
import com.sun.tools.javac.code.Symbol;
import java.util.LinkedHashSet;
import java.util.Set;
import saltmarcher.quality.errorprone.view.ViewArchitectureSupport;
import saltmarcher.quality.errorprone.view.ViewExpressionProvenanceSupport;
import saltmarcher.architecture.policy.view.ViewSourceDescriptor;

@BugPattern(
        name = "ViewInputEventSnapshotBoundary",
        summary = "Passive Views must build ViewInputEvent snapshots from raw widget state rather than same-view semantic helpers.",
        severity = BugPattern.SeverityLevel.ERROR)
public final class ViewInputEventSnapshotBoundaryChecker extends BugChecker
        implements BugChecker.CompilationUnitTreeMatcher {

    @Override
    public Description matchCompilationUnit(CompilationUnitTree tree, VisitorState state) {
        ViewSourceDescriptor source = ViewSourceDescriptor.describe(tree);
        if (!source.isPassiveViewSource()) {
            return Description.NO_MATCH;
        }

        String sourcePackageName = source.packageName();
        String viewSimpleName = source.topLevelSimpleName();
        String qualifiedViewName = source.qualifiedTopLevelTypeName();
        Tree[] firstViolationTree = {null};
        Set<String> violations = new LinkedHashSet<>();
        ViewExpressionProvenanceSupport provenanceSupport = ViewExpressionProvenanceSupport.create(tree);
        new TreePathScanner<Void, Symbol.MethodSymbol>() {
            @Override
            public Void visitMethod(MethodTree methodTree, Symbol.MethodSymbol unused) {
                return super.visitMethod(methodTree, ASTHelpers.getSymbol(methodTree));
            }

            @Override
            public Void visitNewClass(NewClassTree newClassTree, Symbol.MethodSymbol currentMethod) {
                String constructedType = ViewArchitectureSupport.qualifiedTypeNameOf(newClassTree);
                if (isTopLevelSameStemViewInputEvent(sourcePackageName, viewSimpleName, constructedType)) {
                    inspectArguments(
                            newClassTree,
                            currentMethod,
                            sourcePackageName,
                            qualifiedViewName,
                            provenanceSupport,
                            violations,
                            firstViolationTree);
                }
                return super.visitNewClass(newClassTree, currentMethod);
            }
        }.scan(tree, null);

        if (violations.isEmpty()) {
            return Description.NO_MATCH;
        }
        Tree diagnosticTree = firstViolationTree[0] == null ? tree : firstViolationTree[0];
        return buildDescription(diagnosticTree)
                .setMessage("Passive View '" + qualifiedViewName
                        + "' builds same-stem ViewInputEvent snapshots through non-raw semantic reconstruction: "
                        + String.join(", ", violations)
                        + ". Build the carrier directly from current widget or raw event state and let the IntentHandler interpret it.")
                .build();
    }

    private static void inspectArguments(
            NewClassTree newClassTree,
            Symbol.MethodSymbol currentMethod,
            String sourcePackageName,
            String qualifiedViewName,
            ViewExpressionProvenanceSupport provenanceSupport,
            Set<String> violations,
            Tree[] firstViolationTree
    ) {
        for (Tree argument : newClassTree.getArguments()) {
            ViewExpressionProvenanceSupport.SnapshotViolation violation = provenanceSupport.findFirstSnapshotViolation(
                    argument,
                    currentMethod,
                    sourcePackageName,
                    qualifiedViewName);
            if (violation != null) {
                violations.add(violation.description());
                recordViolationTree(violation.anchor(), firstViolationTree);
            }
        }
    }

    private static boolean isTopLevelSameStemViewInputEvent(
            String sourcePackageName,
            String viewSimpleName,
            String constructedType
    ) {
        return ViewArchitectureSupport.isSameStemViewInputEventReference(sourcePackageName, viewSimpleName, constructedType)
                && constructedType != null
                && constructedType.equals(ViewArchitectureSupport.topLevelQualifiedTypeNameOf(constructedType));
    }

    private static void recordViolationTree(Tree tree, Tree[] firstViolationTree) {
        if (firstViolationTree[0] == null) {
            firstViolationTree[0] = tree;
        }
    }
}
