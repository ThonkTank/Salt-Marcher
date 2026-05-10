package architecture.data.layer;

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

@AnalyzeMainClasses
public final class DataLayerArchitectureTest {

    private DataLayerArchitectureTest() {
    }

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

    private static String featureName(String packageName) {
        String domainFeatureName = domainFeatureName(packageName);
        return domainFeatureName != null ? domainFeatureName : dataFeatureName(packageName);
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

    private static String dataFeatureName(String packageName) {
        if (!packageName.startsWith("src.data.")) {
            return null;
        }
        String remainder = packageName.substring("src.data.".length());
        int separatorIndex = remainder.indexOf('.');
        return separatorIndex >= 0 ? remainder.substring(0, separatorIndex) : remainder;
    }
}
