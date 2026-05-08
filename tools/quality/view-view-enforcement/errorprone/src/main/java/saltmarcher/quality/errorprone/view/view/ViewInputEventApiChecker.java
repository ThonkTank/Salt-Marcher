package saltmarcher.quality.errorprone.view.view;

import com.google.errorprone.BugPattern;
import com.google.errorprone.VisitorState;
import com.google.errorprone.bugpatterns.BugChecker;
import com.google.errorprone.matchers.Description;
import com.google.errorprone.util.ASTHelpers;
import com.sun.source.tree.ClassTree;
import com.sun.source.tree.CompilationUnitTree;
import com.sun.source.tree.MethodInvocationTree;
import com.sun.source.tree.MethodTree;
import com.sun.source.tree.ModifiersTree;
import com.sun.source.tree.VariableTree;
import com.sun.source.util.TreePathScanner;
import com.sun.source.util.TreeScanner;
import com.sun.tools.javac.code.Symbol;
import java.util.LinkedHashSet;
import java.util.Set;
import javax.lang.model.element.Modifier;
import saltmarcher.quality.errorprone.view.ViewSourceDescriptor;

@BugPattern(
        name = "ViewInputEventApi",
        summary = "Passive Views may expose only onViewInputEvent(Consumer<SameStemViewInputEvent>) as their outward callback seam.",
        severity = BugPattern.SeverityLevel.ERROR)
