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
        name = "DataAdapterRoleContract",
        summary = "Repository/query port adapters implement the matching domain-owned outbound port roles.",
        severity = BugPattern.SeverityLevel.ERROR)
public final class DataAdapterRoleContractChecker extends BugChecker implements BugChecker.ClassTreeMatcher {

    @Override
    public Description matchClass(ClassTree tree, VisitorState state) {
        String packageName = DataArchitectureSupport.packageName(state.getPath().getCompilationUnit());
        AdapterRole role = AdapterRole.fromPackage(packageName);
        if (role == null && !packageName.startsWith("src.data.")) {
            return Description.NO_MATCH;
        }

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
        if (role == null) {
            for (DomainContract contract : domainContracts) {
                violations.add("domain adapter contract " + contract.qualifiedName()
                        + " is implemented outside repository/ or query/");
            }
        } else {
            if (isPublicNonAdapterBoundaryType(typeElement)) {
                violations.add(role.diagnosticName + " package declares public non-adapter boundary type "
                        + typeElement.getQualifiedName()
                        + "; data repository/query packages contain port adapters, while contracts and carriers belong in the owning domain port or published boundary.");
            }
            for (DomainContract contract : domainContracts) {
                if (!contract.featureName().equals(role.featureName())) {
                    violations.add(role.diagnosticName + " adapter depends on foreign domain contract "
                            + contract.qualifiedName());
                } else if (!role.acceptsContractRole(contract.role())) {
                    violations.add(role.diagnosticName + " adapter depends on wrong domain contract role "
                            + contract.qualifiedName());
                }
            }
            if (isPublicConcrete(typeElement) && domainContracts.stream().noneMatch(role::isOwnExpectedContract)) {
                violations.add(role.diagnosticName + " adapter must satisfy one own-feature "
                        + role.expectedContractDescription + " domain port contract.");
            }
            if (isPublicConcrete(typeElement)) {
                violations.addAll(publicMethodViolations(typeElement, role, state));
            }
        }

        if (violations.isEmpty()) {
            return Description.NO_MATCH;
        }

        return buildDescription(tree)
                .setMessage("Data port-adapter contract violation in '" + tree.getSimpleName()
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

    private static List<String> publicMethodViolations(
            TypeElement typeElement,
            AdapterRole role,
            VisitorState state
    ) {
        Set<String> contractMethodSignatures = new LinkedHashSet<>();
        Set<String> visitedContracts = new LinkedHashSet<>();
        for (TypeElement contractType : ownExpectedContractTypes(typeElement, role)) {
            collectContractMethodSignatures(contractType, contractMethodSignatures, visitedContracts, state);
        }
        if (contractMethodSignatures.isEmpty()) {
            return List.of();
        }

        List<String> violations = new ArrayList<>();
        for (ExecutableElement method : ElementFilter.methodsIn(typeElement.getEnclosedElements())) {
            if (!isPublicOrProtected(method)) {
                continue;
            }
            String signature = methodSignature(method, state);
            if (!contractMethodSignatures.contains(signature)) {
                violations.add(role.diagnosticName + " adapter exposes public/protected method "
                        + method.getSimpleName()
                        + " that is not declared by an own-feature "
                        + role.expectedContractDescription
                        + " domain port contract");
            }
        }
        return violations;
    }

    private static Set<TypeElement> ownExpectedContractTypes(TypeElement typeElement, AdapterRole role) {
        Set<TypeElement> contractTypes = new LinkedHashSet<>();
        Set<String> visitedTypes = new LinkedHashSet<>();
        collectOwnExpectedContractTypes(typeElement.getSuperclass(), role, contractTypes, visitedTypes);
        for (TypeMirror implementedInterface : typeElement.getInterfaces()) {
            collectOwnExpectedContractTypes(implementedInterface, role, contractTypes, visitedTypes);
        }
        return contractTypes;
    }

    private static void collectOwnExpectedContractTypes(
            TypeMirror typeMirror,
            AdapterRole role,
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
        if (contract != null && role.isOwnExpectedContract(contract)) {
            contractTypes.add(typeElement);
        }
        collectOwnExpectedContractTypes(typeElement.getSuperclass(), role, contractTypes, visitedTypes);
        for (TypeMirror implementedInterface : typeElement.getInterfaces()) {
            collectOwnExpectedContractTypes(implementedInterface, role, contractTypes, visitedTypes);
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

    private record AdapterRole(
            String diagnosticName,
            ContractRole contractRole,
            String expectedContractDescription,
            String featureName
    ) {

        static AdapterRole fromPackage(String packageName) {
            java.util.regex.Matcher repositoryMatcher = DataArchitectureSupport.REPOSITORY_PACKAGE.matcher(packageName);
            if (repositoryMatcher.matches()) {
                return new AdapterRole("Repository", ContractRole.REPOSITORY, "repository", repositoryMatcher.group(1));
            }
            java.util.regex.Matcher queryMatcher = DataArchitectureSupport.QUERY_PACKAGE.matcher(packageName);
            if (queryMatcher.matches()) {
                return new AdapterRole("Query", ContractRole.READ_ONLY, "read-only", queryMatcher.group(1));
            }
            return null;
        }

        private boolean isOwnExpectedContract(DomainContract contract) {
            return contract.featureName().equals(featureName) && acceptsContractRole(contract.role());
        }

        private boolean acceptsContractRole(ContractRole candidateRole) {
            return candidateRole == contractRole;
        }
    }

    private enum ContractRole {
        REPOSITORY,
        READ_ONLY
    }

    private record DomainContract(String qualifiedName, String featureName, ContractRole role) {

        private static DomainContract from(String referencedType) {
            if (!DataArchitectureSupport.isDomainType(referencedType)) {
                return null;
            }
            ContractRole role = roleOf(referencedType);
            if (role == null) {
                return null;
            }
            String featureName = featureName(referencedType);
            return featureName == null ? null : new DomainContract(referencedType, featureName, role);
        }

        private static ContractRole roleOf(String referencedType) {
            String simpleName = simpleName(referencedType);
            if (simpleName.endsWith("Repository")) {
                return ContractRole.REPOSITORY;
            }
            if (simpleName.endsWith("Lookup")
                    || simpleName.endsWith("Catalog")
                    || simpleName.endsWith("Search")) {
                return ContractRole.READ_ONLY;
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
