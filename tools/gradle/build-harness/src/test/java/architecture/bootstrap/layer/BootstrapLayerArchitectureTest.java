package architecture.bootstrap.layer;

import static com.tngtech.archunit.lang.syntax.ArchRuleDefinition.noClasses;

import architecture.AnalyzeMainClasses;
import com.tngtech.archunit.junit.ArchTest;
import com.tngtech.archunit.lang.ArchRule;

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
}
