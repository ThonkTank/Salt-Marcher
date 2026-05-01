package architecture.bootstrap.appbootstrap;

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
public final class AppBootstrapArchitectureTest {

    private AppBootstrapArchitectureTest() {
    }

    @ArchTest
    static final ArchRule bootstrapMustOnlyUseAppShellFromShellHost =
            classes()
                    .that()
                    .resideInAPackage("bootstrap..")
                    .should(onlyDependOnAppShellFromShellHost());

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
