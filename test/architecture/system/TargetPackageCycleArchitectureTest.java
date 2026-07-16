package architecture.system;

import static com.tngtech.archunit.library.dependencies.SlicesRuleDefinition.slices;

import architecture.AnalyzeMainClasses;
import com.tngtech.archunit.junit.ArchTest;
import com.tngtech.archunit.lang.ArchRule;

@AnalyzeMainClasses
public final class TargetPackageCycleArchitectureTest {

    private TargetPackageCycleArchitectureTest() {
    }

    @ArchTest
    static final ArchRule featuresMustBeCycleFree =
            slices().matching("features.(*)..").should().beFreeOfCycles().allowEmptyShould(true);

    @ArchTest
    static final ArchRule featureRolesMustBeCycleFree =
            slices().matching("features.(*).(*)..")
                    .should().beFreeOfCycles().allowEmptyShould(true);

    @ArchTest
    static final ArchRule featureRolePackagesMustBeCycleFree =
            slices().matching("features.(*).(*).(*)..")
                    .should().beFreeOfCycles().allowEmptyShould(true);

    @ArchTest
    static final ArchRule featureAdapterRolesMustBeCycleFree =
            slices().matching("features.(*).adapter.(*)..")
                    .should().beFreeOfCycles().allowEmptyShould(true);

    @ArchTest
    static final ArchRule featureAdapterRolePackagesMustBeCycleFree =
            slices().matching("features.(*).adapter.(*).(*)..")
                    .should().beFreeOfCycles().allowEmptyShould(true);

    @ArchTest
    static final ArchRule applicationPackagesMustBeCycleFree =
            slices().matching("app.(*)..").should().beFreeOfCycles().allowEmptyShould(true);

    @ArchTest
    static final ArchRule platformPackagesMustBeCycleFree =
            slices().matching("platform.(*)..").should().beFreeOfCycles().allowEmptyShould(true);

    @ArchTest
    static final ArchRule shellPackagesMustBeCycleFree =
            slices().matching("shell.(*)..").should().beFreeOfCycles();
}
