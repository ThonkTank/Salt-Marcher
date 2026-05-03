package architecture.view.contribution;

import static com.tngtech.archunit.lang.syntax.ArchRuleDefinition.classes;
import static com.tngtech.archunit.lang.syntax.ArchRuleDefinition.noClasses;

import architecture.AnalyzeMainClasses;
import com.tngtech.archunit.junit.ArchTest;
import com.tngtech.archunit.lang.ArchRule;

@AnalyzeMainClasses
public final class ViewContributionArchitectureTest {

    private ViewContributionArchitectureTest() {
    }

    @ArchTest
    static final ArchRule contributionsStayInActiveRoots =
            classes()
                    .that(ViewContributionPredicates.areContributions())
                    .should()
                    .resideInAnyPackage("src.view.leftbartabs..", "src.view.statetabs..", "src.view.dropdowns..");

    @ArchTest
    static final ArchRule contributionsMustNotReachDomainDataOrHost =
            noClasses()
                    .that(ViewContributionPredicates.areContributions())
                    .should()
                    .dependOnClassesThat()
                    .resideInAnyPackage("src.domain..", "src.data..", "shell.host..", "bootstrap..");
}
