package architecture.data.model;

import static com.tngtech.archunit.lang.syntax.ArchRuleDefinition.noClasses;

import architecture.AnalyzeMainClasses;
import com.tngtech.archunit.junit.ArchTest;
import com.tngtech.archunit.lang.ArchRule;

@AnalyzeMainClasses
public final class DataModelArchitectureTest {

    private DataModelArchitectureTest() {
    }

    @ArchTest
    static final ArchRule dataModelTypesMustStayIndependentFromDomainTypes =
            noClasses()
                    .that()
                    .resideInAPackage("src.data..model..")
                    .should()
                    .dependOnClassesThat()
                    .resideInAPackage("src.domain..");
}
