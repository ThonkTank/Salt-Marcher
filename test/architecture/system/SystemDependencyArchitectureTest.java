package architecture.system;

import static com.tngtech.archunit.library.dependencies.SlicesRuleDefinition.slices;

import architecture.AnalyzeMainClasses;
import com.tngtech.archunit.junit.ArchTest;
import com.tngtech.archunit.lang.ArchRule;
@AnalyzeMainClasses
public final class SystemDependencyArchitectureTest {

    private SystemDependencyArchitectureTest() {
    }

    @ArchTest
    static final ArchRule domainFeaturesMustStayCycleFree =
            slices().matching("src.domain.(*)..").should().beFreeOfCycles();

    @ArchTest
    static final ArchRule domainSubpackagesMustStayCycleFree =
            slices().matching("src.domain.(*).(*)..").should().beFreeOfCycles();

}
