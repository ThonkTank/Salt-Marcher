package architecture.system;

import static com.tngtech.archunit.library.dependencies.SlicesRuleDefinition.slices;

import architecture.AnalyzeMainClasses;
import com.tngtech.archunit.core.domain.JavaClass;
import com.tngtech.archunit.junit.ArchTest;
import com.tngtech.archunit.lang.ArchRule;
import com.tngtech.archunit.library.dependencies.SliceAssignment;
import com.tngtech.archunit.library.dependencies.SliceIdentifier;

@AnalyzeMainClasses
public final class PackageCycleArchitectureTest {

    private static final SliceAssignment VIEW_COMPONENT_SLICE_ASSIGNMENT = new SliceAssignment() {
        @Override
        public SliceIdentifier getIdentifierOf(JavaClass javaClass) {
            String packageName = javaClass.getPackageName();
            if (!packageName.startsWith("src.view.")) {
                return SliceIdentifier.ignore();
            }
            String rootName = packageName.substring("src.view.".length());
            int nextDot = rootName.indexOf('.');
            if (nextDot >= 0) {
                rootName = rootName.substring(0, nextDot);
            }
            return SliceIdentifier.of(rootName);
        }

        @Override
        public String getDescription() {
            return "src.view target package, normally left-bar tabs, topbar, state, details, or reusable views";
        }
    };

    private PackageCycleArchitectureTest() {
    }

    @ArchTest
    static final ArchRule domainFeaturesMustBeCycleFree =
            slices().matching("src.domain.(*)..").should().beFreeOfCycles();

    @ArchTest
    static final ArchRule viewComponentsMustBeCycleFree =
            slices().assignedFrom(VIEW_COMPONENT_SLICE_ASSIGNMENT).should().beFreeOfCycles();

    @ArchTest
    static final ArchRule shellPackagesMustBeCycleFree =
            slices().matching("shell.(*)..").should().beFreeOfCycles();

}
