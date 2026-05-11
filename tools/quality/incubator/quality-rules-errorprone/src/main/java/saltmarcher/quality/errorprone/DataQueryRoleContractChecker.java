package saltmarcher.quality.errorprone;

import com.google.errorprone.BugPattern;
import com.google.errorprone.VisitorState;
import com.google.errorprone.bugpatterns.BugChecker;
import com.google.errorprone.matchers.Description;
import com.google.errorprone.util.ASTHelpers;
import com.sun.source.tree.ClassTree;
import com.sun.tools.javac.code.Type;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import javax.lang.model.element.ElementKind;
import javax.lang.model.element.ExecutableElement;
import javax.lang.model.element.Modifier;
import javax.lang.model.element.TypeElement;
import javax.lang.model.element.VariableElement;
import javax.lang.model.type.DeclaredType;
import javax.lang.model.type.TypeMirror;
import javax.lang.model.util.ElementFilter;

@BugPattern(
        name = "DataQueryRoleContract",
        summary = "Query port adapters implement matching own-feature read-only domain ports.",
        severity = BugPattern.SeverityLevel.ERROR)
public final class DataQueryRoleContractChecker extends BugChecker implements BugChecker.ClassTreeMatcher {

    @Override
    public Description matchClass(ClassTree tree, VisitorState state) {
        String packageName = DataArchitectureSupport.packageName(state.getPath().getCompilationUnit());
        java.util.regex.Matcher queryMatcher = DataArchitectureSupport.QUERY_PACKAGE.matcher(packageName);
        if (!queryMatcher.matches()) {
            return Description.NO_MATCH;
        }
        String featureName = queryMatcher.group(1);

        TypeElement typeElement = ASTHelpers.getSymbol(tree);
        if (typeElement == null) {
            return Description.NO_MATCH;
        }

        Set<String> referencedTypes = inheritedTypeReferences(typeElement);
        List<DomainContract> domainContracts = referencedTypes.stream()
                .map(DomainContract::from)
                .filter(contract -> contract != null)
                .toList();

        List<String> violations = new ArrayList<>();
        if (isPublicNonAdapterBoundaryType(typeElement)) {
            violations.add("Query package declares public non-adapter boundary type "
                    + typeElement.getQualifiedName()
                    + "; data query packages contain read-port adapters, while contracts and carriers belong in the owning domain port or published boundary.");
        }
        for (DomainContract contract : domainContracts) {
            if (!contract.featureName().equals(featureName)) {
                violations.add("Query adapter depends on foreign domain contract " + contract.qualifiedName());
            } else if (!contract.isReadOnlyContract()) {
                violations.add("Query adapter depends on wrong domain contract role " + contract.qualifiedName());
            }
        }
        if (isPublicConcrete(typeElement) && domainContracts.stream().noneMatch(contract -> contract.isOwnExpectedContract(featureName))) {
            violations.add("Query adapter must satisfy one own-feature read-only domain port contract.");
        }
        if (isPublicConcrete(typeElement)) {
            violations.addAll(exposedMethodViolations(typeElement, featureName, state));
        }

        if (violations.isEmpty()) {
            return Description.NO_MATCH;
        }

        return buildDescription(tree)
                .setMessage("Data query port-adapter contract violation in '" + tree.getSimpleName()
                        + "': " + String.join("; ", violations))
                .build();
    }

    private static Set<String> inheritedTypeReferences(TypeElement typeElement) {
        Set<String> referencedTypes = new LinkedHashSet<>();
        Set<String> visitedTypes = new LinkedHashSet<>();
        collectInheritedTypes(typeElement.getSuperclass(), referencedTypes, visitedTypes);
        for (TypeMirror implementedInterface : typeElement.getInterfaces()) {
            collectInheritedTypes(implementedInterface, referencedTypes, visitedTypes);
        }
        return referencedTypes;
    }

    private static void collectInheritedTypes(
            TypeMirror typeMirror,
            Set<String> referencedTypes,
            Set<String> visitedTypes
    ) {
        if (typeMirror == null || "java.lang.Object".contentEquals(typeMirror.toString())) {
            return;
        }
        DataArchitectureSupport.collectTypeReferences(typeMirror, referencedTypes);
        if (!(typeMirror instanceof DeclaredType declaredType)
                || !(declaredType.asElement() instanceof TypeElement typeElement)) {
            return;
        }
        String qualifiedName = typeElement.getQualifiedName().toString();
        if (!visitedTypes.add(qualifiedName)) {
            return;
        }
        collectInheritedTypes(typeElement.getSuperclass(), referencedTypes, visitedTypes);
        for (TypeMirror implementedInterface : typeElement.getInterfaces()) {
            collectInheritedTypes(implementedInterface, referencedTypes, visitedTypes);
        }
    }

