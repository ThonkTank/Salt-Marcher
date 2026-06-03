package architecture.domain.layer;

import static com.tngtech.archunit.lang.syntax.ArchRuleDefinition.classes;
import static com.tngtech.archunit.library.modules.syntax.ModuleDependencyScope.consideringOnlyDependenciesBetweenModules;
import static com.tngtech.archunit.library.modules.syntax.ModuleRuleDefinition.modules;

import architecture.AnalyzeMainClasses;
import com.tngtech.archunit.base.DescribedPredicate;
import com.tngtech.archunit.core.domain.Dependency;
import com.tngtech.archunit.core.domain.JavaClass;
import com.tngtech.archunit.core.domain.JavaModifier;
import com.tngtech.archunit.junit.ArchTest;
import com.tngtech.archunit.lang.ArchCondition;
import com.tngtech.archunit.lang.ArchRule;
import com.tngtech.archunit.lang.ConditionEvents;
import com.tngtech.archunit.lang.SimpleConditionEvent;
import com.tngtech.archunit.library.modules.syntax.AllowedModuleDependencies;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Map;
import java.util.Set;
import java.util.TreeMap;
import java.util.TreeSet;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@AnalyzeMainClasses
public final class DomainLayerArchitectureTest {

    private static final Path DOMAIN_LAYER_STANDARD =
            Path.of("docs/project/architecture/patterns/domain-layer.md");
    private static final Pattern COMPACT_CONTEXT_DEPENDENCY_MARKER_PATTERN =
            Pattern.compile("mechanical-domain-dependencies:\\s*([^>]+)");
    private static final Pattern DOMAIN_CONTEXT_NAME_PATTERN =
            Pattern.compile("[a-z][a-z0-9_]*");

    private DomainLayerArchitectureTest() {
    }

    @ArchTest
    static final ArchRule domainMustStayIndependentFromOuterLayers =
            classes()
                    .that()
                    .resideInAPackage("src.domain..")
                    .should(dependOnlyOnAllowedOuterLayerPackages());

    @ArchTest
    static final ArchRule domainContextsMustOnlyUseForeignContextPublicBoundaries =
            domainContextModules()
                    .should()
                    .onlyDependOnEachOtherThroughClassesThat(foreignDomainPublicBoundary())
                    .as("domain contexts must only use foreign context public boundaries");

    @ArchTest
    static final ArchRule publicBackendBoundariesBelowViewMustBeRootDomainApplicationServicesOrServiceContributions =
            classes()
                    .that()
                    .resideInAnyPackage("src.domain.*")
                    .and()
                    .arePublic()
                    .should(beRootApplicationServiceOrServiceContributionRoot())
                    .as("public backend boundaries below view must be root domain ApplicationService classes "
                            + "or documented domain ServiceContribution registration roots");

    @ArchTest
    static final ArchRule domainServiceAssembliesMustOnlyDependOnAllowedAssemblyConcerns =
            classes()
                    .that()
                    .haveSimpleNameEndingWith("ServiceAssembly")
                    .and()
                    .resideInAnyPackage("src.domain.*")
                    .should(onlyDependOnAllowedDomainPackages(
                            "same-context assembly, publication, application, model roles, and allowed foreign public seams only",
                            DomainLayerArchitectureTest::isAllowedForServiceAssembly))
                    .allowEmptyShould(true);

    @ArchTest
    static final ArchRule domainServiceAssembliesMustStayPackagePrivate =
            classes()
                    .that()
                    .haveSimpleNameEndingWith("ServiceAssembly")
                    .and()
                    .resideInAnyPackage("src.domain.*")
                    .should(bePackagePrivateServiceAssembly())
                    .as("domain ServiceAssembly roots must stay package-private assembly parts")
                    .allowEmptyShould(true);

    @ArchTest
    static final ArchRule domainContextsMustRespectMarkdownAllowedDependencies =
            domainContextModules()
                    .should()
                    .respectTheirAllowedDependencies(
                            allowedDomainContextDependencies(),
                            consideringOnlyDependenciesBetweenModules())
                    .as("domain contexts must respect markdown allowed dependencies");

