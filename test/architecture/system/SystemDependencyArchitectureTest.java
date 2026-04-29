package architecture.system;

import static com.tngtech.archunit.lang.syntax.ArchRuleDefinition.classes;
import static com.tngtech.archunit.lang.syntax.ArchRuleDefinition.noClasses;
import static com.tngtech.archunit.library.dependencies.SlicesRuleDefinition.slices;

import architecture.AnalyzeMainClasses;
import com.tngtech.archunit.core.domain.Dependency;
import com.tngtech.archunit.core.domain.JavaClass;
import com.tngtech.archunit.junit.ArchTest;
import com.tngtech.archunit.lang.ArchCondition;
import com.tngtech.archunit.lang.ArchRule;
import com.tngtech.archunit.lang.ConditionEvents;
import com.tngtech.archunit.lang.SimpleConditionEvent;
import java.util.Set;

@AnalyzeMainClasses
public final class SystemDependencyArchitectureTest {

    private static final Set<String> DOMAIN_INTERNAL_MODEL_ROLES = Set.of(
            "aggregate",
            "entity",
            "value",
            "policy",
            "factory",
            "service",
            "event",
            "specification");

    private SystemDependencyArchitectureTest() {
    }

    @ArchTest
    static final ArchRule domainMustStayIndependentFromOuterLayers =
            noClasses()
                    .that()
                    .resideInAPackage("src.domain..")
                    .should()
                    .dependOnClassesThat()
                    .resideInAnyPackage("src.view..", "shell..", "bootstrap..", "src.data..");

    @ArchTest
    static final ArchRule domainFeaturesMustOnlyUseForeignFeatureApis =
            classes()
                    .that()
                    .resideInAPackage("src.domain..")
                    .should(onlyDependOnForeignDomainApis());

    @ArchTest
    static final ArchRule domainNamedModulesMustNotReachForeignDomainContexts =
            classes()
                    .that()
                    .resideInAPackage("src.domain..")
                    .should(notDependOnForeignDomainFromNamedModules());

    @ArchTest
    static final ArchRule domainNamedModulesMustNotReachSameContextApplicationBoundary =
            classes()
                    .that()
                    .resideInAPackage("src.domain..")
                    .should(notDependOnSameContextApplicationBoundaryFromNamedModules());

    @ArchTest
    static final ArchRule domainModelRolesMustNotDependOnOutboundPorts =
            classes()
                    .that()
                    .resideInAPackage("src.domain..")
                    .should(notDependOnOutboundPortsFromModelRoles());

    @ArchTest
    static final ArchRule domainFeaturesMustStayCycleFree =
            slices().matching("src.domain.(*)..").should().beFreeOfCycles();

    @ArchTest
    static final ArchRule domainSubpackagesMustStayCycleFree =
            slices().matching("src.domain.(*).(*)..").should().beFreeOfCycles();

    @ArchTest
    static final ArchRule dataMustNotReachPresentationShellOrBootstrap =
            noClasses()
                    .that()
                    .resideInAnyPackage(
                            "src.data..repository..",
                            "src.data..query..",
                            "src.data..gateway..",
                            "src.data..model..",
                            "src.data..mapper..",
                            "src.data..persistencecore..")
                    .should()
                    .dependOnClassesThat()
                    .resideInAnyPackage("src.view..", "shell..", "bootstrap..");

    @ArchTest
    static final ArchRule dataMustNotReachBootstrapOrPresentation =
            noClasses()
                    .that()
                    .resideInAPackage("src.data..")
                    .should()
                    .dependOnClassesThat()
                    .resideInAnyPackage("bootstrap..", "src.view..");

    @ArchTest
    static final ArchRule dataFeaturesMustOnlyUseForeignFeatureApis =
            classes()
                    .that()
                    .resideInAnyPackage(
                            "src.data..",
                            "src.data..repository..",
                            "src.data..query..",
                            "src.data..gateway..",
                            "src.data..model..",
                            "src.data..mapper..",
                            "src.data..persistencecore..")
                    .should(onlyDependOnForeignDomainApis());

    @ArchTest
    static final ArchRule dataFeaturesMustNotReachForeignPrivateDataBuckets =
            classes()
                    .that()
                    .resideInAPackage("src.data..")
                    .should(onlyDependOnOwnDataFeatureOrPersistencecore());

    @ArchTest
    static final ArchRule dataFeaturesMustStayCycleFree =
            slices().matching("src.data.(*)..").should().beFreeOfCycles();

    @ArchTest
    static final ArchRule dataModelTypesMustStayIndependentFromDomainTypes =
            noClasses()
                    .that()
                    .resideInAPackage("src.data..model..")
                    .should()
                    .dependOnClassesThat()
                    .resideInAPackage("src.domain..");

