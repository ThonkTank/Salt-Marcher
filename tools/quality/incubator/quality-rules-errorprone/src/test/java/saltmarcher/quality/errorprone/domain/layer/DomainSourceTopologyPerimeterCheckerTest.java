package saltmarcher.quality.errorprone.domain.layer;

import com.google.errorprone.CompilationTestHelper;
import org.junit.Test;
import org.junit.runner.RunWith;
import org.junit.runners.JUnit4;
import saltmarcher.quality.errorprone.DomainSourceTopologyPerimeterChecker;

@RunWith(JUnit4.class)
public final class DomainSourceTopologyPerimeterCheckerTest {

    private final CompilationTestHelper compilationHelper = CompilationTestHelper.newInstance(
            DomainSourceTopologyPerimeterChecker.class,
            getClass());

    @Test
    public void allowsMatchingDomainSourceIdentity() {
        compilationHelper
                .addSourceLines(
                        "src/domain/foo/model/encounter/helper/EncounterHelper.java",
                        "package src.domain.foo.model.encounter.helper;",
                        "final class EncounterHelper { }")
                .doTest();
    }

    @Test
    public void rejectsPackagePathMismatch() {
        compilationHelper
                .addSourceLines(
                        "src/domain/foo/model/encounter/helper/EncounterHelper.java",
                        "// BUG: Diagnostic contains: package 'src.domain.foo.model.other.helper' must match path package 'src.domain.foo.model.encounter.helper'",
                        "package src.domain.foo.model.other.helper;",
                        "final class EncounterHelper { }")
                .doTest();
    }

    @Test
    public void rejectsTopLevelTypeAndFileNameMismatch() {
        compilationHelper
                .addSourceLines(
                        "src/domain/foo/FooSelectionApplicationService.java",
                        "package src.domain.foo;",
                        "// BUG: Diagnostic contains: file name 'FooSelectionApplicationService.java' must match top-level domain-layer type 'OtherApplicationService.java'",
                        "final class OtherApplicationService { }")
                .doTest();
    }

    @Test
    public void rejectsAdditionalTopLevelTypeAndFileNameMismatch() {
        compilationHelper
                .addSourceLines(
                        "src/domain/foo/FooSelectionApplicationService.java",
                        "package src.domain.foo;",
                        "final class FooSelectionApplicationService { }",
                        "// BUG: Diagnostic contains: file name 'FooSelectionApplicationService.java' must match top-level domain-layer type 'HiddenHelper.java'",
                        "final class HiddenHelper { }")
                .doTest();
    }
}
