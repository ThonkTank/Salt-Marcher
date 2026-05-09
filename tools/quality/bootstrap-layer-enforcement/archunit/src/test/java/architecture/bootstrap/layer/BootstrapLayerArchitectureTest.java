package architecture.bootstrap.layer;

import static com.tngtech.archunit.lang.syntax.ArchRuleDefinition.classes;
import static com.tngtech.archunit.lang.syntax.ArchRuleDefinition.noClasses;

import architecture.AnalyzeMainClasses;
import com.tngtech.archunit.core.domain.Dependency;
import com.tngtech.archunit.core.domain.JavaClass;
import com.tngtech.archunit.junit.ArchTest;
import com.tngtech.archunit.lang.ArchCondition;
import com.tngtech.archunit.lang.ArchRule;
import com.tngtech.archunit.lang.ConditionEvents;
import com.tngtech.archunit.lang.SimpleConditionEvent;

@AnalyzeMainClasses
public final class BootstrapLayerArchitectureTest {

    private BootstrapLayerArchitectureTest() {
    }

    @ArchTest
    static final ArchRule bootstrapMustStayOutsideFeatureCode =
            noClasses()
                    .that()
                    .resideInAPackage("bootstrap..")
                    .should()
                    .dependOnClassesThat()
                    .resideInAnyPackage("src.view..", "src.domain..", "src.data..");

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
