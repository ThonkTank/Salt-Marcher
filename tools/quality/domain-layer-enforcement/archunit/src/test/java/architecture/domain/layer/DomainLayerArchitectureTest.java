package architecture.domain.layer;

import static com.tngtech.archunit.lang.syntax.ArchRuleDefinition.classes;
import static com.tngtech.archunit.lang.syntax.ArchRuleDefinition.noClasses;

import architecture.AnalyzeMainClasses;
import com.tngtech.archunit.core.domain.Dependency;
import com.tngtech.archunit.core.domain.JavaClass;
import com.tngtech.archunit.core.domain.JavaField;
import com.tngtech.archunit.core.domain.JavaMethod;
import com.tngtech.archunit.junit.ArchTest;
import com.tngtech.archunit.lang.ArchCondition;
import com.tngtech.archunit.lang.ArchRule;
import com.tngtech.archunit.lang.ConditionEvents;
import com.tngtech.archunit.lang.SimpleConditionEvent;
import java.util.Set;

@AnalyzeMainClasses
public final class DomainLayerArchitectureTest {

    private static final Set<String> PASSIVE_JDK_PACKAGES = Set.of(
            "java.",
            "javax.",
            "jakarta.");

    private DomainLayerArchitectureTest() {
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
    static final ArchRule domainInternalModelMustNotReachSameContextApplicationBoundary =
            classes()
                    .that()
                    .resideInAPackage("src.domain..model..")
                    .should(notDependOnSameContextApplicationBoundaryFromInternalModel());

    @ArchTest
    static final ArchRule domainInternalModelMustNotDependOnPortsOrRepositories =
            classes()
                    .that()
                    .resideInAPackage("src.domain..model..model..")
                    .should(notDependOnPortsOrRepositoriesFromInternalModel());

    @ArchTest
    static final ArchRule domainRootApplicationServicesMustStayOnApplicationOrPublishedSeams =
            classes()
                    .that()
                    .resideInAPackage("src.domain..")
                    .should(rootApplicationServicesMustStayOnApplicationOrPublishedSeams());

    @ArchTest
    static final ArchRule domainUseCasesMustStayOnApplicationOrModelRoles =
            classes()
                    .that()
                    .haveSimpleNameEndingWith("UseCase")
                    .and()
                    .resideInAPackage("src.domain..")
                    .should(useCasesMustStayOnApplicationOrModelRoles());

    @ArchTest
    static final ArchRule domainHelpersMustOnlyDependOnConstants =
            classes()
                    .that()
                    .haveSimpleNameEndingWith("Helper")
                    .and()
                    .resideInAPackage("src.domain..")
                    .should(helpersMustOnlyDependOnConstants());

    @ArchTest
    static final ArchRule domainConstantsMustBeStaticImmutableHolders =
            classes()
                    .that()
                    .haveSimpleNameEndingWith("Constants")
                    .and()
                    .resideInAPackage("src.domain..")
                    .should(constantsMustBeStaticImmutableHolders());

    @ArchTest
    static final ArchRule domainPortsMustOnlyDependOnForeignPublishedModelsAndSameContextUseCases =
            classes()
                    .that()
                    .haveSimpleNameEndingWith("Port")
                    .and()
                    .resideInAPackage("src.domain..")
                    .should(portsMustOnlyDependOnForeignPublishedModelsAndSameContextUseCases());

    @ArchTest
    static final ArchRule domainRepositoriesMustStayOffPublishedAndDataSignatures =
            classes()
                    .that()
                    .haveSimpleNameEndingWith("Repository")
                    .and()
                    .resideInAPackage("src.domain..")
                    .should(repositoriesMustStayOffPublishedAndDataSignatures());

    @ArchTest
    static final ArchRule domainInternalModelsMustNotDependOnPublishedTypes =
            noClasses()
                    .that()
                    .resideInAPackage("src.domain..model..model..")
                    .should()
                    .dependOnClassesThat()
                    .resideInAPackage("src.domain..published..");

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

    private static ArchCondition<JavaClass> notDependOnSameContextApplicationBoundaryFromInternalModel() {
        return new ArchCondition<>("not depend on same-context root/application packages from internal model code") {
            @Override
            public void check(JavaClass item, ConditionEvents events) {
                String sourceFeature = domainFeatureName(item.getPackageName());
                if (sourceFeature == null) {
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

    private static ArchCondition<JavaClass> notDependOnPortsOrRepositoriesFromInternalModel() {
        return new ArchCondition<>("not depend on same-context port or repository roles from internal model code") {
            @Override
            public void check(JavaClass item, ConditionEvents events) {
                String sourceFeature = domainFeatureName(item.getPackageName());
                if (sourceFeature == null) {
                    return;
                }
                for (Dependency dependency : item.getDirectDependenciesFromSelf()) {
                    JavaClass target = dependency.getTargetClass();
                    String targetPackage = target.getPackageName();
                    if (!targetPackage.startsWith("src.domain." + sourceFeature + ".model.")) {
                        continue;
                    }
                    if (!targetPackage.matches("^src\\.domain\\." + sourceFeature + "\\.model\\.[^.]+\\.(port|repository)(\\..*)?$")) {
                        continue;
                    }
                    events.add(SimpleConditionEvent.violated(
                            item,
                            item.getName() + " depends on same-context port/repository role " + target.getName()));
                }
            }
        };
    }

    private static ArchCondition<JavaClass> rootApplicationServicesMustStayOnApplicationOrPublishedSeams() {
        return new ArchCondition<>("stay on same-context application/published seams only from root ApplicationService code") {
            @Override
            public void check(JavaClass item, ConditionEvents events) {
                if (!isRootApplicationService(item)) {
                    return;
                }
                String sourceFeature = domainFeatureName(item.getPackageName());
                if (sourceFeature == null) {
                    return;
                }
                String rootPackage = "src.domain." + sourceFeature;
                String applicationPackage = rootPackage + ".application";
                String publishedPackage = rootPackage + ".published";
                for (Dependency dependency : item.getDirectDependenciesFromSelf()) {
                    JavaClass target = dependency.getTargetClass();
                    String targetPackage = target.getPackageName();
                    if (!targetPackage.startsWith("src.domain.")) {
                        continue;
                    }
                    if (targetPackage.equals(applicationPackage) || targetPackage.startsWith(applicationPackage + ".")) {
                        continue;
                    }
                    if (targetPackage.equals(publishedPackage) || targetPackage.startsWith(publishedPackage + ".")) {
                        continue;
                    }
                    events.add(SimpleConditionEvent.violated(
                            item,
                            item.getName() + " depends on non-boundary domain type " + target.getName()));
                }
            }
        };
    }

    private static ArchCondition<JavaClass> useCasesMustStayOnApplicationOrModelRoles() {
        return new ArchCondition<>("only depend on same-context application/model roles and passive JDK types") {
            @Override
            public void check(JavaClass item, ConditionEvents events) {
                String sourceFeature = domainFeatureName(item.getPackageName());
                if (sourceFeature == null) {
                    return;
                }
                String rootPackage = "src.domain." + sourceFeature;
                String applicationPackage = rootPackage + ".application";
                String modelPackage = rootPackage + ".model";
                for (Dependency dependency : item.getDirectDependenciesFromSelf()) {
                    JavaClass target = dependency.getTargetClass();
                    String targetPackage = target.getPackageName();
                    if (isPassiveJdkPackage(targetPackage)) {
                        continue;
                    }
                    if (!targetPackage.startsWith("src.domain.")) {
                        continue;
                    }
                    if (targetPackage.equals(applicationPackage) || targetPackage.startsWith(applicationPackage + ".")) {
                        continue;
                    }
                    if (targetPackage.equals(modelPackage) || targetPackage.startsWith(modelPackage + ".")) {
                        continue;
                    }
                    events.add(SimpleConditionEvent.violated(
                            item,
                            item.getName() + " depends on non-usecase domain collaborator " + target.getName()));
                }
            }
        };
    }

    private static ArchCondition<JavaClass> helpersMustOnlyDependOnConstants() {
        return new ArchCondition<>("depend only on same-family Constants or passive JDK types") {
            @Override
            public void check(JavaClass item, ConditionEvents events) {
                String helperConstantsPackage = helperSiblingPackage(item.getPackageName(), "constants");
                if (helperConstantsPackage == null) {
                    return;
                }
                for (Dependency dependency : item.getDirectDependenciesFromSelf()) {
                    JavaClass target = dependency.getTargetClass();
                    String targetPackage = target.getPackageName();
                    if (isPassiveJdkPackage(targetPackage)) {
                        continue;
                    }
                    if (!targetPackage.startsWith("src.domain.")) {
                        continue;
                    }
                    if (targetPackage.equals(helperConstantsPackage) || targetPackage.startsWith(helperConstantsPackage + ".")) {
                        continue;
                    }
                    events.add(SimpleConditionEvent.violated(
                            item,
                            item.getName() + " depends on non-constants domain collaborator " + target.getName()));
                }
            }
        };
    }

    private static ArchCondition<JavaClass> constantsMustBeStaticImmutableHolders() {
        return new ArchCondition<>("stay as static immutable holders without runtime or state ownership") {
            @Override
            public void check(JavaClass item, ConditionEvents events) {
                if (!item.getModifiers().contains(com.tngtech.archunit.core.domain.JavaModifier.FINAL)
                        && !item.isEnum()) {
                    events.add(SimpleConditionEvent.violated(
                            item,
                            item.getName() + " must be final or enum-shaped."));
                }
                for (JavaField field : item.getFields()) {
                    if (field.getOwner().getName().equals(item.getName())
                            && !field.getModifiers().contains(com.tngtech.archunit.core.domain.JavaModifier.STATIC)) {
                        events.add(SimpleConditionEvent.violated(
                                item,
                                item.getName() + " owns non-static field " + field.getName()));
                    }
                }
                for (JavaMethod method : item.getMethods()) {
                    if (!method.getOwner().getName().equals(item.getName())) {
                        continue;
                    }
                    if (method.getName().equals("<init>")) {
                        continue;
                    }
                    if (!method.getModifiers().contains(com.tngtech.archunit.core.domain.JavaModifier.STATIC)) {
                        events.add(SimpleConditionEvent.violated(
                                item,
                                item.getName() + " exposes non-static method " + method.getName()));
                    }
                }
                for (Dependency dependency : item.getDirectDependenciesFromSelf()) {
                    JavaClass target = dependency.getTargetClass();
                    String targetPackage = target.getPackageName();
                    if (isPassiveJdkPackage(targetPackage)) {
                        continue;
                    }
                    if (targetPackage.startsWith("src.domain.")) {
                        events.add(SimpleConditionEvent.violated(
                                item,
                                item.getName() + " depends on domain runtime type " + target.getName()));
                    }
                }
            }
        };
    }

    private static ArchCondition<JavaClass> portsMustOnlyDependOnForeignPublishedModelsAndSameContextUseCases() {
        return new ArchCondition<>("depend only on foreign published models and same-context model-local usecases") {
            @Override
            public void check(JavaClass item, ConditionEvents events) {
                String sourceFeature = domainFeatureName(item.getPackageName());
                String sameContextModelUseCasePackage = portSiblingPackage(item.getPackageName(), "usecase");
                if (sourceFeature == null || sameContextModelUseCasePackage == null) {
                    return;
                }
                for (Dependency dependency : item.getDirectDependenciesFromSelf()) {
                    JavaClass target = dependency.getTargetClass();
                    String targetPackage = target.getPackageName();
                    if (isPassiveJdkPackage(targetPackage)) {
                        continue;
                    }
                    if (!targetPackage.startsWith("src.domain.")) {
                        continue;
                    }
                    String targetFeature = domainFeatureName(targetPackage);
                    if (targetFeature != null && !targetFeature.equals(sourceFeature)
                            && isPublishedModel(target)) {
                        continue;
                    }
                    if (targetPackage.equals(sameContextModelUseCasePackage)
                            || targetPackage.startsWith(sameContextModelUseCasePackage + ".")) {
                        continue;
                    }
                    events.add(SimpleConditionEvent.violated(
                            item,
                            item.getName() + " depends on illegal port collaborator " + target.getName()));
                }
            }
        };
    }

    private static ArchCondition<JavaClass> repositoriesMustStayOffPublishedAndDataSignatures() {
        return new ArchCondition<>("depend only on same-context application/model roles or foreign root ApplicationServices") {
            @Override
            public void check(JavaClass item, ConditionEvents events) {
                String sourceFeature = domainFeatureName(item.getPackageName());
                if (sourceFeature == null) {
                    return;
                }
                String rootPackage = "src.domain." + sourceFeature;
                String applicationPackage = rootPackage + ".application";
                String modelPackage = rootPackage + ".model";
                for (Dependency dependency : item.getDirectDependenciesFromSelf()) {
                    JavaClass target = dependency.getTargetClass();
                    String targetPackage = target.getPackageName();
                    if (isPassiveJdkPackage(targetPackage)) {
                        continue;
                    }
                    if (targetPackage.startsWith("src.data.")) {
                        events.add(SimpleConditionEvent.violated(
                                item,
                                item.getName() + " depends on src.data type " + target.getName()));
                        continue;
                    }
                    if (!targetPackage.startsWith("src.domain.")) {
                        continue;
                    }
                    if (targetPackage.contains(".published.")) {
                        events.add(SimpleConditionEvent.violated(
                                item,
                                item.getName() + " depends on published carrier " + target.getName()));
                        continue;
                    }
                    String targetFeature = domainFeatureName(targetPackage);
                    if (sourceFeature.equals(targetFeature)) {
                        if (targetPackage.equals(applicationPackage) || targetPackage.startsWith(applicationPackage + ".")) {
                            continue;
                        }
                        if (targetPackage.equals(modelPackage) || targetPackage.startsWith(modelPackage + ".")) {
                            continue;
                        }
                    } else if (isRootApplicationService(target)) {
                        continue;
                    }
                    events.add(SimpleConditionEvent.violated(
                            item,
                            item.getName() + " depends on illegal repository collaborator " + target.getName()));
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

    private static boolean isRootApplicationService(JavaClass javaClass) {
        String packageName = javaClass.getPackageName();
        String feature = domainFeatureName(packageName);
        return feature != null
                && packageName.equals("src.domain." + feature)
                && javaClass.getSimpleName().endsWith("ApplicationService");
    }

    private static String helperSiblingPackage(String packageName, String siblingRole) {
        String marker = ".helper";
        int markerIndex = packageName.indexOf(marker);
        if (markerIndex < 0) {
            return null;
        }
        return packageName.substring(0, markerIndex) + "." + siblingRole;
    }

    private static String portSiblingPackage(String packageName, String siblingRole) {
        String marker = ".port";
        int markerIndex = packageName.indexOf(marker);
        if (markerIndex < 0) {
            return null;
        }
        return packageName.substring(0, markerIndex) + "." + siblingRole;
    }

    private static boolean isPublishedModel(JavaClass javaClass) {
        return javaClass.getPackageName().contains(".published.")
                && javaClass.getSimpleName().endsWith("Model");
    }

    private static boolean isPassiveJdkPackage(String packageName) {
        for (String prefix : PASSIVE_JDK_PACKAGES) {
            if (packageName.startsWith(prefix)) {
                return true;
            }
        }
        return false;
    }
}
