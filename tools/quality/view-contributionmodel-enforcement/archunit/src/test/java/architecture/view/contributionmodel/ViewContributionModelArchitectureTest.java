package architecture.view.contributionmodel;

import static com.tngtech.archunit.lang.syntax.ArchRuleDefinition.noClasses;

import architecture.AnalyzeMainClasses;
import architecture.view.ViewRolePredicates;
import com.tngtech.archunit.junit.ArchTest;
import com.tngtech.archunit.lang.ArchRule;

@AnalyzeMainClasses
public final class ViewContributionModelArchitectureTest {

    private ViewContributionModelArchitectureTest() {
    }

    @ArchTest
    static final ArchRule contributionModelsMustStayShellDataAndServiceFree =
            noClasses()
                    .that(ViewRolePredicates.areContributionModels())
                    .should()
                    .dependOnClassesThat()
                    .resideInAnyPackage("shell..", "src.data..", "bootstrap..");

    @ArchTest
    static final ArchRule contributionModelsMustNotDependOnApplicationServices =
            noClasses()
                    .that(ViewRolePredicates.areContributionModels())
                    .should()
                    .dependOnClassesThat()
                    .haveSimpleNameEndingWith("ApplicationService");
}