    @ArchTest
    static final ArchRule dataGatewaysMustStayIndependentFromDomainTypes =
            noClasses()
                    .that()
                    .resideInAPackage("src.data..gateway..")
                    .should()
                    .dependOnClassesThat()
                    .resideInAPackage("src.domain..");

    @ArchTest
    static final ArchRule persistencecoreMustStayIndependentFromFeatureSpecificDataPackages =
            classes()
                    .that()
                    .resideInAPackage("src.data.persistencecore..")
                    .should(notDependOnFeatureSpecificDataPackages());

    @ArchTest
    static final ArchRule persistencecoreMustNotDependOnDomainTypes =
            noClasses()
                    .that()
                    .resideInAPackage("src.data.persistencecore..")
                    .should()
                    .dependOnClassesThat()
                    .resideInAPackage("src.domain..");

    @ArchTest
    static final ArchRule shellMustNotReachFeatureInteractorsDomainOrData =
            noClasses()
                    .that()
                    .resideInAPackage("shell..")
                    .should()
                    .dependOnClassesThat()
                    .resideInAnyPackage("src.view..", "src.domain..", "src.data..");

    @ArchTest
    static final ArchRule shellMustStayIndependentFromBootstrap =
            noClasses()
                    .that()
                    .resideInAPackage("shell..")
                    .should()
                    .dependOnClassesThat()
                    .resideInAPackage("bootstrap..");

    @ArchTest
    static final ArchRule bootstrapMustStayOutsideFeatureCode =
            noClasses()
                    .that()
                    .resideInAPackage("bootstrap..")
                    .should()
                    .dependOnClassesThat()
                    .resideInAnyPackage("src.view..", "src.domain..", "src.data..");

    @ArchTest
    static final ArchRule nonBootstrapCodeMustNotReachShellHostInternals =
            noClasses()
                    .that()
                    .resideInAnyPackage("src..", "shell.api..")
                    .should()
                    .dependOnClassesThat()
                    .resideInAPackage("shell.host..");

    @ArchTest
    static final ArchRule shellApiMustStayIndependentFromHostAndFeatureLayers =
            noClasses()
                    .that()
                    .resideInAPackage("shell.api..")
                    .should()
                    .dependOnClassesThat()
                    .resideInAnyPackage("shell.host..", "bootstrap..", "src.view..", "src.domain..", "src.data..");

    @ArchTest
    static final ArchRule bootstrapMustOnlyUseAppShellFromShellHost =
            classes()
                    .that()
                    .resideInAPackage("bootstrap..")
                    .should(onlyDependOnAppShellFromShellHost());

