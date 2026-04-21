package architecture;

import com.tngtech.archunit.core.domain.JavaClass;
import com.tngtech.archunit.core.domain.JavaClasses;
import com.tngtech.archunit.junit.ArchTest;
import java.util.Set;
import java.util.TreeSet;

@AnalyzeMainClasses
public final class ArchitectureImportSmokeTest {

    private static final Set<String> REQUIRED_ARCHITECTURE_ROOTS =
            Set.of("bootstrap", "shell", "src.domain", "src.view", "src.data");

    private ArchitectureImportSmokeTest() {
    }

    @ArchTest
    static void productionImportMustCoverArchitectureRoots(JavaClasses classes) {
        Set<String> importedRoots = importedArchitectureRoots(classes);
        Set<String> missingRoots = new TreeSet<>(REQUIRED_ARCHITECTURE_ROOTS);
        missingRoots.removeAll(importedRoots);
        if (!missingRoots.isEmpty()) {
            throw new AssertionError("architectureTest imported " + classes.size()
                    + " production classes but missed architecture roots: "
                    + String.join(", ", missingRoots));
        }
    }

    private static Set<String> importedArchitectureRoots(JavaClasses classes) {
        Set<String> result = new TreeSet<>();
        for (JavaClass javaClass : classes) {
            String packageName = javaClass.getPackageName();
            for (String root : REQUIRED_ARCHITECTURE_ROOTS) {
                if (packageName.equals(root) || packageName.startsWith(root + ".")) {
                    result.add(root);
                }
            }
        }
        return result;
    }
}
