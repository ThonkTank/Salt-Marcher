package saltmarcher.quality.errorprone.view.viewinputevent;

import com.google.errorprone.BugPattern;
import com.google.errorprone.VisitorState;
import com.google.errorprone.bugpatterns.BugChecker;
import com.google.errorprone.matchers.Description;
import com.google.errorprone.util.ASTHelpers;
import com.sun.source.tree.CompilationUnitTree;
import com.sun.source.tree.IdentifierTree;
import com.sun.source.tree.MemberSelectTree;
import com.sun.source.tree.MethodInvocationTree;
import com.sun.source.tree.NewClassTree;
import com.sun.source.tree.Tree;
import com.sun.source.util.TreePathScanner;
import com.sun.source.util.TreeScanner;
import com.sun.tools.javac.code.Symbol;
import java.util.LinkedHashSet;
import java.util.Set;
import javax.lang.model.element.Modifier;
import saltmarcher.quality.errorprone.view.ViewArchitectureSupport;
import saltmarcher.quality.errorprone.view.ViewSourceDescriptor;

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
        new TreePathScanner<Void, Void>() {
            @Override
            public Void visitNewClass(NewClassTree newClassTree, Void unused) {
                String constructedType = ViewArchitectureSupport.qualifiedTypeNameOf(newClassTree);
                if (isTopLevelSameStemViewInputEvent(sourcePackageName, viewSimpleName, constructedType)) {
                    inspectArguments(newClassTree, sourcePackageName, qualifiedViewName, violations, firstViolationTree);
                }
                return super.visitNewClass(newClassTree, unused);
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
            String sourcePackageName,
            String qualifiedViewName,
            Set<String> violations,
            Tree[] firstViolationTree
    ) {
        for (Tree argument : newClassTree.getArguments()) {
            scanArgument(argument, sourcePackageName, qualifiedViewName, violations, firstViolationTree);
        }
    }

    private static void scanArgument(
            Tree argument,
            String sourcePackageName,
            String qualifiedViewName,
            Set<String> violations,
            Tree[] firstViolationTree
    ) {
        new TreeScanner<Void, Void>() {
            @Override
            public Void visitMethodInvocation(MethodInvocationTree methodInvocationTree, Void unused) {
                Symbol.MethodSymbol symbol = ASTHelpers.getSymbol(methodInvocationTree);
                if (symbol == null) {
                    return super.visitMethodInvocation(methodInvocationTree, unused);
                }
                String ownerType = ViewArchitectureSupport.getQualifiedOwnerTypeName(symbol);
                if (isSameViewHelperOwner(ownerType, qualifiedViewName)) {
                    violations.add("same-view helper " + ownerType + "." + symbol.getSimpleName() + "()");
                    recordViolationTree(methodInvocationTree, firstViolationTree);
                }
                if (isForbiddenReferencedType(ownerType, sourcePackageName)) {
                    violations.add("forbidden snapshot dependency " + ownerType);
                    recordViolationTree(methodInvocationTree, firstViolationTree);
                }
                return super.visitMethodInvocation(methodInvocationTree, unused);
            }

            @Override
            public Void visitIdentifier(IdentifierTree identifierTree, Void unused) {
                collectForbiddenSymbolUsage(
                        identifierTree,
                        sourcePackageName,
                        qualifiedViewName,
                        violations,
                        firstViolationTree);
                return super.visitIdentifier(identifierTree, unused);
            }

            @Override
            public Void visitMemberSelect(MemberSelectTree memberSelectTree, Void unused) {
                collectForbiddenSymbolUsage(
                        memberSelectTree,
                        sourcePackageName,
                        qualifiedViewName,
                        violations,
                        firstViolationTree);
                return super.visitMemberSelect(memberSelectTree, unused);
            }

            @Override
            public Void visitNewClass(NewClassTree nestedNewClassTree, Void unused) {
                String constructedType = ViewArchitectureSupport.qualifiedTypeNameOf(nestedNewClassTree);
                if (isForbiddenReferencedType(constructedType, sourcePackageName)) {
                    violations.add("forbidden snapshot dependency " + constructedType);
                    recordViolationTree(nestedNewClassTree, firstViolationTree);
                }
                return super.visitNewClass(nestedNewClassTree, unused);
            }
        }.scan(argument, null);
    }

    private static void collectForbiddenSymbolUsage(
            Tree tree,
            String sourcePackageName,
            String qualifiedViewName,
            Set<String> violations,
            Tree[] firstViolationTree
    ) {
        Symbol symbol = ASTHelpers.getSymbol(tree);
        if (symbol == null) {
            return;
        }
        String ownerType = ViewArchitectureSupport.getQualifiedOwnerTypeName(symbol);
        if (isForbiddenReferencedType(ownerType, sourcePackageName)) {
            violations.add("forbidden snapshot dependency " + ownerType);
            recordViolationTree(tree, firstViolationTree);
        }
        if (symbol instanceof Symbol.VarSymbol fieldSymbol
                && fieldSymbol.getModifiers().contains(Modifier.STATIC)
                && fieldSymbol.getModifiers().contains(Modifier.FINAL)
                && isSameViewHelperOwner(ownerType, qualifiedViewName)
                && isSentinelName(fieldSymbol.getSimpleName().toString())) {
            violations.add("same-view sentinel " + ownerType + "." + fieldSymbol.getSimpleName());
            recordViolationTree(tree, firstViolationTree);
        }
    }

    private static boolean isForbiddenReferencedType(String referencedType, String sourcePackageName) {
        if (referencedType == null || referencedType.isBlank()) {
            return false;
        }
        return referencedType.startsWith("src.domain.")
                || referencedType.startsWith("src.data.")
                || ViewArchitectureSupport.isApplicationServiceReference(referencedType)
                || ViewArchitectureSupport.isSameViewRootModelReference(sourcePackageName, referencedType)
                || ViewArchitectureSupport.isTargetPublishedEventReference(referencedType);
    }

    private static boolean isSameViewHelperOwner(String ownerType, String qualifiedViewName) {
        return ownerType != null
                && (ownerType.equals(qualifiedViewName)
                || ownerType.startsWith(qualifiedViewName + "$")
                || ownerType.startsWith(qualifiedViewName + "."));
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

    private static boolean isSentinelName(String fieldName) {
        return fieldName.startsWith("AUTO_")
                || fieldName.startsWith("NO_")
                || fieldName.startsWith("EMPTY_")
                || fieldName.startsWith("DEFAULT_");
    }

    private static void recordViolationTree(Tree tree, Tree[] firstViolationTree) {
        if (firstViolationTree[0] == null) {
            firstViolationTree[0] = tree;
        }
    }
}
