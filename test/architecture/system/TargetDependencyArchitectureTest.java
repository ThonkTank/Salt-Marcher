package architecture.system;

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
public final class TargetDependencyArchitectureTest {

    private TargetDependencyArchitectureTest() {
    }

    @ArchTest
    static final ArchRule targetPackagesRespectPermanentDependencyDirection =
            classes()
                    .that()
                    .resideInAnyPackage("app..", "shell..", "platform..", "features..")
                    .should(respectTargetDependencyDirection())
                    .allowEmptyShould(true);

    private static ArchCondition<JavaClass> respectTargetDependencyDirection() {
        return new ArchCondition<>("respect the permanent app, shell, platform, and feature boundaries") {
            @Override
            public void check(JavaClass item, ConditionEvents events) {
                TargetPackage source = TargetPackage.from(item);
                if (source.featureArea == FeatureArea.INVALID) {
                    events.add(SimpleConditionEvent.violated(
                            item,
                            item.getName() + " must reside in a feature api, domain, application, "
                                    + "adapter/sqlite, adapter/resource, adapter/javafx, or exact feature-root package"));
                }
                if (source.root == TargetRoot.PLATFORM
                        && !TargetPackage.isValidPlatformPackage(item.getPackageName())) {
                    events.add(SimpleConditionEvent.violated(
                            item,
                            item.getName() + " must reside in platform.execution, platform.persistence, "
                                    + "platform.diagnostics, platform.state, or platform.ui"));
                }
                for (Dependency dependency : item.getDirectDependenciesFromSelf()) {
                    JavaClass targetClass = dependency.getTargetClass();
                    if (source.forbidsMechanism(targetClass.getPackageName())) {
                        events.add(SimpleConditionEvent.violated(
                                item,
                                item.getName() + " must not depend on mechanism " + targetClass.getName()));
                        continue;
                    }
                    if (source.forbidsPlatformCapability(targetClass.getPackageName())) {
                        events.add(SimpleConditionEvent.violated(
                                item,
                                item.getName() + " must not depend on platform capability "
                                        + targetClass.getName()));
                        continue;
                    }
                    TargetPackage target = TargetPackage.from(targetClass);
                    if (!source.forbids(target)) {
                        continue;
                    }
                    events.add(SimpleConditionEvent.violated(
                            item,
                            item.getName() + " must not depend on " + targetClass.getName()));
                }
            }
        };
    }

