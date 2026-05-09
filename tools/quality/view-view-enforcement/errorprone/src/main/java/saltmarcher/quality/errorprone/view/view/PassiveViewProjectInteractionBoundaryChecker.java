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
import com.sun.source.tree.Tree;
import com.sun.source.util.TreePathScanner;
import com.sun.tools.javac.code.Symbol;
import java.util.LinkedHashSet;
import java.util.Set;
import saltmarcher.quality.errorprone.view.ViewSourceDescriptor;

@BugPattern(
        name = "PassiveViewProjectInteractionBoundary",
        summary = "Passive Views may not invoke project members or read project fields outside same-stem ViewInputEvent construction.",
        severity = BugPattern.SeverityLevel.ERROR)
public final class PassiveViewProjectInteractionBoundaryChecker extends BugChecker
        implements BugChecker.CompilationUnitTreeMatcher {

    @Override
    public Description matchCompilationUnit(CompilationUnitTree tree, VisitorState state) {
        ViewSourceDescriptor source = ViewSourceDescriptor.describe(tree);
        if (!source.isPassiveViewSource()) {
            return Description.NO_MATCH;
        }

        String sourcePackageName = source.packageName();
        String qualifiedViewName = source.qualifiedTopLevelTypeName();
        Tree[] firstViolationTree = {null};
        Set<String> violations = new LinkedHashSet<>();
        new TreePathScanner<Void, Void>() {
            @Override
            public Void visitMethodInvocation(MethodInvocationTree methodInvocationTree, Void unused) {
                Symbol.MethodSymbol symbol = ASTHelpers.getSymbol(methodInvocationTree);
                if (symbol == null) {
                    return super.visitMethodInvocation(methodInvocationTree, unused);
                }
                String ownerType = ViewArchitectureSupport.getQualifiedOwnerTypeName(symbol);
                if (isForbiddenProjectOwner(ownerType, sourcePackageName, qualifiedViewName)) {
                    violations.add(ownerType + "." + symbol.getSimpleName() + "()");
                    if (firstViolationTree[0] == null) {
                        firstViolationTree[0] = methodInvocationTree;
                    }
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
        }.scan(tree, null);

        if (violations.isEmpty()) {
            return Description.NO_MATCH;
        }
        return buildDescription(firstViolationTree[0] == null ? tree : firstViolationTree[0])
                .setMessage("Passive View '" + qualifiedViewName
                        + "' invokes or reads project members "
                        + String.join(", ", violations)
                        + ". A passive View may interact with project types only by constructing its own same-stem ViewInputEvent snapshot.")
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
        violations.add(ownerType + "." + symbol.getSimpleName());
        if (firstViolationTree[0] == null) {
            firstViolationTree[0] = tree;
        }
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
}
