package saltmarcher.quality.errorprone;

import com.google.errorprone.util.ASTHelpers;
import com.sun.source.tree.ClassTree;
import com.sun.source.tree.CompilationUnitTree;
import com.sun.source.tree.MethodTree;
import com.sun.source.tree.Tree;
import com.sun.source.tree.VariableTree;
import com.sun.source.util.TreeScanner;
import com.sun.tools.javac.code.Symbol;
import java.util.LinkedHashSet;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import javax.lang.model.element.ElementKind;
import javax.lang.model.element.Modifier;
import javax.lang.model.element.TypeElement;
import javax.lang.model.type.TypeMirror;

final class DomainRoleConcernSupport {

    enum Role {
        APPLICATION_SERVICE("ApplicationService"),
        USECASE("UseCase"),
        MODEL("Model"),
        HELPER("Helper"),
        CONSTANTS("Constants"),
        PORT("Port"),
        REPOSITORY("Repository");

        private final String displayName;

        Role(String displayName) {
            this.displayName = displayName;
        }

        String displayName() {
            return displayName;
        }
    }

    record SourceRole(
            Role role,
            String feature,
            String family,
            String packageName,
            String topLevelQualifiedName
    ) {
    }

    private static final Pattern ROOT_PACKAGE = Pattern.compile("^src\\.domain\\.([^.]+)$");
    private static final Pattern ROOT_APPLICATION_PACKAGE = Pattern.compile("^src\\.domain\\.([^.]+)\\.application(\\..*)?$");
    private static final Pattern MODEL_ROLE_PACKAGE =
            Pattern.compile("^src\\.domain\\.([^.]+)\\.model\\.([^.]+)\\.(model|usecase|helper|constants|port|repository)(\\..*)?$");
    private static final Pattern PUBLISHED_PACKAGE = Pattern.compile("^src\\.domain\\.([^.]+)\\.published(\\..*)?$");
    private static final Pattern DOMAIN_APPLICATION_SERVICE_TYPE =
            Pattern.compile("^src\\.domain\\.([^.]+)\\.[^.]+ApplicationService$");
    private static final Pattern DOMAIN_ROOT_APPLICATION_USECASE_TYPE =
            Pattern.compile("^src\\.domain\\.([^.]+)\\.application\\.[^.]+UseCase$");
    private static final Pattern DOMAIN_ROOT_APPLICATION_USECASE_OWNED_TYPE =
            Pattern.compile("^src\\.domain\\.([^.]+)\\.application\\.[^.]+UseCase(?:[.$].*)?$");
    private static final Pattern DOMAIN_MODEL_ROLE_TYPE =
            Pattern.compile("^src\\.domain\\.([^.]+)\\.model\\.([^.]+)\\.(model|usecase|helper|constants|port|repository)\\..+");
    private static final Pattern DOMAIN_PUBLISHED_TYPE =
            Pattern.compile("^src\\.domain\\.([^.]+)\\.published\\..+");
    private static final Pattern DOMAIN_PUBLISHED_MODEL_TYPE =
            Pattern.compile("^src\\.domain\\.([^.]+)\\.published\\.[^.]+Model$");
    private static final Set<String> OUTER_LAYER_PREFIXES = Set.of(
            "bootstrap.",
            "shell.",
            "src.view.",
            "src.data.",
            "javafx.",
            "java.sql.",
            "javax.sql.",
            "javax.json.",
            "jakarta.json.",
            "java.net.",
            "java.io.",
            "java.nio.file.",
            "javax.persistence.",
            "jakarta.persistence.",
            "javax.transaction.",
            "jakarta.transaction.",
            "org.jooq.",
            "org.hibernate.",
            "okhttp3.",
            "retrofit2.");
    private static final Set<String> EXECUTABLE_PROTOCOL_TYPES = Set.of(
            "java.lang.Runnable",
            "java.util.concurrent.Callable",
            "java.util.concurrent.CompletionStage",
            "java.util.concurrent.Future",
            "java.util.Observer",
            "java.util.Observable");

    private DomainRoleConcernSupport() {
    }

    static SourceRole describeRole(CompilationUnitTree tree, Role role) {
        String packageName = DataArchitectureSupport.packageName(tree);
        String topLevelQualifiedName = topLevelQualifiedName(tree);
        if (topLevelQualifiedName == null) {
            return null;
        }
        return switch (role) {
            case APPLICATION_SERVICE -> describeApplicationService(packageName, topLevelQualifiedName);
            case USECASE -> describeUseCase(packageName, topLevelQualifiedName);
            case MODEL, HELPER, CONSTANTS, PORT, REPOSITORY -> describeModelRole(packageName, topLevelQualifiedName, role);
        };
    }

