package architecture;

import static com.tngtech.archunit.lang.syntax.ArchRuleDefinition.classes;
import static com.tngtech.archunit.lang.syntax.ArchRuleDefinition.noClasses;

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

    private static final String[] DOMAIN_INTERNAL_PACKAGES = {
            "src.domain..entity..",
            "src.domain..usecase..",
            "src.domain..repository..",
            "src.domain..valueobject.."
    };

    private DependencyBoundaryArchitectureTest() {
    }

    @ArchTest
    static final ArchRule featureEntrypointsMustNotReachDomainInternalsOrData =
            noClasses()
                    .that()
                    .resideInAPackage("src.view..")
                    .and()
                    .haveSimpleNameEndingWith("ViewContribution")
                    .should()
                    .dependOnClassesThat()
                    .resideInAnyPackage("src.data..");

    @ArchTest
    static final ArchRule featureEntrypointsMustOnlyUseFeatureApisAtBackendBoundary =
            noClasses()
                    .that()
                    .resideInAPackage("src.view..")
                    .and()
                    .haveSimpleNameEndingWith("ViewContribution")
                    .should()
                    .dependOnClassesThat()
                    .resideInAnyPackage(DOMAIN_INTERNAL_PACKAGES);

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
    static final ArchRule dataMustNotReachPresentationShellOrBootstrap =
            noClasses()
                    .that()
                    .resideInAnyPackage(
                            "src.data..repository..",
                            "src.data..datasource..",
                            "src.data..model..",
                            "src.data..mapper..")
                    .should()
                    .dependOnClassesThat()
                    .resideInAnyPackage("src.view..", "shell..", "bootstrap..");

    @ArchTest
    static final ArchRule dataFeaturesMustOnlyUseForeignFeatureApis =
            classes()
                    .that()
                    .resideInAnyPackage(
                            "src.data..repository..",
                            "src.data..datasource..",
                            "src.data..model..",
                            "src.data..mapper..")
                    .should(onlyDependOnForeignDomainApis());

    @ArchTest
    static final ArchRule shellMustNotReachFeatureInteractorsDomainOrData =
            noClasses()
                    .that()
                    .resideInAPackage("shell..")
                    .should()
                    .dependOnClassesThat()
                    .resideInAnyPackage("src.view..", "src.domain..", "src.data..");

    @ArchTest
    static final ArchRule bootstrapMustStayOutsideFeatureCode =
            noClasses()
                    .that()
                    .resideInAPackage("bootstrap..")
                    .should()
                    .dependOnClassesThat()
                    .resideInAnyPackage("src.view..", "src.domain..", "src.data..");

    private static ArchCondition<JavaClass> onlyDependOnForeignDomainApis() {
        return new ArchCondition<>("only depend on same-feature domain internals or foreign feature APIs") {
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
                    if (isFeatureApi(targetPackage, target.getSimpleName(), targetFeature)) {
                        continue;
                    }
                    String message = item.getName() + " depends on foreign domain internal " + target.getName();
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

    private static boolean isFeatureApi(String packageName, String simpleName, String featureName) {
        return packageName.equals("src.domain." + featureName)
                || packageName.startsWith("src.domain." + featureName + ".api");
    }
}
