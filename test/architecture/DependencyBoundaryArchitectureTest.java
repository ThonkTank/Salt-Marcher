package architecture;

import static com.tngtech.archunit.lang.syntax.ArchRuleDefinition.classes;
import static com.tngtech.archunit.lang.syntax.ArchRuleDefinition.noClasses;
import static com.tngtech.archunit.library.dependencies.SlicesRuleDefinition.slices;

import com.tngtech.archunit.core.domain.Dependency;
import com.tngtech.archunit.core.domain.JavaClass;
import com.tngtech.archunit.junit.ArchTest;
import com.tngtech.archunit.lang.ArchCondition;
import com.tngtech.archunit.lang.ArchRule;
import com.tngtech.archunit.lang.ConditionEvents;
import com.tngtech.archunit.lang.SimpleConditionEvent;
import java.util.Set;

@AnalyzeMainClasses
public final class DependencyBoundaryArchitectureTest {

    private static final Set<String> DOMAIN_INTERNAL_MODEL_ROLES = Set.of(
            "aggregate",
            "entity",
            "value",
            "policy",
            "factory",
            "service",
            "event",
            "specification");

    private DependencyBoundaryArchitectureTest() {
    }

    @ArchTest
    static final ArchRule viewLayerMustUseModelsOrViewsPackages =
            classes()
                    .that()
                    .resideInAPackage("src.view..")
                    .should(resideInTargetViewPackage());

    @ArchTest
    static final ArchRule viewLayerMustNotUseViewContributionImplementations =
            classes()
                    .that()
                    .resideInAPackage("src.view..")
                    .should(notBeViewContributionImplementation());

    @ArchTest
    static final ArchRule viewActiveRootsAndViewModelsMustNotReachBootstrapDataOrShellHost =
            noClasses()
                    .that()
                    .resideInAPackage("src.view..")
                    .should()
                    .dependOnClassesThat()
                    .resideInAnyPackage("bootstrap..", "src.data..", "shell.host..");

    @ArchTest
    static final ArchRule viewActiveRootsAndViewModelsMustOnlyUseAllowedDomainBoundaries =
            classes()
                    .that()
                    .resideInAPackage("src.view..")
                    .should(onlyDependOnDomainPublicBoundaries());

    @ArchTest
    static final ArchRule passiveViewsMustNotReachContributionShellDomainDataOrBootstrap =
            noClasses()
                    .that()
                    .resideInAPackage("src.view..")
                    .and()
                    .haveSimpleNameEndingWith("View")
                    .should()
                    .dependOnClassesThat()
                    .resideInAnyPackage("bootstrap..", "shell..", "src.domain..", "src.data..");

    @ArchTest
    static final ArchRule viewComponentsMustStayCycleFree =
            slices()
                    .matching("src.view.(*)..")
                    .should()
                    .beFreeOfCycles();

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
            slices()
                    .matching("src.domain.(*)..")
                    .should()
                    .beFreeOfCycles();

