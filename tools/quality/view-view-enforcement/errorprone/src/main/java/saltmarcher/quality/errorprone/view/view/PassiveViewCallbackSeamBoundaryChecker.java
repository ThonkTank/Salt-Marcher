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
        summary = "Passive Views may expose only onViewInputEvent(...) outward plus project-free prepared-state sink accessors.",
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
                        + "' exposes illegal callback, result, or imperative render seams "
                        + String.join(", ", violations)
                        + ". Passive Views may expose only onViewInputEvent(Consumer<SameStemViewInputEvent>) outward and project-free prepared-state sink accessors inward.")
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
        if (methodTree.getReturnType() == null) {
            return;
        }
        if (isAllowedViewInputEventApi(methodTree, sourcePackageName, viewSimpleName)) {
            return;
        }
        if (isAllowedPreparedStateSinkAccessor(methodTree, sourcePackageName, viewSimpleName)) {
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
        if (variableTree.getModifiers().getFlags().containsAll(Set.of(Modifier.STATIC, Modifier.FINAL))) {
            return;
        }
        violations.add(variableTree.getName() + " field");
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

    private static boolean isAllowedPreparedStateSinkAccessor(
            MethodTree methodTree,
            String sourcePackageName,
            String viewSimpleName
    ) {
        if (!methodTree.getParameters().isEmpty()) {
            return false;
        }
        return isPreparedStateSinkType(ASTHelpers.getType(methodTree.getReturnType()), sourcePackageName, viewSimpleName);
    }

    private static boolean isPreparedStateSinkType(
            javax.lang.model.type.TypeMirror typeMirror,
            String sourcePackageName,
            String viewSimpleName
    ) {
        if (typeMirror == null) {
            return false;
        }
        if (ViewArchitectureSupport.isConsumerOfSameStemViewInputEvent(typeMirror, sourcePackageName, viewSimpleName)
                || ViewArchitectureSupport.isConsumerOfSameRootViewInputEvent(typeMirror, sourcePackageName)) {
            return false;
        }
        if (!isConsumerType(typeMirror)) {
            return false;
        }
        javax.lang.model.type.DeclaredType declaredType = (javax.lang.model.type.DeclaredType) typeMirror;
        if (declaredType.getTypeArguments().size() != 1) {
            return false;
        }
        Set<String> referencedTypes = ViewArchitectureSupport.collectTypeReferences(typeMirror);
        if (referencedTypes.isEmpty()) {
            return false;
        }
        return referencedTypes.stream().allMatch(referencedType ->
                !referencedType.startsWith("src.")
                        && !referencedType.startsWith("shell.")
                        && !referencedType.startsWith("bootstrap.")
                        && !ViewArchitectureSupport.isForbiddenViewInfrastructureJdkType(referencedType));
    }

    private static boolean isConsumerType(javax.lang.model.type.TypeMirror typeMirror) {
        if (!(typeMirror instanceof javax.lang.model.type.DeclaredType declaredType)) {
            return false;
        }
        javax.lang.model.element.Element element = declaredType.asElement();
        if (!(element instanceof javax.lang.model.element.TypeElement typeElement)) {
            return false;
        }
        return "java.util.function.Consumer".contentEquals(typeElement.getQualifiedName());
    }

    private static boolean isOutwardVisible(ModifiersTree modifiersTree) {
        return !modifiersTree.getFlags().contains(Modifier.PRIVATE);
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
