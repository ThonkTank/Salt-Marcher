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
import java.util.Set;

@AnalyzeMainClasses
public final class LayerDependencyDirectionArchitectureTest {

    private static final Set<String> DOMAIN_SHELL_REGISTRATION_TARGETS = Set.of(
            "shell.api.ServiceRegistry",
            "shell.api.ServiceRegistry$Builder",
            "shell.api.ServiceContribution");

    private LayerDependencyDirectionArchitectureTest() {
    }

    @ArchTest
    static final ArchRule sourceCodeDependenciesMustPointInward =
            classes()
                    .that()
                    .resideInAnyPackage("bootstrap..", "shell..", "src.view..", "src.domain..", "src.data..")
                    .should(respectRetainedLayerDependencyDirection());

    private static ArchCondition<JavaClass> respectRetainedLayerDependencyDirection() {
        return new ArchCondition<>("respect retained layer dependency direction") {
            @Override
            public void check(JavaClass item, ConditionEvents events) {
                Layer sourceLayer = layerOf(item);
                if (sourceLayer == null) {
                    return;
                }
                for (Dependency dependency : item.getDirectDependenciesFromSelf()) {
                    JavaClass target = dependency.getTargetClass();
                    Layer targetLayer = layerOf(target);
                    if (targetLayer == null || targetLayer == sourceLayer) {
                        continue;
                    }
                    if (!isForbidden(sourceLayer, targetLayer)) {
                        continue;
                    }
                    if (isAllowedDomainShellRegistrationDependency(item, target)) {
                        continue;
                    }
                    events.add(SimpleConditionEvent.violated(
                            item,
                            item.getName() + " must not depend on " + target.getName()
                                    + " (" + sourceLayer + " -> " + targetLayer + ")"));
                }
            }
        };
    }

    private static boolean isForbidden(Layer sourceLayer, Layer targetLayer) {
        return switch (sourceLayer) {
            case DOMAIN -> targetLayer == Layer.BOOTSTRAP
                    || targetLayer == Layer.SHELL
                    || targetLayer == Layer.VIEW
                    || targetLayer == Layer.DATA;
            case VIEW -> targetLayer == Layer.DATA;
            case DATA -> targetLayer == Layer.BOOTSTRAP
                    || targetLayer == Layer.VIEW;
            case SHELL -> targetLayer == Layer.BOOTSTRAP
                    || targetLayer == Layer.VIEW
                    || targetLayer == Layer.DOMAIN
                    || targetLayer == Layer.DATA;
            case BOOTSTRAP -> targetLayer == Layer.VIEW
                    || targetLayer == Layer.DOMAIN
                    || targetLayer == Layer.DATA;
        };
    }

    private static boolean isAllowedDomainShellRegistrationDependency(JavaClass source, JavaClass target) {
        if (layerOf(source) != Layer.DOMAIN || layerOf(target) != Layer.SHELL) {
            return false;
        }
        return isRootDomainRegistrationSource(source)
                && DOMAIN_SHELL_REGISTRATION_TARGETS.contains(target.getName());
    }

    private static boolean isRootDomainRegistrationSource(JavaClass source) {
        String packageName = source.getPackageName();
        if (!packageName.startsWith("src.domain.")) {
            return false;
        }
        String rest = packageName.substring("src.domain.".length());
        if (rest.contains(".")) {
            return false;
        }
        String simpleName = source.getName().substring(packageName.length() + 1);
        return simpleName.matches("[A-Za-z0-9]+Service(Assembly|Contribution)(\\$.*)?");
    }

    private static Layer layerOf(JavaClass javaClass) {
        String packageName = javaClass.getPackageName();
        if (packageName.equals("bootstrap") || packageName.startsWith("bootstrap.")) {
            return Layer.BOOTSTRAP;
        }
        if (packageName.equals("shell") || packageName.startsWith("shell.")) {
            return Layer.SHELL;
        }
        if (packageName.equals("src.view") || packageName.startsWith("src.view.")) {
            return Layer.VIEW;
        }
        if (packageName.equals("src.domain") || packageName.startsWith("src.domain.")) {
            return Layer.DOMAIN;
        }
        if (packageName.equals("src.data") || packageName.startsWith("src.data.")) {
            return Layer.DATA;
        }
        return null;
    }

    private enum Layer {
        BOOTSTRAP,
        SHELL,
        VIEW,
        DOMAIN,
        DATA
    }
}