    static Set<String> boundaryViolations(SourceRole sourceRole, CompilationUnitTree tree) {
        Set<String> violations = new LinkedHashSet<>();
        for (String referencedType : DataArchitectureSupport.collectReferencedTypes(tree)) {
            if (referencedType == null
                    || referencedType.isBlank()
                    || isOwnTopLevelOrNestedTypeReference(sourceRole, referencedType)) {
                continue;
            }
            if (isExecutableProtocolType(referencedType)) {
                violations.add("references executable protocol type " + referencedType);
                continue;
            }
            if (isOuterLayerType(referencedType)) {
                violations.add("references outer-layer type " + referencedType);
                continue;
            }
            if (!referencedType.startsWith("src.domain.")) {
                continue;
            }
            if (!isAllowedDomainReference(sourceRole, referencedType)) {
                violations.add(forbiddenDomainConcernMessage(sourceRole, referencedType));
            }
        }
        collectShapeViolations(sourceRole, tree, violations);
        return violations;
    }

    static boolean isSameFeaturePublishedType(String referencedType, String feature) {
        Matcher matcher = DOMAIN_PUBLISHED_TYPE.matcher(referencedType);
        return matcher.matches() && feature.equals(matcher.group(1));
    }

    static boolean isSameFeaturePublishedModelType(String referencedType, String feature) {
        Matcher matcher = DOMAIN_PUBLISHED_MODEL_TYPE.matcher(referencedType);
        return matcher.matches() && feature.equals(matcher.group(1));
    }

    static boolean isSameFeaturePublishedNonModelType(String referencedType, String feature) {
        return isSameFeaturePublishedType(referencedType, feature)
                && !isSameFeaturePublishedModelType(referencedType, feature);
    }

    static boolean isSameFeatureRootUseCaseOwnedType(String referencedType, String feature) {
        Matcher matcher = DOMAIN_ROOT_APPLICATION_USECASE_OWNED_TYPE.matcher(referencedType);
        return matcher.matches() && feature.equals(matcher.group(1));
    }

    static Set<String> collectTypeReferences(TypeMirror typeMirror) {
        Set<String> referencedTypes = new LinkedHashSet<>();
        DataArchitectureSupport.collectTypeReferences(typeMirror, referencedTypes);
        return referencedTypes;
    }

    private static SourceRole describeApplicationService(String packageName, String topLevelQualifiedName) {
        Matcher matcher = ROOT_PACKAGE.matcher(packageName);
        if (!matcher.matches() || !topLevelQualifiedName.endsWith("ApplicationService")) {
            return null;
        }
        return new SourceRole(Role.APPLICATION_SERVICE, matcher.group(1), null, packageName, topLevelQualifiedName);
    }

    private static SourceRole describeUseCase(String packageName, String topLevelQualifiedName) {
        Matcher rootMatcher = ROOT_APPLICATION_PACKAGE.matcher(packageName);
        if (rootMatcher.matches()) {
            return new SourceRole(Role.USECASE, rootMatcher.group(1), null, packageName, topLevelQualifiedName);
        }
        Matcher modelMatcher = MODEL_ROLE_PACKAGE.matcher(packageName);
        if (!modelMatcher.matches() || !"usecase".equals(modelMatcher.group(3))) {
            return null;
        }
        return new SourceRole(Role.USECASE, modelMatcher.group(1), modelMatcher.group(2), packageName, topLevelQualifiedName);
    }

    private static SourceRole describeModelRole(String packageName, String topLevelQualifiedName, Role role) {
        Matcher matcher = MODEL_ROLE_PACKAGE.matcher(packageName);
        if (!matcher.matches()) {
            return null;
        }
        String packageRole = matcher.group(3);
        if (!packageRole.equals(role.name().toLowerCase())) {
            return null;
        }
        return new SourceRole(role, matcher.group(1), matcher.group(2), packageName, topLevelQualifiedName);
    }

    private static String topLevelQualifiedName(CompilationUnitTree tree) {
        String packageName = DataArchitectureSupport.packageName(tree);
        ClassTree topLevelClass = topLevelClass(tree);
        if (topLevelClass == null || topLevelClass.getSimpleName().toString().isBlank()) {
            return null;
        }
        return packageName.isBlank()
                ? topLevelClass.getSimpleName().toString()
                : packageName + "." + topLevelClass.getSimpleName();
    }

