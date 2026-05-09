package saltmarcher.quality.errorprone.domain.published;

import com.google.errorprone.CompilationTestHelper;
import org.junit.Test;
import org.junit.runner.RunWith;
import org.junit.runners.JUnit4;
import saltmarcher.quality.errorprone.DomainPublishedOwnershipBoundaryChecker;

@RunWith(JUnit4.class)
public final class DomainPublishedOwnershipBoundaryCheckerTest {

    private final CompilationTestHelper compilationHelper = CompilationTestHelper.newInstance(
            DomainPublishedOwnershipBoundaryChecker.class,
            getClass());

    @Test
    public void allowsApplicationServiceCommandInput() {
        compilationHelper
                .addSourceLines(
                        "src/domain/foo/FooSelectionApplicationService.java",
                        "package src.domain.foo;",
                        "import src.domain.foo.published.ApplySelectionCommand;",
                        "public final class FooSelectionApplicationService {",
                        "  public void apply(ApplySelectionCommand command) { }",
                        "}")
                .addSourceLines(
                        "src/domain/foo/published/ApplySelectionCommand.java",
                        "package src.domain.foo.published;",
                        "public record ApplySelectionCommand() { }")
                .doTest();
    }

    @Test
    public void rejectsPublisherTopLevelOutsidePublished() {
        compilationHelper
                .addSourceLines(
                        "src/domain/foo/FooPublishedStatePublisher.java",
                        "package src.domain.foo;",
                        "// BUG: Diagnostic contains: top-level publisher role FooPublishedStatePublisher",
                        "public final class FooPublishedStatePublisher { }")
                .doTest();
    }

    @Test
    public void rejectsPublicReturnOfSameContextPublishedType() {
        compilationHelper
                .addSourceLines(
                        "src/domain/foo/application/LoadGridUseCase.java",
                        "package src.domain.foo.application;",
                        "import src.domain.foo.published.GridModel;",
                        "// BUG: Diagnostic contains: public/protected method load returns same-context published type src.domain.foo.published.GridModel",
                        "public final class LoadGridUseCase {",
                        "  public GridModel load() {",
                        "    return null;",
                        "  }",
                        "}")
                .addSourceLines(
                        "src/domain/foo/published/GridModel.java",
                        "package src.domain.foo.published;",
                        "public interface GridModel { }")
                .doTest();
    }
}
