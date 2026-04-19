package architecture;

import static com.tngtech.archunit.lang.syntax.ArchRuleDefinition.classes;
import static com.tngtech.archunit.lang.syntax.ArchRuleDefinition.noClasses;
import static com.tngtech.archunit.library.dependencies.SlicesRuleDefinition.slices;

import com.tngtech.archunit.core.domain.Dependency;
import com.tngtech.archunit.core.domain.JavaClass;
import com.tngtech.archunit.core.importer.ImportOption;
import com.tngtech.archunit.junit.AnalyzeClasses;
import com.tngtech.archunit.junit.ArchTest;
import com.tngtech.archunit.junit.CacheMode;
import com.tngtech.archunit.lang.ArchCondition;
import com.tngtech.archunit.lang.ArchRule;
import com.tngtech.archunit.lang.ConditionEvents;
import com.tngtech.archunit.lang.SimpleConditionEvent;

@AnalyzeClasses(
        packages = {"bootstrap", "shell", "src.domain", "src.view", "src.data"},
        importOptions = {
                ImportOption.DoNotIncludeTests.class,
                ImportOption.DoNotIncludeJars.class
        },
        cacheMode = CacheMode.PER_CLASS)
public final class DependencyBoundaryArchitectureTest {

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
    static final ArchRule viewModelsMustNotReachBootstrapDataOrShellHost =
            noClasses()
                    .that()
                    .resideInAPackage("src.view.models..")
                    .should()
                    .dependOnClassesThat()
                    .resideInAnyPackage("bootstrap..", "src.data..", "shell.host..");

    @ArchTest
    static final ArchRule viewModelsMustOnlyUseFeatureApisAtBackendBoundary =
            classes()
                    .that()
                    .resideInAPackage("src.view.models..")
                    .should(onlyDependOnDomainPublicBoundaries());

    @ArchTest
    static final ArchRule passiveViewsMustNotReachModelShellDomainDataOrBootstrap =
            noClasses()
                    .that()
                    .resideInAPackage("src.view.views..")
                    .should()
                    .dependOnClassesThat()
                    .resideInAnyPackage("bootstrap..", "shell..", "src.domain..", "src.data..", "src.view.models..");

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

    private static ArchCondition<JavaClass> resideInTargetViewPackage() {
        return new ArchCondition<>("reside in src.view.models or src.view.views") {
            @Override
            public void check(JavaClass item, ConditionEvents events) {
                String packageName = item.getPackageName();
                if (packageName.equals("src.view.models")
                        || packageName.startsWith("src.view.models.")
                        || packageName.equals("src.view.views")
                        || packageName.startsWith("src.view.views.")) {
                    return;
                }
                String message = item.getName()
                        + " lives in old view topology package "
                        + packageName
                        + "; move contribution models to src.view.models and passive panels to src.view.views";
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
                        + " uses replaced *ViewContribution naming; use *TabModel or *WindowModel under src.view.models";
                events.add(SimpleConditionEvent.violated(item, message));
            }
        };
    }

    private static ArchCondition<JavaClass> onlyDependOnDomainPublicBoundaries() {
        return new ArchCondition<>("only depend on domain application-service roots or api carriers") {
            @Override
            public void check(JavaClass item, ConditionEvents events) {
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
                    if (isFeaturePublicBoundary(targetPackage, targetFeature)) {
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
        return packageName.equals("src.domain." + featureName)
                || packageName.startsWith("src.domain." + featureName + ".api");
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