    @ArchTest
    static final ArchRule domainSubpackagesMustStayCycleFree =
            slices()
                    .matching("src.domain.(*).(*)..")
                    .should()
                    .beFreeOfCycles();

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
            slices()
                    .matching("src.data.(*)..")
                    .should()
                    .beFreeOfCycles();

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
                    String message = item.getName() + " depends on foreign domain internal " + target.getName();
                    events.add(SimpleConditionEvent.violated(item, message));
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
                    String message = item.getName()
                            + " depends on foreign domain context "
                            + target.getName()
                            + "; named modules must stay within their own context";
                    events.add(SimpleConditionEvent.violated(item, message));
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
                        String message = item.getName()
                                + " depends on same-context application boundary "
                                + target.getName()
                                + "; named modules must be called by application use cases, not call back into them";
                        events.add(SimpleConditionEvent.violated(item, message));
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
                    String message = item.getName()
                            + " depends on outbound port "
                            + target.getName()
                            + "; ports may be injected into application use cases or adapters, not model roles";
                    events.add(SimpleConditionEvent.violated(item, message));
                }
            }
        };
    }

    private static ArchCondition<JavaClass> resideInTargetViewPackage() {
        return new ArchCondition<>("reside in target view contribution, view model, view, or reusable view package") {
            @Override
            public void check(JavaClass item, ConditionEvents events) {
                String packageName = item.getPackageName();
                if (isTargetViewPackage(packageName)) {
                    return;
                }
                String message = item.getName()
                        + " lives in old view topology package "
                        + packageName
                        + "; move shell-facing code to src.view.leftbartabs/statetabs/dropdowns and reusable panels to src.view.slotcontent";
                events.add(SimpleConditionEvent.violated(item, message));
            }
        };
    }

    private static ArchCondition<JavaClass> notBeViewContributionImplementation() {
        return new ArchCondition<>("not be a *ViewContribution implementation") {
            @Override
            public void check(JavaClass item, ConditionEvents events) {
                if (!item.getSimpleName().endsWith("ViewContribution")) {
                    return;
                }
                String message = item.getName()
                        + " uses replaced *ViewContribution naming; use *Contribution under src.view.leftbartabs, src.view.statetabs, or src.view.dropdowns";
                events.add(SimpleConditionEvent.violated(item, message));
            }
        };
    }

    private static boolean isTargetViewPackage(String packageName) {
        if (packageName.matches("src\\.view\\.slotcontent\\.(controls|state|details|main|topbar)\\.[^.]+")) {
            return true;
        }
        return packageName.matches("src\\.view\\.(leftbartabs|statetabs|dropdowns)\\.[^.]+");
    }

    private static ArchCondition<JavaClass> onlyDependOnDomainPublicBoundaries() {
        return new ArchCondition<>("only depend on allowed domain public boundaries") {
            @Override
            public void check(JavaClass item, ConditionEvents events) {
                boolean contribution = item.getSimpleName().endsWith("Contribution");
                boolean slotcontent = item.getPackageName().startsWith("src.view.slotcontent.");
                for (Dependency dependency : item.getDirectDependenciesFromSelf()) {
                    JavaClass target = dependency.getTargetClass();
                    String targetPackage = target.getPackageName();
                    if (!targetPackage.startsWith("src.domain.")) {
                        continue;
                    }
                    String targetFeature = domainFeatureName(targetPackage);
                    if (targetFeature == null) {
                        continue;
                    }
                    if (contribution) {
                        String message = item.getName() + " depends on domain type " + target.getName()
                                + "; contributions must delegate domain lookup to their Binder";
                        events.add(SimpleConditionEvent.violated(item, message));
                        continue;
                    }
                    if (slotcontent) {
                        if (isFeaturePublishedBoundary(targetPackage, targetFeature)) {
                            continue;
                        }
                        String message = item.getName() + " depends on domain type " + target.getName()
                                + "; slotcontent may use only domain published carriers";
                        events.add(SimpleConditionEvent.violated(item, message));
                        continue;
                    }
                    if (isFeatureRootApplicationService(target)
                            || isFeaturePublishedBoundary(targetPackage, targetFeature)) {
                        continue;
                    }
                    String message = item.getName() + " depends on domain internal " + target.getName();
                    events.add(SimpleConditionEvent.violated(item, message));
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
        String namedModule = domainNamedModuleName(packageName);
        if (namedModule == null) {
            return null;
        }
        String[] parts = packageName.split("\\.");
        for (int index = 4; index < parts.length; index++) {
            String part = parts[index];
            if ("port".equals(part) || DOMAIN_INTERNAL_MODEL_ROLES.contains(part)) {
                return part;
            }
        }
        return null;
    }

    private static ArchCondition<JavaClass> onlyDependOnOwnDataFeatureOrPersistencecore() {
        return new ArchCondition<>("only depend on same-feature data implementation or persistencecore within src.data") {
            @Override
            public void check(JavaClass item, ConditionEvents events) {
                String sourceFeature = dataFeatureName(item.getPackageName());
                if (sourceFeature == null || sourceFeature.equals("persistencecore")) {
                    return;
                }
                for (Dependency dependency : item.getDirectDependenciesFromSelf()) {
                    JavaClass target = dependency.getTargetClass();
                    String targetPackage = target.getPackageName();
                    if (!targetPackage.startsWith("src.data.")) {
                        continue;
                    }
                    String targetFeature = dataFeatureName(targetPackage);
                    if (targetFeature == null
                            || targetFeature.equals(sourceFeature)
                            || targetFeature.equals("persistencecore")) {
                        continue;
                    }
                    String message = item.getName() + " depends on foreign data implementation " + target.getName();
                    events.add(SimpleConditionEvent.violated(item, message));
                }
            }
        };
    }

    private static ArchCondition<JavaClass> notDependOnFeatureSpecificDataPackages() {
        return new ArchCondition<>("not depend on feature-specific data packages from persistencecore") {
            @Override
            public void check(JavaClass item, ConditionEvents events) {
                for (Dependency dependency : item.getDirectDependenciesFromSelf()) {
                    JavaClass target = dependency.getTargetClass();
                    String targetPackage = target.getPackageName();
                    if (!targetPackage.startsWith("src.data.")
                            || isPersistencecorePackage(targetPackage)) {
                        continue;
                    }
                    String message = item.getName()
                            + " makes persistencecore depend on feature-specific data type "
                            + target.getName();
                    events.add(SimpleConditionEvent.violated(item, message));
                }
            }
        };
    }

    private static boolean isFeaturePublicBoundary(String packageName, String featureName) {
        return isRootDomainPackage(packageName, featureName)
                || isFeaturePublishedBoundary(packageName, featureName);
    }

    private static boolean isFeatureRootApplicationService(JavaClass javaClass) {
        String packageName = javaClass.getPackageName();
        String featureName = domainFeatureName(packageName);
        if (featureName == null || !isRootDomainPackage(packageName, featureName)) {
            return false;
        }
        String simpleName = javaClass.getSimpleName();
        return simpleName.endsWith("ApplicationService")
                && normalizeFeatureToken(simpleName.substring(0, simpleName.length() - "ApplicationService".length()))
                .equals(normalizeFeatureToken(featureName));
    }

    private static boolean isRootDomainPackage(String packageName, String featureName) {
        return packageName.equals("src.domain." + featureName);
    }

    private static boolean isFeaturePublishedBoundary(String packageName, String featureName) {
        return packageName.startsWith("src.domain." + featureName + ".published");
    }

    private static String normalizeFeatureToken(String value) {
        StringBuilder result = new StringBuilder();
        for (char character : value.toCharArray()) {
            if (Character.isLetterOrDigit(character)) {
                result.append(Character.toLowerCase(character));
            }
        }
        return result.toString();
    }

    private static String dataFeatureName(String packageName) {
        if (!packageName.startsWith("src.data.")) {
            return null;
        }
        String remainder = packageName.substring("src.data.".length());
        int separatorIndex = remainder.indexOf('.');
        return separatorIndex >= 0 ? remainder.substring(0, separatorIndex) : remainder;
    }

    private static boolean isPersistencecorePackage(String packageName) {
        return packageName.equals("src.data.persistencecore")
                || packageName.startsWith("src.data.persistencecore.");
    }

    private static ArchCondition<JavaClass> onlyDependOnAppShellFromShellHost() {
        return new ArchCondition<>("only depend on shell.host.AppShell from shell.host") {
            @Override
            public void check(JavaClass item, ConditionEvents events) {
                for (Dependency dependency : item.getDirectDependenciesFromSelf()) {
                    JavaClass target = dependency.getTargetClass();
                    if (!target.getPackageName().startsWith("shell.host.")) {
                        continue;
                    }
                    if ("shell.host.AppShell".equals(target.getName())) {
                        continue;
                    }
                    String message = item.getName() + " depends on internal shell host type " + target.getName();
                    events.add(SimpleConditionEvent.violated(item, message));
                }
            }
        };
    }
}