    @ArchTest
    static final ArchRule domainContextDependencyGraphMustBeAcyclic =
            domainContextModules()
                    .should()
                    .beFreeOfCycles()
                    .as("domain context dependency graph must be acyclic");

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
                    .that(isInternalModelClass())
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
                            DomainLayerArchitectureTest::isAllowedForConstants))
                    .allowEmptyShould(true);

    @ArchTest
    static final ArchRule domainPortsMustOnlyDependOnForeignPublishedAndSameContextFollowUpRoles =
            classes()
                    .that()
                    .resideInAPackage("src.domain..model..port..")
                    .should(onlyDependOnAllowedDomainPackages(
                            "foreign published state plus same-context use cases, models, and constants only",
                            DomainLayerArchitectureTest::isAllowedForPort))
                    .allowEmptyShould(true);

    @ArchTest
    static final ArchRule domainRepositoriesMustOnlyDependOnForeignRootsAndSameContextInternals =
            classes()
                    .that()
                    .resideInAPackage("src.domain..model..repository..")
                    .should(onlyDependOnAllowedDomainPackages(
                            "foreign root application services plus same-context model/constants/repository internals only",
                            DomainLayerArchitectureTest::isAllowedForRepository));

    private static com.tngtech.archunit.library.modules.syntax.GivenModules<?> domainContextModules() {
        return modules()
                .definedByPackages("src.domain.(*)..")
                .derivingNameFromPattern("$1");
    }

    private static DescribedPredicate<JavaClass> foreignDomainPublicBoundary() {
        return DescribedPredicate.describe(
                "reside in foreign published packages or be foreign root ApplicationService classes",
                javaClass -> isPublishedPackage(javaClass.getPackageName())
                        || isRootApplicationService(javaClass));
    }

    private static boolean isPublishedPackage(String packageName) {
        String targetFeature = domainFeatureName(packageName);
        return targetFeature != null && isSameFeaturePublishedPackage(packageName, targetFeature);
    }

    private static boolean isRootApplicationService(JavaClass javaClass) {
        return javaClass.getSimpleName().endsWith("ApplicationService")
                && javaClass.getPackageName().equals("src.domain." + domainFeatureName(javaClass.getPackageName()));
    }

    private static ArchCondition<JavaClass> beRootApplicationServiceOrServiceContributionRoot() {
        return new ArchCondition<>("be a root ApplicationService or ServiceContribution root") {
            @Override
            public void check(JavaClass item, ConditionEvents events) {
                if (isRootApplicationService(item) || isDomainServiceContributionRoot(item)) {
                    return;
                }
                events.add(SimpleConditionEvent.violated(
                        item,
                        item.getName()
                                + " is a public root domain type below view but not a root ApplicationService "
                                + "or documented ServiceContribution registration root"));
            }
        };
    }

    private static ArchCondition<JavaClass> bePackagePrivateServiceAssembly() {
        return new ArchCondition<>("be package-private") {
            @Override
            public void check(JavaClass item, ConditionEvents events) {
                if (!item.getModifiers().contains(JavaModifier.PUBLIC)) {
                    return;
                }
                events.add(SimpleConditionEvent.violated(
                        item,
                        item.getName() + " is a public ServiceAssembly; ServiceAssembly roots must stay package-private"));
            }
        };
    }

    private static AllowedModuleDependencies allowedDomainContextDependencies() {
        Map<String, Set<String>> dependencies = parseAllowedContextDependencies(readDomainLayerStandard());
        if (dependencies.isEmpty()) {
            throw new IllegalStateException(DOMAIN_LAYER_STANDARD
                    + " must declare mechanical context dependencies with `mechanical-domain-dependencies:`.");
        }
        AllowedModuleDependencies allowed = null;
        for (Map.Entry<String, Set<String>> entry : dependencies.entrySet()) {
            validateContextName(entry.getKey());
            entry.getValue().forEach(DomainLayerArchitectureTest::validateContextName);
            String[] targets = entry.getValue().toArray(String[]::new);
            allowed = allowed == null
                    ? AllowedModuleDependencies.allow().fromModule(entry.getKey()).toModules(targets)
                    : allowed.fromModule(entry.getKey()).toModules(targets);
        }
        return allowed;
    }

    private static String readDomainLayerStandard() {
        try {
            return Files.readString(DOMAIN_LAYER_STANDARD, StandardCharsets.UTF_8);
        } catch (IOException exception) {
            throw new IllegalStateException("Could not read " + DOMAIN_LAYER_STANDARD, exception);
        }
    }

    private static Map<String, Set<String>> parseAllowedContextDependencies(String content) {
        Matcher matcher = COMPACT_CONTEXT_DEPENDENCY_MARKER_PATTERN.matcher(content);
        if (!matcher.find()) {
            return Map.of();
        }
        Map<String, Set<String>> allowed = new TreeMap<>();
        String markerContent = matcher.group(1).replaceFirst("\\s*--\\s*$", "");
        for (String dependency : markerContent.split(";")) {
            String[] parts = dependency.trim().split("=", 2);
            if (parts.length != 2 || parts[0].trim().isEmpty()) {
                throw new IllegalStateException("Malformed domain context dependency entry: " + dependency.trim());
            }
            Set<String> targets = new TreeSet<>();
            for (String target : parts[1].split(",")) {
                String trimmed = target.trim();
                if (!trimmed.isEmpty()) {
                    targets.add(trimmed);
                }
            }
            allowed.put(parts[0].trim(), targets);
        }
        return allowed;
    }

    private static void validateContextName(String contextName) {
        if (!DOMAIN_CONTEXT_NAME_PATTERN.matcher(contextName).matches()) {
            throw new IllegalStateException("Invalid domain context name in " + DOMAIN_LAYER_STANDARD + ": "
                    + contextName);
        }
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
                    if (sharesTopLevelSource(item, target)) {
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

    private static boolean sharesTopLevelSource(JavaClass source, JavaClass target) {
        return topLevelName(source).equals(topLevelName(target));
    }

    private static String topLevelName(JavaClass javaClass) {
        String name = javaClass.getName();
        int nestedTypeSeparator = name.indexOf('$');
        return nestedTypeSeparator < 0 ? name : name.substring(0, nestedTypeSeparator);
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

    private static boolean isAllowedForServiceAssembly(
            String sourcePackage,
            String sourceFeature,
            String targetPackage
    ) {
        return isSameFeatureRootPackage(targetPackage, sourceFeature)
                || isSameFeaturePublishedPackage(targetPackage, sourceFeature)
                || isSameFeatureApplicationPackage(targetPackage, sourceFeature)
                || isSameFeatureModelRolePackage(targetPackage, sourceFeature, "model")
                || isSameFeatureModelRolePackage(targetPackage, sourceFeature, "usecase")
                || isSameFeatureModelRolePackage(targetPackage, sourceFeature, "helper")
                || isSameFeatureModelRolePackage(targetPackage, sourceFeature, "constants")
                || isSameFeatureModelRolePackage(targetPackage, sourceFeature, "port")
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
        if (isSameFeatureApplicationPackage(packageName, feature)) {
            return true;
        }
        return isSameFeatureModelRolePackage(packageName, feature, "usecase");
    }

    private static boolean isSameFeatureRootPackage(String packageName, String feature) {
        return packageName.equals("src.domain." + feature);
    }

    private static boolean isSameFeatureApplicationPackage(String packageName, String feature) {
        String rootApplicationPackage = "src.domain." + feature + ".application";
        return packageName.equals(rootApplicationPackage) || packageName.startsWith(rootApplicationPackage + ".");
    }

    private static boolean isSameFeatureModelRolePackage(String packageName, String feature, String role) {
        if ("model".equals(role)) {
            return isSameFeatureInternalModelPackage(packageName, feature);
        }
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

    private static DescribedPredicate<JavaClass> isInternalModelClass() {
        return DescribedPredicate.describe(
                "reside in a same-context internal model package",
                javaClass -> {
                    String feature = domainFeatureName(javaClass.getPackageName());
                    return feature != null && isSameFeatureInternalModelPackage(javaClass.getPackageName(), feature);
                });
    }

    private static boolean isSameFeatureInternalModelPackage(String packageName, String feature) {
        String familyPrefix = "src.domain." + feature + ".model.";
        if (!packageName.startsWith(familyPrefix)) {
            return false;
        }
        String remainder = packageName.substring(familyPrefix.length());
        int familySeparator = remainder.indexOf('.');
        if (familySeparator < 0) {
            return !remainder.isBlank();
        }
        String firstAfterFamily = remainder.substring(familySeparator + 1);
        int roleSeparator = firstAfterFamily.indexOf('.');
        String segment = roleSeparator < 0 ? firstAfterFamily : firstAfterFamily.substring(0, roleSeparator);
        return !Set.of("usecase", "helper", "constants", "port", "repository").contains(segment);
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

    private static boolean isDomainServiceContributionRoot(JavaClass item) {
        String packageName = item.getPackageName();
        String simpleName = item.getSimpleName();
        return packageName.matches("^src\\.domain\\.[^.]+$")
                && simpleName.endsWith("ServiceContribution");
    }

    @FunctionalInterface
    private interface DomainDependencyPolicy {
        boolean isAllowed(String sourcePackage, String sourceFeature, String targetPackage);
    }
}