    private record TargetPackage(
            TargetRoot root,
            String feature,
            FeatureArea featureArea,
            boolean shellApi,
            String packageName) {

        private static TargetPackage from(JavaClass javaClass) {
            String packageName = javaClass.getPackageName();
            if (inPackage(packageName, "app")) {
                return new TargetPackage(TargetRoot.APP, "", FeatureArea.NONE, false, packageName);
            }
            if (inPackage(packageName, "shell")) {
                return new TargetPackage(
                        TargetRoot.SHELL,
                        "",
                        FeatureArea.NONE,
                        inPackage(packageName, "shell.api"),
                        packageName);
            }
            if (inPackage(packageName, "platform")) {
                return new TargetPackage(TargetRoot.PLATFORM, "", FeatureArea.NONE, false, packageName);
            }
            if (inPackage(packageName, "bootstrap") || inPackage(packageName, "src")) {
                return new TargetPackage(TargetRoot.LEGACY, "", FeatureArea.NONE, false, packageName);
            }
            if (!inPackage(packageName, "features")) {
                return new TargetPackage(TargetRoot.OUTSIDE, "", FeatureArea.NONE, false, packageName);
            }
            String[] segments = packageName.split("\\.");
            String feature = segments.length > 1 ? segments[1] : "";
            FeatureArea area = segments.length == 2
                    ? FeatureArea.COMPOSITION
                    : segments.length > 2
                            ? FeatureArea.from(segments[2], segments.length > 3 ? segments[3] : "")
                            : FeatureArea.INVALID;
            return new TargetPackage(TargetRoot.FEATURE, feature, area, false, packageName);
        }

        private boolean forbids(TargetPackage target) {
            if (target.root == TargetRoot.OUTSIDE) {
                return false;
            }
            if (target.root == TargetRoot.LEGACY) {
                return true;
            }
            if (root == TargetRoot.APP) {
                return target.root == TargetRoot.FEATURE
                        && target.featureArea != FeatureArea.API
                        && target.featureArea != FeatureArea.COMPOSITION;
            }
            if (root == target.root) {
                if (root == TargetRoot.SHELL) {
                    return shellApi && !target.shellApi;
                }
                return root == TargetRoot.FEATURE && forbidsFeatureDependency(target);
            }
            return switch (root) {
                case SHELL -> target.root == TargetRoot.APP
                        || target.root == TargetRoot.FEATURE
                        || (shellApi && target.root == TargetRoot.PLATFORM);
                case PLATFORM -> target.root == TargetRoot.APP
                        || target.root == TargetRoot.SHELL
                        || target.root == TargetRoot.FEATURE;
                case FEATURE -> target.root == TargetRoot.APP
                        || (target.root == TargetRoot.SHELL
                                && (!target.shellApi || !mayUseShellApi()));
                case APP, LEGACY, OUTSIDE -> false;
            };
        }

        private boolean forbidsFeatureDependency(TargetPackage target) {
            if (target.featureArea == FeatureArea.INVALID) {
                return true;
            }
            if (!feature.equals(target.feature)) {
                return switch (featureArea) {
                    case APPLICATION, COMPOSITION -> target.featureArea != FeatureArea.API;
                    case JAVAFX_ADAPTER -> target.featureArea != FeatureArea.API;
                    case API, DOMAIN, SQLITE_ADAPTER, RESOURCE_ADAPTER, INVALID, NONE -> true;
                };
            }
            return switch (featureArea) {
                case API -> target.featureArea != FeatureArea.API;
                case DOMAIN -> target.featureArea != FeatureArea.DOMAIN;
                case APPLICATION -> target.featureArea == FeatureArea.SQLITE_ADAPTER
                        || target.featureArea == FeatureArea.JAVAFX_ADAPTER
                        || target.featureArea == FeatureArea.COMPOSITION;
                case SQLITE_ADAPTER -> target.featureArea == FeatureArea.JAVAFX_ADAPTER
                        || target.featureArea == FeatureArea.COMPOSITION;
                case RESOURCE_ADAPTER -> target.featureArea != FeatureArea.API
                        && target.featureArea != FeatureArea.DOMAIN
                        && target.featureArea != FeatureArea.RESOURCE_ADAPTER;
                case JAVAFX_ADAPTER -> target.featureArea != FeatureArea.API
                        && target.featureArea != FeatureArea.DOMAIN
                        && target.featureArea != FeatureArea.APPLICATION
                        && target.featureArea != FeatureArea.JAVAFX_ADAPTER;
                case COMPOSITION, NONE -> false;
                case INVALID -> true;
            };
        }

        private boolean mayUseShellApi() {
            return featureArea == FeatureArea.JAVAFX_ADAPTER
                    || featureArea == FeatureArea.COMPOSITION;
        }

        private boolean forbidsMechanism(String packageName) {
            boolean javaFx = inPackage(packageName, "javafx");
            boolean jdbc = inPackage(packageName, "java.sql")
                    || inPackage(packageName, "javax.sql")
                    || inPackage(packageName, "org.sqlite");
            boolean fileIo = inPackage(packageName, "java.io")
                    || inPackage(packageName, "java.nio.file")
                    || inPackage(packageName, "java.nio.channels");
            if (jdbc) {
                return !(root == TargetRoot.FEATURE && featureArea == FeatureArea.SQLITE_ADAPTER)
                        && !(root == TargetRoot.PLATFORM
                                && inPackage(this.packageName, "platform.persistence"));
            }
            if (root != TargetRoot.FEATURE) {
                return false;
            }
            return switch (featureArea) {
                case API, DOMAIN, APPLICATION -> javaFx || jdbc || fileIo;
                case SQLITE_ADAPTER, RESOURCE_ADAPTER -> javaFx;
                case JAVAFX_ADAPTER, COMPOSITION -> jdbc || fileIo;
                case INVALID, NONE -> javaFx || jdbc || fileIo;
            };
        }

        private boolean forbidsPlatformCapability(String packageName) {
            if (!inPackage(packageName, "platform")) {
                return false;
            }
            if (root == TargetRoot.SHELL) {
                return shellApi
                        || (!inPackage(packageName, "platform.ui")
                                && !inPackage(packageName, "platform.diagnostics"));
            }
            if (root != TargetRoot.FEATURE) {
                return false;
            }
            return switch (featureArea) {
                case API -> !inAnyPlatformPackage(packageName, "state", "ui");
                case APPLICATION -> !inAnyPlatformPackage(
                        packageName, "execution", "state", "ui", "diagnostics");
                case SQLITE_ADAPTER -> !inAnyPlatformPackage(
                        packageName, "persistence", "diagnostics");
                case RESOURCE_ADAPTER -> !inAnyPlatformPackage(packageName, "diagnostics");
                case JAVAFX_ADAPTER -> !inAnyPlatformPackage(packageName, "ui");
                case COMPOSITION -> !isValidPlatformPackage(packageName);
                case DOMAIN, INVALID, NONE -> true;
            };
        }

        private static boolean inAnyPlatformPackage(String packageName, String... capabilities) {
            for (String capability : capabilities) {
                if (inPackage(packageName, "platform." + capability)) {
                    return true;
                }
            }
            return false;
        }

        private static boolean isValidPlatformPackage(String packageName) {
            return inAnyPlatformPackage(
                    packageName, "execution", "persistence", "diagnostics", "state", "ui");
        }

        private static boolean inPackage(String actual, String expected) {
            return actual.equals(expected) || actual.startsWith(expected + ".");
        }
    }

    private enum TargetRoot {
        APP,
        SHELL,
        PLATFORM,
        FEATURE,
        LEGACY,
        OUTSIDE
    }

    private enum FeatureArea {
        API,
        DOMAIN,
        APPLICATION,
        SQLITE_ADAPTER,
        RESOURCE_ADAPTER,
        JAVAFX_ADAPTER,
        COMPOSITION,
        INVALID,
        NONE;

        private static FeatureArea from(String segment, String nestedSegment) {
            return switch (segment) {
                case "api" -> API;
                case "domain" -> DOMAIN;
                case "application" -> APPLICATION;
                case "adapter" -> switch (nestedSegment) {
                    case "sqlite" -> SQLITE_ADAPTER;
                    case "resource" -> RESOURCE_ADAPTER;
                    case "javafx" -> JAVAFX_ADAPTER;
                    default -> INVALID;
                };
                default -> INVALID;
            };
        }
    }
}
