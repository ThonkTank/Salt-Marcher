package saltmarcher.quality.errorprone.view.view;

import com.google.errorprone.BugPattern;
import com.google.errorprone.VisitorState;
import com.google.errorprone.bugpatterns.BugChecker;
import com.google.errorprone.matchers.Description;
import com.google.errorprone.util.ASTHelpers;
import com.sun.source.tree.CompilationUnitTree;
import com.sun.source.tree.MethodInvocationTree;
import com.sun.source.tree.NewClassTree;
import com.sun.source.tree.Tree;
import com.sun.source.util.TreePathScanner;
import com.sun.tools.javac.code.Symbol;
import com.sun.tools.javac.code.Type;
import java.util.LinkedHashSet;
import java.util.Set;
import javax.lang.model.element.Modifier;

@BugPattern(
        name = "PassiveViewProjectionConstructionBoundary",
        summary = "Passive Views may not construct projection or write carriers.",
        severity = BugPattern.SeverityLevel.ERROR)
public final class PassiveViewProjectionConstructionBoundaryChecker extends BugChecker
        implements BugChecker.CompilationUnitTreeMatcher {

    @Override
    public Description matchCompilationUnit(CompilationUnitTree tree, VisitorState state) {
        if (!ViewArchitectureSupport.isPanelViewSource(tree)) {
            return Description.NO_MATCH;
        }

        String sourcePackageName = ViewArchitectureSupport.packageName(tree);
        String viewSimpleName = ViewArchitectureSupport.topLevelSimpleName(tree);
        String qualifiedViewName = ViewArchitectureSupport.qualifiedTopLevelTypeName(tree);
        Tree[] firstViolationTree = {null};
        Set<String> violations = new LinkedHashSet<>();
        new TreePathScanner<Void, Void>() {
            @Override
            public Void visitNewClass(NewClassTree newClassTree, Void unused) {
                String constructedType = qualifiedTypeNameOf(newClassTree);
                if (isForbiddenConstructedType(constructedType, sourcePackageName, viewSimpleName, qualifiedViewName)) {
                    violations.add("new " + ViewArchitectureSupport.topLevelQualifiedTypeNameOf(constructedType));
                    if (firstViolationTree[0] == null) {
                        firstViolationTree[0] = newClassTree;
                    }
                }
                return super.visitNewClass(newClassTree, unused);
            }

            @Override
            public Void visitMethodInvocation(MethodInvocationTree methodInvocationTree, Void unused) {
                Symbol.MethodSymbol symbol = ASTHelpers.getSymbol(methodInvocationTree);
                if (symbol == null || !symbol.getModifiers().contains(Modifier.STATIC)) {
                    return super.visitMethodInvocation(methodInvocationTree, unused);
                }
                String ownerType = ViewArchitectureSupport.getQualifiedOwnerTypeName(symbol);
                if (isForbiddenStaticFactoryOwner(ownerType, sourcePackageName, viewSimpleName, qualifiedViewName)) {
                    violations.add(ownerType + "." + symbol.getSimpleName() + "()");
                    if (firstViolationTree[0] == null) {
                        firstViolationTree[0] = methodInvocationTree;
                    }
                }
                return super.visitMethodInvocation(methodInvocationTree, unused);
            }
        }.scan(tree, null);

        if (violations.isEmpty()) {
            return Description.NO_MATCH;
        }
        Tree diagnosticTree = firstViolationTree[0] == null ? tree : firstViolationTree[0];
        return buildDescription(diagnosticTree)
                .setMessage("Passive View '" + qualifiedViewName
                        + "' constructs projection or write carriers "
                        + String.join(", ", violations)
                        + ". A passive View may author only its own same-stem ViewInputEvent snapshots; projection carriers belong in models and write carriers belong behind the IntentHandler/Binder seam.")
                .build();
    }

    private static boolean isForbiddenConstructedType(
            String constructedType,
            String sourcePackageName,
            String viewSimpleName,
            String qualifiedViewName
    ) {
        if (constructedType == null || constructedType.isBlank()) {
            return false;
        }
        if (ViewArchitectureSupport.isSameStemViewInputEventReference(sourcePackageName, viewSimpleName, constructedType)) {
            return false;
        }
        if (constructedType.startsWith("src.domain.")
                || constructedType.startsWith("src.data.")
                || ViewArchitectureSupport.isApplicationServiceReference(constructedType)
                || ViewArchitectureSupport.isTargetPublishedEventReference(constructedType)
                || ViewArchitectureSupport.isSameViewRootModelReference(sourcePackageName, constructedType)) {
            return true;
        }
        return false;
    }

    private static boolean isForbiddenStaticFactoryOwner(
            String ownerType,
            String sourcePackageName,
            String viewSimpleName,
            String qualifiedViewName
    ) {
        if (ownerType == null || ownerType.isBlank()) {
            return false;
        }
        if (ViewArchitectureSupport.isSameStemViewInputEventReference(sourcePackageName, viewSimpleName, ownerType)) {
            return false;
        }
        if (ownerType.startsWith("src.domain.")
                || ownerType.startsWith("src.data.")
                || ViewArchitectureSupport.isApplicationServiceReference(ownerType)
                || ViewArchitectureSupport.isTargetPublishedEventReference(ownerType)
                || ViewArchitectureSupport.isSameViewRootModelReference(sourcePackageName, ownerType)) {
            return true;
        }
        return false;
    }

    private static String qualifiedTypeNameOf(NewClassTree newClassTree) {
        Type instantiatedType = ASTHelpers.getType(newClassTree);
        if (instantiatedType != null && instantiatedType.tsym instanceof Symbol.ClassSymbol classSymbol) {
            String qualifiedName = classSymbol.getQualifiedName().toString();
            if (!qualifiedName.isBlank()) {
                return qualifiedName;
            }
        }
        Symbol symbol = ASTHelpers.getSymbol(newClassTree);
        if (symbol == null) {
            return "";
        }
        String qualifiedTypeName = ViewArchitectureSupport.getQualifiedTypeName(symbol);
        if (qualifiedTypeName != null && !qualifiedTypeName.isBlank()) {
            return qualifiedTypeName;
        }
        return ASTHelpers.getType(newClassTree) == null ? "" : ASTHelpers.getType(newClassTree).toString();
    }
}
