package saltmarcher.quality.errorprone.view.view;

import com.google.errorprone.BugPattern;
import com.google.errorprone.VisitorState;
import com.google.errorprone.bugpatterns.BugChecker;
import com.google.errorprone.matchers.Description;
import com.google.errorprone.util.ASTHelpers;
import com.sun.source.tree.ClassTree;
import com.sun.source.tree.CompilationUnitTree;
import com.sun.source.tree.MethodTree;
import com.sun.source.tree.Tree;
import com.sun.source.tree.VariableTree;
import java.util.LinkedHashSet;
import java.util.Set;
import javax.lang.model.element.Modifier;
import javax.lang.model.element.TypeElement;
import javax.lang.model.type.DeclaredType;
import javax.lang.model.type.TypeMirror;
import saltmarcher.quality.errorprone.view.ViewSourceDescriptor;

@BugPattern(
        name = "PassiveViewTypeShapeBoundary",
        summary = "Passive Views must stay concrete UI surfaces instead of project-View inheritance, utility, or constructor-injected relay shapes.",
        severity = BugPattern.SeverityLevel.ERROR)
public final class PassiveViewTypeShapeBoundaryChecker extends BugChecker
        implements BugChecker.CompilationUnitTreeMatcher {

    @Override
    public Description matchCompilationUnit(CompilationUnitTree tree, VisitorState state) {
        ViewSourceDescriptor source = ViewSourceDescriptor.describe(tree);
        if (!source.isPassiveViewSource()) {
            return Description.NO_MATCH;
        }

        ClassTree topLevelClass = ViewArchitectureSupport.topLevelClass(tree);
        if (topLevelClass == null) {
            return Description.NO_MATCH;
        }

        String sourcePackageName = source.packageName();
        String viewSimpleName = source.topLevelSimpleName();
        String qualifiedViewName = source.qualifiedTopLevelTypeName();
        Set<String> violations = new LinkedHashSet<>();

        if (isUtilityLike(topLevelClass)) {
            violations.add("static utility shape");
        }
        collectProjectSupertypeViolations(topLevelClass, sourcePackageName, viewSimpleName, violations);
        collectConstructorViolations(topLevelClass, sourcePackageName, viewSimpleName, violations);

        if (violations.isEmpty()) {
            return Description.NO_MATCH;
        }
        return buildDescription(topLevelClass)
                .setMessage("Passive View '" + qualifiedViewName
                        + "' violates the passive-View type shape through "
                        + String.join(", ", violations)
                        + ". Views must stay concrete UI surfaces rather than project-View inheritance chains, utility holders, or constructor-injected relay protocols.")
                .build();
    }

    private static void collectProjectSupertypeViolations(
            ClassTree topLevelClass,
            String sourcePackageName,
            String viewSimpleName,
            Set<String> violations
    ) {
        if (topLevelClass.getExtendsClause() != null) {
            TypeMirror extendsType = ASTHelpers.getType(topLevelClass.getExtendsClause());
            if (isForbiddenSupertype(extendsType, sourcePackageName, viewSimpleName)) {
                violations.add("project superclass " + topLevelClass.getExtendsClause());
            }
        }
        for (Tree implementsClause : topLevelClass.getImplementsClause()) {
            TypeMirror implementedType = ASTHelpers.getType(implementsClause);
            if (isForbiddenSupertype(implementedType, sourcePackageName, viewSimpleName)) {
                violations.add("project interface " + implementsClause);
            }
        }
    }

    private static boolean isForbiddenSupertype(
            TypeMirror typeMirror,
            String sourcePackageName,
            String viewSimpleName
    ) {
        if (typeMirror == null) {
            return false;
        }
        for (String referencedType : ViewArchitectureSupport.collectTypeReferences(typeMirror)) {
            if (ViewArchitectureSupport.isOwnTopLevelOrNestedTypeReference(
                    sourcePackageName,
                    viewSimpleName,
                    referencedType)) {
                continue;
            }
            if (referencedType.startsWith("src.")
                    || referencedType.startsWith("shell.")
                    || referencedType.startsWith("bootstrap.")) {
                return true;
            }
        }
        return false;
    }

    private static void collectConstructorViolations(
            ClassTree topLevelClass,
            String sourcePackageName,
            String viewSimpleName,
            Set<String> violations
    ) {
        for (Tree member : topLevelClass.getMembers()) {
            if (!(member instanceof MethodTree methodTree) || methodTree.getReturnType() != null) {
                continue;
            }
            for (VariableTree parameter : methodTree.getParameters()) {
                TypeMirror parameterType = ASTHelpers.getType(parameter.getType());
                if (isForbiddenConstructorParameter(parameterType, sourcePackageName, viewSimpleName)) {
                    violations.add("constructor parameter " + parameter.getType());
                }
            }
        }
    }

    private static boolean isForbiddenConstructorParameter(
            TypeMirror typeMirror,
            String sourcePackageName,
            String viewSimpleName
    ) {
        if (typeMirror == null) {
            return false;
        }
        if (isCallbackOrResultProtocol(typeMirror)) {
            return true;
        }
        for (String referencedType : ViewArchitectureSupport.collectTypeReferences(typeMirror)) {
            if (ViewArchitectureSupport.isOwnTopLevelOrNestedTypeReference(
                    sourcePackageName,
                    viewSimpleName,
                    referencedType)) {
                continue;
            }
            if (referencedType.startsWith("src.")
                    || referencedType.startsWith("shell.")
                    || referencedType.startsWith("bootstrap.")) {
                return true;
            }
        }
        return false;
    }

    private static boolean isCallbackOrResultProtocol(TypeMirror typeMirror) {
        if (ViewArchitectureSupport.isCallbackOrResultProtocolType(typeMirror)) {
            return true;
        }
        if (!(typeMirror instanceof DeclaredType declaredType)) {
            return false;
        }
        if (!(declaredType.asElement() instanceof TypeElement typeElement)) {
            return false;
        }
        return "java.util.function.Consumer".contentEquals(typeElement.getQualifiedName())
                || "java.util.function.BiConsumer".contentEquals(typeElement.getQualifiedName());
    }

    private static boolean isUtilityLike(ClassTree topLevelClass) {
        boolean hasOutwardStaticMethod = false;
        boolean hasInstanceState = false;
        for (Tree member : topLevelClass.getMembers()) {
            if (member instanceof VariableTree variableTree
                    && !variableTree.getModifiers().getFlags().contains(Modifier.STATIC)) {
                hasInstanceState = true;
            }
            if (member instanceof MethodTree methodTree) {
                if (methodTree.getReturnType() == null) {
                    continue;
                }
                if (!methodTree.getModifiers().getFlags().contains(Modifier.STATIC)) {
                    return false;
                }
                hasOutwardStaticMethod = true;
            }
        }
        return hasOutwardStaticMethod && !hasInstanceState;
    }
}
