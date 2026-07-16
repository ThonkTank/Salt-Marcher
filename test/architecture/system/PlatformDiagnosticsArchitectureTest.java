package architecture.system;

import static com.tngtech.archunit.lang.syntax.ArchRuleDefinition.noClasses;
import static org.junit.jupiter.api.Assertions.assertFalse;

import architecture.AnalyzeMainClasses;
import com.tngtech.archunit.junit.ArchTest;
import com.tngtech.archunit.lang.ArchRule;
import java.lang.reflect.Method;
import java.util.Arrays;
import java.util.Map;
import org.junit.jupiter.api.Test;
import platform.diagnostics.Diagnostics;

@AnalyzeMainClasses
public final class PlatformDiagnosticsArchitectureTest {

    @ArchTest
    static final ArchRule diagnosticsRemainLocalAndMechanismFree =
            noClasses()
                    .that()
                    .resideInAPackage("platform.diagnostics..")
                    .should()
                    .dependOnClassesThat()
                    .resideInAnyPackage(
                            "java.net..",
                            "java.net.http..",
                            "java.sql..",
                            "java.io..",
                            "java.nio.file..",
                            "app..",
                            "shell..",
                            "features..");

    @Test
    void diagnosticsApiCannotAcceptFreeFormPayloadsOrThrowables() {
        for (Method method : Diagnostics.class.getDeclaredMethods()) {
            assertFalse(Arrays.stream(method.getParameterTypes()).anyMatch(type ->
                            type == String.class
                                    || type == Object.class
                                    || type == Map.class
                                    || Throwable.class.isAssignableFrom(type)),
                    () -> method + " must accept only stable diagnostic ids and failure types");
        }
    }
}
