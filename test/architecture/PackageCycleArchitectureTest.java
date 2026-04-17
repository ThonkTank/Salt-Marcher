package architecture;

import static com.tngtech.archunit.library.dependencies.SlicesRuleDefinition.slices;

import com.tngtech.archunit.junit.AnalyzeClasses;
import com.tngtech.archunit.junit.ArchTest;
import com.tngtech.archunit.junit.CacheMode;
import com.tngtech.archunit.lang.ArchRule;
import com.tngtech.archunit.core.importer.ImportOption;

@AnalyzeClasses(
        packages = {"src.domain", "src.view", "src.data", "shell"},
        importOptions = {
                ImportOption.DoNotIncludeTests.class,
                ImportOption.DoNotIncludeJars.class
        },
        cacheMode = CacheMode.PER_CLASS)
public final class PackageCycleArchitectureTest {

    private PackageCycleArchitectureTest() {
    }

    @ArchTest
    static final ArchRule domainFeaturesMustBeCycleFree =
            slices().matching("src.domain.(*)..").should().beFreeOfCycles();

    @ArchTest
    static final ArchRule viewComponentsMustBeCycleFree =
            slices().matching("src.view.(*)..").should().beFreeOfCycles();

    @ArchTest
    static final ArchRule dataFeaturesMustBeCycleFree =
            slices().matching("src.data.(*)..").should().beFreeOfCycles();

    @ArchTest
    static final ArchRule shellPackagesMustBeCycleFree =
            slices().matching("shell.(*)..").should().beFreeOfCycles();
}
