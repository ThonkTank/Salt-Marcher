package saltmarcher.quality.errorprone.view.view;

import com.google.errorprone.BugPattern;
import com.google.errorprone.VisitorState;
import com.google.errorprone.bugpatterns.BugChecker;
import com.google.errorprone.matchers.Description;
import com.google.errorprone.util.ASTHelpers;
import com.sun.source.tree.ClassTree;
import com.sun.source.tree.CompilationUnitTree;
import com.sun.source.tree.MethodTree;
import com.sun.source.tree.ModifiersTree;
import com.sun.source.tree.Tree;
import com.sun.source.tree.VariableTree;
import com.sun.source.util.TreeScanner;
import java.util.LinkedHashSet;
import java.util.Set;
import javax.lang.model.element.Modifier;
import saltmarcher.quality.errorprone.view.ViewSourceDescriptor;
@BugPattern(
        name = "PassiveViewCallbackSeamBoundary",
        summary = "Passive Views outside technical primitive packages may not expose callback or result-bearing outward seams.",
        severity = BugPattern.SeverityLevel.ERROR)
public final class PassiveViewCallbackSeamBoundaryChecker extends BugChecker
        implements BugChecker.CompilationUnitTreeMatcher {

    @Override
    public Description matchCompilationUnit(CompilationUnitTree tree, VisitorState state) {
        ViewSourceDescriptor source = ViewSourceDescriptor.describe(tree);
        if (!source.isPassiveViewSource()) {
            return Description.NO_MATCH;
        }

        ClassTree topLevelClass = topLevelClass(tree);
        if (topLevelClass == null) {
            return Description.NO_MATCH;
        }
        if (isStaticViewUtility(topLevelClass)) {
            return Description.NO_MATCH;
        }

        String sourcePackageName = source.packageName();
        String viewSimpleName = source.topLevelSimpleName();
        String qualifiedViewName = sourcePackageName.isBlank()
                ? viewSimpleName
                : sourcePackageName + "." + viewSimpleName;

        Set<String> violations = new LinkedHashSet<>();
        for (var member : topLevelClass.getMembers()) {
            if (member instanceof MethodTree methodTree) {
                collectMethodViolation(methodTree, sourcePackageName, viewSimpleName, violations);
            } else if (member instanceof VariableTree variableTree) {
                collectFieldViolation(variableTree, sourcePackageName, violations);
            }
        }

        if (violations.isEmpty()) {
            return Description.NO_MATCH;
        }
        return buildDescription(topLevelClass)
                .setMessage("Passive View '" + qualifiedViewName
                        + "' exposes alternate callback or result-bearing outward seams "
                        + String.join(", ", violations)
                        + ". Passive Views must stay callback-flat and use only onViewInputEvent(Consumer<SameStemViewInputEvent>) when interactive.")
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
        if (!containsProtocolParameter(methodTree, sourcePackageName) && !returnsProtocolType(methodTree)) {
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
        if (!ViewArchitectureSupport.isCallbackOrResultProtocolType(ASTHelpers.getType(variableTree.getType()))
                && !ViewArchitectureSupport.isConsumerOfSameRootViewInputEvent(
                        ASTHelpers.getType(variableTree.getType()),
                        sourcePackageName)) {
            return;
        }
        violations.add(variableTree.getName() + " field");
    }

    private static boolean containsProtocolParameter(MethodTree methodTree, String sourcePackageName) {
        for (VariableTree parameter : methodTree.getParameters()) {
            if (ViewArchitectureSupport.isCallbackOrResultProtocolType(ASTHelpers.getType(parameter.getType()))
                    || ViewArchitectureSupport.isConsumerOfSameRootViewInputEvent(
                    ASTHelpers.getType(parameter.getType()),
                    sourcePackageName)) {
                return true;
            }
        }
        return false;
    }

    private static boolean returnsProtocolType(MethodTree methodTree) {
        return methodTree.getReturnType() != null
                && ViewArchitectureSupport.isCallbackOrResultProtocolType(ASTHelpers.getType(methodTree.getReturnType()));
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

    private static boolean isStaticViewUtility(ClassTree topLevelClass) {
        boolean hasOutwardStaticMethod = false;
        for (var member : topLevelClass.getMembers()) {
            if (member instanceof MethodTree methodTree) {
                if (methodTree.getReturnType() == null) {
                    if (!methodTree.getModifiers().getFlags().contains(Modifier.PRIVATE)) {
                        return false;
                    }
                    continue;
                }
                if (!methodTree.getModifiers().getFlags().contains(Modifier.STATIC)) {
                    return false;
                }
                if (isOutwardVisible(methodTree.getModifiers())) {
                    hasOutwardStaticMethod = true;
                }
            } else if (member instanceof VariableTree variableTree
                    && !variableTree.getModifiers().getFlags().contains(Modifier.STATIC)) {
                return false;
            }
        }
        return hasOutwardStaticMethod;
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
}