    private static boolean isPublicConcrete(TypeElement typeElement) {
        return typeElement.getKind() == ElementKind.CLASS
                && typeElement.getModifiers().contains(Modifier.PUBLIC)
                && !typeElement.getModifiers().contains(Modifier.ABSTRACT);
    }

    private static boolean isPublicNonAdapterBoundaryType(TypeElement typeElement) {
        return typeElement.getModifiers().contains(Modifier.PUBLIC)
                && !isPublicConcrete(typeElement);
    }

    private static List<String> exposedMethodViolations(
            TypeElement typeElement,
            String featureName,
            VisitorState state
    ) {
        Set<String> contractMethodSignatures = new LinkedHashSet<>();
        Set<String> visitedContracts = new LinkedHashSet<>();
        for (TypeElement contractType : ownExpectedContractTypes(typeElement, featureName)) {
            collectContractMethodSignatures(contractType, contractMethodSignatures, visitedContracts, state);
        }
        if (contractMethodSignatures.isEmpty()) {
            return List.of();
        }

        List<String> violations = new ArrayList<>();
        for (ExposedMethod method : exposedMethods(typeElement)) {
            String signature = methodSignature(method.method(), state);
            if (!contractMethodSignatures.contains(signature)) {
                violations.add("Query adapter exposes public/protected method "
                        + method.method().getSimpleName()
                        + method.originDescription()
                        + " that is not declared by an own-feature read-only domain port contract");
            }
        }
        return violations;
    }

    private static List<ExposedMethod> exposedMethods(TypeElement typeElement) {
        List<ExposedMethod> methods = new ArrayList<>();
        collectExposedMethods(typeElement, typeElement, methods, new LinkedHashSet<>());
        return methods;
    }

    private static void collectExposedMethods(
            TypeElement ownerType,
            TypeElement currentType,
            List<ExposedMethod> methods,
            Set<String> visitedTypes
    ) {
        String qualifiedName = currentType.getQualifiedName().toString();
        if (!visitedTypes.add(qualifiedName) || "java.lang.Object".equals(qualifiedName)) {
            return;
        }
        boolean inherited = !currentType.equals(ownerType);
        for (ExecutableElement method : ElementFilter.methodsIn(currentType.getEnclosedElements())) {
            if (isPublicOrProtected(method) && (!inherited || !method.getModifiers().contains(Modifier.STATIC))) {
                methods.add(new ExposedMethod(method, inherited ? currentType : null));
            }
        }
        TypeMirror superclass = currentType.getSuperclass();
        if (superclass instanceof DeclaredType declaredType
                && declaredType.asElement() instanceof TypeElement superclassElement) {
            collectExposedMethods(ownerType, superclassElement, methods, visitedTypes);
        }
    }

    private static Set<TypeElement> ownExpectedContractTypes(TypeElement typeElement, String featureName) {
        Set<TypeElement> contractTypes = new LinkedHashSet<>();
        Set<String> visitedTypes = new LinkedHashSet<>();
        collectOwnExpectedContractTypes(typeElement.getSuperclass(), featureName, contractTypes, visitedTypes);
        for (TypeMirror implementedInterface : typeElement.getInterfaces()) {
            collectOwnExpectedContractTypes(implementedInterface, featureName, contractTypes, visitedTypes);
        }
        return contractTypes;
    }

    private static void collectOwnExpectedContractTypes(
            TypeMirror typeMirror,
            String featureName,
            Set<TypeElement> contractTypes,
            Set<String> visitedTypes
    ) {
        if (typeMirror == null || "java.lang.Object".contentEquals(typeMirror.toString())) {
            return;
        }
        if (!(typeMirror instanceof DeclaredType declaredType)
                || !(declaredType.asElement() instanceof TypeElement typeElement)) {
            return;
        }
        String qualifiedName = typeElement.getQualifiedName().toString();
        if (!visitedTypes.add(qualifiedName)) {
            return;
        }
        DomainContract contract = DomainContract.from(qualifiedName);
        if (contract != null && contract.isOwnExpectedContract(featureName)) {
            contractTypes.add(typeElement);
        }
        collectOwnExpectedContractTypes(typeElement.getSuperclass(), featureName, contractTypes, visitedTypes);
        for (TypeMirror implementedInterface : typeElement.getInterfaces()) {
            collectOwnExpectedContractTypes(implementedInterface, featureName, contractTypes, visitedTypes);
        }
    }

