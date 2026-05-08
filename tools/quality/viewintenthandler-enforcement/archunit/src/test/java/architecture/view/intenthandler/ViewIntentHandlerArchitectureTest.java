package architecture.view.intenthandler;

import static com.tngtech.archunit.lang.syntax.ArchRuleDefinition.classes;
import static com.tngtech.archunit.lang.syntax.ArchRuleDefinition.noClasses;

import architecture.AnalyzeMainClasses;
import architecture.view.ViewRolePredicates;
import com.tngtech.archunit.core.domain.Dependency;
import com.tngtech.archunit.core.domain.JavaClass;
import com.tngtech.archunit.junit.ArchTest;
import com.tngtech.archunit.lang.ArchCondition;
import com.tngtech.archunit.lang.ArchRule;
import com.tngtech.archunit.lang.ConditionEvents;
import com.tngtech.archunit.lang.SimpleConditionEvent;

@AnalyzeMainClasses
public final class ViewIntentHandlerArchitectureTest {

    private ViewIntentHandlerArchitectureTest() {
    }

    @ArchTest
    static final ArchRule intentHandlersMustStayShellDataAndBootstrapFree =
            noClasses()
                    .that(ViewRolePredicates.areIntentHandlers())
                    .should()
                    .dependOnClassesThat()
                    .resideInAnyPackage("shell..", "src.data..", "bootstrap..");

    @ArchTest
    static final ArchRule intentHandlersMustDependOnDomainOnlyThroughRootApplicationServices =
            classes()
                    .that(ViewRolePredicates.areIntentHandlers())
                    .should(avoidNonApplicationServiceDomainDependencies());

    private static ArchCondition<JavaClass> avoidNonApplicationServiceDomainDependencies() {
        return new ArchCondition<>("depend on domain types only through root ApplicationService boundaries") {
            @Override
            public void check(JavaClass item, ConditionEvents events) {
                for (Dependency dependency : item.getDirectDependenciesFromSelf()) {
                    JavaClass target = dependency.getTargetClass();
                    String targetName = target.getName();
                    if (!targetName.startsWith("src.domain.")) {
                        continue;
                    }
                    if (targetName.matches("src\\.domain\\.[^.]+\\.[^.]+ApplicationService(\\$.*)?")) {
                        continue;
                    }
                    events.add(SimpleConditionEvent.violated(
                            item,
                            item.getName() + " depends on non-ApplicationService domain type " + targetName));
                }
            }
        };
    }
}
