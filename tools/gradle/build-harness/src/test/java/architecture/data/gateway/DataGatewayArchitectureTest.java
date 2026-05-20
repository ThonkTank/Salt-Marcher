package architecture.data.gateway;

import static com.tngtech.archunit.lang.syntax.ArchRuleDefinition.noClasses;

import architecture.AnalyzeMainClasses;
import com.tngtech.archunit.junit.ArchTest;
import com.tngtech.archunit.lang.ArchRule;

@AnalyzeMainClasses
public final class DataGatewayArchitectureTest {

    private DataGatewayArchitectureTest() {
    }

    @ArchTest
    static final ArchRule dataGatewaysMustStayIndependentFromDomainTypes =
            noClasses()
                    .that()
                    .resideInAPackage("src.data..gateway..")
                    .should()
                    .dependOnClassesThat()
                    .resideInAPackage("src.domain..")
                    .allowEmptyShould(true);
}
