package architecture.domain.layer;

import static com.tngtech.archunit.lang.syntax.ArchRuleDefinition.classes;

import architecture.AnalyzeMainClasses;
import com.tngtech.archunit.core.domain.Dependency;
import com.tngtech.archunit.core.domain.JavaClass;
import com.tngtech.archunit.junit.ArchTest;
import com.tngtech.archunit.lang.ArchCondition;
import com.tngtech.archunit.lang.ArchRule;
import com.tngtech.archunit.lang.ConditionEvents;
import com.tngtech.archunit.lang.SimpleConditionEvent;

@AnalyzeMainClasses
public final class DomainLayerArchitectureTest {

    private DomainLayerArchitectureTest() {
    }

    @ArchTest
    static final ArchRule domainMustStayIndependentFromOuterLayers =
            classes()
                    .that()
                    .resideInAPackage("src.domain..")
                    .should(dependOnlyOnAllowedOuterLayerPackages());

    @ArchTest
    static final ArchRule domainFeaturesMustOnlyUseForeignFeatureApis =
            classes()
                    .that()
                    .resideInAPackage("src.domain..")
                    .should(onlyDependOnForeignDomainApis());

    @ArchTest
    static final ArchRule domainApplicationServicesMustOnlyUsePublishedCommandsAndUseCases =
            classes()
                    .that()
                    .haveSimpleNameEndingWith("ApplicationService")
                    .and()
                    .resideInAnyPackage("src.domain.*")
                    .should(onlyDependOnAllowedDomainPackages(
                            "same-context published command language and same-context use cases only",
                            DomainLayerArchitectureTest::isAllowedForApplicationService));

    @ArchTest
    static final ArchRule domainUseCasesMustOnlyDependOnAllowedInternalRoles =
            classes()
                    .that()
                    .resideInAnyPackage("src.domain..application..", "src.domain..model..usecase..")
                    .should(onlyDependOnAllowedDomainPackages(
                            "same-context internal model work, helpers, constants, ports, repositories, and foreign root application services only",
                            DomainLayerArchitectureTest::isAllowedForUseCase));

    @ArchTest
    static final ArchRule domainInternalModelsMustOnlyDependOnModelsAndConstants =
            classes()
                    .that()
                    .resideInAPackage("src.domain..model..model..")
                    .should(onlyDependOnAllowedDomainPackages(
                            "same-context model and constants only",
                            DomainLayerArchitectureTest::isAllowedForModel));

    @ArchTest
    static final ArchRule domainHelpersMustOnlyDependOnModelsAndConstants =
            classes()
                    .that()
                    .resideInAPackage("src.domain..model..helper..")
                    .should(onlyDependOnAllowedDomainPackages(
                            "same-context model inputs and constants only",
                            DomainLayerArchitectureTest::isAllowedForHelper));

    @ArchTest
    static final ArchRule domainConstantsMustOnlyDependOnConstants =
            classes()
                    .that()
                    .resideInAPackage("src.domain..model..constants..")
                    .should(onlyDependOnAllowedDomainPackages(
                            "same-context constants only",
                            DomainLayerArchitectureTest::isAllowedForConstants));

    @ArchTest
    static final ArchRule domainPortsMustOnlyDependOnForeignPublishedAndSameContextFollowUpRoles =
            classes()
                    .that()
                    .resideInAPackage("src.domain..model..port..")
                    .should(onlyDependOnAllowedDomainPackages(
                            "foreign published state plus same-context use cases, models, and constants only",
                            DomainLayerArchitectureTest::isAllowedForPort));

    @ArchTest
    static final ArchRule domainRepositoriesMustOnlyDependOnForeignRootsAndSameContextInternals =
            classes()
                    .that()
                    .resideInAPackage("src.domain..model..repository..")
                    .should(onlyDependOnAllowedDomainPackages(
                            "foreign root application services plus same-context model/constants/repository internals only",
                            DomainLayerArchitectureTest::isAllowedForRepository));

