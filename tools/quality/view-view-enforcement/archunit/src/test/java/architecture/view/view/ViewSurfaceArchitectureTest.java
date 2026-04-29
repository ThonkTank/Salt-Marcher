package architecture.view.view;

import static com.tngtech.archunit.lang.syntax.ArchRuleDefinition.noClasses;

import architecture.AnalyzeMainClasses;
import architecture.view.ViewRolePredicates;
import com.tngtech.archunit.junit.ArchTest;
import com.tngtech.archunit.lang.ArchRule;

@AnalyzeMainClasses
public final class ViewSurfaceArchitectureTest {

    private ViewSurfaceArchitectureTest() {
    }

    @ArchTest
    static final ArchRule passiveViewsMustNotReachShellDomainDataOrBootstrap =
            noClasses()
                    .that(ViewRolePredicates.arePassiveViews())
                    .should()
                    .dependOnClassesThat()
                    .resideInAnyPackage("shell..", "src.domain..", "src.data..", "bootstrap..");
}