    private static ArchCondition<JavaClass> onlyDependOnForeignDomainApis() {
        return new ArchCondition<>("only depend on same-feature domain internals or foreign feature public boundaries") {
            @Override
            public void check(JavaClass item, ConditionEvents events) {
                String sourceFeature = featureName(item.getPackageName());
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

    private static ArchCondition<JavaClass> notDependOnForeignDomainFromNamedModules() {
        return new ArchCondition<>("not depend on foreign domain contexts from named domain modules") {
            @Override
            public void check(JavaClass item, ConditionEvents events) {
                String sourceFeature = domainFeatureName(item.getPackageName());
                if (sourceFeature == null || domainNamedModuleName(item.getPackageName()) == null) {
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
                    events.add(SimpleConditionEvent.violated(
                            item,
                            item.getName() + " depends on foreign domain context " + target.getName()));
                }
            }
        };
    }

    private static ArchCondition<JavaClass> notDependOnSameContextApplicationBoundaryFromNamedModules() {
        return new ArchCondition<>("not depend on same-context root/application packages from named domain modules") {
            @Override
            public void check(JavaClass item, ConditionEvents events) {
                String sourceFeature = domainFeatureName(item.getPackageName());
                if (sourceFeature == null || domainNamedModuleName(item.getPackageName()) == null) {
                    return;
                }
                String rootPackage = "src.domain." + sourceFeature;
                String applicationPackage = rootPackage + ".application";
                for (Dependency dependency : item.getDirectDependenciesFromSelf()) {
                    JavaClass target = dependency.getTargetClass();
                    String targetPackage = target.getPackageName();
                    if (targetPackage.equals(rootPackage) || targetPackage.startsWith(applicationPackage + ".")) {
                        events.add(SimpleConditionEvent.violated(
                                item,
                                item.getName() + " depends on same-context application boundary " + target.getName()));
                    }
                }
            }
        };
    }

    private static ArchCondition<JavaClass> notDependOnOutboundPortsFromModelRoles() {
        return new ArchCondition<>("not depend on outbound ports from aggregate/entity/value/policy/factory/service/event/specification roles") {
            @Override
            public void check(JavaClass item, ConditionEvents events) {
                String sourceRole = domainRoleName(item.getPackageName());
                if (sourceRole == null || !DOMAIN_INTERNAL_MODEL_ROLES.contains(sourceRole)) {
                    return;
                }
                for (Dependency dependency : item.getDirectDependenciesFromSelf()) {
                    JavaClass target = dependency.getTargetClass();
                    if (!"port".equals(domainRoleName(target.getPackageName()))) {
                        continue;
                    }
                    events.add(SimpleConditionEvent.violated(
                            item,
                            item.getName() + " depends on outbound port " + target.getName()));
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

    private static String featureName(String packageName) {
        String domainFeatureName = domainFeatureName(packageName);
        return domainFeatureName != null ? domainFeatureName : dataFeatureName(packageName);
    }

    private static String domainNamedModuleName(String packageName) {
        if (!packageName.startsWith("src.domain.")) {
            return null;
        }
        String[] parts = packageName.split("\\.");
        if (parts.length < 4) {
            return null;
        }
        String moduleName = parts[3];
        if ("published".equals(moduleName) || "application".equals(moduleName)) {
            return null;
        }
        return moduleName;
    }

    private static String domainRoleName(String packageName) {
        String[] parts = packageName.split("\\.");
        return parts.length >= 6 && parts[0].equals("src") && parts[1].equals("domain") ? parts[5] : null;
    }

    private static boolean isFeaturePublicBoundary(String packageName, String featureName) {
        String rootPackage = "src.domain." + featureName;
        return packageName.equals(rootPackage)
                || packageName.startsWith(rootPackage + ".published.");
    }

    private static String dataFeatureName(String packageName) {
        if (!packageName.startsWith("src.data.")) {
            return null;
        }
        String remainder = packageName.substring("src.data.".length());
        int separatorIndex = remainder.indexOf('.');
        return separatorIndex >= 0 ? remainder.substring(0, separatorIndex) : remainder;
    }

    private static ArchCondition<JavaClass> onlyDependOnOwnDataFeatureOrPersistencecore() {
        return new ArchCondition<>("only depend on own data feature or persistencecore") {
            @Override
            public void check(JavaClass item, ConditionEvents events) {
                String sourceFeature = dataFeatureName(item.getPackageName());
                if (sourceFeature == null) {
                    return;
                }
                for (Dependency dependency : item.getDirectDependenciesFromSelf()) {
                    JavaClass target = dependency.getTargetClass();
                    String targetPackage = target.getPackageName();
                    if (!targetPackage.startsWith("src.data.")) {
                        continue;
                    }
                    String targetFeature = dataFeatureName(targetPackage);
                    if (targetPackage.startsWith("src.data.persistencecore.")
                            || sourceFeature.equals(targetFeature)) {
                        continue;
                    }
                    events.add(SimpleConditionEvent.violated(
                            item,
                            item.getName() + " depends on foreign private data bucket " + target.getName()));
                }
            }
        };
    }

    private static ArchCondition<JavaClass> notDependOnFeatureSpecificDataPackages() {
        return new ArchCondition<>("not depend on feature-specific data packages") {
            @Override
            public void check(JavaClass item, ConditionEvents events) {
                for (Dependency dependency : item.getDirectDependenciesFromSelf()) {
                    JavaClass target = dependency.getTargetClass();
                    String targetPackage = target.getPackageName();
                    if (targetPackage.startsWith("src.data.persistencecore.")
                            || !targetPackage.startsWith("src.data.")) {
                        continue;
                    }
                    events.add(SimpleConditionEvent.violated(
                            item,
                            item.getName() + " depends on feature-specific data package " + target.getName()));
                }
            }
        };
    }

    private static ArchCondition<JavaClass> onlyDependOnAppShellFromShellHost() {
        return new ArchCondition<>("only depend on shell.host.AppShell from bootstrap") {
            @Override
            public void check(JavaClass item, ConditionEvents events) {
                for (Dependency dependency : item.getDirectDependenciesFromSelf()) {
                    JavaClass target = dependency.getTargetClass();
                    String targetPackage = target.getPackageName();
                    if (!targetPackage.startsWith("shell.host.")) {
                        continue;
                    }
                    if ("shell.host.AppShell".equals(target.getName())) {
                        continue;
                    }
                    events.add(SimpleConditionEvent.violated(
                            item,
                            item.getName() + " depends on shell.host internal " + target.getName()));
                }
            }
        };
    }
}