    private static ArchCondition<JavaClass> onlyDependOnForeignDomainApis() {
        return new ArchCondition<>("only depend on same-feature domain internals or foreign feature public boundaries") {
            @Override
            public void check(JavaClass item, ConditionEvents events) {
                String sourceFeature = domainFeatureName(item.getPackageName());
                if (sourceFeature == null) {
                    return;
                }
                for (Dependency dependency : item.getDirectDependenciesFromSelf()) {
                    JavaClass target = dependency.getTargetClass();
                    String targetPackage = target.getPackageName();
                    if (!targetPackage.startsWith("src.domain.")) {
                        continue;
                    }
                    String targetFeature = domainFeatureName(targetPackage);
                    if (targetFeature == null || targetFeature.equals(sourceFeature)) {
                        continue;
                    }
                    if (isFeaturePublicBoundary(targetPackage, targetFeature)) {
                        continue;
                    }
                    events.add(SimpleConditionEvent.violated(
                            item,
                            item.getName() + " depends on foreign domain internal " + target.getName()));
                }
            }
        };
    }

    private static ArchCondition<JavaClass> onlyDependOnAllowedDomainPackages(
            String description,
            DomainDependencyPolicy policy
    ) {
        return new ArchCondition<>(description) {
            @Override
            public void check(JavaClass item, ConditionEvents events) {
                String sourcePackage = item.getPackageName();
                String sourceFeature = domainFeatureName(sourcePackage);
                if (sourceFeature == null) {
                    return;
                }
                for (Dependency dependency : item.getDirectDependenciesFromSelf()) {
                    JavaClass target = dependency.getTargetClass();
                    String targetPackage = target.getPackageName();
                    if (!targetPackage.startsWith("src.domain.")) {
                        continue;
                    }
                    if (policy.isAllowed(sourcePackage, sourceFeature, targetPackage)) {
                        continue;
                    }
                    events.add(SimpleConditionEvent.violated(
                            item,
                            item.getName() + " depends on forbidden domain concern " + target.getName()));
                }
            }
        };
    }

    private static boolean isAllowedForApplicationService(
            String sourcePackage,
            String sourceFeature,
            String targetPackage
    ) {
        return isSameFeaturePublishedPackage(targetPackage, sourceFeature)
                || isSameFeatureUseCasePackage(targetPackage, sourceFeature);
    }

    private static boolean isAllowedForUseCase(
            String sourcePackage,
            String sourceFeature,
            String targetPackage
    ) {
        return isSameFeatureModelRolePackage(targetPackage, sourceFeature, "model")
                || isSameFeatureModelRolePackage(targetPackage, sourceFeature, "usecase")
                || isSameFeatureModelRolePackage(targetPackage, sourceFeature, "helper")
                || isSameFeatureModelRolePackage(targetPackage, sourceFeature, "constants")
                || isSameFeatureModelRolePackage(targetPackage, sourceFeature, "port")
                || isSameFeatureModelRolePackage(targetPackage, sourceFeature, "repository")
                || isForeignRootPackage(targetPackage, sourceFeature);
    }

    private static boolean isAllowedForModel(
            String sourcePackage,
            String sourceFeature,
            String targetPackage
    ) {
        return isSameFeatureModelRolePackage(targetPackage, sourceFeature, "model")
                || isSameFeatureModelRolePackage(targetPackage, sourceFeature, "constants");
    }

    private static boolean isAllowedForHelper(
            String sourcePackage,
            String sourceFeature,
            String targetPackage
    ) {
        return isSameFeatureModelRolePackage(targetPackage, sourceFeature, "model")
                || isSameFeatureModelRolePackage(targetPackage, sourceFeature, "constants");
    }

    private static boolean isAllowedForConstants(
            String sourcePackage,
            String sourceFeature,
            String targetPackage
    ) {
        return isSameFeatureModelRolePackage(targetPackage, sourceFeature, "constants");
    }

    private static boolean isAllowedForPort(
            String sourcePackage,
            String sourceFeature,
            String targetPackage
    ) {
        return isSameFeatureModelRolePackage(targetPackage, sourceFeature, "model")
                || isSameFeatureModelRolePackage(targetPackage, sourceFeature, "usecase")
                || isSameFeatureModelRolePackage(targetPackage, sourceFeature, "constants")
                || isForeignPublishedPackage(targetPackage, sourceFeature);
    }

    private static boolean isAllowedForRepository(
            String sourcePackage,
            String sourceFeature,
            String targetPackage
    ) {
        return isSameFeatureModelRolePackage(targetPackage, sourceFeature, "model")
                || isSameFeatureModelRolePackage(targetPackage, sourceFeature, "constants")
                || isSameFeatureModelRolePackage(targetPackage, sourceFeature, "repository")
                || isForeignRootPackage(targetPackage, sourceFeature)
                || isForeignPublishedPackage(targetPackage, sourceFeature);
    }