    static ClassTree topLevelClass(CompilationUnitTree tree) {
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

    private static boolean isOwnTopLevelOrNestedTypeReference(SourceRole sourceRole, String referencedType) {
        return referencedType.equals(sourceRole.topLevelQualifiedName())
                || referencedType.startsWith(sourceRole.topLevelQualifiedName() + ".")
                || referencedType.startsWith(sourceRole.topLevelQualifiedName() + "$");
    }

    private static boolean isExecutableProtocolType(String referencedType) {
        return referencedType.startsWith("java.util.function.")
                || EXECUTABLE_PROTOCOL_TYPES.contains(referencedType);
    }

    private static boolean isOuterLayerType(String referencedType) {
        return OUTER_LAYER_PREFIXES.stream().anyMatch(referencedType::startsWith);
    }

    private static boolean isAllowedDomainReference(SourceRole sourceRole, String referencedType) {
        return switch (sourceRole.role()) {
            case APPLICATION_SERVICE -> isAllowedForApplicationService(sourceRole, referencedType);
            case USECASE -> isAllowedForUseCase(sourceRole, referencedType);
            case MODEL -> isAllowedForModel(sourceRole, referencedType);
            case HELPER -> isAllowedForHelper(sourceRole, referencedType);
            case CONSTANTS -> isAllowedForConstants(sourceRole, referencedType);
            case PORT -> isAllowedForPort(sourceRole, referencedType);
            case REPOSITORY -> isAllowedForRepository(sourceRole, referencedType);
        };
    }

    private static String forbiddenDomainConcernMessage(SourceRole sourceRole, String referencedType) {
        if (sourceRole.role() == Role.USECASE
                && sourceRole.family() == null
                && isSameFeatureRootUseCaseOwnedType(referencedType, sourceRole.feature())) {
            return "references root UseCase chain " + referencedType;
        }
        return "references forbidden domain concern " + referencedType;
    }

    private static boolean isAllowedForApplicationService(SourceRole sourceRole, String referencedType) {
        return isSameFeaturePublishedNonModelType(referencedType, sourceRole.feature())
                || isSameFeatureUseCaseType(referencedType, sourceRole.feature());
    }

    private static boolean isAllowedForUseCase(SourceRole sourceRole, String referencedType) {
        return isSameFeatureModelRoleType(referencedType, sourceRole.feature(), "model")
                || isSameFeatureModelRoleType(referencedType, sourceRole.feature(), "usecase")
                || isSameFeatureModelRoleType(referencedType, sourceRole.feature(), "helper")
                || isSameFeatureModelRoleType(referencedType, sourceRole.feature(), "constants")
                || isSameFeatureModelRoleType(referencedType, sourceRole.feature(), "port")
                || isSameFeatureModelRoleType(referencedType, sourceRole.feature(), "repository")
                || isForeignRootApplicationServiceType(referencedType, sourceRole.feature());
    }

    private static boolean isAllowedForModel(SourceRole sourceRole, String referencedType) {
        return isSameFeatureModelRoleType(referencedType, sourceRole.feature(), "model")
                || isSameFeatureModelRoleType(referencedType, sourceRole.feature(), "constants");
    }

    private static boolean isAllowedForHelper(SourceRole sourceRole, String referencedType) {
        return isSameFeatureModelRoleType(referencedType, sourceRole.feature(), "model")
                || isSameFeatureModelRoleType(referencedType, sourceRole.feature(), "constants");
    }

    private static boolean isAllowedForConstants(SourceRole sourceRole, String referencedType) {
        return isSameFeatureModelRoleType(referencedType, sourceRole.feature(), "constants");
    }

    private static boolean isAllowedForPort(SourceRole sourceRole, String referencedType) {
        return isSameFeatureModelRoleType(referencedType, sourceRole.feature(), "model")
                || isSameFeatureModelRoleType(referencedType, sourceRole.feature(), "usecase")
                || isSameFeatureModelRoleType(referencedType, sourceRole.feature(), "constants")
                || isForeignPublishedType(referencedType, sourceRole.feature());
    }

    private static boolean isAllowedForRepository(SourceRole sourceRole, String referencedType) {
        return isSameFeatureModelRoleType(referencedType, sourceRole.feature(), "model")
                || isSameFeatureModelRoleType(referencedType, sourceRole.feature(), "constants")
                || isSameFeatureModelRoleType(referencedType, sourceRole.feature(), "repository")
                || isForeignRootApplicationServiceType(referencedType, sourceRole.feature());
    }

    private static boolean isSameFeatureUseCaseType(String referencedType, String feature) {
        Matcher rootMatcher = DOMAIN_ROOT_APPLICATION_USECASE_TYPE.matcher(referencedType);
        if (rootMatcher.matches()) {
            return feature.equals(rootMatcher.group(1));
        }
        Matcher modelMatcher = DOMAIN_MODEL_ROLE_TYPE.matcher(referencedType);
        return modelMatcher.matches()
                && feature.equals(modelMatcher.group(1))
                && "usecase".equals(modelMatcher.group(3));
    }

    private static boolean isSameFeatureModelRoleType(String referencedType, String feature, String role) {
        Matcher matcher = DOMAIN_MODEL_ROLE_TYPE.matcher(referencedType);
        return matcher.matches()
                && feature.equals(matcher.group(1))
                && role.equals(matcher.group(3));
    }

    private static boolean isForeignPublishedType(String referencedType, String sourceFeature) {
        Matcher matcher = DOMAIN_PUBLISHED_TYPE.matcher(referencedType);
        return matcher.matches() && !sourceFeature.equals(matcher.group(1));
    }

    private static boolean isForeignRootApplicationServiceType(String referencedType, String sourceFeature) {
        Matcher matcher = DOMAIN_APPLICATION_SERVICE_TYPE.matcher(referencedType);
        return matcher.matches() && !sourceFeature.equals(matcher.group(1));
    }

    private static void collectShapeViolations(
            SourceRole sourceRole,
            CompilationUnitTree tree,
            Set<String> violations) {
        ClassTree topLevelClass = topLevelClass(tree);
        if (topLevelClass == null) {
            return;
        }
        TypeElement typeElement = ASTHelpers.getSymbol(topLevelClass);
        if (typeElement == null) {
            return;
        }
        switch (sourceRole.role()) {
            case MODEL -> collectModelShapeViolations(typeElement, violations);
            case CONSTANTS -> collectConstantsShapeViolations(topLevelClass, typeElement, violations);
            default -> {
                // No additional type-shape restrictions here.
            }
        }
    }

    private static void collectModelShapeViolations(TypeElement typeElement, Set<String> violations) {
        if (typeElement.getKind() == ElementKind.ENUM || typeElement.getKind() == ElementKind.RECORD) {
            return;
        }
        if (typeElement.getKind() != ElementKind.CLASS) {
            violations.add("uses non-class Model shape " + typeElement.getKind());
            return;
        }
        if (!typeElement.getModifiers().contains(Modifier.FINAL)) {
            violations.add("uses non-final Model class shape");
        }
        if (typeElement.getModifiers().contains(Modifier.ABSTRACT)) {
            violations.add("uses abstract Model class shape");
        }
    }

    private static void collectConstantsShapeViolations(
            ClassTree topLevelClass,
            TypeElement typeElement,
            Set<String> violations) {
        if (typeElement.getKind() == ElementKind.ENUM) {
            return;
        }
        if (typeElement.getKind() != ElementKind.CLASS) {
            violations.add("uses non-class/non-enum Constants shape " + typeElement.getKind());
            return;
        }
        if (!typeElement.getModifiers().contains(Modifier.FINAL)) {
            violations.add("uses non-final Constants class shape");
        }
        for (Tree member : topLevelClass.getMembers()) {
            if (member instanceof VariableTree variableTree) {
                Set<Modifier> modifiers = variableTree.getModifiers().getFlags();
                if (!modifiers.contains(Modifier.STATIC) || !modifiers.contains(Modifier.FINAL)) {
                    violations.add("owns non-static or mutable Constants field " + variableTree.getName());
                }
            } else if (member instanceof MethodTree methodTree) {
                if (methodTree.getReturnType() == null) {
                    if (!methodTree.getModifiers().getFlags().contains(Modifier.PRIVATE)) {
                        violations.add("exposes non-private Constants constructor");
                    }
                    continue;
                }
                String methodName = methodTree.getName().toString();
                if (!methodTree.getModifiers().getFlags().contains(Modifier.STATIC)
                        && !methodName.equals("toString")
                        && !methodName.equals("hashCode")
                        && !methodName.equals("equals")) {
                    violations.add("exposes instance Constants method " + methodName + "()");
                }
            }
        }
    }
}
