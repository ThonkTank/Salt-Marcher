package saltmarcher.quality.errorprone;

import com.google.errorprone.BugPattern;
import com.google.errorprone.VisitorState;
import com.google.errorprone.bugpatterns.BugChecker;
import com.google.errorprone.matchers.Description;
import com.google.errorprone.util.ASTHelpers;
import com.sun.source.tree.ClassTree;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import javax.lang.model.element.ElementKind;
import javax.lang.model.element.Modifier;
import javax.lang.model.element.TypeElement;
import javax.lang.model.type.DeclaredType;
import javax.lang.model.type.TypeMirror;

@BugPattern(
        name = "DataAdapterRoleContract",
        summary = "Repository adapters implement repository contracts and query adapters implement read-model contracts.",
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
                        + "; data repository/query contracts and carriers belong in the owning domain boundary.");
            }
            for (DomainContract contract : domainContracts) {
                if (!contract.featureName().equals(role.featureName())) {
                    violations.add(role.diagnosticName + " adapter depends on foreign domain contract "
                            + contract.qualifiedName());
                } else if (contract.role() != role.contractRole()) {
                    violations.add(role.diagnosticName + " adapter depends on wrong domain contract role "
                            + contract.qualifiedName());
                }
            }
            if (isPublicConcrete(typeElement) && domainContracts.stream().noneMatch(role::isOwnExpectedContract)) {
                violations.add(role.diagnosticName + " adapter must satisfy one own-feature "
                        + role.expectedContractDescription + " contract.");
            }
        }

        if (violations.isEmpty()) {
            return Description.NO_MATCH;
        }

        return buildDescription(tree)
                .setMessage("Data adapter role contract violation in '" + tree.getSimpleName()
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
                return new AdapterRole("Query", ContractRole.QUERY, "read-model/query", queryMatcher.group(1));
            }
            return null;
        }

        private boolean isOwnExpectedContract(DomainContract contract) {
            return contract.featureName().equals(featureName) && contract.role() == contractRole;
        }
    }

    private enum ContractRole {
        REPOSITORY,
        QUERY
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
            if (simpleName.endsWith("QueryPort")
                    || simpleName.endsWith("ReadPort")
                    || simpleName.endsWith("LookupPort")
                    || simpleName.endsWith("ProjectionPort")) {
                return ContractRole.QUERY;
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
