package architecture.view.binder;

import static com.tngtech.archunit.lang.syntax.ArchRuleDefinition.noClasses;

import architecture.AnalyzeMainClasses;
import architecture.view.ViewRolePredicates;
import com.tngtech.archunit.junit.ArchTest;
import com.tngtech.archunit.lang.ArchRule;

@AnalyzeMainClasses
public final class ViewBinderArchitectureTest {

    private ViewBinderArchitectureTest() {
    }

    @ArchTest
    static final ArchRule bindersMustNotReachDataOrShellHost =
            noClasses()
                    .that(ViewRolePredicates.areBinders())
                    .should()
                    .dependOnClassesThat()
                    .resideInAnyPackage("src.data..", "shell.host..", "bootstrap..");
}