public final class ViewInputEventApiChecker extends BugChecker
        implements BugChecker.CompilationUnitTreeMatcher {

    @Override
    public Description matchCompilationUnit(CompilationUnitTree tree, VisitorState state) {
        ViewSourceDescriptor source = ViewSourceDescriptor.describe(tree);
        if (!source.isPassiveViewSource()) {
            return Description.NO_MATCH;
        }

        String sourcePackageName = source.packageName();
        ClassTree topLevelClass = topLevelClass(tree);
        if (topLevelClass == null) {
            return Description.NO_MATCH;
        }
        String viewSimpleName = ViewArchitectureSupport.topLevelSimpleName(tree);

        Set<String> violations = new LinkedHashSet<>();
        boolean participatesInProtocol = participatesInViewInputEventProtocol(tree, topLevelClass, sourcePackageName, viewSimpleName);
        if (participatesInProtocol) {
            for (var member : topLevelClass.getMembers()) {
                if (member instanceof MethodTree methodTree) {
                    collectMethodViolation(methodTree, sourcePackageName, viewSimpleName, violations);
                } else if (member instanceof VariableTree variableTree) {
                    collectFieldViolation(variableTree, sourcePackageName, violations);
                }
            }
        }
        collectForwardingViolation(tree, sourcePackageName, violations);

        if (violations.isEmpty()) {
            return Description.NO_MATCH;
        }
        return buildDescription(topLevelClass)
                .setMessage("Passive View package '" + sourcePackageName
                        + "' mis-shapes the ViewInputEvent surface through "
                        + String.join(", ", violations)
                        + ". Views may emit user input only through one same-stem fire-and-forget onViewInputEvent(Consumer<...ViewInputEvent>) seam and must not subscribe to another top-level View's input seam.")
                .build();
    }

    private static void collectMethodViolation(
            MethodTree methodTree,
            String sourcePackageName,
            String viewSimpleName,
            Set<String> violations
    ) {
        if (!isOutwardVisible(methodTree.getModifiers())) {
            return;
        }
        if (isAllowedViewInputEventApi(methodTree, sourcePackageName, viewSimpleName)) {
            return;
        }
        if (!"onViewInputEvent".contentEquals(methodTree.getName())
                && !containsCallbackSurfaceParameter(methodTree)
                && !returnsCallbackSurface(methodTree)) {
            return;
        }
        violations.add(methodTree.getName() + "(" + methodTree.getParameters().size() + ")");
    }

    private static void collectFieldViolation(
            VariableTree variableTree,
            String sourcePackageName,
            Set<String> violations
    ) {
        if (!isOutwardVisible(variableTree.getModifiers())) {
            return;
        }
        if (!ViewArchitectureSupport.isCallbackSurfaceType(ASTHelpers.getType(variableTree.getType()))
                && !ViewArchitectureSupport.isConsumerOfSameRootViewInputEvent(
                        ASTHelpers.getType(variableTree.getType()),
                        sourcePackageName)) {
            return;
        }
        violations.add(variableTree.getName() + " field");
    }

    private static boolean containsCallbackSurfaceParameter(MethodTree methodTree) {
        for (VariableTree parameter : methodTree.getParameters()) {
            if (ViewArchitectureSupport.isCallbackSurfaceType(ASTHelpers.getType(parameter.getType()))) {
                return true;
            }
        }
        return false;
    }

    private static boolean returnsCallbackSurface(MethodTree methodTree) {
        return methodTree.getReturnType() != null
                && ViewArchitectureSupport.isCallbackSurfaceType(ASTHelpers.getType(methodTree.getReturnType()));
    }

    private static boolean isAllowedViewInputEventApi(
            MethodTree methodTree,
            String sourcePackageName,
            String viewSimpleName
    ) {
        if (!"onViewInputEvent".contentEquals(methodTree.getName())
                || methodTree.getParameters().size() != 1
                || methodTree.getReturnType() == null
                || !"void".contentEquals(methodTree.getReturnType().toString())) {
            return false;
        }
        VariableTree parameter = methodTree.getParameters().get(0);
        return ViewArchitectureSupport.isConsumerOfSameStemViewInputEvent(
                ASTHelpers.getType(parameter.getType()),
                sourcePackageName,
                viewSimpleName);
    }

    private static boolean isOutwardVisible(ModifiersTree modifiersTree) {
        return !modifiersTree.getFlags().contains(Modifier.PRIVATE);
    }

    private static void collectForwardingViolation(
            CompilationUnitTree tree,
            String sourcePackageName,
            Set<String> violations
    ) {
        new TreePathScanner<Void, Void>() {
            @Override
            public Void visitMethodInvocation(MethodInvocationTree methodInvocationTree, Void unused) {
                Symbol.MethodSymbol symbol = ASTHelpers.getSymbol(methodInvocationTree);
                if (symbol == null || !"onViewInputEvent".contentEquals(symbol.getSimpleName())) {
                    return super.visitMethodInvocation(methodInvocationTree, unused);
                }
                String ownerType = ViewArchitectureSupport.getQualifiedOwnerTypeName(symbol);
                ViewArchitectureSupport.ViewTypeInfo ownerInfo = ViewArchitectureSupport.parseViewType(ownerType);
                if (ownerInfo == null || !"VIEW".equals(ownerInfo.bucket())) {
                    return super.visitMethodInvocation(methodInvocationTree, unused);
                }
                violations.add("direct view-to-view input forwarding via " + ownerType + ".onViewInputEvent");
                return super.visitMethodInvocation(methodInvocationTree, unused);
            }
        }.scan(tree, null);
    }

    private static ClassTree topLevelClass(CompilationUnitTree tree) {
        ClassTree[] result = {null};
        new TreeScanner<Void, Void>() {
            @Override
            public Void visitClass(ClassTree classTree, Void unused) {
                if (result[0] == null) {
                    result[0] = classTree;
                }
                return null;
            }
        }.scan(tree, null);
        return result[0];
    }

    private static boolean participatesInViewInputEventProtocol(
            CompilationUnitTree tree,
            ClassTree topLevelClass,
            String sourcePackageName,
            String viewSimpleName
    ) {
        for (var member : topLevelClass.getMembers()) {
            if (member instanceof MethodTree methodTree
                    && "onViewInputEvent".contentEquals(methodTree.getName())) {
                return true;
            }
        }
        for (String referencedType : ViewArchitectureSupport.collectReferencedTypes(tree)) {
            if (ViewArchitectureSupport.isSameStemViewInputEventReference(
                    sourcePackageName,
                    viewSimpleName,
                    referencedType)) {
                return true;
            }
        }
        return false;
    }
}
