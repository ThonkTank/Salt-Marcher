package saltmarcher.quality.errorprone.domain;

import com.google.errorprone.CompilationTestHelper;
import org.junit.Test;
import org.junit.runner.RunWith;
import org.junit.runners.JUnit4;
import saltmarcher.quality.errorprone.DomainPublishedBoundarySignaturePurityChecker;
import saltmarcher.quality.errorprone.DomainPublicBoundarySignaturePurityChecker;

@RunWith(JUnit4.class)
public final class DomainBoundarySignaturePurityCheckersTest {

    @Test
    public void publicBoundarySignaturePurityIgnoresLookalikeOutsideSrcDomain() {
        CompilationTestHelper.newInstance(DomainPublicBoundarySignaturePurityChecker.class, getClass())
                .addSourceLines(
                        "src/notdomain/foo/FooApplicationService.java",
                        "package src.notdomain.foo;",
                        "import src.domain.bar.published.BarSnapshot;",
                        "public final class FooApplicationService {",
                        "  public BarSnapshot foreignSnapshot() {",
                        "    return null;",
                        "  }",
                        "}")
                .addSourceLines(
                        "src/domain/bar/published/BarSnapshot.java",
                        "package src.domain.bar.published;",
                        "public record BarSnapshot() { }")
                .doTest();
    }

    @Test
    public void publicBoundarySignaturePurityIgnoresRootNameInNonRootPackage() {
        CompilationTestHelper.newInstance(DomainPublicBoundarySignaturePurityChecker.class, getClass())
                .addSourceLines(
                        "src/domain/foo/application/FooApplicationService.java",
                        "package src.domain.foo.application;",
                        "import src.domain.bar.published.BarSnapshot;",
                        "public final class FooApplicationService {",
                        "  public BarSnapshot foreignSnapshot() {",
                        "    return null;",
                        "  }",
                        "}")
                .addSourceLines(
                        "src/domain/bar/published/BarSnapshot.java",
                        "package src.domain.bar.published;",
                        "public record BarSnapshot() { }")
                .doTest();
    }

    @Test
    public void publicBoundarySignaturePurityAllowsJdkValueAndContainerTypes() {
        CompilationTestHelper.newInstance(DomainPublicBoundarySignaturePurityChecker.class, getClass())
                .addSourceLines(
                        "src/domain/foo/FooApplicationService.java",
                        "package src.domain.foo;",
                        "import java.time.LocalDate;",
                        "import java.util.List;",
                        "import java.util.Map;",
                        "import java.util.Optional;",
                        "import java.util.Set;",
                        "import java.util.UUID;",
                        "public final class FooApplicationService {",
                        "  public List<UUID> ids() {",
                        "    return List.of();",
                        "  }",
                        "  public Optional<LocalDate> openedAt(Map<String, Set<UUID>> index) {",
                        "    return Optional.empty();",
                        "  }",
                        "}")
                .doTest();
    }

    @Test
    public void publishedSignaturePurityIgnoresNonPublicPublishedType() {
        CompilationTestHelper.newInstance(DomainPublishedBoundarySignaturePurityChecker.class, getClass())
                .addSourceLines(
                        "src/domain/foo/published/FooInternalSnapshot.java",
                        "package src.domain.foo.published;",
                        "import src.domain.foo.model.grid.model.GridState;",
                        "final class FooInternalSnapshot {",
                        "  public GridState state() {",
                        "    return null;",
                        "  }",
                        "}")
                .addSourceLines(
                        "src/domain/foo/model/grid/model/GridState.java",
                        "package src.domain.foo.model.grid.model;",
                        "public final class GridState { }")
                .doTest();
    }

    @Test
    public void publishedSignaturePurityAllowsJdkValueAndContainerTypes() {
        CompilationTestHelper.newInstance(DomainPublishedBoundarySignaturePurityChecker.class, getClass())
                .addSourceLines(
                        "src/domain/foo/published/FooSnapshot.java",
                        "package src.domain.foo.published;",
                        "import java.time.LocalDate;",
                        "import java.util.List;",
                        "import java.util.Map;",
                        "import java.util.Optional;",
                        "import java.util.Set;",
                        "import java.util.UUID;",
                        "public record FooSnapshot(",
                        "    UUID id,",
                        "    List<String> labels,",
                        "    Map<String, Set<LocalDate>> datesByLabel) {",
                        "  public Optional<UUID> selectedId() {",
                        "    return Optional.of(id);",
                        "  }",
                        "}")
                .doTest();
    }
}