    private static void collectContractMethodSignatures(
            TypeElement contractType,
            Set<String> methodSignatures,
            Set<String> visitedContracts,
            VisitorState state
    ) {
        String qualifiedName = contractType.getQualifiedName().toString();
        if (!visitedContracts.add(qualifiedName)) {
            return;
        }
        for (ExecutableElement method : ElementFilter.methodsIn(contractType.getEnclosedElements())) {
            if (!method.getModifiers().contains(Modifier.STATIC)) {
                methodSignatures.add(methodSignature(method, state));
            }
        }
        collectSuperContractMethodSignatures(contractType.getSuperclass(), methodSignatures, visitedContracts, state);
        for (TypeMirror implementedInterface : contractType.getInterfaces()) {
            collectSuperContractMethodSignatures(implementedInterface, methodSignatures, visitedContracts, state);
        }
    }

    private static void collectSuperContractMethodSignatures(
            TypeMirror typeMirror,
            Set<String> methodSignatures,
            Set<String> visitedContracts,
            VisitorState state
    ) {
        if (!(typeMirror instanceof DeclaredType declaredType)
                || !(declaredType.asElement() instanceof TypeElement typeElement)) {
            return;
        }
        collectContractMethodSignatures(typeElement, methodSignatures, visitedContracts, state);
    }

    private static boolean isPublicOrProtected(ExecutableElement method) {
        return method.getModifiers().contains(Modifier.PUBLIC)
                || method.getModifiers().contains(Modifier.PROTECTED);
    }

    private static String methodSignature(ExecutableElement method, VisitorState state) {
        List<String> parameterTypes = new ArrayList<>();
        for (VariableElement parameter : method.getParameters()) {
            parameterTypes.add(erasedTypeName(parameter.asType(), state));
        }
        return method.getSimpleName() + "(" + String.join(",", parameterTypes) + ")";
    }

    private static String erasedTypeName(TypeMirror typeMirror, VisitorState state) {
        if (typeMirror instanceof Type javacType) {
            return state.getTypes().erasure(javacType).toString();
        }
        return typeMirror.toString();
    }

    private record ExposedMethod(ExecutableElement method, TypeElement inheritedFrom) {

        private String originDescription() {
            return inheritedFrom == null ? "" : " inherited from " + inheritedFrom.getQualifiedName();
        }
    }

    private record DomainContract(String qualifiedName, String featureName, boolean readOnlyContract) {

        private static DomainContract from(String referencedType) {
            if (!DataArchitectureSupport.isDomainType(referencedType)) {
                return null;
            }
            Boolean readOnlyContract = readOnlyContract(referencedType);
            if (readOnlyContract == null) {
                return null;
            }
            String featureName = featureName(referencedType);
            return featureName == null ? null : new DomainContract(referencedType, featureName, readOnlyContract);
        }

        private boolean isReadOnlyContract() {
            return readOnlyContract;
        }

        private boolean isOwnExpectedContract(String ownFeatureName) {
            return readOnlyContract && featureName.equals(ownFeatureName);
        }

        private static Boolean readOnlyContract(String referencedType) {
            String simpleName = simpleName(referencedType);
            if (simpleName.endsWith("Repository")) {
                return false;
            }
            if (simpleName.endsWith("Lookup")
                    || simpleName.endsWith("Catalog")
                    || simpleName.endsWith("Port")
                    || simpleName.endsWith("Search")) {
                return true;
            }
            return null;
        }

        private static String featureName(String referencedType) {
            String prefix = "src.domain.";
            if (!referencedType.startsWith(prefix)) {
                return null;
            }
            String remainder = referencedType.substring(prefix.length());
            int separator = remainder.indexOf('.');
            return separator < 0 ? remainder : remainder.substring(0, separator);
        }

        private static String simpleName(String referencedType) {
            int separatorIndex = referencedType.lastIndexOf('.');
            return separatorIndex < 0 ? referencedType : referencedType.substring(separatorIndex + 1);
        }
    }
}
