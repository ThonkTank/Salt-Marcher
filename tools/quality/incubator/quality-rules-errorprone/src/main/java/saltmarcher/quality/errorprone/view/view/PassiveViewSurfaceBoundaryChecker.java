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
import com.sun.source.tree.Tree;
import com.sun.source.tree.VariableTree;
import com.sun.source.util.TreePathScanner;
import com.sun.tools.javac.code.Symbol;
import java.util.LinkedHashSet;
import java.util.Set;
import javax.lang.model.element.Modifier;
import javax.lang.model.element.TypeElement;
import javax.lang.model.type.DeclaredType;
import javax.lang.model.type.TypeMirror;
import saltmarcher.quality.errorprone.view.ViewArchitectureSupport;
import saltmarcher.architecture.policy.view.ViewSourceDescriptor;

@BugPattern(
        name = "PassiveViewSurfaceBoundary",
        summary = "Passive Views stay concrete UI surfaces and may expose only bind(SameStemContentModel) plus an optional same-stem input seam.",
        severity = BugPattern.SeverityLevel.ERROR)
public final class PassiveViewSurfaceBoundaryChecker extends BugChecker
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

        collectTypeShapeViolations(topLevelClass, sourcePackageName, viewSimpleName, violations);
        collectApiSurfaceViolations(topLevelClass, sourcePackageName, viewSimpleName, violations);
        collectForwardingViolation(tree, violations);

        if (violations.isEmpty()) {
            return Description.NO_MATCH;
        }
        return buildDescription(topLevelClass)
                .setMessage("Passive View '" + qualifiedViewName
                        + "' violates the passive-View surface boundary through "
                        + String.join(", ", violations)
                        + ". A passive View stays a concrete UI surface, exposes exactly one bind(SameStemContentModel) inbound seam and optionally onViewInputEvent(Consumer<SameStemViewInputEvent>) outward.")
                .build();
    }

    private static void collectTypeShapeViolations(
            ClassTree topLevelClass,
            String sourcePackageName,
            String viewSimpleName,
            Set<String> violations
    ) {
        if (isUtilityLike(topLevelClass)) {
            violations.add("static utility shape");
        }
        collectProjectSupertypeViolations(topLevelClass, sourcePackageName, viewSimpleName, violations);
        collectConstructorViolations(topLevelClass, sourcePackageName, viewSimpleName, violations);
    }

    private static void collectApiSurfaceViolations(
            ClassTree topLevelClass,
            String sourcePackageName,
            String viewSimpleName,
            Set<String> violations
    ) {
        for (Tree member : topLevelClass.getMembers()) {
            if (member instanceof MethodTree methodTree) {
                collectMethodViolation(methodTree, sourcePackageName, viewSimpleName, violations);
            } else if (member instanceof VariableTree variableTree) {
                collectFieldViolation(variableTree, violations);
            }
        }
        long bindMethodCount = topLevelClass.getMembers().stream()
                .filter(MethodTree.class::isInstance)
                .map(MethodTree.class::cast)
                .filter(methodTree -> isAllowedContentModelBindApi(methodTree, sourcePackageName, viewSimpleName))
                .count();
        if (bindMethodCount != 1) {
            violations.add("bind(SameStemContentModel) count " + bindMethodCount);
        }
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

    private static void collectMethodViolation(
            MethodTree methodTree,
            String sourcePackageName,
            String viewSimpleName,
            Set<String> violations
    ) {
        if (!isOutwardVisible(methodTree.getModifiers()) || methodTree.getReturnType() == null) {
            return;
        }
        if (isAllowedViewInputEventApi(methodTree, sourcePackageName, viewSimpleName)) {
            return;
        }
        if (isAllowedContentModelBindApi(methodTree, sourcePackageName, viewSimpleName)) {
            return;
        }
        violations.add(methodTree.getName() + "(" + methodTree.getParameters().size() + ")");
    }

    private static void collectFieldViolation(VariableTree variableTree, Set<String> violations) {
        if (!isOutwardVisible(variableTree.getModifiers())) {
            return;
        }
        if (variableTree.getModifiers().getFlags().containsAll(Set.of(Modifier.STATIC, Modifier.FINAL))) {
            return;
        }
        violations.add(variableTree.getName() + " field");
    }

    private static void collectForwardingViolation(CompilationUnitTree tree, Set<String> violations) {
        new TreePathScanner<Void, Void>() {
            @Override
            public Void visitMethodInvocation(MethodInvocationTree methodInvocationTree, Void unused) {
                Symbol.MethodSymbol symbol = ASTHelpers.getSymbol(methodInvocationTree);
                if (symbol == null || !"onViewInputEvent".contentEquals(symbol.getSimpleName())) {
                    return super.visitMethodInvocation(methodInvocationTree, unused);
                }
                String ownerType = ViewArchitectureSupport.getQualifiedOwnerTypeName(symbol);
                if (ViewArchitectureSupport.isTargetPanelViewReference(ownerType)) {
                    violations.add("direct view-to-view input forwarding via " + ownerType + ".onViewInputEvent");
                }
                return super.visitMethodInvocation(methodInvocationTree, unused);
            }
        }.scan(tree, null);
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

    private static boolean isAllowedViewInputEventApi(
            MethodTree methodTree,
            String sourcePackageName,
            String viewSimpleName
    ) {
        if (!"onViewInputEvent".contentEquals(methodTree.getName())
                || methodTree.getParameters().size() != 1
                || !"void".contentEquals(methodTree.getReturnType().toString())) {
            return false;
        }
        VariableTree parameter = methodTree.getParameters().get(0);
        return ViewArchitectureSupport.isConsumerOfSameStemViewInputEvent(
                ASTHelpers.getType(parameter.getType()),
                sourcePackageName,
                viewSimpleName);
    }

    private static boolean isAllowedContentModelBindApi(
            MethodTree methodTree,
            String sourcePackageName,
            String viewSimpleName
    ) {
        if (!"bind".contentEquals(methodTree.getName())
                || methodTree.getParameters().size() != 1
                || !"void".contentEquals(methodTree.getReturnType().toString())
                || !methodTree.getModifiers().getFlags().contains(Modifier.PUBLIC)) {
            return false;
        }
        VariableTree parameter = methodTree.getParameters().get(0);
        TypeMirror parameterType = ASTHelpers.getType(parameter.getType());
        if (parameterType == null) {
            return false;
        }
        return ViewArchitectureSupport.isSameStemContentModelReference(
                sourcePackageName,
                viewSimpleName,
                parameterType.toString());
    }

    private static boolean isOutwardVisible(ModifiersTree modifiersTree) {
        return !modifiersTree.getFlags().contains(Modifier.PRIVATE);
    }
}
