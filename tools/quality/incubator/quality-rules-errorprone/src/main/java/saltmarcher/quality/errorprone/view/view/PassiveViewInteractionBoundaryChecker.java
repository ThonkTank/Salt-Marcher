package saltmarcher.quality.errorprone.view.view;

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
import com.sun.tools.javac.code.Symbol;
import com.sun.tools.javac.code.Type;
import java.util.LinkedHashSet;
import java.util.Set;
import javax.lang.model.element.Modifier;
import saltmarcher.quality.errorprone.view.ViewArchitectureSupport;
import saltmarcher.quality.errorprone.view.ViewSourceDescriptor;

@BugPattern(
        name = "PassiveViewInteractionBoundary",
        summary = "Passive Views may not depend on, invoke, or construct project-owned collaborators beyond same-stem ViewInputEvent snapshots.",
        severity = BugPattern.SeverityLevel.ERROR)
public final class PassiveViewInteractionBoundaryChecker extends BugChecker
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

        for (String referencedType : ViewArchitectureSupport.collectReferencedTypes(tree)) {
            if (isForbiddenReference(referencedType, sourcePackageName, viewSimpleName)) {
                violations.add("forbidden reference " + referencedType);
                recordViolationTree(tree, firstViolationTree);
            }
        }

        new TreePathScanner<Void, Void>() {
            @Override
            public Void visitMethodInvocation(MethodInvocationTree methodInvocationTree, Void unused) {
                Symbol.MethodSymbol symbol = ASTHelpers.getSymbol(methodInvocationTree);
                if (symbol == null) {
                    return super.visitMethodInvocation(methodInvocationTree, unused);
                }
                String ownerType = ViewArchitectureSupport.getQualifiedOwnerTypeName(symbol);
                if (symbol.getModifiers().contains(Modifier.STATIC)
                        && isForbiddenStaticFactoryOwner(ownerType, sourcePackageName, viewSimpleName)) {
                    violations.add("projection/write factory " + ownerType + "." + symbol.getSimpleName() + "()");
                    recordViolationTree(methodInvocationTree, firstViolationTree);
                    return super.visitMethodInvocation(methodInvocationTree, unused);
                }
                if (isForbiddenProjectOwner(ownerType, sourcePackageName, qualifiedViewName)) {
                    violations.add("project member " + ownerType + "." + symbol.getSimpleName() + "()");
                    recordViolationTree(methodInvocationTree, firstViolationTree);
                }
                return super.visitMethodInvocation(methodInvocationTree, unused);
            }

            @Override
            public Void visitIdentifier(IdentifierTree identifierTree, Void unused) {
                collectProjectMemberViolation(
                        identifierTree,
                        sourcePackageName,
                        qualifiedViewName,
                        violations,
                        firstViolationTree);
                return super.visitIdentifier(identifierTree, unused);
            }

            @Override
            public Void visitMemberSelect(MemberSelectTree memberSelectTree, Void unused) {
                collectProjectMemberViolation(
                        memberSelectTree,
                        sourcePackageName,
                        qualifiedViewName,
                        violations,
                        firstViolationTree);
                return super.visitMemberSelect(memberSelectTree, unused);
            }

            @Override
            public Void visitNewClass(NewClassTree newClassTree, Void unused) {
                String constructedType = qualifiedTypeNameOf(newClassTree);
                if (isForbiddenConstructedType(constructedType, sourcePackageName, viewSimpleName)) {
                    violations.add("constructs " + ViewArchitectureSupport.topLevelQualifiedTypeNameOf(constructedType));
                    recordViolationTree(newClassTree, firstViolationTree);
                }
                return super.visitNewClass(newClassTree, unused);
            }
        }.scan(tree, null);

        if (violations.isEmpty()) {
            return Description.NO_MATCH;
        }
        return buildDescription(firstViolationTree[0] == null ? tree : firstViolationTree[0])
                .setMessage("Passive View '" + qualifiedViewName
                        + "' crosses the passive-View interaction boundary through "
                        + String.join(", ", violations)
                        + ". A passive View may know project types only enough to author its own same-stem ViewInputEvent snapshot.")
                .build();
    }

    private static void collectProjectMemberViolation(
            Tree tree,
            String sourcePackageName,
            String qualifiedViewName,
            Set<String> violations,
            Tree[] firstViolationTree
    ) {
        Symbol symbol = ASTHelpers.getSymbol(tree);
        if (symbol == null || symbol instanceof Symbol.ClassSymbol) {
            return;
        }
        String ownerType = ViewArchitectureSupport.getQualifiedOwnerTypeName(symbol);
        if (!isForbiddenProjectOwner(ownerType, sourcePackageName, qualifiedViewName)) {
            return;
        }
        violations.add("project member " + ownerType + "." + symbol.getSimpleName());
        recordViolationTree(tree, firstViolationTree);
    }

    private static boolean isForbiddenReference(
            String referencedType,
            String sourcePackageName,
            String viewSimpleName
    ) {
        if (ViewArchitectureSupport.isForbiddenViewInfrastructureJdkType(referencedType)) {
            return true;
        }
        if (referencedType.startsWith("shell.")
                || referencedType.startsWith("bootstrap.")
                || referencedType.startsWith("src.domain.")
                || referencedType.startsWith("src.data.")) {
            return true;
        }
        if (referencedType.startsWith("src.view.")
                && ViewArchitectureSupport.isOwnTopLevelOrNestedTypeReference(
                sourcePackageName,
                viewSimpleName,
                referencedType)) {
            return false;
        }
        ViewArchitectureSupport.ViewTypeInfo viewType = ViewArchitectureSupport.parseViewType(referencedType);
        if (viewType == null) {
            return referencedType.startsWith("src.view.");
        }
        if ("VIEW_INPUT_EVENT".equals(viewType.bucket())) {
            return !ViewArchitectureSupport.isSameStemViewInputEventReference(
                    sourcePackageName,
                    viewSimpleName,
                    referencedType);
        }
        return true;
    }

    private static boolean isForbiddenProjectOwner(
            String ownerType,
            String sourcePackageName,
            String qualifiedViewName
    ) {
        if (ownerType == null || ownerType.isBlank()) {
            return false;
        }
        if (ownerType.equals(qualifiedViewName)
                || ownerType.startsWith(qualifiedViewName + "$")
                || ownerType.startsWith(qualifiedViewName + ".")) {
            return false;
        }
        if (ownerType.startsWith("shell.")
                || ownerType.startsWith("bootstrap.")
                || ownerType.startsWith("src.domain.")
                || ownerType.startsWith("src.data.")) {
            return true;
        }
        if (ownerType.startsWith("src.view.") && ViewArchitectureSupport.parseViewType(ownerType) == null) {
            return true;
        }
        return ViewArchitectureSupport.parseViewType(ownerType) != null;
    }

    private static boolean isForbiddenConstructedType(
            String constructedType,
            String sourcePackageName,
            String viewSimpleName
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
            String viewSimpleName
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

    private static void recordViolationTree(Tree tree, Tree[] firstViolationTree) {
        if (firstViolationTree[0] == null && tree != null) {
            firstViolationTree[0] = tree;
        }
    }
}