    private static ArchCondition<JavaClass> dependOnlyOnAllowedOuterLayerPackages() {
        return new ArchCondition<>("stay independent from outer layers except domain service-composition shell seam") {
            @Override
            public void check(JavaClass item, ConditionEvents events) {
                for (Dependency dependency : item.getDirectDependenciesFromSelf()) {
                    JavaClass target = dependency.getTargetClass();
                    String targetPackage = target.getPackageName();
                    if (!isOuterLayerPackage(targetPackage)) {
                        continue;
                    }
                    if (isDomainServiceCompositionRoot(item) && isAllowedShellCompositionPackage(targetPackage)) {
                        continue;
                    }
                    events.add(SimpleConditionEvent.violated(
                            item,
                            item.getName() + " depends on outer-layer type " + target.getName()));
                }
            }
        };
    }

    private static String domainFeatureName(String packageName) {
        if (!packageName.startsWith("src.domain.")) {
            return null;
        }
        String remainder = packageName.substring("src.domain.".length());
        int separatorIndex = remainder.indexOf('.');
        return separatorIndex >= 0 ? remainder.substring(0, separatorIndex) : remainder;
    }

    private static boolean isFeaturePublicBoundary(String packageName, String featureName) {
        String rootPackage = "src.domain." + featureName;
        return packageName.equals(rootPackage)
                || packageName.equals(rootPackage + ".published")
                || packageName.startsWith(rootPackage + ".published.");
    }

    private static boolean isSameFeaturePublishedPackage(String packageName, String feature) {
        String publishedPackage = "src.domain." + feature + ".published";
        return packageName.equals(publishedPackage) || packageName.startsWith(publishedPackage + ".");
    }

    private static boolean isForeignPublishedPackage(String packageName, String sourceFeature) {
        String targetFeature = domainFeatureName(packageName);
        return targetFeature != null
                && !targetFeature.equals(sourceFeature)
                && isSameFeaturePublishedPackage(packageName, targetFeature);
    }

    private static boolean isSameFeatureUseCasePackage(String packageName, String feature) {
        String rootApplicationPackage = "src.domain." + feature + ".application";
        if (packageName.equals(rootApplicationPackage) || packageName.startsWith(rootApplicationPackage + ".")) {
            return true;
        }
        return isSameFeatureModelRolePackage(packageName, feature, "usecase");
    }

    private static boolean isSameFeatureModelRolePackage(String packageName, String feature, String role) {
        String rolePackagePrefix = "src.domain." + feature + ".model.";
        if (!packageName.startsWith(rolePackagePrefix)) {
            return false;
        }
        String remainder = packageName.substring(rolePackagePrefix.length());
        int familySeparator = remainder.indexOf('.');
        if (familySeparator < 0) {
            return false;
        }
        String afterFamily = remainder.substring(familySeparator + 1);
        return afterFamily.equals(role) || afterFamily.startsWith(role + ".");
    }

    private static boolean isForeignRootPackage(String packageName, String sourceFeature) {
        String targetFeature = domainFeatureName(packageName);
        return targetFeature != null
                && !targetFeature.equals(sourceFeature)
                && packageName.equals("src.domain." + targetFeature);
    }

    private static boolean isOuterLayerPackage(String packageName) {
        return packageName.startsWith("src.view.")
                || packageName.startsWith("shell.")
                || packageName.startsWith("bootstrap.")
                || packageName.startsWith("src.data.");
    }

    private static boolean isAllowedShellCompositionPackage(String packageName) {
        return packageName.equals("shell.api") || packageName.startsWith("shell.api.");
    }

    private static boolean isDomainServiceCompositionRoot(JavaClass item) {
        String packageName = item.getPackageName();
        String simpleName = item.getSimpleName();
        return packageName.matches("^src\\.domain\\.[^.]+$")
                && (simpleName.endsWith("ServiceContribution") || simpleName.endsWith("ServiceAssembly"));
    }

    @FunctionalInterface
    private interface DomainDependencyPolicy {
        boolean isAllowed(String sourcePackage, String sourceFeature, String targetPackage);
    }
}
