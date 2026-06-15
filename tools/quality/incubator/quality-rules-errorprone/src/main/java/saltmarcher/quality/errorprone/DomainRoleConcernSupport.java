package saltmarcher.quality.errorprone;

import com.google.errorprone.util.ASTHelpers;
import com.sun.source.tree.AssignmentTree;
import com.sun.source.tree.ClassTree;
import com.sun.source.tree.CompilationUnitTree;
import com.sun.source.tree.IdentifierTree;
import com.sun.source.tree.ImportTree;
import com.sun.source.tree.MemberSelectTree;
import com.sun.source.tree.MethodInvocationTree;
import com.sun.source.tree.MethodTree;
import com.sun.source.tree.NewClassTree;
import com.sun.source.tree.ParenthesizedTree;
import com.sun.source.tree.Tree;
import com.sun.source.tree.TypeCastTree;
import com.sun.source.tree.VariableTree;
import com.sun.source.util.TreeScanner;
import com.sun.tools.javac.code.Symbol;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.Map;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import javax.lang.model.element.ElementKind;
import javax.lang.model.element.Modifier;
import javax.lang.model.element.TypeElement;
import javax.lang.model.element.TypeParameterElement;
import javax.lang.model.type.TypeKind;
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

    private record ApplicationServiceCarrierScanContext(
            Symbol.MethodSymbol currentMethod,
            Symbol legalRootParameter,
            Map<Symbol, Set<String>> legalBoundaryCarrierLocals,
            boolean insideLegalBoundaryCarrierType
    ) {
    }

    private static final Pattern ROOT_PACKAGE = Pattern.compile("^src\\.domain\\.([^.]+)$");
    private static final Pattern ROOT_APPLICATION_PACKAGE = Pattern.compile("^src\\.domain\\.([^.]+)\\.application(\\..*)?$");
    private static final Pattern MODEL_TECHNICAL_ROLE_PACKAGE =
            Pattern.compile("^src\\.domain\\.([^.]+)\\.model\\.([^.]+)\\.(usecase|helper|constants|port|repository)(\\..*)?$");
    private static final Pattern INTERNAL_MODEL_PACKAGE =
            Pattern.compile("^src\\.domain\\.([^.]+)\\.model\\.([^.]+)(?:\\.(.*))?$");
    private static final Pattern PUBLISHED_PACKAGE = Pattern.compile("^src\\.domain\\.([^.]+)\\.published(\\..*)?$");
    private static final Pattern DOMAIN_APPLICATION_SERVICE_TYPE =
            Pattern.compile("^src\\.domain\\.([^.]+)\\.[^.]+ApplicationService$");
    private static final Pattern DOMAIN_ROOT_APPLICATION_USECASE_TYPE =
            Pattern.compile("^src\\.domain\\.([^.]+)\\.application\\.[^.]+UseCase$");
    private static final Pattern DOMAIN_ROOT_APPLICATION_USECASE_OWNED_TYPE =
            Pattern.compile("^src\\.domain\\.([^.]+)\\.application\\.[^.]+UseCase(?:[.$].*)?$");
    private static final Pattern DOMAIN_MODEL_ROLE_TYPE =
            Pattern.compile("^src\\.domain\\.([^.]+)\\.model\\.([^.]+)\\.(usecase|helper|constants|port|repository)\\..+");
    private static final Pattern DOMAIN_INTERNAL_MODEL_TYPE =
            Pattern.compile("^src\\.domain\\.([^.]+)\\.model\\.([^.]+)(?:\\.(.*))?$");
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
        if (sourceRole.role() == Role.MODEL) {
            collectExecutableProtocolSurfaceViolations(tree, violations);
        }
        for (String referencedType : DataArchitectureSupport.collectReferencedTypes(tree)) {
            if (referencedType == null
                    || referencedType.isBlank()
                    || isOwnTopLevelOrNestedTypeReference(sourceRole, referencedType)) {
                continue;
            }
            if (isExecutableProtocolType(referencedType) && sourceRole.role() == Role.MODEL) {
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
            if (sourceRole.role() == Role.APPLICATION_SERVICE
                    && isSameFeaturePublishedNonModelType(referencedType, sourceRole.feature())) {
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
        Matcher modelMatcher = MODEL_TECHNICAL_ROLE_PACKAGE.matcher(packageName);
        if (!modelMatcher.matches() || !"usecase".equals(modelMatcher.group(3))) {
            return null;
        }
        return new SourceRole(Role.USECASE, modelMatcher.group(1), modelMatcher.group(2), packageName, topLevelQualifiedName);
    }

    private static SourceRole describeModelRole(String packageName, String topLevelQualifiedName, Role role) {
        if (role == Role.MODEL) {
            Matcher matcher = INTERNAL_MODEL_PACKAGE.matcher(packageName);
            if (!matcher.matches() || isTechnicalModelRoleSegment(matcher.group(3))) {
                return null;
            }
            return new SourceRole(role, matcher.group(1), matcher.group(2), packageName, topLevelQualifiedName);
        }
        Matcher matcher = MODEL_TECHNICAL_ROLE_PACKAGE.matcher(packageName);
        if (!matcher.matches() || !matcher.group(3).equals(role.name().toLowerCase())) {
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

    private static void collectExecutableProtocolSurfaceViolations(
            CompilationUnitTree tree,
            Set<String> violations
    ) {
        ClassTree topLevelClass = topLevelClass(tree);
        if (topLevelClass == null) {
            return;
        }
        collectExecutableProtocolClassSurfaceViolations(topLevelClass, violations);
    }

    private static void collectExecutableProtocolClassSurfaceViolations(
            ClassTree classTree,
            Set<String> violations
    ) {
        TypeElement typeElement = ASTHelpers.getSymbol(classTree);
        if (typeElement != null) {
            for (TypeParameterElement typeParameter : typeElement.getTypeParameters()) {
                collectExecutableProtocolViolations(typeParameter.asType(), violations);
            }
            TypeMirror superclass = typeElement.getSuperclass();
            if (superclass != null && superclass.getKind() != TypeKind.NONE) {
                collectExecutableProtocolViolations(superclass, violations);
            }
            for (TypeMirror interfaceType : typeElement.getInterfaces()) {
                collectExecutableProtocolViolations(interfaceType, violations);
            }
        }
        for (Tree member : classTree.getMembers()) {
            if (member instanceof VariableTree variableTree) {
                Symbol symbol = ASTHelpers.getSymbol(variableTree);
                if (symbol != null) {
                    collectExecutableProtocolViolations(symbol.asType(), violations);
                }
                continue;
            }
            if (member instanceof MethodTree methodTree) {
                collectExecutableProtocolMethodViolations(methodTree, violations);
                continue;
            }
            if (member instanceof ClassTree nestedClassTree) {
                collectExecutableProtocolClassSurfaceViolations(nestedClassTree, violations);
            }
        }
    }

    private static void collectExecutableProtocolMethodViolations(
            MethodTree methodTree,
            Set<String> violations
    ) {
        Symbol.MethodSymbol methodSymbol = ASTHelpers.getSymbol(methodTree);
        if (methodSymbol == null) {
            return;
        }
        if (!methodSymbol.isConstructor()) {
            collectExecutableProtocolViolations(methodSymbol.getReturnType(), violations);
        }
        for (TypeMirror thrownType : methodSymbol.getThrownTypes()) {
            collectExecutableProtocolViolations(thrownType, violations);
        }
        for (Symbol.TypeVariableSymbol typeParameter : methodSymbol.getTypeParameters()) {
            collectExecutableProtocolViolations(typeParameter.asType(), violations);
        }
        for (Symbol.VarSymbol parameter : methodSymbol.getParameters()) {
            collectExecutableProtocolViolations(parameter.asType(), violations);
        }
    }

    private static void collectExecutableProtocolViolations(
            TypeMirror typeMirror,
            Set<String> violations
    ) {
        for (String referencedType : collectTypeReferences(typeMirror)) {
            if (isExecutableProtocolType(referencedType)) {
                violations.add("references executable protocol type " + referencedType);
            }
        }
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
                || isForeignRootApplicationServiceType(referencedType, sourceRole.feature())
                || isForeignPublishedNonModelType(referencedType, sourceRole.feature());
    }

    private static boolean isSameFeatureUseCaseType(String referencedType, String feature) {
        Matcher rootMatcher = DOMAIN_ROOT_APPLICATION_USECASE_TYPE.matcher(referencedType);
        if (rootMatcher.matches()) {
            return feature.equals(rootMatcher.group(1));
        }
        if (isSameFeatureRootUseCaseOwnedType(referencedType, feature)) {
            return true;
        }
        Matcher modelMatcher = DOMAIN_MODEL_ROLE_TYPE.matcher(referencedType);
        return modelMatcher.matches()
                && feature.equals(modelMatcher.group(1))
                && "usecase".equals(modelMatcher.group(3));
    }

    private static boolean isSameFeatureModelRoleType(String referencedType, String feature, String role) {
        if ("model".equals(role)) {
            Matcher matcher = DOMAIN_INTERNAL_MODEL_TYPE.matcher(referencedType);
            return matcher.matches()
                    && feature.equals(matcher.group(1))
                    && !isTechnicalModelRoleSegment(matcher.group(3));
        }
        Matcher matcher = DOMAIN_MODEL_ROLE_TYPE.matcher(referencedType);
        return matcher.matches()
                && feature.equals(matcher.group(1))
                && role.equals(matcher.group(3));
    }

    private static boolean isTechnicalModelRoleSegment(String suffix) {
        if (suffix == null || suffix.isBlank()) {
            return false;
        }
        int separator = suffix.indexOf('.');
        String segment = separator < 0 ? suffix : suffix.substring(0, separator);
        return Set.of("usecase", "helper", "constants", "port", "repository").contains(segment);
    }

    private static boolean isForeignPublishedType(String referencedType, String sourceFeature) {
        Matcher matcher = DOMAIN_PUBLISHED_TYPE.matcher(referencedType);
        return matcher.matches() && !sourceFeature.equals(matcher.group(1));
    }

    private static boolean isForeignPublishedNonModelType(String referencedType, String sourceFeature) {
        return isForeignPublishedType(referencedType, sourceFeature)
                && !DOMAIN_PUBLISHED_MODEL_TYPE.matcher(referencedType).matches();
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
            case APPLICATION_SERVICE -> collectApplicationServicePublishedCarrierPositionViolations(
                    sourceRole, topLevelClass, typeElement, violations);
            case MODEL -> collectModelShapeViolations(typeElement, violations);
            case CONSTANTS -> collectConstantsShapeViolations(topLevelClass, typeElement, violations);
            default -> {
                // No additional type-shape restrictions here.
            }
        }
    }

    private static void collectApplicationServicePublishedCarrierPositionViolations(
            SourceRole sourceRole,
            ClassTree topLevelClass,
            TypeElement typeElement,
            Set<String> violations) {
        for (TypeMirror typeParameter : typeElement.getTypeParameters().stream()
                .map(typeParameterElement -> typeParameterElement.asType())
                .toList()) {
            addApplicationServicePublishedCarrierViolations(
                    sourceRole, typeParameter, "type parameter bound", violations);
        }
        new TreeScanner<Void, ApplicationServiceCarrierScanContext>() {
            @Override
            public Void scan(Tree currentTree, ApplicationServiceCarrierScanContext context) {
                return super.scan(currentTree, context);
            }

            @Override
            public Void visitImport(ImportTree importTree, ApplicationServiceCarrierScanContext context) {
                return null;
            }

            @Override
            public Void visitMethodInvocation(
                    MethodInvocationTree methodInvocation,
                    ApplicationServiceCarrierScanContext context) {
                if (isLegalBoundaryCarrierRead(methodInvocation, context)) {
                    return null;
                }
                if (!isLegalApplicationServiceBoundaryAdapterInvocation(sourceRole, methodInvocation)) {
                    addApplicationServiceForwardedCarrierArgumentViolations(
                            sourceRole,
                            methodInvocation.getArguments(),
                            "method argument " + methodInvocationName(methodInvocation),
                            context,
                            violations);
                }
                return super.visitMethodInvocation(methodInvocation, context);
            }

            @Override
            public Void visitNewClass(
                    NewClassTree newClassTree,
                    ApplicationServiceCarrierScanContext context) {
                addApplicationServiceForwardedCarrierArgumentViolations(
                        sourceRole,
                        newClassTree.getArguments(),
                        "constructor argument " + newClassTree.getIdentifier(),
                        context,
                        violations);
                return super.visitNewClass(newClassTree, context);
            }

            @Override
            public Void visitAssignment(
                    AssignmentTree assignmentTree,
                    ApplicationServiceCarrierScanContext context) {
                Symbol symbol = expressionSymbol(assignmentTree.getVariable());
                Symbol.MethodSymbol currentMethod = context == null ? null : context.currentMethod();
                if (context != null
                        && symbol != null
                        && symbol.owner == currentMethod
                        && isLegalApplicationServiceBoundaryAdapterLocalCarrierAlias(
                                sourceRole,
                                assignmentTree.getExpression(),
                                currentMethod,
                                context)) {
                    context.legalBoundaryCarrierLocals().put(
                            symbol,
                            boundaryCarrierOriginTypes(null, assignmentTree.getExpression(), context));
                }
                return super.visitAssignment(assignmentTree, context);
            }

            @Override
            public Void visitMemberSelect(
                    MemberSelectTree memberSelect,
                    ApplicationServiceCarrierScanContext context) {
                if (isLegalBoundaryCarrierRead(memberSelect, context)) {
                    return null;
                }
                Symbol symbol = ASTHelpers.getSymbol(memberSelect);
                if (isApplicationServicePublishedCarrierTypeUseSymbol(symbol, context)) {
                    addApplicationServicePublishedCarrierViolations(
                            sourceRole,
                            symbol.asType(),
                            "type use " + memberSelect.getKind(),
                            violations);
                }
                return super.visitMemberSelect(memberSelect, context);
            }

            @Override
            public Void visitIdentifier(
                    IdentifierTree identifierTree,
                    ApplicationServiceCarrierScanContext context) {
                if (!isInsideLegalBoundaryCarrierType(context)) {
                    Symbol symbol = ASTHelpers.getSymbol(identifierTree);
                    if (isApplicationServicePublishedCarrierTypeUseSymbol(symbol, context)) {
                        addApplicationServicePublishedCarrierViolations(
                                sourceRole,
                                symbol.asType(),
                                "type use " + identifierTree.getKind(),
                                violations);
                    }
                }
                return super.visitIdentifier(identifierTree, context);
            }

            @Override
            public Void visitMethod(MethodTree methodTree, ApplicationServiceCarrierScanContext ignored) {
                Symbol.MethodSymbol methodSymbol = ASTHelpers.getSymbol(methodTree);
                if (methodSymbol == null) {
                    return super.visitMethod(methodTree, nullContext());
                }
                if (!methodSymbol.isConstructor()) {
                    addApplicationServicePublishedCarrierViolations(
                            sourceRole, methodSymbol.getReturnType(),
                            "method return type " + methodSymbol.getSimpleName(), violations);
                    for (TypeMirror thrownType : methodSymbol.getThrownTypes()) {
                        addApplicationServicePublishedCarrierViolations(
                                sourceRole, thrownType,
                                "method thrown type " + methodSymbol.getSimpleName(), violations);
                    }
                    for (Symbol.TypeVariableSymbol typeParameter : methodSymbol.getTypeParameters()) {
                        addApplicationServicePublishedCarrierViolations(
                                sourceRole, typeParameter.asType(),
                                "method type parameter bound " + methodSymbol.getSimpleName(), violations);
                    }
                }
                return super.visitMethod(methodTree, new ApplicationServiceCarrierScanContext(
                        methodSymbol,
                        legalRootParameter(sourceRole, methodSymbol),
                        new LinkedHashMap<>(),
                        false));
            }

            @Override
            public Void visitVariable(
                    VariableTree variableTree,
                    ApplicationServiceCarrierScanContext context) {
                Symbol symbol = ASTHelpers.getSymbol(variableTree);
                Symbol.MethodSymbol currentMethod = context == null ? null : context.currentMethod();
                if (symbol != null) {
                    String position = applicationServiceVariablePosition(variableTree, symbol, currentMethod);
                    boolean legalRootParameter = isLegalApplicationServicePublishedCarrierParameter(
                            sourceRole, symbol, currentMethod);
                    if (legalRootParameter) {
                        scan(variableTree.getType(), new ApplicationServiceCarrierScanContext(
                                currentMethod,
                                symbol,
                                context == null ? new LinkedHashMap<>() : context.legalBoundaryCarrierLocals(),
                                true));
                        scan(variableTree.getInitializer(), context);
                        return null;
                    }
                    boolean legalBoundaryAlias = isLegalApplicationServiceBoundaryAdapterLocalCarrierAlias(
                            sourceRole,
                            variableTree.getInitializer(),
                            currentMethod,
                            context);
                    if (legalBoundaryAlias) {
                        if (context != null) {
                            context.legalBoundaryCarrierLocals().put(
                                    symbol,
                                    boundaryCarrierOriginTypes(symbol.asType(), variableTree.getInitializer(), context));
                        }
                        scan(variableTree.getType(), new ApplicationServiceCarrierScanContext(
                                currentMethod,
                                context == null ? null : context.legalRootParameter(),
                                context == null ? new LinkedHashMap<>() : context.legalBoundaryCarrierLocals(),
                                true));
                        scan(variableTree.getInitializer(), context);
                        return null;
                    }
                    addApplicationServicePublishedCarrierViolations(
                            sourceRole, symbol.asType(), position, violations);
                }
                return super.visitVariable(variableTree, context);
            }
        }.scan(topLevelClass, nullContext());
    }

    private static ApplicationServiceCarrierScanContext nullContext() {
        return new ApplicationServiceCarrierScanContext(null, null, new LinkedHashMap<>(), false);
    }

    private static boolean isInsideLegalBoundaryCarrierType(ApplicationServiceCarrierScanContext context) {
        return context != null && context.insideLegalBoundaryCarrierType();
    }

    private static boolean isLegalBoundaryCarrierSymbol(
            Symbol symbol,
            ApplicationServiceCarrierScanContext context) {
        return context != null
                && ((context.legalRootParameter() != null && symbol == context.legalRootParameter())
                || context.legalBoundaryCarrierLocals().containsKey(symbol));
    }

    private static boolean isLegalRootParameterTypeSymbol(
            Symbol symbol,
            ApplicationServiceCarrierScanContext context) {
        if (context == null || context.legalRootParameter() == null) {
            return false;
        }
        String symbolTypeName = symbol.asType().toString();
        return collectTypeReferences(context.legalRootParameter().asType()).contains(symbolTypeName);
    }

    private static void addApplicationServiceForwardedCarrierArgumentViolations(
            SourceRole sourceRole,
            Iterable<? extends Tree> arguments,
            String position,
            ApplicationServiceCarrierScanContext context,
            Set<String> violations) {
        if (context == null) {
            return;
        }
        for (Tree argument : arguments) {
            if (isRootedInLegalBoundaryCarrier(argument, context)) {
                Set<String> referencedTypes = new LinkedHashSet<>();
                TypeMirror argumentType = expressionValueType(argument);
                if (argumentType != null) {
                    referencedTypes.addAll(collectTypeReferences(argumentType));
                }
                Symbol argumentSymbol = expressionSymbol(argument);
                if (argumentSymbol != null) {
                    referencedTypes.addAll(context.legalBoundaryCarrierLocals().getOrDefault(
                            argumentSymbol,
                            Set.of()));
                }
                addApplicationServicePublishedCarrierViolations(sourceRole, referencedTypes, position, violations);
            }
        }
    }

    private static boolean isApplicationServicePublishedCarrierTypeUseSymbol(
            Symbol symbol,
            ApplicationServiceCarrierScanContext context) {
        if (symbol == null
                || symbol.getKind() == ElementKind.METHOD
                || symbol.getKind() == ElementKind.CONSTRUCTOR) {
            return false;
        }
        return !isLegalBoundaryCarrierSymbol(symbol, context)
                && !isLegalRootParameterTypeSymbol(symbol, context);
    }

    private static boolean isLegalBoundaryCarrierRead(
            Tree currentTree,
            ApplicationServiceCarrierScanContext context) {
        if (context == null || context.legalRootParameter() == null) {
            return false;
        }
        if (currentTree instanceof MethodInvocationTree methodInvocation) {
            return isRequireNonNullOnLegalRootParameter(methodInvocation, context.legalRootParameter())
                    || isRootedInLegalBoundaryCarrier(methodInvocation.getMethodSelect(), context);
        }
        if (currentTree instanceof MemberSelectTree memberSelect) {
            return isRootedInLegalBoundaryCarrier(memberSelect.getExpression(), context);
        }
        return false;
    }

    private static boolean isLegalApplicationServiceBoundaryAdapterInvocation(
            SourceRole sourceRole,
            MethodInvocationTree methodInvocation) {
        Symbol symbol = ASTHelpers.getSymbol(methodInvocation);
        if (!(symbol instanceof Symbol.MethodSymbol methodSymbol)) {
            return false;
        }
        return isApplicationServiceBoundaryAdapterMethod(sourceRole, methodSymbol);
    }

    private static String methodInvocationName(MethodInvocationTree methodInvocation) {
        Symbol symbol = ASTHelpers.getSymbol(methodInvocation);
        return symbol == null ? methodInvocation.getMethodSelect().toString() : symbol.getSimpleName().toString();
    }

    private static boolean isRequireNonNullOnLegalRootParameter(
            MethodInvocationTree methodInvocation,
            Symbol legalRootParameter) {
        Symbol symbol = ASTHelpers.getSymbol(methodInvocation);
        if (symbol == null
                || !"requireNonNull".contentEquals(symbol.getSimpleName())
                || !"java.util.Objects".equals(ownerTypeName(symbol))
                || methodInvocation.getArguments().isEmpty()) {
            return false;
        }
        return ASTHelpers.getSymbol(methodInvocation.getArguments().getFirst()) == legalRootParameter;
    }

    private static boolean isRootedInLegalBoundaryCarrier(
            Tree tree,
            ApplicationServiceCarrierScanContext context) {
        if (tree instanceof IdentifierTree identifierTree) {
            return isLegalBoundaryCarrierSymbol(ASTHelpers.getSymbol(identifierTree), context);
        }
        tree = unwrapExpression(tree);
        if (tree instanceof IdentifierTree identifierTree) {
            return isLegalBoundaryCarrierSymbol(ASTHelpers.getSymbol(identifierTree), context);
        }
        if (tree instanceof MemberSelectTree memberSelectTree) {
            return isRootedInLegalBoundaryCarrier(memberSelectTree.getExpression(), context);
        }
        if (tree instanceof MethodInvocationTree methodInvocationTree) {
            return isRootedInLegalBoundaryCarrier(methodInvocationTree.getMethodSelect(), context);
        }
        return false;
    }

    private static Symbol legalRootParameter(SourceRole sourceRole, Symbol.MethodSymbol currentMethod) {
        if (currentMethod == null
                || currentMethod.isConstructor()
                || currentMethod.getParameters().size() != 1) {
            return null;
        }
        Symbol parameter = currentMethod.getParameters().getFirst();
        return isLegalApplicationServicePublishedCarrierParameter(sourceRole, parameter, currentMethod)
                ? parameter
                : null;
    }

    private static String applicationServiceVariablePosition(
            VariableTree variableTree,
            Symbol symbol,
            Symbol.MethodSymbol currentMethod) {
        if (currentMethod == null) {
            return "field " + variableTree.getName();
        }
        if (symbol.owner == currentMethod && symbol.getKind() == ElementKind.PARAMETER) {
            if (currentMethod.isConstructor()) {
                return "constructor parameter " + variableTree.getName();
            }
            return "method parameter " + currentMethod.getSimpleName() + "." + variableTree.getName();
        }
        return "local variable " + variableTree.getName();
    }

    private static boolean isLegalApplicationServicePublishedCarrierParameter(
            SourceRole sourceRole,
            Symbol symbol,
            Symbol.MethodSymbol currentMethod) {
        if (currentMethod == null
                || currentMethod.isConstructor()
                || symbol.owner != currentMethod
                || symbol.getKind() != ElementKind.PARAMETER
                || currentMethod.getParameters().size() != 1
                || !currentMethod.getParameters().get(0).equals(symbol)) {
            return false;
        }
        Set<Modifier> modifiers = currentMethod.getModifiers();
        if (modifiers.contains(Modifier.PUBLIC) || modifiers.contains(Modifier.PROTECTED)) {
            return true;
        }
        return sourceRole != null
                && modifiers.contains(Modifier.PRIVATE)
                && modifiers.contains(Modifier.STATIC)
                && isApplicationServiceBoundaryAdapterName(currentMethod)
                && isDirectSameFeaturePublishedCommandParameter(symbol, sourceRole.feature());
    }

    private static boolean isLegalApplicationServiceBoundaryAdapterLocalCarrierAlias(
            SourceRole sourceRole,
            Tree initializer,
            Symbol.MethodSymbol currentMethod,
            ApplicationServiceCarrierScanContext context) {
        if (sourceRole == null
                || initializer == null
                || !isApplicationServiceBoundaryAdapterMethod(sourceRole, currentMethod)
                || !isRootedInLegalBoundaryCarrier(initializer, context)) {
            return false;
        }
        return boundaryCarrierOriginTypes(null, initializer, context).stream()
                .anyMatch(typeName -> isSameFeaturePublishedNonModelType(typeName, sourceRole.feature())
                        && !typeName.endsWith("Command"));
    }

    private static Set<String> boundaryCarrierOriginTypes(
            TypeMirror declaredType,
            Tree initializer,
            ApplicationServiceCarrierScanContext context) {
        Set<String> referencedTypes = new LinkedHashSet<>();
        if (declaredType != null) {
            referencedTypes.addAll(collectTypeReferences(declaredType));
        }
        if (initializer != null) {
            Tree unwrappedInitializer = unwrapExpression(initializer);
            TypeMirror initializerType = expressionValueType(unwrappedInitializer);
            if (initializerType != null) {
                referencedTypes.addAll(collectTypeReferences(initializerType));
            }
            Symbol initializerSymbol = expressionSymbol(unwrappedInitializer);
            if (context != null && initializerSymbol != null) {
                referencedTypes.addAll(context.legalBoundaryCarrierLocals().getOrDefault(
                        initializerSymbol,
                        Set.of()));
            }
        }
        return referencedTypes;
    }

    private static TypeMirror expressionValueType(Tree tree) {
        tree = unwrapExpression(tree);
        if (tree instanceof MethodInvocationTree methodInvocation) {
            Symbol symbol = ASTHelpers.getSymbol(methodInvocation);
            if (symbol instanceof Symbol.MethodSymbol methodSymbol) {
                return methodSymbol.getReturnType();
            }
            Symbol selectSymbol = ASTHelpers.getSymbol(methodInvocation.getMethodSelect());
            if (selectSymbol instanceof Symbol.MethodSymbol methodSymbol) {
                return methodSymbol.getReturnType();
            }
        }
        TypeMirror treeType = ASTHelpers.getType(tree);
        if (treeType != null) {
            return treeType;
        }
        Symbol symbol = ASTHelpers.getSymbol(tree);
        return symbol == null ? null : symbol.asType();
    }

    private static Symbol expressionSymbol(Tree tree) {
        return ASTHelpers.getSymbol(unwrapExpression(tree));
    }

    private static Tree unwrapExpression(Tree tree) {
        Tree current = tree;
        while (current instanceof ParenthesizedTree || current instanceof TypeCastTree) {
            if (current instanceof ParenthesizedTree parenthesizedTree) {
                current = parenthesizedTree.getExpression();
            } else {
                current = ((TypeCastTree) current).getExpression();
            }
        }
        return current;
    }

    private static boolean isApplicationServiceBoundaryAdapterMethod(
            SourceRole sourceRole,
            Symbol.MethodSymbol currentMethod) {
        return currentMethod != null
                && currentMethod.getModifiers().contains(Modifier.PRIVATE)
                && currentMethod.getModifiers().contains(Modifier.STATIC)
                && isApplicationServiceBoundaryAdapterName(currentMethod)
                && currentMethod.getParameters().size() == 1
                && isDirectSameFeaturePublishedCommandParameter(
                        currentMethod.getParameters().getFirst(),
                        sourceRole.feature());
    }

    private static boolean isApplicationServiceBoundaryAdapterName(Symbol.MethodSymbol currentMethod) {
        String name = currentMethod.getSimpleName().toString();
        return name.startsWith("to") || name.startsWith("from");
    }

    private static boolean isDirectSameFeaturePublishedCommandParameter(Symbol symbol, String feature) {
        String parameterType = symbol.asType().toString();
        return isSameFeaturePublishedNonModelType(parameterType, feature)
                && parameterType.endsWith("Command");
    }

    private static String ownerTypeName(Symbol symbol) {
        if (symbol.owner instanceof Symbol.ClassSymbol classSymbol) {
            return classSymbol.getQualifiedName().toString();
        }
        return null;
    }

    private static void addApplicationServicePublishedCarrierViolations(
            SourceRole sourceRole,
            TypeMirror typeMirror,
            String position,
            Set<String> violations) {
        addApplicationServicePublishedCarrierViolations(
                sourceRole, collectTypeReferences(typeMirror), position, violations);
    }

    private static void addApplicationServicePublishedCarrierViolations(
            SourceRole sourceRole,
            Set<String> referencedTypes,
            String position,
            Set<String> violations) {
        for (String referencedType : referencedTypes) {
            if (isSameFeaturePublishedNonModelType(referencedType, sourceRole.feature())) {
                violations.add("uses same-feature published non-model carrier " + referencedType
                        + " outside the single public/protected root method parameter at " + position);
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
