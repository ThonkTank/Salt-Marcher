package architecture.shell.layer;

import static com.tngtech.archunit.lang.syntax.ArchRuleDefinition.noClasses;

import architecture.AnalyzeMainClasses;
import com.tngtech.archunit.junit.ArchTest;
import com.tngtech.archunit.lang.ArchRule;

@AnalyzeMainClasses
public final class ShellLayerArchitectureTest {

    private ShellLayerArchitectureTest() {
    }

    @ArchTest
    static final ArchRule shellMustNotReachFeatureInteractorsDomainOrData =
            noClasses()
                    .that()
                    .resideInAPackage("shell..")
                    .should()
                    .dependOnClassesThat()
                    .resideInAnyPackage("src.view..", "src.domain..", "src.data..");

    @ArchTest
    static final ArchRule shellMustStayIndependentFromBootstrap =
            noClasses()
                    .that()
                    .resideInAPackage("shell..")
                    .should()
                    .dependOnClassesThat()
                    .resideInAPackage("bootstrap..");

    @ArchTest
    static final ArchRule nonBootstrapCodeMustNotReachShellHostInternals =
            noClasses()
                    .that()
                    .resideInAnyPackage("src..", "shell.api..")
                    .should()
                    .dependOnClassesThat()
                    .resideInAPackage("shell.host..");

    @ArchTest
    static final ArchRule shellApiMustStayIndependentFromHostAndFeatureLayers =
            noClasses()
                    .that()
                    .resideInAPackage("shell.api..")
                    .should()
                    .dependOnClassesThat()
                    .resideInAnyPackage("shell.host..", "bootstrap..", "src.view..", "src.domain..", "src.data..");

}
